#!/usr/bin/env node
// Pull top eBay products (Buy Browse API · item_summary/search, default Best
// Match ranking) and write a JSON cache the "Best Sellers" eBay tab reads.
// eBay's true best-seller feed (Marketing API getMerchandisedProducts) needs a
// separate Buy-API grant most accounts don't have, so this uses Browse search —
// top/popular items, not a strict sales chart. Keeps the previous good cache if
// the call fails or is empty.
//
//   node scripts/fetch-ebay.mjs [--category=293] [--query=laptop] [--limit=30]
//   node scripts/fetch-ebay.mjs --categories [--limit=15]   # multi-category tabs
//
// Env (.env.local):
//   EBAY_CLIENT_ID       eBay App ID  (Client ID)        [required]
//   EBAY_CLIENT_SECRET   eBay Cert ID (Client Secret)    [required]
//   EBAY_CATEGORY_ID     category id (default 293 = Consumer Electronics)
//   EBAY_QUERY           optional keyword to narrow the category
//   EBAY_MARKETPLACE_ID  default EBAY_US
//   EBAY_EPN_CAMPAIGN_ID optional EPN campaign id → affiliate item links
//   EBAY_ENV             production (default) | sandbox
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
for (const line of (existsSync(join(ROOT, '.env.local')) ? readFileSync(join(ROOT, '.env.local'), 'utf8') : '').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1]) ?? d;
const hasFlag = (k) => process.argv.includes(`--${k}`);
const CLIENT_ID = process.env.EBAY_CLIENT_ID;
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const CATEGORY = arg('category', process.env.EBAY_CATEGORY_ID || '293');
const QUERY = arg('query', process.env.EBAY_QUERY || '');
const MARKETPLACE = process.env.EBAY_MARKETPLACE_ID || 'EBAY_US';
const CAMPAIGN = process.env.EBAY_EPN_CAMPAIGN_ID || '';
const LIMIT = parseInt(arg('limit', process.env.BESTSELLERS_LIMIT || '30'), 10);
const USE_CATEGORIES = hasFlag('categories') || process.env.EBAY_BESTSELLERS_BY_CATEGORY === 'true';
const SANDBOX = (process.env.EBAY_ENV || 'production').toLowerCase() === 'sandbox';
const HOST = SANDBOX ? 'api.sandbox.ebay.com' : 'api.ebay.com';
const OUT = join(ROOT, 'data', 'best-sellers-ebay.json');

// Mirrors the Amazon best-seller categories. Keyword-driven (no fixed eBay
// leaf-category IDs) so it stays resilient across marketplaces; a category is
// simply skipped if it returns nothing.
const CATEGORY_CONFIG = [
  { key: 'smart-phones', label: 'Smart Phones', query: 'unlocked smartphone' },
  { key: 'laptops', label: 'Laptops', query: 'laptop computer' },
  { key: 'tablets', label: 'Tablets', query: 'tablet' },
  { key: 'smartwatches', label: 'Smartwatches', query: 'smart watch' },
  { key: 'headphones', label: 'Headphones', query: 'wireless headphones earbuds' },
  { key: 'smart-tvs', label: 'Smart TVs', query: 'smart tv 4k' },
  { key: 'smart-home', label: 'Smart Home', query: 'smart home device' },
  { key: 'smart-electronics', label: 'Smart Electronics', query: 'smart electronics gadget' },
];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('EBAY_CLIENT_ID / EBAY_CLIENT_SECRET not set in .env.local — aborting (cache untouched).');
  process.exit(1);
}

function num(v) { const n = parseFloat(String(v ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : null; }

function money(price) {
  if (!price) return null;
  const v = num(price.value);
  if (v === null) return null;
  const cur = price.currency || 'USD';
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(v); }
  catch { return `${cur} ${v}`; }
}

async function token() {
  const res = await fetch(`https://${HOST}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
    },
    body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
  });
  if (!res.ok) throw new Error(`oauth HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  return (await res.json()).access_token;
}

function headersFor(access) {
  const headers = {
    Authorization: `Bearer ${access}`,
    'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE,
    Accept: 'application/json',
  };
  if (CAMPAIGN) headers['X-EBAY-C-ENDUSERCTX'] = `affiliateCampaignId=${CAMPAIGN}`;
  return headers;
}

async function search(access, { categoryId, query, limit }) {
  const qs = new URLSearchParams({ limit: String(Math.min(limit, 200)), filter: 'buyingOptions:{FIXED_PRICE}' });
  if (categoryId) qs.set('category_ids', categoryId);
  if (query) qs.set('q', query);
  const res = await fetch(`https://${HOST}/buy/browse/v1/item_summary/search?${qs}`, { headers: headersFor(access) });
  if (!res.ok) throw new Error(`browse search HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  return (await res.json())?.itemSummaries || [];
}

function mapItem(p, i, category) {
  return {
    rank: i + 1,
    id: p.itemId || p.legacyItemId || '',
    marketplace: 'ebay',
    category: category?.key ?? null,
    categoryLabel: category?.label ?? null,
    title: p.title || '',
    price: money(p.price),
    priceValue: num(p.price?.value),
    image: p.image?.imageUrl || p.thumbnailImages?.[0]?.imageUrl || '',
    rating: null,
    ratingCount: null,
    url: p.itemAffiliateWebUrl || p.itemWebUrl || '',
  };
}

async function main() {
  const access = await token();

  if (USE_CATEGORIES) {
    const all = [];
    let ok = 0;
    for (const cat of CATEGORY_CONFIG) {
      try {
        const raw = await search(access, { query: cat.query, limit: LIMIT });
        const items = raw.slice(0, LIMIT).map((p, i) => mapItem(p, i, cat)).filter((x) => x.title && x.image && x.url);
        if (items.length) { all.push(...items); ok += 1; console.log(`  ${cat.label}: ${items.length}`); }
        else console.log(`  ${cat.label}: 0 (skipped)`);
      } catch (e) {
        console.error(`  ${cat.label} failed: ${e.message}`);
      }
    }
    if (!all.length) throw new Error('eBay returned 0 usable items across categories (cache left as-is).');
    writeFileSync(OUT, JSON.stringify({
      marketplace: 'ebay',
      category: 'multiple',
      categories: CATEGORY_CONFIG.map((c) => ({ key: c.key, label: c.label })),
      capturedAt: new Date().toISOString(),
      items: all,
    }, null, 2));
    console.log(`Wrote ${all.length} eBay items across ${ok} categor(ies) -> ${OUT}`);
    return;
  }

  // Single-category mode (backwards compatible).
  const raw = await search(access, { categoryId: CATEGORY, query: QUERY, limit: LIMIT });
  const items = raw.slice(0, LIMIT).map((p, i) => mapItem(p, i, null)).filter((x) => x.title && x.image && x.url);
  if (!items.length) throw new Error('eBay returned 0 usable items (cache left as-is).');
  writeFileSync(OUT, JSON.stringify({ marketplace: 'ebay', category: CATEGORY, query: QUERY || null, capturedAt: new Date().toISOString(), items }, null, 2));
  console.log(`Wrote ${items.length} eBay items (cat ${CATEGORY}${QUERY ? `, q="${QUERY}"` : ''}) -> ${OUT}`);
}

main().catch((e) => { console.error('fetch-ebay failed:', e.message); process.exit(1); });
