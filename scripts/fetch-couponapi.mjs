#!/usr/bin/env node
/**
 * Pull coupons from CouponAPI.org (https://couponapi.org) for a target set of
 * merchants and write a JSON cache in the shared coupon shape. CouponAPI.org
 * aggregates affiliate networks and returns AFFILIATE-READY links (your IDs),
 * so those go into `affiliateUrl` and are used verbatim (no GeniusLink wrap).
 *
 *   node scripts/fetch-couponapi.mjs [--incremental] [--limit=1000] [--dry]
 *
 * Env (.env.local):
 *   COUPONAPI_KEY          your CouponAPI.org API key                 [required]
 *   COUPONAPI_BASE_URL     default https://couponapi.org/api
 *   COUPONAPI_MERCHANTS    CSV filter, default the 6 below
 *
 * Endpoints (documented):
 *   Full:        {base}/getFeed/?API_KEY=..&format=json
 *   Incremental: {base}/getIncrementalFeed/?API_KEY=..&format=json&last_extract=<unix>
 *
 * NOTE: Amazon is NOT served by these networks (Amazon Associates is separate) —
 * it's listed as a target for completeness but will usually return nothing here.
 * Keep Amazon on Amazon Associates + GeniusLink. CouponAPI's exact field names
 * may differ — run --dry first and adjust mapCoupon() to the real response.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
for (const line of (existsSync(join(ROOT, '.env.local')) ? readFileSync(join(ROOT, '.env.local'), 'utf8') : '').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const DRY = process.argv.includes('--dry');
const INCREMENTAL = process.argv.includes('--incremental');
const LIMIT = parseInt(arg('limit', '5000'), 10);
// --all (or COUPONAPI_MERCHANTS=all) keeps every store that passes the US-location
// filter, instead of only the target-merchant list. Amazon stays excluded.
const ALL_MERCHANTS =
  process.argv.includes('--all') || (process.env.COUPONAPI_MERCHANTS || '').trim().toLowerCase() === 'all';

const KEY = process.env.COUPONAPI_KEY;
const BASE = (process.env.COUPONAPI_BASE_URL || 'https://couponapi.org/api').replace(/\/$/, '');
const TARGETS = (process.env.COUPONAPI_MERCHANTS || 'ebay,amazon,walmart,target,bestbuy,newegg')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const OUT = join(ROOT, 'data', 'coupons-couponapi.json');

if (!KEY) {
  console.error('COUPONAPI_KEY not set in .env.local — aborting.');
  console.error('Subscribe at https://couponapi.org, then add COUPONAPI_KEY=... to .env.local.');
  process.exit(1);
}

const slugify = (s) =>
  String(s || '').toLowerCase().normalize('NFKD')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const first = (o, keys) => { for (const k of keys) if (o[k] != null && o[k] !== '') return o[k]; return undefined; };

function domainFromUrl(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }

// Keep only coupons for a given locale (default US) — the feed mixes regions
// (e.g. amazon.co.uk is GB). Uses locations[] / primary_location; keeps unknowns.
const LOCATION = (process.env.COUPONAPI_LOCATION || 'US').toUpperCase();
function isTargetLocation(r) {
  const raw = r.locations ?? r.location ?? [];
  const arr = (Array.isArray(raw) ? raw : [raw]).map((x) => String(x).toUpperCase());
  if (arr.length) return arr.includes(LOCATION);
  const pl = String(r.primary_location || '').toLowerCase();
  // Keep US plus multi-region offers (e.g. "multi country", worldwide/global),
  // which are available to US shoppers. Only drop explicitly single non-US regions.
  if (pl) return pl.includes('united states') || pl.includes('multi') || pl.includes('worldwide') || pl.includes('global');
  return true;
}

// Normalize a raw store/domain to a clean brand name + canonical slug so coupons
// attach to the right /coupons/{slug} store pages.
const STORE_MAP = [
  [/walmart/, { name: 'Walmart', slug: 'walmart' }],
  [/bestbuy/, { name: 'Best Buy', slug: 'best-buy' }],
  [/newegg/, { name: 'Newegg', slug: 'newegg' }],
  [/target/, { name: 'Target', slug: 'target' }],
  [/ebay/, { name: 'eBay', slug: 'ebay' }],
  [/amazon/, { name: 'Amazon', slug: 'amazon' }],
];
function cleanStore(raw) {
  const n = norm(raw);
  const hit = STORE_MAP.find(([re]) => re.test(n));
  if (hit) return hit[1];
  const base = String(raw || '').replace(/^www\./, '').replace(/\.(com|net|org|co|io|us|shop).*$/i, '');
  return { name: base.replace(/\b\w/g, (c) => c.toUpperCase()) || String(raw), slug: slugify(base) };
}

// Match a record's store/merchant against the target merchant list.
function matchesTarget(store, url) {
  const hay = `${norm(store)} ${norm(url)}`;
  return TARGETS.some((t) => hay.includes(norm(t)) || (t === 'bestbuy' && hay.includes('bestbuy')));
}

// Detect a non-US region from the store domain (e.g. bestbuy.ca, sony.co.uk) so
// non-US storefronts stay separate from their US counterparts instead of merging.
function regionFromStore(raw) {
  const s = String(raw || '').toLowerCase();
  if (/\.co\.uk|\.uk(?:\/|$)/.test(s)) return 'UK';
  if (/\.ca(?:\/|$)/.test(s)) return 'CA';
  if (/\.com\.au|\.au(?:\/|$)/.test(s)) return 'AU';
  if (/\.de(?:\/|$)/.test(s)) return 'DE';
  if (/\.fr(?:\/|$)/.test(s)) return 'FR';
  return 'US';
}

// CouponAPI record → shared nxt-coupon shape. Adjust field names after a --dry.
function mapCoupon(r) {
  const rawStore = first(r, ['store', 'merchant', 'store_name', 'merchant_name', 'advertiser'])
    || domainFromUrl(first(r, ['url', 'aff_url', 'store_url']) || '');
  const base = cleanStore(rawStore);
  const region = regionFromStore(rawStore);
  const store = region === 'US' ? base.name : `${base.name} ${region}`;
  const storeSlug = region === 'US' ? base.slug : `${base.slug}-${region.toLowerCase()}`;
  const code = first(r, ['coupon_code', 'code', 'couponcode']) || null;
  const affLink = first(r, ['aff_url', 'affiliate_link', 'affiliateUrl', 'tracking_url', 'deeplink', 'aff_link']) || '';
  const rawLink = first(r, ['url', 'directurl', 'merchant_home_page', 'store_url', 'landing_url']) || '';
  const type = String(first(r, ['type', 'offer_type']) || '').toLowerCase();
  const couponType = code ? 'Promo code' : /sale|deal/.test(type) ? 'Sale' : 'Coupon';
  return {
    externalId: `couponapi:${first(r, ['offer_id', 'id', 'coupon_id']) ?? `${slugify(store)}:${code ?? slugify(first(r, ['title', 'offer_text']) || '')}`}`,
    source: `couponapi:${first(r, ['source', 'network']) || 'aggregate'}`,
    store,
    storeSlug,
    title: first(r, ['title', 'offer_text', 'description', 'offer']) || `${store} offer`,
    code: code || undefined,
    discount: first(r, ['discount', 'offer_value', 'savings']) || '',
    category: first(r, ['category', 'categories']) || `${store} coupons`,
    couponType,
    affiliateUrl: affLink || undefined,
    destinationUrl: affLink ? undefined : (rawLink || undefined),
    featured: String(first(r, ['featured']) || '').toLowerCase() === 'yes' || first(r, ['featured']) === true,
    isBrand: true,
    verifiedLabel: 'Verified',
    expiresAt: first(r, ['enddate', 'expiry', 'end_date', 'valid_to']) || null,
    displayOrder: 0,
  };
}

async function fetchFeed() {
  const path = INCREMENTAL ? '/getIncrementalFeed/' : '/getFeed/';
  const qs = new URLSearchParams({ API_KEY: KEY, format: 'json' });
  if (INCREMENTAL) qs.set('last_extract', String(Math.floor(Date.now() / 1000) - 86400)); // last 24h
  const url = `${BASE}${path}?${qs}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CouponAPI HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  const body = await res.json();
  // Feed may be a bare array or wrapped ({ result, offers, coupons, data }).
  const list = Array.isArray(body) ? body : (body.offers || body.coupons || body.result || body.data || []);
  return Array.isArray(list) ? list : [];
}

async function main() {
  console.log(`CouponAPI.org sync (${INCREMENTAL ? 'incremental' : 'full'}${DRY ? ', DRY' : ''}) · ${ALL_MERCHANTS ? 'ALL US stores' : `targets: ${TARGETS.join(', ')}`}`);
  let raw;
  try {
    raw = await fetchFeed();
  } catch (e) {
    console.error(`Fetch failed: ${e.message}`);
    console.error('Cache left as-is.');
    process.exit(1);
  }
  console.log(`Feed returned ${raw.length} record(s).`);

  const coupons = raw
    // --all keeps every region; otherwise US-only.
    .filter((r) => ALL_MERCHANTS || isTargetLocation(r))
    .filter((r) => ALL_MERCHANTS || matchesTarget(first(r, ['store', 'merchant', 'store_name']) || '', first(r, ['url', 'aff_url', 'store_url']) || ''))
    .map(mapCoupon)
    // Amazon (any region) stays on Amazon Associates + GeniusLink (CJ "amazon" data is junk).
    .filter((c) => c.store && c.title && !c.storeSlug.startsWith('amazon'))
    .slice(0, LIMIT);

  const byStore = coupons.reduce((m, c) => (m[c.store] = (m[c.store] || 0) + 1, m), {});
  console.log(`${coupons.length} coupon(s) across ${Object.keys(byStore).length} store(s):`, byStore);

  if (DRY) {
    console.log(JSON.stringify(coupons.slice(0, 5), null, 2));
    console.log('DRY RUN — nothing written. Verify the mapping, then run without --dry.');
    return;
  }
  if (coupons.length === 0) {
    console.log('No coupons for target merchants right now. Cache left as-is.');
    return;
  }

  writeFileSync(OUT, JSON.stringify({ source: 'couponapi.org', capturedAt: new Date().toISOString(), items: coupons }, null, 2));
  console.log(`Wrote ${coupons.length} coupon(s) -> ${OUT}`);
}

main().catch((e) => { console.error('fetch-couponapi failed:', e.message); process.exit(1); });
