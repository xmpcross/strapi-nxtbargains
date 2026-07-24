#!/usr/bin/env node
/**
 * Sync coupons from Feedico (https://feedico.io) into the Strapi `nxt-coupons`
 * collection. Feedico aggregates affiliate networks (CJ, Awin, Impact,
 * Partnerize, Admitad, TradeTracker, Takeads) and returns AFFILIATE-READY links
 * scoped to your tracking IDs — so those links are stored in `affiliateUrl` and
 * used verbatim by the frontend (no GeniusLink wrap needed).
 *
 * Amazon is intentionally SKIPPED here — keep Amazon Associates + GeniusLink for
 * Amazon (Amazon isn't served by these networks). Any coupon that arrives without
 * a tracked link is stored in `destinationUrl`, which the frontend affiliate-wraps
 * via GeniusLink as a fallback.
 *
 *   node scripts/sync-feedico-coupons.mjs [--limit=500] [--dry]
 *
 * Env (.env.local):
 *   FEEDICO_API_TOKEN     Bearer token from the Feedico dashboard   [required]
 *   FEEDICO_BASE_URL      default https://api.feedico.io
 *   FEEDICO_COUPONS_PATH  default /v1/coupons
 *   FEEDICO_NETWORK       optional network filter (e.g. "cj"); free tier = 1 network
 *   NEXT_PUBLIC_STRAPI_URL / STRAPI_INTERNAL_URL   Strapi base
 *   STRAPI_API_TOKEN      Strapi API token with write access to nxt-coupon  [required]
 *
 * NOTE: Feedico's exact field names may differ from the assumptions in
 * mapFeedicoCoupon() below — adjust that one function to their real schema
 * (check a sample response first with --dry).
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
const NETWORKS = process.argv.includes('--networks');
// Drop non-English coupons (Admitad feeds are multi-locale). Default ON for a
// US/English storefront; pass --all-languages to keep everything.
const ENGLISH_ONLY = !process.argv.includes('--all-languages');
const LIMIT = parseInt(arg('limit', '500'), 10);

// Common English words used in coupon/deal titles — a title must contain at
// least one to count as English (filters Latin-script foreign languages too).
const EN_WORDS = /\b(off|for|with|free|extra|discount|code|order|orders|save|saving|savings|deal|deals|shipping|coupon|sale|and|the|on|get|new|gift|buy|only|now|over|first|all|from|your|store|price|cashback|voucher|promo|welcome|min|max|purchase|item|items|best|top|big|hot|super|limited|today|exclusive|clearance|bundle|bonus|up\s?to|percent)\b/i;

// Keep plain-English titles; drop Cyrillic/CJK/Arabic/Greek + Latin-script foreign.
function isEnglishTitle(s) {
  const t = String(s || '');
  if (/[Ѐ-ӿͰ-Ͽ؀-ۿ֐-׿぀-ヿ一-鿿가-힯]/.test(t)) return false; // non-Latin scripts
  return EN_WORDS.test(t);
}

const FEEDICO_TOKEN = process.env.FEEDICO_API_TOKEN;
const FEEDICO_BASE = (process.env.FEEDICO_BASE_URL || 'https://api.feedico.io').replace(/\/$/, '');
const FEEDICO_PATH = process.env.FEEDICO_COUPONS_PATH || '/api/v1/me/coupons'; // POST
const FEEDICO_NETWORK = process.env.FEEDICO_NETWORK || ''; // e.g. "impact_com"

const STRAPI = (process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.fxnstudio.com').replace(/\/$/, '');
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;

// Store names to skip (kept on Amazon Associates + GeniusLink).
const SKIP_STORES = /(^|\s)amazon(\s|$)/i;

if (!FEEDICO_TOKEN) { console.error('FEEDICO_API_TOKEN not set in .env.local — aborting.'); process.exit(1); }

// Local cache the /coupons pages read even before the Strapi collection exists.
const CACHE_OUT = join(ROOT, 'data', 'coupons-feedico.json');

const slugify = (s) =>
  String(s || '').toLowerCase().normalize('NFKD')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Placeholder "codes" that mean "no code needed" (Feedico/Admitad send these).
const PLACEHOLDER_CODE = /^(not required|no code|none|n\/?a|-+|не\s?нужен|не\s?требуется|нет)$/i;
const cleanStore = (s) => String(s || '').replace(/\s+WW$/i, '').trim(); // "AliExpress WW" → "AliExpress"

/** Map ONE Feedico coupon record → nxt-coupon fields (pinned to the live schema). */
function mapFeedicoCoupon(r) {
  const store = cleanStore(r.networkName || r.store || r.merchant || '');
  const rawCode = String(r.code || '').trim();
  const code = rawCode && !PLACEHOLDER_CODE.test(rawCode) ? rawCode : null;
  const network = r.provider || r.network || FEEDICO_NETWORK || 'feedico';
  const tracked = r.offerUrl || r.affiliate_url || r.tracking_url || r.deeplink || '';
  const discount = r.extra?.discount || r.discount || '';
  const typeName = r.extra?.types?.[0]?.name || '';
  const couponType = code ? 'Promo code' : (/sale|discount|off/i.test(`${typeName} ${discount}`) ? 'Sale' : 'Coupon');

  return {
    externalId: `feedico:${r.id ?? r.externalCouponId ?? `${slugify(store)}:${code ?? slugify(r.title || '')}`}`,
    source: `feedico:${network}`,
    store,
    storeSlug: slugify(store),
    title: r.title || r.description || `${store} offer`,
    code: code || undefined,
    discount,
    category: typeName ? `${store} — ${typeName}` : `${store} coupons`,
    couponType,
    // Feedico offerUrl is affiliate-ready (e.g. rzekl.com) → used verbatim.
    affiliateUrl: tracked || undefined,
    destinationUrl: tracked ? undefined : (r.url || undefined),
    featured: Boolean(r.featured),
    isBrand: true,
    verifiedLabel: 'Verified',
    expiresAt: r.endsAt || r.expires_at || null,
    displayOrder: 0,
  };
}

// Feedico coupons: POST /api/v1/me/coupons  { page, per_page, [provider] }
// → { ok, recordCount, page, pageSize, availableProviders, coupons: [...] }
async function fetchFeedicoCoupons() {
  const all = [];
  let page = 1;
  const perPage = 100;
  while (all.length < LIMIT) {
    const reqBody = { page, per_page: perPage };
    if (FEEDICO_NETWORK) reqBody.provider = FEEDICO_NETWORK;
    const res = await fetch(`${FEEDICO_BASE}${FEEDICO_PATH}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FEEDICO_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(reqBody),
    });
    if (!res.ok) {
      console.error(`Feedico ${res.status} on ${FEEDICO_PATH}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
      break;
    }
    const body = await res.json();
    const items = body.coupons || body.data || [];
    if (page === 1) console.log(`  provider(s): ${(body.availableProviders || []).join(', ') || 'n/a'} · recordCount: ${body.recordCount ?? '?'}`);
    if (!items.length) break;
    all.push(...items);
    const total = body.recordCount ?? null;
    const pageSize = body.pageSize ?? perPage;
    if (total != null && page * pageSize >= total) break;
    page++;
  }
  return all.slice(0, LIMIT);
}

// List connected merchants + their coupon counts.
// POST /api/v1/me/networks { page, per_page } → { networks: [...] }
async function fetchFeedicoNetworks() {
  const all = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${FEEDICO_BASE}/api/v1/me/networks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FEEDICO_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ page, per_page: 100 }),
    });
    if (!res.ok) {
      console.error(`Feedico networks ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
      break;
    }
    const body = await res.json();
    const items = body.networks || [];
    all.push(...items);
    const total = body.recordCount ?? null;
    const pageSize = body.pageSize ?? 100;
    if (!items.length || (total != null && page * pageSize >= total)) break;
    page++;
  }
  return all;
}

function printNetworks(networks) {
  if (networks.length === 0) {
    console.log('No merchants connected yet. Add merchants in the Feedico dashboard.');
    return;
  }
  const withCoupons = networks.filter((n) => (n.couponCount ?? 0) > 0);
  const totalCoupons = networks.reduce((s, n) => s + (n.couponCount ?? 0), 0);
  console.log(`\n${networks.length} merchant(s) connected · ${totalCoupons} coupon(s) total · ${withCoupons.length} with coupons\n`);
  const rows = [...networks].sort((a, b) => (b.couponCount ?? 0) - (a.couponCount ?? 0));
  const name = (n) => (n.displayName || n.merchantWebsiteUrl || n.externalMerchantKey || '?').slice(0, 48);
  const pad = Math.max(...rows.map((n) => name(n).length), 8);
  console.log(`${'MERCHANT'.padEnd(pad)}  ${'COUPONS'.padStart(7)}  ${'STATUS'.padEnd(8)}  PROVIDER`);
  console.log('-'.repeat(pad + 30));
  for (const n of rows) {
    const flag = n.lastSyncError ? ' ⚠ sync error' : '';
    console.log(
      `${name(n).padEnd(pad)}  ${String(n.couponCount ?? 0).padStart(7)}  ${String(n.status || '?').padEnd(8)}  ${n.provider || '?'}${flag}`,
    );
  }
  console.log('\nTip: merchants with 0 coupons have no active codes in the network right now.');
}

// Upsert one coupon into Strapi by externalId (create or update).
async function upsertCoupon(doc) {
  const q = new URLSearchParams();
  q.set('filters[externalId][$eq]', doc.externalId);
  q.set('pagination[pageSize]', '1');
  const findRes = await fetch(`${STRAPI}/api/nxt-coupons?${q}`, { headers: { Authorization: `Bearer ${STRAPI_TOKEN}` } });
  if (!findRes.ok) throw new Error(`Strapi find ${findRes.status}: ${await findRes.text().catch(() => '')}`);
  const existing = (await findRes.json())?.data?.[0];

  const method = existing ? 'PUT' : 'POST';
  const path = existing ? `/api/nxt-coupons/${existing.documentId}` : '/api/nxt-coupons';
  const res = await fetch(`${STRAPI}${path}`, {
    method,
    headers: { Authorization: `Bearer ${STRAPI_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: doc }),
  });
  if (!res.ok) throw new Error(`Strapi ${method} ${res.status}: ${await res.text().catch(() => '')}`);
  return existing ? 'updated' : 'created';
}

async function main() {
  if (NETWORKS) {
    printNetworks(await fetchFeedicoNetworks());
    return;
  }

  console.log(`Feedico → Strapi coupon sync (limit=${LIMIT}${DRY ? ', DRY RUN' : ''})`);
  const raw = await fetchFeedicoCoupons();
  console.log(`Fetched ${raw.length} coupons from Feedico.`);

  let docs = raw
    .map(mapFeedicoCoupon)
    .filter((d) => d.store && d.title && !SKIP_STORES.test(d.store));

  if (ENGLISH_ONLY) {
    const before = docs.length;
    docs = docs.filter((d) => isEnglishTitle(d.title));
    console.log(`English filter: kept ${docs.length}, dropped ${before - docs.length} non-English (use --all-languages to keep).`);
  }

  const byStore = docs.reduce((m, d) => ((m[d.store] = (m[d.store] || 0) + 1), m), {});
  console.log(`${docs.length} to sync (Amazon skipped → kept on Associates + GeniusLink):`, byStore);

  if (DRY) {
    console.log(JSON.stringify(docs.slice(0, 5), null, 2));
    console.log('DRY RUN — nothing written. Verify the mapping above, then run without --dry.');
    return;
  }

  // Always write the local cache (the /coupons pages read this immediately).
  writeFileSync(CACHE_OUT, JSON.stringify({ source: 'feedico', capturedAt: new Date().toISOString(), coupons: docs }, null, 2));
  console.log(`Wrote ${docs.length} coupon(s) -> ${CACHE_OUT}`);

  // Optionally also upsert into Strapi (only if a token is configured).
  if (!STRAPI_TOKEN) {
    console.log('STRAPI_API_TOKEN not set — cache written, Strapi upsert skipped.');
    return;
  }
  let created = 0, updated = 0, failed = 0;
  for (const doc of docs) {
    try {
      const r = await upsertCoupon(doc);
      r === 'created' ? created++ : updated++;
    } catch (e) {
      failed++;
      if (failed <= 3) console.error(`  ✗ ${doc.store} / ${doc.code ?? doc.title.slice(0, 40)}: ${e.message}`);
    }
  }
  console.log(`Strapi upsert: created=${created} updated=${updated} failed=${failed}${failed ? ' (collection created yet? see strapi-cms/nxt-coupon)' : ''}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
