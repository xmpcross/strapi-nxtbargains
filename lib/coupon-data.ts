import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { wrapImpactAffiliate } from './impact-links';
import { couponStoreSlug } from './coupon-stores';
import { listNxtCoupons, type NxtCoupon } from './strapi';

const COUPON_REVALIDATE_SECONDS = 86400;
const GENIUSLINK_CACHE_FILE = join(process.cwd(), 'data', 'geniuslink-cache.json');
const STORE_COUPON_CACHE_FILE = join(process.cwd(), 'data', 'coupon-store-coupons.json');
const GENIUSLINK_TIMEOUT_MS = 15000;

export type Coupon = {
  store: string;
  title: string;
  code?: string;
  discount: string;
  category: string;
  href: string;
  type: 'Coupon' | 'Promo code' | 'Sale';
  verified: string;
  featured?: boolean;
};

export type Retailer = {
  name: string;
  label: string;
  href: string;
  logo?: string;
  domain?: string;
};

export type CouponBrandGroup = {
  store: Retailer;
  coupons: Coupon[];
};

type ApiRecord = Record<string, unknown>;
type StoreCouponCache = {
  stores?: Record<string, {
    capturedAt?: string;
    coupons?: Coupon[];
  }>;
};

const STARTER_COUPONS: Coupon[] = [
  {
    store: 'Amazon',
    title: 'Clip limited-time coupons before checkout on featured electronics and home products.',
    discount: 'Up to 40% off',
    category: 'Amazon coupons',
    href: '/coupons/amazon',
    type: 'Coupon',
    verified: 'Updated today',
    featured: true,
  },
  {
    store: 'eBay',
    title: 'Stack seller markdowns with seasonal voucher offers across tech, fashion, and home.',
    code: 'DEALSTACK',
    discount: 'Extra 10% off',
    category: 'Marketplace codes',
    href: '/search?q=ebay+promo+code',
    type: 'Promo code',
    verified: 'Verified feed',
    featured: true,
  },
  {
    store: 'Walmart',
    title: 'Rollbacks and online-only offers on smart home, appliances, toys, and daily essentials.',
    discount: 'Rollback deals',
    category: 'Department deals',
    href: '/search?q=walmart+deals',
    type: 'Sale',
    verified: 'Updated daily',
  },
  {
    store: 'Best Buy',
    title: 'Member pricing and open-box savings on laptops, TVs, monitors, and headphones.',
    code: 'TECHSAVE',
    discount: 'Save 5-25%',
    category: 'Electronics',
    href: '/search?q=best+buy+promo+code',
    type: 'Promo code',
    verified: 'Checked today',
  },
  {
    store: 'Target',
    title: 'Circle offers and weekly promo-code drops for beauty, home, baby, and seasonal goods.',
    discount: 'Weekly offers',
    category: 'Home and lifestyle',
    href: '/search?q=target+coupon',
    type: 'Coupon',
    verified: 'Fresh picks',
  },
  {
    store: 'Newegg',
    title: 'PC parts, gaming gear, storage, and component bundles with checkout code savings.',
    code: 'BUILDNOW',
    discount: 'Extra 12% off',
    category: 'Computing',
    href: '/search?q=newegg+promo+code',
    type: 'Promo code',
    verified: 'Code checked',
  },
];

const FALLBACK_RETAILERS: Retailer[] = [
  { name: 'Amazon', label: 'Amazon coupon codes', href: '/coupons/amazon' },
  { name: 'eBay', label: 'eBay promo codes', href: '/coupons/ebay' },
  { name: 'Walmart', label: 'Walmart coupons', href: '/coupons/walmart' },
  { name: 'Best Buy', label: 'Best Buy discount codes', href: '/search?q=best+buy+discount+codes' },
  { name: 'Target', label: 'Target coupons', href: '/search?q=target+coupons' },
  { name: 'Newegg', label: 'Newegg promo codes', href: '/coupons/newegg' },
  { name: 'Nike', label: 'Nike discount codes', href: '/search?q=nike+discount+codes' },
  { name: 'Dell', label: 'Dell coupon codes', href: '/search?q=dell+coupon+codes' },
  { name: 'Lenovo', label: 'Lenovo promo codes', href: '/search?q=lenovo+promo+codes' },
  { name: 'Samsung', label: 'Samsung coupons', href: '/search?q=samsung+coupons' },
  { name: 'Dyson', label: 'Dyson discount codes', href: '/search?q=dyson+discount+codes' },
  { name: 'HP', label: 'HP coupon codes', href: '/coupons/hp' },
];

// NOTE: The live RapidAPI "get-promo-codes" coupon/store/brand feed has been
// removed (that subscription is no longer active). Coupons now come from the CMS
// (Strapi nxt-coupon) and the local feed caches — CouponAPI.org / Feedico /
// AWIN / TradeDoubler — written by the scripts/ fetchers. See README
// "Coupon source priority".

let geniusCache: Record<string, string> | null = null;
let geniusDirty = false;

function geniusEnabled() {
  return Boolean(process.env.GENIUSLINK_API_KEY && process.env.GENIUSLINK_API_SECRET && process.env.GENIUSLINK_GROUP_ID);
}

function loadGeniusCache() {
  if (geniusCache) return geniusCache;
  try {
    geniusCache = existsSync(GENIUSLINK_CACHE_FILE)
      ? JSON.parse(readFileSync(GENIUSLINK_CACHE_FILE, 'utf8')) as Record<string, string>
      : {};
  } catch {
    geniusCache = {};
  }
  return geniusCache;
}

export function flushGeniusCache() {
  if (!geniusDirty || !geniusCache) return;
  try {
    // Read-only filesystems (e.g. Netlify/serverless functions) can't persist
    // the cache — that's fine, it just stays in-memory for this instance.
    writeFileSync(GENIUSLINK_CACHE_FILE, JSON.stringify(geniusCache, null, 2));
  } catch {
    // ignore — no disk persistence available
  }
  geniusDirty = false;
}

function readStoreCouponCache(storeId: number | string) {
  if (!existsSync(STORE_COUPON_CACHE_FILE)) return null;
  try {
    const parsed = JSON.parse(readFileSync(STORE_COUPON_CACHE_FILE, 'utf8')) as StoreCouponCache;
    const cached = parsed.stores?.[String(storeId)]?.coupons;
    return Array.isArray(cached) ? cached : null;
  } catch {
    return null;
  }
}

async function geniusWrap(url: string) {
  if (!url || !url.startsWith('http') || !geniusEnabled()) return url;
  if (/^https?:\/\/(?:www\.)?geni\.us\//i.test(url)) return url;

  const cache = loadGeniusCache();
  if (cache[url]) return cache[url];

  const domain = process.env.GENIUSLINK_DOMAIN || 'geni.us';
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), GENIUSLINK_TIMEOUT_MS);
    const res = await fetch('https://api.geni.us/v3/shorturls', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'X-Api-Key': process.env.GENIUSLINK_API_KEY ?? '',
        'X-Api-Secret': process.env.GENIUSLINK_API_SECRET ?? '',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        url,
        groupId: Number(process.env.GENIUSLINK_GROUP_ID),
        domain,
        linkCreatorSetting: 'Simple',
      }),
      next: { revalidate: COUPON_REVALIDATE_SECONDS },
    });
    if (!res.ok) return url;
    const code = (await res.json())?.shortUrl?.code;
    if (!code) return url;
    const shortUrl = `https://${domain}/${code}`;
    cache[url] = shortUrl;
    geniusDirty = true;
    return shortUrl;
  } catch {
    return url;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function monetizeUrl(url: string) {
  const impactUrl = wrapImpactAffiliate({ id: 0, productUrl: url });
  if (impactUrl) return impactUrl;
  return geniusWrap(url);
}

async function geniusWrapCoupons(coupons: Coupon[]) {
  const wrapped: Coupon[] = [];
  for (const coupon of coupons) {
    wrapped.push({ ...coupon, href: await monetizeUrl(coupon.href) });
  }
  flushGeniusCache();
  return wrapped;
}

function isRecord(value: unknown): value is ApiRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordsFrom(value: unknown): ApiRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];

  for (const key of ['data', 'coupons', 'results', 'items', 'offers', 'records', 'list', 'deals']) {
    const nested = recordsFrom(value[key]);
    if (nested.length > 0) return nested;
  }

  return [];
}

function textField(record: ApiRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function absoluteHref(value: string | null, fallback: string): string {
  if (!value) return fallback;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return fallback;
}

function nestedRecord(record: ApiRecord, key: string): ApiRecord {
  const value = record[key];
  return isRecord(value) ? value : {};
}

function storeNameFromUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const host = new URL(value).hostname.replace(/^www\./, '');
    const base = host.split('.')[0];
    if (!base) return host;
    return base
      .split(/[-_]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  } catch {
    return null;
  }
}

function couponFromAmazonDeal(record: ApiRecord): Coupon | null {
  const pricing = nestedRecord(record, 'pricing');
  const promo = nestedRecord(record, 'promo');
  const coupon = nestedRecord(record, 'coupon');
  const urls = nestedRecord(record, 'urls');
  const offer = nestedRecord(record, 'offer');

  const store = textField(offer, ['merchant']) || 'Amazon';
  const title = textField(record, ['product_name', 'productName', 'name', 'title']);
  if (!title) return null;

  const code = textField(promo, ['code']);
  const couponText = textField(coupon, ['raw']);
  const totalDiscount = textField(record, ['total_discount_pct', 'totalDiscountPct']);
  const promoDiscount = textField(promo, ['discount_pct', 'discountPct']);
  const combinedPrice = textField(pricing, ['estimated_combined_price', 'estimatedCombinedPrice']);
  const promoPrice = textField(pricing, ['price_after_promo_only', 'priceAfterPromoOnly']);
  const discount = totalDiscount
    ? `${totalDiscount}% off`
    : promoDiscount
      ? `${promoDiscount}% promo`
      : couponText || 'Amazon deal';

  return {
    store,
    title,
    code: code || undefined,
    discount: combinedPrice ? `${discount} - est. ${combinedPrice}` : discount,
    category: textField(record, ['category']) || 'Amazon deals',
    href: absoluteHref(
      textField(urls, ['affiliate', 'product']) || textField(promo, ['promo_url', 'promoUrl']),
      `/search?q=${encodeURIComponent(`${title} Amazon promo`)}`,
    ),
    type: code ? 'Promo code' : 'Coupon',
    verified: promoPrice ? `Promo price ${promoPrice}` : 'Recently updated',
    featured: true,
  };
}

function couponFromRecord(record: ApiRecord, source: 'promo' | 'amazonDeals', storesById?: Map<string, Retailer>): Coupon | null {
  if (source === 'amazonDeals') return couponFromAmazonDeal(record);

  const storeUrl = textField(record, ['url', 'link', 'store_url', 'storeUrl', 'website', 'domain']);
  const storeId = textField(record, ['store_id', 'storeId']);
  const store = textField(record, [
    'store',
    'store_name',
    'merchant',
    'merchant_name',
    'merchantName',
    'shop',
    'brand',
    'website',
    'domain',
  ]) || storesById?.get(storeId ?? '')?.name || storeNameFromUrl(storeUrl) || (storeId ? `Store ${storeId}` : null);

  const title = textField(record, [
    'title',
    'description',
    'coupon_title',
    'couponTitle',
    'offer',
    'name',
    'product_title',
    'productTitle',
    'product_name',
  ]);

  if (!store || !title) return null;

  const code = textField(record, ['code', 'coupon_code', 'couponCode', 'promo_code', 'promoCode', 'discount_code']);
  const discount = textField(record, [
    'discount',
    'discount_text',
    'discountText',
    'value',
    'saving',
    'savings',
    'percent_off',
    'percentOff',
  ]) || (code ? 'Promo code' : 'Coupon offer');
  const category = textField(record, ['category', 'category_name', 'categoryName', 'type']) || 'Promo codes';
  const href = absoluteHref(
    storeUrl || textField(record, ['affiliate_url', 'affiliateUrl', 'product_url', 'productUrl']),
    `/search?q=${encodeURIComponent(`${store} ${code ? 'promo code' : 'coupon'}`)}`,
  );
  const expires = textField(record, ['expires', 'expiry', 'expiry_date', 'expire_date', 'end_date', 'valid_till']);

  return {
    store,
    title,
    code: code || undefined,
    discount,
    category,
    href,
    type: code ? 'Promo code' : 'Coupon',
    verified: expires ? `Expires ${expires}` : 'Recently updated',
    featured: Boolean(code),
  };
}

function retailerFromRecord(record: ApiRecord): Retailer | null {
  const name = textField(record, ['name', 'store', 'store_name', 'storeName', 'merchant', 'merchant_name', 'title']);
  if (!name) return null;
  const domain = textField(record, ['domain', 'website']);
  const href = absoluteHref(
    textField(record, ['url', 'link', 'store_url', 'storeUrl', 'website', 'domain']),
    `/search?q=${encodeURIComponent(`${name} promo codes`)}`,
  );

  return {
    name,
    label: `${name} promo codes`,
    href,
    logo: textField(record, ['logo']) || undefined,
    domain: domain || undefined,
  };
}

function retailerFromCoupon(coupon: Coupon): Retailer {
  return {
    name: coupon.store,
    label: `${coupon.store} ${coupon.code ? 'promo codes' : 'coupons'}`,
    href: `/coupons/${couponStoreSlug(coupon.store)}`,
  };
}


// Map a CMS coupon record to the frontend Coupon shape.
function couponFromStrapi(c: NxtCoupon): Coupon {
  return {
    store: c.store,
    title: c.title,
    code: c.code ?? undefined,
    discount: c.discount ?? '',
    category: c.category ?? `${c.store} coupons`,
    href:
      c.affiliateUrl?.trim() ||
      c.destinationUrl?.trim() ||
      `/coupons/${c.storeSlug?.trim() || couponStoreSlug(c.store)}`,
    type: c.couponType ?? (c.code ? 'Promo code' : 'Sale'),
    verified: c.verifiedLabel ?? 'Verified',
    featured: Boolean(c.featured),
  };
}

function couponStoreHref(c: NxtCoupon): string {
  return `/coupons/${c.storeSlug?.trim() || couponStoreSlug(c.store)}`;
}

// Local coupon-feed caches (written by the sync scripts). Read even before the
// Strapi collection exists so synced coupons show immediately.
// NOTE: CouponAPI.org was discontinued; Feedico is the remaining local feed.
const COUPON_FEED_FILES: Record<string, string> = {
  feedico: join(process.cwd(), 'data', 'coupons-feedico.json'),
};

function couponFeedOrder(): string[] {
  const forced = (process.env.COUPON_FEED_SOURCE || '').trim().toLowerCase();
  if (forced && COUPON_FEED_FILES[forced]) return [forced];
  return ['feedico'];
}

function readCouponFeedCache(): NxtCoupon[] {
  // Merge local feed caches (currently Feedico) in priority order, deduped.
  const seen = new Set<string>();
  const merged: NxtCoupon[] = [];
  for (const source of couponFeedOrder()) {
    const file = COUPON_FEED_FILES[source];
    try {
      if (!file || !existsSync(file)) continue;
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as { coupons?: NxtCoupon[]; items?: NxtCoupon[] };
      const rows = Array.isArray(parsed.coupons) ? parsed.coupons : Array.isArray(parsed.items) ? parsed.items : [];
      for (const row of rows) {
        const key = row.externalId || `${row.store}|${row.code ?? ''}|${row.title}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(row);
      }
    } catch {
      // try next source
    }
  }
  return merged;
}

// Build coupon page data from a set of NxtCoupon rows (Strapi or Feedico cache).
// `wrap` = affiliate-wrap the links via GeniusLink; skip for already-tracked
// feed links (e.g. Feedico/Admitad offerUrl).
async function buildCouponPageData(
  rows: NxtCoupon[],
  wrap: boolean,
): Promise<{ coupons: Coupon[]; retailers: Retailer[]; brandGroups: CouponBrandGroup[] } | null> {
  if (rows.length === 0) return null;

  const coupons = rows.map(couponFromStrapi);

  const retailerSeen = new Set<string>();
  const retailers: Retailer[] = [];
  for (const row of rows) {
    const key = row.store.toLowerCase();
    if (retailerSeen.has(key)) continue;
    retailerSeen.add(key);
    retailers.push({ name: row.store, label: `${row.store} coupons`, href: couponStoreHref(row) });
  }

  const byStore = new Map<string, Coupon[]>();
  for (const row of rows.filter((r) => r.isBrand)) {
    const list = byStore.get(row.store) ?? [];
    list.push(couponFromStrapi(row));
    byStore.set(row.store, list);
  }
  const brandGroups: CouponBrandGroup[] = [...byStore.entries()].slice(0, 8).map(([store, cps]) => ({
    store: retailers.find((r) => r.name === store) ?? {
      name: store,
      label: `${store} coupons`,
      href: `/coupons/${couponStoreSlug(store)}`,
    },
    coupons: cps,
  }));

  return { coupons: wrap ? await geniusWrapCoupons(coupons) : coupons, retailers: retailers.slice(0, 12), brandGroups };
}

export async function listCouponPageData(): Promise<{ coupons: Coupon[]; retailers: Retailer[]; brandGroups: CouponBrandGroup[] }> {
  // Prefer CMS-curated coupons, then the local Feedico cache, then legacy source.
  const strapi = await buildCouponPageData(await listNxtCoupons({ pageSize: 200 }), true);
  if (strapi) return strapi;

  const feedico = await buildCouponPageData(readCouponFeedCache(), false);
  if (feedico) return feedico;

  // No CMS/feed coupons available — fall back to the built-in starter set.
  return {
    coupons: STARTER_COUPONS,
    retailers: FALLBACK_RETAILERS,
    brandGroups: [],
  };
}

export async function listCouponsForStore(
  storeId: number | string,
  storeName?: string,
  storeSlug?: string,
): Promise<Coupon[]> {
  // Prefer CMS-curated coupons for this store; then the local Feedico cache
  // (already affiliate-tracked → no wrap); then the legacy cache/API.
  const strapiRows = await listNxtCoupons({ store: storeName, storeSlug, pageSize: 48 });
  if (strapiRows.length > 0) return geniusWrapCoupons(strapiRows.map(couponFromStrapi));

  const slugLc = (storeSlug || '').toLowerCase();
  const nameLc = (storeName || '').toLowerCase();
  const feedicoRows = readCouponFeedCache().filter(
    (c) =>
      (slugLc && (c.storeSlug || '').toLowerCase() === slugLc) ||
      (nameLc && c.store.toLowerCase() === nameLc),
  );
  if (feedicoRows.length > 0) return feedicoRows.map(couponFromStrapi);

  const cached = readStoreCouponCache(storeId);
  if (cached) return geniusWrapCoupons(cached);

  // No CMS, feed, or cached coupons for this store.
  return [];
}

export async function listCoupons(): Promise<Coupon[]> {
  const { coupons } = await listCouponPageData();
  return coupons;
}

export async function listHomepageCoupons(limit = 4): Promise<Coupon[]> {
  const coupons = await listCoupons();
  const featured = coupons.filter((coupon) => coupon.featured);
  return (featured.length > 0 ? featured : coupons).slice(0, limit);
}
