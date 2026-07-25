#!/usr/bin/env node
// Fetch coupons from the RapidAPI "get-promo-codes" API and cache them locally
// for /coupons. Respects a MONTHLY request budget so we never blow the plan
// quota (default 20,000/month), tracked in data/getpromo-usage.json.
//
//   node scripts/fetch-coupons-getpromo.mjs            # normal run
//   node scripts/fetch-coupons-getpromo.mjs --dry      # fetch + preview, no write
//   node scripts/fetch-coupons-getpromo.mjs --pages=50 # cap requests this run
//
// Env (.env.local):
//   RAPIDAPI_PROMO_CODES_KEY      your get-promo-codes RapidAPI key   [required]
//   RAPIDAPI_PROMO_CODES_HOST     default get-promo-codes.p.rapidapi.com
//   RAPIDAPI_PROMO_MONTHLY_LIMIT  monthly request cap (default 20000)
//   RAPIDAPI_PROMO_RUN_LIMIT      max requests per run  (default 600)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
for (const line of (existsSync(join(ROOT, '.env.local')) ? readFileSync(join(ROOT, '.env.local'), 'utf8') : '').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const arg = (k, d = '') => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const DRY = process.argv.includes('--dry');
const HOST = process.env.RAPIDAPI_PROMO_CODES_HOST || 'get-promo-codes.p.rapidapi.com';
const KEY = process.env.RAPIDAPI_PROMO_CODES_KEY || process.env.RAPIDAPI_PROMO_KEY;
const MONTHLY_LIMIT = Math.max(0, parseInt(process.env.RAPIDAPI_PROMO_MONTHLY_LIMIT || '20000', 10) || 0);
const RUN_LIMIT = Math.max(1, parseInt(arg('pages', process.env.RAPIDAPI_PROMO_RUN_LIMIT || '600'), 10) || 600);
const SORT = process.env.RAPIDAPI_PROMO_SORT || 'update_time_desc';
const DELAY_MS = Number(arg('delay-ms', '1200'));
const OUT = join(ROOT, 'data', 'coupons-getpromo.json');
const USAGE = join(ROOT, 'data', 'getpromo-usage.json');

if (!KEY) {
  console.error('RAPIDAPI_PROMO_CODES_KEY not set in .env.local — aborting.');
  console.error('Add: RAPIDAPI_PROMO_CODES_KEY=your-rapidapi-key');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const monthKey = () => new Date().toISOString().slice(0, 7); // YYYY-MM (UTC)

// Monthly usage tracker — resets automatically when the month rolls over.
function loadUsage() {
  try {
    const u = JSON.parse(readFileSync(USAGE, 'utf8'));
    if (u && u.month === monthKey()) return { month: u.month, requests: Number(u.requests) || 0 };
  } catch {}
  return { month: monthKey(), requests: 0 };
}
function saveUsage(u) {
  try {
    mkdirSync(dirname(USAGE), { recursive: true });
    writeFileSync(USAGE, JSON.stringify(u, null, 2));
  } catch {}
}

const first = (o, ks) => {
  for (const k of ks) if (o && o[k] != null && o[k] !== '') return o[k];
  return '';
};
const slugify = (s) =>
  String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const domainFromUrl = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const recordsFrom = (body) =>
  Array.isArray(body) ? body : (body?.data || body?.coupons || body?.result || body?.offers || []);

// Store directory (id -> { name, domain, url }) so coupons get clean store names
// instead of raw domains. get-coupons records only carry `store_id`.
function loadStoreIndex() {
  const map = new Map();
  try {
    const d = JSON.parse(readFileSync(join(ROOT, 'data', 'coupon-stores.json'), 'utf8'));
    const arr = d.stores || d.items || (Array.isArray(d) ? d : []);
    for (const s of arr) map.set(Number(s.id), s);
  } catch {}
  return map;
}

// Pull a human discount snippet out of the coupon title/description.
function extractDiscount(text) {
  const m = String(text || '').match(/(\d{1,3}%\s*off|\$\s?\d[\d.,]*\s*off|free shipping|bogo|buy one[, ]+get one)/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

// get-promo-codes record → shared nxt-coupon shape.
function mapCoupon(r, storeIndex) {
  const status = String(r.status || '').toLowerCase();
  if (status && status !== 'active') return null;

  const title = String(first(r, ['title', 'description', 'coupon_title', 'offer', 'name'])).trim();
  if (!title) return null;

  const url = first(r, ['url', 'affiliate_url', 'tracking_url', 'deeplink', 'store_url', 'link']);
  const st = storeIndex.get(Number(r.store_id));
  const store = String((st?.name && String(st.name).trim()) || domainFromUrl(url) || (r.store_id ? `Store ${r.store_id}` : '')).trim();
  if (!store) return null;

  const code = first(r, ['code', 'coupon_code', 'promo_code', 'discount_code']) || null;
  return {
    externalId: `getpromo:${first(r, ['id', 'coupon_id', 'offer_id']) || `${slugify(store)}:${code || slugify(title)}`}`,
    source: 'rapidapi:get-promo-codes',
    storeId: r.store_id != null ? Number(r.store_id) : undefined,
    store,
    storeSlug: slugify(store),
    title,
    code: code || undefined,
    discount: extractDiscount(title) || (code ? 'Promo code' : ''),
    category: `${store} coupons`,
    couponType: code ? 'Promo code' : 'Sale',
    affiliateUrl: url || undefined,
    featured: false,
    isBrand: true,
    verifiedLabel: 'Verified',
    expiresAt: first(r, ['end_time', 'end_date', 'expiry', 'expire_date']) || null,
  };
}

async function fetchPage(page) {
  const res = await fetch(`https://${HOST}/data/get-coupons/?page=${page}&sort=${encodeURIComponent(SORT)}`, {
    headers: { 'x-rapidapi-host': HOST, 'x-rapidapi-key': KEY },
  });
  if (res.status === 429) throw new Error('RATE_LIMIT');
  if (!res.ok) throw new Error(`get-coupons page ${page} HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  return res.json();
}

async function main() {
  const usage = loadUsage();
  const remainingMonthly = Math.max(0, MONTHLY_LIMIT - usage.requests);
  const budget = Math.min(RUN_LIMIT, remainingMonthly);
  console.log(
    `get-promo-codes coupons · month ${usage.month}: ${usage.requests}/${MONTHLY_LIMIT} used, ${remainingMonthly} remaining · this run up to ${budget} request(s)`,
  );
  if (budget <= 0) {
    console.log('Monthly request budget exhausted — cache left as-is until next month.');
    return;
  }

  const storeIndex = loadStoreIndex();
  const seen = new Set();
  const coupons = [];
  let used = 0;
  for (let page = 1; used < budget; page++) {
    let body;
    try {
      body = await fetchPage(page);
      used += 1;
    } catch (e) {
      if (e.message === 'RATE_LIMIT') { console.log('Rate limited; stopping this run.'); break; }
      console.error(e.message);
      break;
    }
    const rows = recordsFrom(body).map((r) => mapCoupon(r, storeIndex)).filter(Boolean);
    if (rows.length === 0) { console.log(`page ${page}: empty — end of feed.`); break; }
    for (const c of rows) {
      if (seen.has(c.externalId)) continue;
      seen.add(c.externalId);
      coupons.push(c);
    }
    if (DELAY_MS) await sleep(DELAY_MS);
  }

  usage.requests += used;
  if (!DRY) saveUsage(usage);
  const byStore = coupons.reduce((m, c) => ((m[c.store] = (m[c.store] || 0) + 1), m), {});
  console.log(`Fetched ${coupons.length} coupon(s) using ${used} request(s). Month now ${usage.requests}/${MONTHLY_LIMIT}.`);
  console.log(`${Object.keys(byStore).length} store(s):`, byStore);

  if (DRY) {
    console.log(JSON.stringify(coupons.slice(0, 5), null, 2));
    console.log('DRY RUN — nothing written. Verify the mapping, then run without --dry.');
    return;
  }
  if (coupons.length === 0) {
    console.log('No coupons returned; cache left as-is.');
    return;
  }
  writeFileSync(
    OUT,
    JSON.stringify({ source: 'rapidapi:get-promo-codes', capturedAt: new Date().toISOString(), monthlyUsage: usage, items: coupons }, null, 2),
  );
  console.log(`Wrote ${coupons.length} coupon(s) -> ${OUT}`);
}

main().catch((e) => {
  console.error('fetch-coupons-getpromo failed:', e.message);
  process.exit(1);
});
