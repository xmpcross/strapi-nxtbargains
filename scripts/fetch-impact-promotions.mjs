#!/usr/bin/env node
/**
 * Pull coupons/deals directly from Impact.com (Impact Radius) for every joined
 * campaign (e.g. Walmart) via the Promotions API, and write a JSON cache in the
 * shared coupon shape. Links come back as affiliate-ready Impact TrackingLinks,
 * so no GeniusLink wrap is needed.
 *
 *   node scripts/fetch-impact-promotions.mjs [--limit=500]
 *
 * Env (.env.local):
 *   IMPACT_ACCOUNT_SID   Impact Mediapartner Account SID   [required]
 *   IMPACT_AUTH_TOKEN    Impact Auth Token                 [required]
 *
 * Endpoint: GET https://api.impact.com/Mediapartners/{SID}/Promotions
 *   (Basic auth SID:TOKEN, Accept: application/json, paginated via @nextpageuri)
 *
 * Note: returns 0 when an advertiser has no active promo codes at the moment
 * (Walmart frequently runs price cuts rather than codes). Keeps the previous
 * good cache if the fetch fails, so a transient error never blanks the page.
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
const LIMIT = parseInt(arg('limit', '500'), 10);

const SID = process.env.IMPACT_ACCOUNT_SID;
const TOKEN = process.env.IMPACT_AUTH_TOKEN;
const OUT = join(ROOT, 'data', 'coupons-impact.json');

if (!SID || !TOKEN) {
  console.error('IMPACT_ACCOUNT_SID / IMPACT_AUTH_TOKEN not set in .env.local — aborting (cache untouched).');
  process.exit(1);
}

const AUTH = 'Basic ' + Buffer.from(`${SID}:${TOKEN}`).toString('base64');
const BASE = `https://api.impact.com/Mediapartners/${SID}`;

const slugify = (s) =>
  String(s || '').toLowerCase().normalize('NFKD')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function first(obj, keys) {
  for (const k of keys) if (obj[k] != null && obj[k] !== '') return obj[k];
  return undefined;
}

// Impact Promotion → shared Coupon shape.
function couponFromPromotion(p) {
  const store = first(p, ['AdvertiserName', 'CampaignName']) || 'Walmart';
  const code = first(p, ['PromoCode', 'CouponCode', 'Code']) || null;
  const link = first(p, ['TrackingLink', 'LandingPageUrl', 'Url']) || '';
  const type = code ? 'Promo code' : /sale|deal|off/i.test(String(first(p, ['Type', 'Name']) || '')) ? 'Sale' : 'Coupon';
  return {
    externalId: `impact:${first(p, ['Id', 'PromotionId']) ?? `${slugify(store)}:${code ?? slugify(first(p, ['Name', 'Description']) || '')}`}`,
    source: 'impact',
    store,
    storeSlug: slugify(store),
    title: first(p, ['Name', 'Description', 'Terms']) || `${store} offer`,
    code: code || undefined,
    discount: first(p, ['Discount', 'Value', 'Savings']) || '',
    category: `${store} coupons`,
    couponType: type,
    affiliateUrl: link || undefined, // Impact TrackingLink is affiliate-ready
    featured: false,
    isBrand: true,
    verifiedLabel: 'Verified',
    expiresAt: first(p, ['EndDate', 'ExpirationDate', 'ValidTo']) || null,
    displayOrder: 0,
  };
}

async function fetchPromotions() {
  const items = [];
  let uri = `${BASE}/Promotions?PageSize=100`;
  while (uri && items.length < LIMIT) {
    const res = await fetch(uri, { headers: { Authorization: AUTH, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Impact HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
    const body = await res.json();
    const page = body.Promotions ?? body.Promotion ?? [];
    const list = Array.isArray(page) ? page : [page].filter(Boolean);
    items.push(...list);
    const next = body['@nextpageuri'];
    uri = next ? `https://api.impact.com${next}` : null;
  }
  return items.slice(0, LIMIT);
}

async function main() {
  console.log(`Impact promotions sync (SID ${SID.slice(0, 8)}…, limit=${LIMIT})`);
  let raw;
  try {
    raw = await fetchPromotions();
  } catch (e) {
    console.error(`Fetch failed: ${e.message}`);
    console.error('Cache left as-is.');
    process.exit(1);
  }

  const coupons = raw.map(couponFromPromotion).filter((c) => c.store && c.title);
  console.log(`Fetched ${raw.length} promotion(s) → ${coupons.length} coupon(s).`);

  if (coupons.length === 0) {
    console.log('No active Impact promotions right now (advertiser has no live codes). Cache left as-is.');
    return;
  }

  writeFileSync(OUT, JSON.stringify({ network: 'impact', capturedAt: new Date().toISOString(), items: coupons }, null, 2));
  console.log(`Wrote ${coupons.length} Impact coupon(s) -> ${OUT}`);
}

main().catch((e) => { console.error('fetch-impact-promotions failed:', e.message); process.exit(1); });
