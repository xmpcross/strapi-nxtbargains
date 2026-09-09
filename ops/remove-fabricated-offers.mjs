#!/usr/bin/env node
/**
 * Delete the fabricated offers from the shared Strapi commerce types.
 *
 * A generator once wrote a fixed set of "offers" per product by templating the
 * product's own slug into a merchant URL, and priced them by nudging one real
 * price a few percent either way. They are not listings that went stale — the
 * pages they point at never existed:
 *
 *   https://www.walmart.com/dp/google-pixel-9-128gb     Walmart uses /ip/
 *   https://www.bestbuy.com/dp/google-pixel-9-128gb     Best Buy has no /dp/
 *   https://www.target.com/dp/google-pixel-9-128gb      Target uses /p/
 *   https://www.amazon.com/dp/google-pixel-9-128gb      /dp/ takes an ASIN
 *   https://www.amazon_us.com/dp/lg-c5-oled-55-inch     not a resolvable domain
 *   https://www.official_store.com/dp/lg-g6-oled-55-inch          "
 *
 * Three signatures, each decidable from the URL alone:
 *
 *   invalid-hostname       an underscore, which is not legal in a hostname
 *   dp-path-on-non-amazon  only Amazon uses /dp/
 *   amazon-dp-not-asin     Amazon's /dp/ segment is a 10-char ASIN, and these
 *                          hold the product slug instead
 *
 * The Amazon host test must be a suffix match on the registrable domain —
 * matching "amazon." at the start of the hostname misses www.amazon.com, which
 * would send 275 genuine Amazon listings to the delete list.
 *
 * Snapshots first: they hang off the offer, and Strapi does not cascade, so
 * deleting the offer first would strand them (see remove-uncomparable-products).
 *
 * Everything deleted is written to /opt/backups/nxt-bargains first.
 *
 * Usage:
 *   node ops/remove-fabricated-offers.mjs --dry-run
 *   node ops/remove-fabricated-offers.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const ARGS = process.argv.slice(2);
const DRY = ARGS.includes('--dry-run');
const BACKUP_DIR = '/opt/backups/nxt-bargains';

const B = (process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL || '').replace(/\/$/, '');
const T = process.env.STRAPI_API_TOKEN || '';
if (!B || !T) { console.error('Missing STRAPI_INTERNAL_URL / STRAPI_API_TOKEN'); process.exit(1); }

/** Deletes contend in Strapi; a 5xx here is transient, so retry with backoff. */
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
    throw new Error(`strapi ${res.status} ${path}: ${body.slice(0, 160)}`);
  }
  return body ? JSON.parse(body) : null;
}

async function allPages(path, onRow) {
  for (let page = 1; ; page += 1) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await api(`${path}${sep}pagination[page]=${page}&pagination[pageSize]=500`);
    for (const row of r.data ?? []) onRow(row);
    if (page >= r.meta.pagination.pageCount) return;
  }
}

async function pool(items, fn, size = 3) {
  let i = 0, done = 0;
  const errors = [];
  await Promise.all(Array.from({ length: size }, async () => {
    for (let k = i++; k < items.length; k = i++) {
      try { await fn(items[k]); } catch (e) { errors.push(String(e).slice(0, 120)); }
      if (++done % 250 === 0) console.log(`    …${done}/${items.length}`);
    }
  }));
  return errors;
}

const ASIN = /^[A-Z0-9]{10}$/;
const AMAZON_HOST = /(?:^|\.)amazon\.[a-z.]+$/;

/** Why this offer is fabricated, or null when it looks like a real listing. */
export function fabricationReason(productUrl) {
  let parsed;
  try { parsed = new URL(productUrl); } catch { return null; }
  const host = parsed.hostname.toLowerCase();
  if (host.includes('_')) return 'invalid-hostname';

  const segments = parsed.pathname.split('/').filter(Boolean);
  const dp = segments.indexOf('dp');
  if (dp === -1) return null;

  const tail = segments[dp + 1] ?? '';
  if (!AMAZON_HOST.test(host)) return 'dp-path-on-non-amazon';
  return ASIN.test(tail) ? null : 'amazon-dp-not-asin';
}

const offers = [];
await allPages(
  'commerce-offers?fields[0]=title&fields[1]=price&fields[2]=originalPrice&fields[3]=currency'
  + '&fields[4]=productUrl&fields[5]=affiliateUrl&fields[6]=status&fields[7]=availability'
  + '&fields[8]=condition&fields[9]=discountPercent&fields[10]=source&fields[11]=linkStatusCode'
  + '&populate[product][fields][0]=slug&populate[merchant][fields][0]=name',
  (row) => offers.push(row),
);
console.log(`  offers                   : ${offers.length}`);

const doomed = [];
const reasons = new Map();
for (const o of offers) {
  const reason = fabricationReason(o.productUrl ?? '');
  if (!reason) continue;
  doomed.push(o);
  reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
}
const doomedDocs = new Set(doomed.map((o) => o.documentId));
console.log(`  fabricated               : ${doomed.length}`);
for (const [r, n] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`    ${r.padEnd(24)} ${n}`);
console.log(`  real offers kept         : ${offers.length - doomed.length}`);

// Snapshots hang off the offer, and Strapi does not cascade.
const snapshots = [];
await allPages('commerce-price-snapshots?fields[0]=checkedAt&populate[offer][fields][0]=documentId', (row) => {
  const offerDoc = row.offer?.documentId;
  if (offerDoc && doomedDocs.has(offerDoc)) snapshots.push(row.documentId);
});
console.log(`  their price snapshots    : ${snapshots.length}`);

if (DRY) {
  const byHost = new Map();
  for (const o of doomed) {
    const h = (() => { try { return new URL(o.productUrl).hostname; } catch { return '(unparseable)'; } })();
    byHost.set(h, (byHost.get(h) ?? 0) + 1);
  }
  console.log('\n  by host:');
  for (const [h, n] of [...byHost].sort((a, b) => b[1] - a[1])) console.log(`    ${String(h).padEnd(26)} ${n}`);
  console.log('\n  [dry-run] nothing deleted');
  process.exit(0);
}

mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = `${BACKUP_DIR}/fabricated-offers-${stamp}.json`;
writeFileSync(backup, JSON.stringify({ offers: doomed, snapshotDocumentIds: snapshots }, null, 1));
console.log(`\n  backup: ${backup}`);

console.log('\n  deleting snapshots…');
let errs = await pool(snapshots, (d) => api(`commerce-price-snapshots/${d}`, { method: 'DELETE' }));
console.log(`    failed: ${errs.length}`);

console.log('  deleting offers…');
errs = errs.concat(await pool(doomed.map((o) => o.documentId), (d) => api(`commerce-offers/${d}`, { method: 'DELETE' })));
console.log(`    failed: ${errs.length}`);

// Verify against the API rather than the loop counter.
let remaining = 0;
await allPages('commerce-offers?fields[0]=productUrl', (row) => {
  if (fabricationReason(row.productUrl ?? '')) remaining += 1;
});
console.log(`\n  fabricated offers remaining: ${remaining}`);
for (const e of errs.slice(0, 5)) console.log(`   ${e}`);
