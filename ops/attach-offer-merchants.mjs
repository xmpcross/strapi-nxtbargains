#!/usr/bin/env node
/**
 * Attach the commerce-merchant relation to migrated nxt.bargains offers.
 *
 * The Supabase migration wrote `seller_name` into the offer title and dropped
 * `marketplace` entirely, leaving `offer.merchant` unset. The frontend derives
 * store names, logos, merchant filtering and the /stores/<slug> pages from that
 * relation (lib/commerce.ts), so after the Strapi cutover every /stores/* URL
 * returned 404 — they had been 200 on Supabase.
 *
 * Mapping is by the source `marketplace` value, matched back to the Strapi
 * offer through productUrl.
 *
 * `marketplace_store` and `official_store` are deliberately left unset. They
 * are not merchants: they are the Google Shopping placeholder sellers, and
 * 510 + 12 of the source rows carry them. Inventing a store page for
 * "Marketplace Store" would put a fake retailer in the navigation.
 *
 * Usage:
 *   node ops/attach-offer-merchants.mjs --dry-run
 *   node ops/attach-offer-merchants.mjs
 */
const DRY = process.argv.includes('--dry-run');

const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
const B = (process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL || '').replace(/\/$/, '');
const T = process.env.STRAPI_API_TOKEN || '';
if (!SB || !SK || !B || !T) { console.error('Missing SUPABASE_URL/key or STRAPI_INTERNAL_URL/token'); process.exit(1); }

/** source `marketplace` -> commerce-merchant slug. Absent = no real merchant. */
const MERCHANT_MAP = {
  amazon: 'amazon', amazon_us: 'amazon', amazon_au: 'amazon',
  ebay: 'ebay', ebay_au: 'ebay',
  bestbuy: 'best-buy', best_buy: 'best-buy',
  walmart: 'walmart', target: 'target', newegg: 'newegg',
  apple_store: 'apple', google_store: 'google-store',
  aliexpress: 'aliexpress', stylevana: 'stylevana',
};

async function api(path, init) {
  const res = await fetch(`${B}/api/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`strapi ${res.status} ${path}: ${body.slice(0, 160)}`);
  return body ? JSON.parse(body) : null;
}

async function sbAll(path, pageSize = 1000) {
  const out = [];
  for (let from = 0; ; from += pageSize) {
    const res = await fetch(`${SB}/rest/v1/${path}`, {
      headers: { apikey: SK, Authorization: `Bearer ${SK}`, Range: `${from}-${from + pageSize - 1}` },
    });
    if (!res.ok) throw new Error(`supabase ${res.status}`);
    const rows = await res.json();
    out.push(...rows);
    if (rows.length < pageSize) return out;
  }
}

async function allPages(path, onRow) {
  for (let page = 1; ; page += 1) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await api(`${path}${sep}pagination[page]=${page}&pagination[pageSize]=200`);
    for (const row of r.data ?? []) onRow(row);
    if (page >= r.meta.pagination.pageCount) return;
  }
}

const merchantBySlug = new Map();
await allPages('commerce-merchants?fields[0]=slug', (row) => {
  const a = row.attributes ?? row;
  merchantBySlug.set(a.slug, row.documentId ?? a.documentId);
});
console.log(`  merchants in strapi : ${merchantBySlug.size}`);

const src = await sbAll('marketplace_products?select=product_url,marketplace&is_available=eq.true');
const marketByUrl = new Map(src.map((r) => [r.product_url, r.marketplace]));
console.log(`  source offers       : ${src.length}`);

const offers = [];
await allPages('commerce-offers?filters[source][$eq]=supabase-migration&fields[0]=productUrl&populate[merchant][fields][0]=slug', (row) => {
  const a = row.attributes ?? row;
  const m = a.merchant?.data ?? a.merchant;
  offers.push({ doc: row.documentId ?? a.documentId, url: a.productUrl, has: Boolean(m) });
});
console.log(`  migrated offers     : ${offers.length}`);

const todo = [];
const skipped = new Map();
for (const o of offers) {
  if (o.has) continue;
  const market = marketByUrl.get(o.url);
  const slug = MERCHANT_MAP[market];
  const doc = slug && merchantBySlug.get(slug);
  if (doc) todo.push({ ...o, doc2: doc, slug });
  else skipped.set(market ?? '(unmatched url)', (skipped.get(market ?? '(unmatched url)') ?? 0) + 1);
}
console.log(`  to relate           : ${todo.length}`);
console.log('\n  left unset (not real merchants / no strapi record):');
for (const [k, n] of [...skipped].sort((a, b) => b[1] - a[1])) console.log(`    ${String(k).padEnd(24)} ${n}`);

const byMerchant = new Map();
for (const t of todo) byMerchant.set(t.slug, (byMerchant.get(t.slug) ?? 0) + 1);
console.log('\n  will relate:');
for (const [k, n] of [...byMerchant].sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(24)} ${n}`);

if (DRY) { console.log('\n  [dry-run] nothing written'); process.exit(0); }

let idx = 0, done = 0;
const errors = [];
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let i = idx++; i < todo.length; i = idx++) {
    const t = todo[i];
    try {
      await api(`commerce-offers/${t.doc}`, { method: 'PUT', body: JSON.stringify({ data: { merchant: t.doc2 } }) });
    } catch (e) { errors.push(`${t.doc}: ${String(e).slice(0, 100)}`); }
    if (++done % 200 === 0) console.log(`    …${done}/${todo.length}`);
  }
}));

// Verify from the API rather than trusting the loop.
let verified = 0;
await allPages('commerce-offers?filters[source][$eq]=supabase-migration&fields[0]=productUrl&populate[merchant][fields][0]=slug', (row) => {
  const a = row.attributes ?? row;
  if (a.merchant?.data ?? a.merchant) verified += 1;
});
console.log(`\n  failed              : ${errors.length}`);
console.log(`  VERIFIED with merchant: ${verified} / ${offers.length}`);
for (const e of errors.slice(0, 5)) console.log(`     ${e}`);
