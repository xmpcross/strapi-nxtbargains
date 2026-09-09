#!/usr/bin/env node
/**
 * Migrate the nxt.bargains commerce catalogue from Supabase into Strapi.
 *
 * The frontend already reads either backend: lib/strapi.ts branches on
 * `useSupabaseCommerce()` at a dozen call sites, so once the data is in Strapi
 * the switch is `COMMERCE_DATA_SOURCE` in .env.local. Nothing else changes.
 *
 * SCOPE — nxt.bargains only. commerce-* in Strapi is a pool shared with
 * bestlooking.skin, nxtsmarthome.com.au and others, so every product written
 * here carries `tags: ['nxt-bargains']`, matching the three that are already
 * there. Nothing belonging to another site is read or touched.
 *
 * IDEMPOTENT — existing Strapi products are indexed by slug up front and
 * skipped, so a re-run only fills gaps. Safe to interrupt and resume; the
 * slug->documentId map is written to disk after every batch.
 *
 * URL STABILITY — Strapi's `productCanonicalPath` prefers `categories[0].slug`
 * and falls back to slugifying the plain `category` string. This copies
 * Supabase's free-text `category` into that field and does NOT attach the
 * `categories` relation, so every product keeps the exact URL it has today.
 * (Those categories are frequently wrong — a foundation filed under
 * "Smart Home" — but fixing them is a content decision, not a migration one.
 * Doing it here would silently move ~1,000 URLs.)
 *
 * Usage:
 *   node ops/migrate-supabase-to-strapi.mjs --dry-run          # report only
 *   node ops/migrate-supabase-to-strapi.mjs --products         # phase 1
 *   node ops/migrate-supabase-to-strapi.mjs --offers           # phase 2
 *   node ops/migrate-supabase-to-strapi.mjs --products --offers
 *   node ops/migrate-supabase-to-strapi.mjs --only-with-images # skip the 276 imageless
 *
 * price_history is NOT migrated: 146,420 rows through the REST API is hours of
 * writes for data the site only reads as "has it dropped". Decide the retention
 * window first, then extend this.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const ARGS = new Set(process.argv.slice(2));
const DRY = ARGS.has('--dry-run');
const DO_PRODUCTS = ARGS.has('--products') || DRY;
const DO_OFFERS = ARGS.has('--offers') || DRY;
const DO_SNAPSHOTS = ARGS.has('--snapshots') || DRY;
const ONLY_WITH_IMAGES = ARGS.has('--only-with-images');

const SITE_TAG = 'nxt-bargains';
const MAP_FILE = 'ops/.migration-map.json';
const CONCURRENCY = 4;

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
const STRAPI_URL = (process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL || '').replace(/\/$/, '');
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN || '';

for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_KEY, STRAPI_URL, STRAPI_TOKEN })) {
  if (!v) { console.error(`Missing ${k} — source .env.local first.`); process.exit(1); }
}

const log = (...a) => console.log(...a);

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Page through PostgREST with Range headers; it caps a single response. */
async function sbAll(path, pageSize = 1000) {
  const out = [];
  for (let from = 0; ; from += pageSize) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${from}-${from + pageSize - 1}`,
      },
    });
    if (!res.ok) throw new Error(`supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const rows = await res.json();
    out.push(...rows);
    if (rows.length < pageSize) return out;
  }
}

async function strapi(path, init = {}) {
  const res = await fetch(`${STRAPI_URL}/api/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${STRAPI_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`strapi ${res.status} on ${path}: ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : null;
}

/** Every commerce-product slug already in Strapi, across all sites. */
async function existingStrapiSlugs() {
  const slugs = new Map();
  for (let page = 1; ; page += 1) {
    const r = await strapi(`commerce-products?pagination[page]=${page}&pagination[pageSize]=200&fields[0]=slug`);
    for (const row of r.data ?? []) {
      const a = row.attributes ?? row;
      if (a.slug) slugs.set(a.slug, row.documentId ?? a.documentId);
    }
    const p = r.meta?.pagination;
    if (!p || page >= p.pageCount) return slugs;
  }
}

/** Run tasks with a small concurrency cap; collects errors rather than throwing. */
async function pool(items, worker, concurrency = CONCURRENCY) {
  const errors = [];
  let done = 0;
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      try { await worker(item); } catch (e) { errors.push({ item, error: String(e).slice(0, 200) }); }
      if (++done % 50 === 0) log(`    …${done}/${items.length}`);
    }
  }));
  return errors;
}

function loadMap() {
  if (existsSync(MAP_FILE)) return JSON.parse(readFileSync(MAP_FILE, 'utf8'));
  return { products: {} };
}
function saveMap(m) {
  mkdirSync('ops', { recursive: true });
  writeFileSync(MAP_FILE, JSON.stringify(m, null, 2));
}

// --- phase 1: products -------------------------------------------------------
const PRODUCT_FIELDS = 'id,title,slug,brand,model,mpn,asin,gtin_upc_ean,category,image_url,description,specifications,updated_at';

/**
 * Strapi limits that the Supabase catalogue violates, both found by bisecting
 * the API rather than reading a schema:
 *
 *   name      max 220  — explicit validation, returns 400
 *                        "name must be at most 220 characters"
 *   imageUrl  max 255  — database column, surfaces as an opaque 500
 *
 * 72 of 1,270 products breach one or the other, because the ingest writes the
 * scraped marketplace title verbatim — promo banners and prices included — and
 * some image URLs are long Google Shopping thumbnail links.
 */
const MAX_NAME = 220;
const MAX_URL = 255;

/** Trim to a word boundary so a truncated title does not end mid-word. */
function clampName(name) {
  const s = (name || '').trim();
  if (s.length <= MAX_NAME) return s;
  const cut = s.slice(0, MAX_NAME);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > MAX_NAME - 40 ? cut.slice(0, lastSpace) : cut).trim();
}

/** An over-length image URL is dropped rather than truncated — a cut URL is
 *  a broken URL, and the product is more useful imageless than with a 404. */
function clampUrl(url) {
  const s = (url || '').trim();
  return s && s.length <= MAX_URL ? s : null;
}

async function migrateProducts(map) {
  log('\n=== products ===');
  let rows = await sbAll(`canonical_products?select=${PRODUCT_FIELDS}&is_active=eq.true&order=updated_at.desc`);
  log(`  supabase active products : ${rows.length}`);

  if (ONLY_WITH_IMAGES) {
    const before = rows.length;
    rows = rows.filter((r) => (r.image_url || '').trim());
    log(`  --only-with-images       : dropped ${before - rows.length}, keeping ${rows.length}`);
  }

  const existing = await existingStrapiSlugs();
  log(`  already in strapi        : ${existing.size} (all sites)`);

  const todo = rows.filter((r) => r.slug && !existing.has(r.slug));
  log(`  to create                : ${todo.length}`);
  log(`  skipped (slug exists)    : ${rows.length - todo.length}`);

  // Existing rows still need to be in the map so phase 2 can attach offers.
  for (const r of rows) {
    if (r.slug && existing.has(r.slug)) map.products[r.id] = existing.get(r.slug);
  }

  if (DRY) { log('  [dry-run] nothing written'); return; }

  const errors = await pool(todo, async (r) => {
    const created = await strapi('commerce-products', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          name: clampName(r.title),
          slug: r.slug,
          brand: r.brand ?? null,
          description: r.description ?? null,
          specs: r.specifications ?? null,
          asin: r.asin ?? null,
          gtin: r.gtin_upc_ean ?? null,
          mpn: r.mpn ?? null,
          // Free-text category only — see the URL STABILITY note at the top.
          category: r.category ?? null,
          imageUrl: clampUrl(r.image_url),
          tags: [SITE_TAG],
          productStatus: 'active',
        },
      }),
    });
    map.products[r.id] = created.data.documentId;
  });

  saveMap(map);
  log(`  created                  : ${todo.length - errors.length}`);
  if (errors.length) {
    log(`  FAILED                   : ${errors.length}`);
    for (const e of errors.slice(0, 5)) log(`     ${e.item.slug}: ${e.error}`);
  }
}

// --- phase 2: offers ---------------------------------------------------------
const OFFER_FIELDS = 'id,canonical_product_id,marketplace,seller_name,current_price,original_price,discount_percent,currency,coupon_code,product_url,is_available,scraped_at';

async function migrateOffers(map) {
  log('\n=== offers ===');
  const rows = await sbAll(`marketplace_products?select=${OFFER_FIELDS}&is_available=eq.true`);
  log(`  supabase available offers: ${rows.length}`);

  const linkable = rows.filter((r) => map.products[r.canonical_product_id]);
  log(`  linkable to a strapi product: ${linkable.length}`);
  log(`  orphaned (no product)    : ${rows.length - linkable.length}`);

  // commerce-offers has no natural key, so re-running this phase blind would
  // duplicate every row. Index what a previous run already wrote by productUrl
  // and skip those.
  const already = await strapiOfferIndex();
  const todo = linkable.filter((r) => !already.has(r.product_url));
  log(`  already migrated         : ${linkable.length - todo.length}`);
  log(`  to create                : ${todo.length}`);

  if (DRY) { log('  [dry-run] nothing written'); return; }

  const errors = await pool(todo, async (r) => {
    const price = r.current_price == null ? null : Number(r.current_price);
    await strapi('commerce-offers', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          title: `${r.seller_name || r.marketplace || 'Offer'}`.slice(0, 250),
          price: Number.isFinite(price) ? price : null,
          originalPrice: r.original_price == null ? null : Number(r.original_price),
          discountPercent: r.discount_percent == null ? null : Number(r.discount_percent),
          currency: r.currency || 'USD',
          couponCode: r.coupon_code ?? null,
          productUrl: r.product_url,
          affiliateUrl: r.product_url,
          availability: r.is_available ? 'in_stock' : 'out_of_stock',
          condition: 'new',
          source: 'supabase-migration',
          lastCheckedAt: r.scraped_at ?? null,
          status: 'active',
          product: map.products[r.canonical_product_id],
        },
      }),
    });
  });

  log(`  created                  : ${todo.length - errors.length}`);
  if (errors.length) {
    log(`  FAILED                   : ${errors.length}`);
    for (const e of errors.slice(0, 5)) log(`     offer ${e.item.id}: ${e.error}`);
  }
}

// --- phase 3: price snapshots ------------------------------------------------
/**
 * price_history.listing_id points at a marketplace_products row (an offer), not
 * a product, and Strapi's commerce-price-snapshot relates to an offer too. The
 * offers were written in phase 2 without recording their new documentIds, so
 * the mapping is rebuilt here by matching on productUrl, which is unique per
 * offer in this dataset.
 */
async function strapiOfferIndex() {
  const byUrl = new Map();
  for (let page = 1; ; page += 1) {
    const r = await strapi(`commerce-offers?pagination[page]=${page}&pagination[pageSize]=200&fields[0]=productUrl&filters[source][$eq]=supabase-migration`);
    for (const row of r.data ?? []) {
      const a = row.attributes ?? row;
      if (a.productUrl) byUrl.set(a.productUrl, row.documentId ?? a.documentId);
    }
    const p = r.meta?.pagination;
    if (!p || page >= p.pageCount) return byUrl;
  }
}

async function migrateSnapshots(map) {
  log('\n=== price snapshots ===');
  const perOffer = Number(
    [...ARGS].find((a) => a.startsWith('--max-per-offer='))?.split('=')[1] ?? 20,
  );

  const offers = await sbAll('marketplace_products?select=id,canonical_product_id,product_url&is_available=eq.true');
  const byUrl = await strapiOfferIndex();
  log(`  strapi offers indexed    : ${byUrl.size}`);

  // supabase listing id -> { offerDoc, productDoc }
  const link = new Map();
  for (const o of offers) {
    const offerDoc = byUrl.get(o.product_url);
    if (offerDoc) link.set(o.id, { offerDoc, productDoc: map.products[o.canonical_product_id] ?? null });
  }
  log(`  offers resolvable        : ${link.size}`);

  const history = await sbAll('price_history?select=id,listing_id,price,original_price,currency,recorded_at&order=recorded_at.desc', 1000);
  log(`  price_history rows       : ${history.length}`);

  // Keep the most recent N per offer. The site reads snapshots to draw a
  // history line and to detect a drop, both of which need recency, not depth.
  const kept = [];
  const seen = new Map();
  for (const h of history) {
    if (!link.has(h.listing_id)) continue;
    const n = seen.get(h.listing_id) ?? 0;
    if (n >= perOffer) continue;
    seen.set(h.listing_id, n + 1);
    kept.push(h);
  }
  log(`  keeping newest ${perOffer}/offer  : ${kept.length}`);
  log(`  dropped (older/orphaned) : ${history.length - kept.length}`);

  // A snapshot has no natural key either. Raising --max-per-offer on a later
  // run must not re-write the rows an earlier, smaller run already created, so
  // index what exists by offer documentId + checkedAt and skip those.
  const existing = new Set();
  for (let page = 1; ; page += 1) {
    const r = await strapi(`commerce-price-snapshots?pagination[page]=${page}&pagination[pageSize]=200&fields[0]=checkedAt&populate[offer][fields][0]=documentId&filters[source][$eq]=supabase-migration`);
    for (const row of r.data ?? []) {
      const a = row.attributes ?? row;
      const off = a.offer?.data?.documentId ?? a.offer?.documentId;
      if (off && a.checkedAt) existing.add(`${off}|${new Date(a.checkedAt).toISOString()}`);
    }
    const p = r.meta?.pagination;
    if (!p || page >= p.pageCount) break;
  }
  const todo = kept.filter((h) => {
    const l = link.get(h.listing_id);
    return !existing.has(`${l.offerDoc}|${new Date(h.recorded_at).toISOString()}`);
  });
  log(`  already migrated         : ${kept.length - todo.length}`);
  log(`  to create                : ${todo.length}`);

  if (DRY) { log('  [dry-run] nothing written'); return; }

  const errors = await pool(todo, async (h) => {
    const l = link.get(h.listing_id);
    const price = h.price == null ? null : Number(h.price);
    await strapi('commerce-price-snapshots', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          price: Number.isFinite(price) ? price : null,
          originalPrice: h.original_price == null ? null : Number(h.original_price),
          currency: h.currency || 'USD',
          availability: 'in_stock',
          checkedAt: h.recorded_at,
          source: 'supabase-migration',
          offer: l.offerDoc,
          ...(l.productDoc ? { product: l.productDoc } : {}),
        },
      }),
    });
  }, 6);

  log(`  created                  : ${todo.length - errors.length}`);
  if (errors.length) {
    log(`  FAILED                   : ${errors.length}`);
    for (const e of errors.slice(0, 3)) log(`     ${e.item.id}: ${e.error}`);
  }
}

// --- main --------------------------------------------------------------------
const map = loadMap();
log(`mode: ${DRY ? 'DRY RUN' : 'WRITE'}${ONLY_WITH_IMAGES ? ' (only products with images)' : ''}`);
if (DO_PRODUCTS) await migrateProducts(map);
if (DO_OFFERS) await migrateOffers(map);
if (DO_SNAPSHOTS) await migrateSnapshots(map);
if (!DRY) saveMap(map);
log('\ndone.');
