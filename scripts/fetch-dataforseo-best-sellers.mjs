#!/usr/bin/env node
// Rebuild the marketplace best-seller caches from DataForSEO.
//
//   node scripts/fetch-dataforseo-best-sellers.mjs            # Google Shopping + Amazon
//   node scripts/fetch-dataforseo-best-sellers.mjs --google   # store buckets only
//   node scripts/fetch-dataforseo-best-sellers.mjs --amazon   # best-sellers.json only
//   node scripts/fetch-dataforseo-best-sellers.mjs --dry      # fetch, report, write nothing
//
// Why this exists: the Walmart / Target / Best Buy / Newegg caches came from the
// Real-Time Product Search RapidAPI and the Amazon cache from Product Info2 —
// neither subscription exists any more, so those files froze on 25 July 2026.
// DataForSEO is already paid for and already sources the catalogue, so the feeds
// move there rather than onto a seventh vendor.
//
// What this is NOT: a best-seller chart. DataForSEO has no rank endpoint on this
// account. `merchant/google/products` returns Google Shopping listings and
// `merchant/amazon/products` returns Amazon listings — both are "what shows up
// for this category", which is popularity-shaped but not an official ranking.
// The UI wording has to match that; see lib/best-sellers.ts.
//
// The store buckets all come from ONE set of Google Shopping requests, split by
// seller, because that is how the old cache was built too: its `id` fields carry
// Google's catalogid/gpcid and its urls are store search links, not product
// pages. Eight requests cover four stores.
//
// Env (.env.local): DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
for (const line of (existsSync(join(ROOT, '.env.local')) ? readFileSync(join(ROOT, '.env.local'), 'utf8') : '').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};

const DRY = hasFlag('dry');
const LIMIT = Number(flag('limit', 15));
const DEPTH = Number(flag('depth', 60));
const LOCATION = Number(flag('location', 2840)); // 2840 = United States
const LANGUAGE = flag('language', 'en');
// The two endpoints disagree on this field. merchant/google/products wants a
// bare 'en'; merchant/amazon/products rejects both that and language_name and
// only accepts a locale, 'en_US'. Passing the wrong one fails at task_post with
// "Invalid Field: 'language_name'" — which names a field you did not send.
const AMAZON_LANGUAGE = flag('amazon-language', 'en_US');
const PRIORITY = Number(flag('priority', 1));
const ONLY_GOOGLE = hasFlag('google');
const ONLY_AMAZON = hasFlag('amazon');
const RUN_GOOGLE = ONLY_GOOGLE || !ONLY_AMAZON;
const RUN_AMAZON = ONLY_AMAZON || !ONLY_GOOGLE;

const LOGIN = (process.env.DATAFORSEO_LOGIN || '').trim();
const PASSWORD = (process.env.DATAFORSEO_PASSWORD || '').trim();
if (!LOGIN || !PASSWORD) {
  console.error('DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD missing from .env.local');
  process.exit(1);
}

/** DataForSEO's dashboard shows a ready-made base64 blob that is easy to store
 *  as the password; encoding it again gives a 401 that reads like a bad key. */
function authHeader() {
  if (/^[A-Za-z0-9+/=]+$/.test(PASSWORD) && PASSWORD.length > 16) {
    try {
      const [maybeLogin, ...rest] = Buffer.from(PASSWORD, 'base64').toString('utf8').split(':');
      if (rest.length && maybeLogin.includes('@')) return `Basic ${PASSWORD}`;
    } catch { /* not base64 */ }
  }
  return `Basic ${Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64')}`;
}

// Same categories, keys and labels as scripts/fetch-ebay.mjs, so every
// marketplace tab on /best-sellers offers the same category filter.
const CATEGORIES = [
  { key: 'smart-phones', label: 'Smart Phones', query: 'unlocked smartphone' },
  { key: 'laptops', label: 'Laptops', query: 'laptop computer' },
  { key: 'tablets', label: 'Tablets', query: 'tablet' },
  { key: 'smartwatches', label: 'Smartwatches', query: 'smart watch' },
  { key: 'headphones', label: 'Headphones', query: 'wireless headphones earbuds' },
  { key: 'smart-tvs', label: 'Smart TVs', query: 'smart tv 4k' },
  { key: 'smart-home', label: 'Smart Home', query: 'smart home device' },
  { key: 'smart-electronics', label: 'Smart Electronics', query: 'smart electronics gadget' },
];

// Which seller strings land in which cache file. Matched against the seller
// name Google Shopping reports, lowercased.
//
// `search` builds the outbound link. Google Shopping returns `url: null` on
// every item — the only link it carries is a google.com/search?ibp=oshop deep
// link, which would send the visitor to Google rather than to a retailer and
// take the click out of the affiliate chain entirely. The retired feed stored a
// store search URL for exactly this reason (its Walmart rows are
// walmart.com/search?q=<title>), so this matches that and keeps the click on
// the merchant, where Impact or Takeads can still monetise it.
const STORES = [
  { key: 'walmart', file: 'best-sellers-walmart.json', match: /walmart/, search: (q) => `https://www.walmart.com/search?q=${q}` },
  { key: 'target', file: 'best-sellers-target.json', match: /target/, search: (q) => `https://www.target.com/s?searchTerm=${q}` },
  { key: 'bestbuy', file: 'best-sellers-bestbuy.json', match: /best ?buy/, search: (q) => `https://www.bestbuy.com/site/searchpage.jsp?st=${q}` },
  { key: 'newegg', file: 'best-sellers-newegg.json', match: /newegg/, search: (q) => `https://www.newegg.com/p/pl?d=${q}` },
];

async function dfs(endpoint, payload) {
  const post = await fetch(`https://api.dataforseo.com/v3/${endpoint}/task_post`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify([payload]),
    signal: AbortSignal.timeout(120_000),
  });
  if (!post.ok) throw new Error(`task_post HTTP ${post.status}`);
  const task = (await post.json()).tasks?.[0];
  if (task?.status_code !== 20100 || !task.id) throw new Error(`${task?.status_code}: ${task?.status_message}`);

  // The task is paid for the moment it is posted, so a dropped poll must not
  // discard it — only a terminal status ends the loop.
  const deadline = Date.now() + 12 * 60 * 1000;
  for (;;) {
    if (Date.now() > deadline) throw new Error(`task ${task.id} never completed`);
    await new Promise((r) => setTimeout(r, 6000));
    try {
      const res = await fetch(`https://api.dataforseo.com/v3/${endpoint}/task_get/advanced/${task.id}`, {
        headers: { Authorization: authHeader() },
        signal: AbortSignal.timeout(90_000),
      });
      if (!res.ok) continue;
      const t = (await res.json()).tasks?.[0];
      if (t?.status_code === 20000) return t.result?.[0] ?? null;
      if (t && t.status_code !== 40602) throw new Error(`${t.status_code}: ${t.status_message}`); // 40602 = queued
    } catch (err) {
      if (!/aborted|timeout|fetch failed|network/i.test(String(err.message))) throw err;
    }
  }
}

function money(value, currency) {
  if (value == null) return null;
  return !currency || currency === 'USD' ? `$${value.toFixed(2)}` : `${value.toFixed(2)} ${currency}`;
}

/**
 * A DataForSEO merchant item in the shape data/best-sellers*.json already uses.
 *
 * `destination` supplies the outbound link, because the two endpoints differ:
 * Amazon items carry an ASIN and get a real product page, while Google Shopping
 * items carry no merchant URL at all and fall back to a store search.
 */
function normalize(item, marketplace, destination) {
  const title = String(item.title || '').trim();
  if (!title) return null;
  const url = destination(item, title);
  if (!url) return null;

  // The two endpoints name every one of these differently: Google Shopping has
  // price / product_images / product_rating, Amazon has price_from / image_url /
  // rating. Reading only one set silently yields cards with no price at all.
  const price = Number(item.price ?? item.price_from);
  const value = Number.isFinite(price) && price > 0 ? price : null;
  const rating = item.product_rating ?? item.rating;

  return {
    id: item.data_asin || item.asin || item.product_id || item.data_docid || url,
    marketplace,
    title,
    price: money(value, item.currency),
    priceValue: value,
    image: item.product_images?.[0] ?? item.image_url ?? null,
    rating: typeof rating === 'number' ? rating : rating?.value ?? null,
    ratingCount: rating?.votes_count ?? item.reviews_count ?? null,
    url,
  };
}

function rank(items) {
  return items.map((item, i) => ({ rank: i + 1, ...item }));
}

function write(file, body, label) {
  const path = join(ROOT, 'data', file);
  if (DRY) {
    console.log(`  [dry] ${file}: ${body.items.length} item(s) — not written`);
    return;
  }
  if (!body.items.length) {
    // An empty write would blank a working tab. The stale cache is worse than
    // nothing only if it is presented as fresh, and capturedAt still says when.
    console.log(`  !  ${file}: 0 items, cache left as-is`);
    return;
  }
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`);
  console.log(`  ✓  ${file}: ${body.items.length} ${label}`);
}

async function runGoogle() {
  console.log(`Google Shopping — ${CATEGORIES.length} categor(ies) → ${STORES.map((s) => s.key).join(', ')}`);
  const buckets = new Map(STORES.map((s) => [s.key, []]));

  for (const category of CATEGORIES) {
    let result;
    try {
      result = await dfs('merchant/google/products', {
        keyword: category.query,
        location_code: LOCATION,
        language_code: LANGUAGE,
        depth: DEPTH,
        priority: PRIORITY,
        tag: category.key,
      });
    } catch (err) {
      console.error(`  !  ${category.label}: ${err.message}`);
      continue;
    }

    const items = result?.items ?? [];
    const counts = [];
    for (const store of STORES) {
      const bucket = buckets.get(store.key);
      const before = bucket.length;
      for (const item of items) {
        if (bucket.length - before >= LIMIT) break;
        const seller = String(item.seller || '').toLowerCase();
        if (!store.match.test(seller)) continue;
        const normalized = normalize(item, store.key, (_, title) => store.search(encodeURIComponent(title)));
        if (normalized) bucket.push({ ...normalized, category: category.key });
      }
      counts.push(`${store.key}:${bucket.length - before}`);
    }
    console.log(`  ${category.label}: ${items.length} listing(s) → ${counts.join(' ')}`);
  }

  const capturedAt = new Date().toISOString();
  for (const store of STORES) {
    write(store.file, {
      marketplace: store.key,
      source: 'dataforseo-google-shopping',
      capturedAt,
      categories: CATEGORIES.map((c) => ({ key: c.key, label: c.label })),
      items: rank(buckets.get(store.key)),
    }, 'items');
  }
}

async function runAmazon() {
  console.log(`Amazon — ${CATEGORIES.length} categor(ies) → best-sellers.json`);
  const items = [];

  for (const category of CATEGORIES) {
    let result;
    try {
      result = await dfs('merchant/amazon/products', {
        keyword: category.query,
        location_code: LOCATION,
        language_code: AMAZON_LANGUAGE,
        depth: DEPTH,
        priority: PRIORITY,
        tag: category.key,
      });
    } catch (err) {
      console.error(`  !  ${category.label}: ${err.message}`);
      continue;
    }

    // An ASIN gives a real product page, which the Associates tag can be
    // appended to downstream. Anything without one falls back to Amazon search
    // rather than being dropped.
    // Amazon is the one endpoint that reports actual demand: bought_past_month
    // ("10K+ bought in the past month") and an is_best_seller flag. Ordering by
    // it means the Amazon tab really is ranked by something sold, rather than by
    // where the listing happened to appear. Ties keep Amazon's own order.
    const found = (result?.items ?? [])
      .map((raw, i) => ({ raw, i }))
      .sort((a, b) => (b.raw.bought_past_month ?? 0) - (a.raw.bought_past_month ?? 0) || a.i - b.i)
      .map(({ raw }) => normalize(raw, 'amazon', (item, title) => {
        const asin = item.data_asin || item.asin;
        return asin ? `https://www.amazon.com/dp/${asin}` : `https://www.amazon.com/s?k=${encodeURIComponent(title)}`;
      }))
      .filter(Boolean)
      .slice(0, LIMIT)
      .map((item) => ({ ...item, category: category.key }));
    items.push(...found);
    console.log(`  ${category.label}: ${found.length}`);
  }

  write('best-sellers.json', {
    marketplace: 'amazon',
    source: 'dataforseo-amazon',
    capturedAt: new Date().toISOString(),
    categories: CATEGORIES.map((c) => ({ key: c.key, label: c.label })),
    items: rank(items),
  }, 'items');
}

if (RUN_GOOGLE) await runGoogle();
if (RUN_AMAZON) await runAmazon();
