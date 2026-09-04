#!/usr/bin/env node
// Rebuild data/best-sellers.json from DataForSEO's Amazon product search.
//
//   node scripts/fetch-amazon-best-sellers-dataforseo.mjs            # dry run
//   node scripts/fetch-amazon-best-sellers-dataforseo.mjs --write
//   node scripts/fetch-amazon-best-sellers-dataforseo.mjs --write --category=laptops
//
// Replaces the amazon-product-info2 RapidAPI feed, whose last capture was
// 25 July 2026 and which no longer returns data.
//
// Env (.env.local):
//   DATAFORSEO_PASSWORD  the pre-encoded Basic token, NOT a password. It is
//                        base64("login:password"); passing it via curl -u or
//                        as a password field returns 40100. Named misleadingly
//                        in the env file, so this is worth stating twice.
//   NEXT_PUBLIC_AMAZON_AFFILIATE_TAG (or AMAZON_AFFILIATE_TAG) appended to /dp/ links.
//
// Why this endpoint and not a best-sellers one: DataForSEO has no best-sellers
// endpoint — merchant/amazon/best_sellers and dataforseo_labs/amazon/products
// both 404. What merchant/amazon/products does return, per result, is
// `bought_past_month` (Amazon's own "N bought in past month") and
// `is_best_seller` (the orange badge). Ranking on those is a real sales signal
// rather than a search-relevance order dressed up as popularity.
//
// Two API details, both learned by testing rather than from the docs:
//   - language_code must be a locale, 'en_US'. A bare 'en' returns 40501
//     "Invalid Field: 'language_code'", which reads like a wrong field name.
//   - the price is in price_from; `price` exists and is null.
//
// Cost: $0.0015 per category on the standard queue, so about $0.012 a full run.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
for (const line of (existsSync(join(ROOT, '.env.local')) ? readFileSync(join(ROOT, '.env.local'), 'utf8') : '').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const flag = (n, d = null) => {
  const hit = args.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.split('=').slice(1).join('=') : d;
};
const ONLY = flag('category', null);
const PER_CATEGORY = Number(flag('per-category', 15));

const BASIC = process.env.DATAFORSEO_PASSWORD;
if (!BASIC) {
  console.error('DATAFORSEO_PASSWORD (the base64 Basic token) is not set in .env.local');
  process.exit(1);
}
const TAG = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG || process.env.AMAZON_AFFILIATE_TAG || '';
const EP = 'https://api.dataforseo.com/v3/merchant/amazon/products';
const OUT = join(ROOT, 'data', 'best-sellers.json');

/* Keys and labels match the existing file so lib/best-sellers.ts needs no
   change. Queries are plain product terms: prefixing "amazon best sellers"
   made Amazon return listings *about* best sellers rather than the products. */
const CATEGORIES = [
  { key: 'smart-phones',      label: 'Smart Phones',      query: 'unlocked smartphone' },
  { key: 'laptops',           label: 'Laptops',           query: 'laptop computer' },
  { key: 'tablets',           label: 'Tablets',           query: 'tablet' },
  { key: 'smartwatches',      label: 'Smartwatches',      query: 'smartwatch' },
  { key: 'headphones',        label: 'Headphones',        query: 'wireless headphones earbuds' },
  { key: 'smart-tvs',         label: 'Smart TVs',         query: 'smart tv 4k' },
  { key: 'smart-home',        label: 'Smart Home',        query: 'smart home device' },
  { key: 'smart-electronics', label: 'Smart Electronics', query: 'smart electronics gadget' },
];

/* Accessories and refurbished units outrank the products they attach to on a
   plain keyword search — a phone case sells far more units than the phone. */
const ACCESSORY = /\bcases?\b|\bcovers?\b|\bbands?\b|\bstraps?\b|protector|charger|\bcables?\b|\bdock\b|screen guard|\bstand\b|\bmount\b|\bsleeve\b|adapter|\bskins?\b/i;
const NOT_NEW = /renewed|refurb|pre-?owned|\bused\b|open box/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const headers = { Authorization: `Basic ${BASIC}`, 'Content-Type': 'application/json' };

async function post(category) {
  const res = await fetch(`${EP}/task_post`, {
    method: 'POST',
    headers,
    body: JSON.stringify([{
      keyword: category.query,
      location_code: 2840,
      language_code: 'en_US',   // a bare 'en' is rejected as an invalid field
      depth: 100,
    }]),
  });
  const json = await res.json();
  const task = json?.tasks?.[0];
  if (!task?.id) throw new Error(`task_post failed for ${category.key}: ${task?.status_message ?? res.status}`);
  return { category, id: task.id, cost: Number(task.cost) || 0 };
}

async function collect(pending) {
  const done = new Map();
  for (let round = 0; round < 40 && pending.length; round += 1) {
    await sleep(8000);
    const still = [];
    for (const t of pending) {
      const res = await fetch(`${EP}/task_get/advanced/${t.id}`, { headers: { Authorization: headers.Authorization } });
      const task = (await res.json())?.tasks?.[0];
      if (task?.status_code === 20000 && task?.result) done.set(t.category.key, task.result[0]?.items ?? []);
      else still.push(t);
    }
    pending = still;
    process.stdout.write(`  collected ${done.size}${pending.length ? `, ${pending.length} pending` : ''}\n`);
  }
  return done;
}

/** "9K+ bought in past month" -> 9000, so the sort is on a number. */
function soldToNumber(value) {
  const s = String(value ?? '');
  const m = s.match(/([\d.]+)\s*([KM]?)\+?/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return Math.round(n * (m[2]?.toUpperCase() === 'M' ? 1e6 : m[2]?.toUpperCase() === 'K' ? 1e3 : 1));
}

function toItem(raw, category, rank) {
  const asin = raw.data_asin;
  const price = raw.price_from;
  const sold = raw.bought_past_month;
  const rating = raw.rating ?? {};
  const base = `https://www.amazon.com/dp/${asin}`;
  const badges = [];
  if (sold) badges.push(`${sold} bought in past month`);
  if (raw.is_best_seller) badges.push('Best Seller');
  if (raw.is_amazon_choice) badges.push("Amazon's Choice");
  return {
    rank,
    asin,
    marketplace: 'amazon',
    category: category.key,
    categoryLabel: category.label,
    title: raw.title ?? '',
    price: price != null ? `$${price}` : null,
    priceValue: price ?? null,
    image: raw.image_url ?? null,
    rating: rating.value ?? null,
    ratingCount: rating.votes_count ?? null,
    url: TAG ? `${base}?tag=${encodeURIComponent(TAG)}` : base,
    badge: badges[0] ?? null,
    badges,
    boughtInfo: sold ? `${sold} bought in past month` : null,
    couponInfo: null,
    dealBadge: raw.is_best_seller ? 'Best Seller' : null,
    isPrime: null,
    sponsored: false,
    source: 'dataforseo:merchant/amazon/products',
    soldPastMonth: soldToNumber(sold),
  };
}

const wanted = ONLY ? CATEGORIES.filter((c) => c.key === ONLY) : CATEGORIES;
if (!wanted.length) {
  console.error(`unknown category: ${ONLY}. Known: ${CATEGORIES.map((c) => c.key).join(', ')}`);
  process.exit(1);
}

console.log(`categories : ${wanted.length}`);
console.log(`mode       : ${WRITE ? 'WRITE' : 'DRY RUN'}`);

const posted = [];
let cost = 0;
for (const c of wanted) {
  const t = await post(c);
  cost += t.cost;
  posted.push(t);
}
console.log(`estimate   : $${cost.toFixed(4)}\n`);

const results = await collect(posted);

const items = [];
const perCategory = [];
for (const c of wanted) {
  const raw = results.get(c.key) ?? [];
  const usable = raw
    .filter((r) => r.type === 'amazon_serp' && r.data_asin && r.price_from)
    .filter((r) => !ACCESSORY.test(r.title ?? '') && !NOT_NEW.test(r.title ?? ''));

  const seen = new Set();
  const ranked = usable
    .map((r) => ({ r, sold: soldToNumber(r.bought_past_month), votes: (r.rating ?? {}).votes_count ?? 0 }))
    // Units shifted last month first; review count only breaks ties, since it
    // measures how long a listing has existed more than how well it sells.
    .sort((a, b) => b.sold - a.sold || b.votes - a.votes)
    .filter(({ r }) => {
      if (seen.has(r.data_asin)) return false;
      seen.add(r.data_asin);
      return true;
    })
    .slice(0, PER_CATEGORY);

  ranked.forEach(({ r }, i) => items.push(toItem(r, c, i + 1)));
  const withSold = ranked.filter(({ sold }) => sold > 0).length;
  perCategory.push({ key: c.key, got: ranked.length, withSalesData: withSold });
  console.log(`  ${c.label.padEnd(18)} ${String(ranked.length).padStart(2)} items, ${withSold} with sales data`);
}

const payload = {
  category: 'multiple',
  categories: wanted.map((c) => ({ key: c.key, label: c.label, query: c.query })),
  query: 'multiple category best sellers',
  source: 'dataforseo:merchant/amazon/products',
  capturedAt: new Date().toISOString(),
  items,
};

console.log(`\ntotal: ${items.length} items across ${wanted.length} categories`);
const thin = perCategory.filter((p) => p.got < PER_CATEGORY);
if (thin.length) console.log(`under target: ${thin.map((p) => `${p.key} (${p.got})`).join(', ')}`);

if (!WRITE) {
  console.log('\nDry run — nothing written. Re-run with --write.');
  process.exit(0);
}

// A run that produced nothing must not overwrite a good file with an empty one.
if (!items.length) {
  console.error('\nrefusing to write: 0 items returned');
  process.exit(1);
}
writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`\nwrote ${OUT}`);
