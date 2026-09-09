#!/usr/bin/env node
/**
 * Remove nxt.bargains products that cannot do the one thing their page exists
 * to do: compare prices.
 *
 * A product with a single offer renders a "compare prices across trusted
 * merchants" page showing one price, and a product with none renders
 * placeholders where the prices should be. Neither is worth indexing, and the
 * AdSense review flagged exactly this shape.
 *
 * Deletes, in order, because Strapi does NOT cascade these relations — deleting
 * a product on its own leaves its offers behind pointing at nothing, which is
 * what happened when the imageless products were removed:
 *   1. price snapshots belonging to the product's offers
 *   2. the offers
 *   3. the product
 *
 * Everything is written to /opt/backups/nxt-bargains first.
 *
 * Usage:
 *   node ops/remove-uncomparable-products.mjs --dry-run
 *   node ops/remove-uncomparable-products.mjs --max-offers=1
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const ARGS = process.argv.slice(2);
const DRY = ARGS.includes('--dry-run');
const MAX_OFFERS = Number((ARGS.find((a) => a.startsWith('--max-offers=')) || '--max-offers=1').split('=')[1]);
const SITE_TAG = 'nxt-bargains';
const BACKUP_DIR = '/opt/backups/nxt-bargains';

const B = (process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL || '').replace(/\/$/, '');
const T = process.env.STRAPI_API_TOKEN || '';
if (!B || !T) { console.error('Missing STRAPI_INTERNAL_URL / STRAPI_API_TOKEN'); process.exit(1); }

/** Relation writes and deletes contend in Strapi; a 5xx here is transient. */
async function api(path, init, attempt = 0) {
  const res = await fetch(`${B}/api/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const body = await res.text();
  if (!res.ok) {
    if (res.status >= 500 && attempt < 4) {
      await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
      return api(path, init, attempt + 1);
    }
    throw new Error(`strapi ${res.status} ${path}: ${body.slice(0, 140)}`);
  }
  return body ? JSON.parse(body) : null;
}

async function allPages(path, onRow) {
  for (let page = 1; ; page += 1) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await api(`${path}${sep}pagination[page]=${page}&pagination[pageSize]=200`);
    for (const row of r.data ?? []) onRow(row);
    if (page >= r.meta.pagination.pageCount) return;
  }
}

async function pool(items, worker, concurrency = 3) {
  let idx = 0, done = 0;
  const errors = [];
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (let i = idx++; i < items.length; i = idx++) {
      try { await worker(items[i]); } catch (e) { errors.push(String(e).slice(0, 140)); }
      if (++done % 200 === 0) console.log(`      …${done}/${items.length}`);
    }
  }));
  return errors;
}

// --- find the targets --------------------------------------------------------
const products = [];
await allPages(
  `commerce-products?filters[tags][$containsi]=${SITE_TAG}&fields[0]=slug&fields[1]=name&populate[offers][fields][0]=documentId&populate[categories][fields][0]=slug`,
  (row) => {
    const a = row.attributes ?? row;
    products.push({
      doc: row.documentId ?? a.documentId,
      slug: a.slug,
      name: a.name,
      category: (a.categories ?? [])[0]?.slug ?? null,
      offers: (a.offers ?? []).map((o) => o.documentId ?? o.id),
    });
  },
);
const targets = products.filter((p) => p.offers.length <= MAX_OFFERS);
console.log(`  products                 : ${products.length}`);
console.log(`  with <= ${MAX_OFFERS} offer(s)         : ${targets.length}`);
console.log(`  remaining after removal  : ${products.length - targets.length}`);

const offerDocs = targets.flatMap((p) => p.offers);
console.log(`  offers to delete         : ${offerDocs.length}`);

// snapshots hang off the offers, not the product
const offerSet = new Set(offerDocs);
const snapDocs = [];
await allPages('commerce-price-snapshots?fields[0]=checkedAt&populate[offer][fields][0]=documentId', (row) => {
  const a = row.attributes ?? row;
  const off = a.offer?.data?.documentId ?? a.offer?.documentId;
  if (off && offerSet.has(off)) snapDocs.push(row.documentId ?? a.documentId);
});
console.log(`  snapshots to delete      : ${snapDocs.length}`);

const byCat = new Map();
for (const t of targets) byCat.set(t.category, (byCat.get(t.category) ?? 0) + 1);
console.log('\n  removed from:');
for (const [k, n] of [...byCat].sort((a, b) => b[1] - a[1])) console.log(`    ${String(k).padEnd(24)} ${n}`);

if (DRY) { console.log('\n  [dry-run] nothing deleted'); process.exit(0); }

mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
const file = `${BACKUP_DIR}/removed-single-offer-products-${stamp}.json`;
writeFileSync(file, JSON.stringify({ products: targets, offerDocs, snapDocs }, null, 1));
console.log(`\n  backup: ${file}`);

console.log('\n  deleting snapshots…');
let errs = await pool(snapDocs, (d) => api(`commerce-price-snapshots/${d}`, { method: 'DELETE' }));
console.log(`    failed: ${errs.length}`);

console.log('  deleting offers…');
errs = await pool(offerDocs, (d) => api(`commerce-offers/${d}`, { method: 'DELETE' }));
console.log(`    failed: ${errs.length}`);

console.log('  deleting products…');
errs = await pool(targets.map((t) => t.doc), (d) => api(`commerce-products/${d}`, { method: 'DELETE' }));
console.log(`    failed: ${errs.length}`);

// Verify against the API rather than the loop counters.
let left = 0;
await allPages(`commerce-products?filters[tags][$containsi]=${SITE_TAG}&fields[0]=slug&populate[offers][fields][0]=documentId`, (row) => {
  const a = row.attributes ?? row;
  if ((a.offers ?? []).length <= MAX_OFFERS) left += 1;
});
console.log(`\n  VERIFIED products still <= ${MAX_OFFERS} offer: ${left}`);
