import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type CouponStore = {
  id: number;
  name: string;
  url: string;
  domain: string;
  logo: string;
  country: string;
};

export type CouponStoreCache = {
  source?: string;
  capturedAt?: string;
  total?: number;
  pageSize?: number;
  pagesFetched?: number;
  stores: CouponStore[];
};

type HighIntentStore = {
  slug: string;
  storeId: number;
  label?: string;
  status?: string;
};

type HighIntentStoreCache = {
  stores?: HighIntentStore[];
};

const CACHE_FILE = join(process.cwd(), 'data', 'coupon-stores.json');
const HIGH_INTENT_FILE = join(process.cwd(), 'data', 'high-intent-coupon-stores.json');
const KNOWN_STORE_DOMAINS: Array<[RegExp, string]> = [
  [/amazon/, 'amazon.com'],
  [/ebay/, 'ebay.com'],
  [/walmart/, 'walmart.com'],
  [/newegg/, 'newegg.com'],
];

const SOURCE_STORE_LOGOS: Array<[RegExp, string]> = [
  [/amazon/, '/logos/amazon-logo.svg'],
  [/ebay/, '/logos/ebay-logo.svg'],
  [/walmart/, '/logos/walmart-logo.svg'],
  [/newegg/, '/logos/newegg-logo.svg'],
  [/hp/, '/logos/hp-logo.svg'],
  [/dell/, '/logos/dell-logo.svg'],
  [/lenovo/, '/logos/lenovo-logo.svg'],
  [/samsung/, '/logos/samsung-logo.svg'],
  [/apple/, '/logos/apple-logo.svg'],
  [/target/, '/logos/target-logo.svg'],
  [/nike/, '/logos/nike-logo.svg'],
  [/argos/, '/logos/argos-logo.svg'],
];

export function listCouponStores(): CouponStoreCache {
  if (!existsSync(CACHE_FILE)) return { stores: [] };
  try {
    const parsed = JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as CouponStoreCache;
    return { ...parsed, stores: Array.isArray(parsed.stores) ? parsed.stores : [] };
  } catch {
    return { stores: [] };
  }
}

export function findCouponStore(id: string) {
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) return null;
  return listCouponStores().stores.find((store) => store.id === numericId) ?? null;
}

export function couponStoreSlug(name: string) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function couponStorePublicSlug(store: Pick<CouponStore, 'name' | 'domain' | 'url'>) {
  const domain = store.domain || domainFromUrl(store.url);
  const base = domain.split('.')[0]?.toLowerCase();
  const nameSlug = couponStoreSlug(store.name);
  if (base && nameSlug === `${base}-com`) return base;
  return nameSlug;
}

export function couponStoreCanonicalSlug(store: Pick<CouponStore, 'id' | 'name' | 'domain' | 'url'>) {
  return highIntentStoreAliases().find((alias) => alias.storeId === store.id)?.slug ?? couponStorePublicSlug(store);
}

export function findCouponStoreBySlug(slug: string) {
  const normalized = slug.toLowerCase();
  const stores = listCouponStores().stores;
  const alias = highIntentStoreAliases().find((store) => store.slug === normalized);
  if (alias) {
    const match = stores.find((store) => store.id === alias.storeId);
    if (match) return match;
  }

  return stores
    .filter((store) => couponStorePublicSlug(store) === normalized || couponStoreSlug(store.name) === normalized)
    .sort((a, b) => publicSlugScore(a, normalized) - publicSlugScore(b, normalized))[0] ?? null;
}

export function highIntentStoreAliases() {
  if (!existsSync(HIGH_INTENT_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(HIGH_INTENT_FILE, 'utf8')) as HighIntentStoreCache;
    return (Array.isArray(parsed.stores) ? parsed.stores : [])
      .filter((store) => store.status === 'active' && store.slug && Number.isFinite(store.storeId));
  } catch {
    return [];
  }
}

const STORE_COUPON_CACHE_FILE = join(process.cwd(), 'data', 'coupon-store-coupons.json');

let indexableCouponStoreIdCache: Set<number> | null = null;

/**
 * Store IDs whose coupon page carries real, indexable content: the curated
 * high-intent stores, plus any store whose cached feed currently has at least
 * one coupon. Across ~18k auto-imported stores the vast majority have no
 * coupons, so their pages are thin/boilerplate — we keep those out of the
 * sitemap and mark them noindex so they don't dilute crawl budget or Google's
 * quality signals. A store re-enters the index automatically once it has coupons.
 */
export function indexableCouponStoreIds(): Set<number> {
  if (indexableCouponStoreIdCache) return indexableCouponStoreIdCache;

  const ids = new Set<number>();
  for (const alias of highIntentStoreAliases()) ids.add(alias.storeId);

  if (existsSync(STORE_COUPON_CACHE_FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(STORE_COUPON_CACHE_FILE, 'utf8')) as {
        stores?: Record<string, { storeId?: number; coupons?: unknown[] }>;
      };
      for (const entry of Object.values(parsed.stores ?? {})) {
        if (entry?.storeId != null && Array.isArray(entry.coupons) && entry.coupons.length > 0) {
          ids.add(Number(entry.storeId));
        }
      }
    } catch {
      // fall back to high-intent only
    }
  }

  indexableCouponStoreIdCache = ids;
  return ids;
}

/** Whether a coupon store page should be indexable / included in the sitemap. */
export function couponStoreIsIndexable(store: Pick<CouponStore, 'id'>): boolean {
  return indexableCouponStoreIds().has(store.id);
}

export function relatedCouponStores(store: CouponStore, limit = 6) {
  const category = storeCategory(store);
  return listCouponStores().stores
    .filter((candidate) => candidate.id !== store.id && storeCategory(candidate) === category)
    .slice(0, limit);
}

function publicSlugScore(store: Pick<CouponStore, 'name' | 'domain' | 'url'>, slug: string) {
  const domain = store.domain || domainFromUrl(store.url);
  const base = domain.split('.')[0]?.toLowerCase();
  if (base === slug && /^www\./i.test(hostnameFromUrl(store.url))) return 0;
  if (base === slug && couponStorePublicSlug(store) === slug) return 1;
  if (couponStoreSlug(store.name) === slug) return 2;
  return 3;
}

function hostnameFromUrl(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
}

export function storeSearchText(store: CouponStore) {
  return `${store.name} ${store.domain} ${store.country} ${storeCategory(store)}`.toLowerCase();
}

export function countryName(code: string) {
  if (!code) return 'Global';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

export function storeLogoUrl(store: Pick<CouponStore, 'name' | 'logo' | 'domain' | 'url'>) {
  const sourceLogo = sourceLogoForStore(store.name);
  if (sourceLogo) return sourceLogo;

  const domain = knownStoreDomain(store.name) || store.domain || domainFromUrl(store.url);
  if (domain) return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  if (store.logo) return store.logo;
  return '';
}

function sourceLogoForStore(name: string) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return SOURCE_STORE_LOGOS.find(([pattern]) => pattern.test(normalized))?.[1] ?? '';
}

function knownStoreDomain(name: string) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return KNOWN_STORE_DOMAINS.find(([pattern]) => pattern.test(normalized))?.[1] ?? '';
}

export function storeCategory(store: Pick<CouponStore, 'name' | 'domain' | 'url'>) {
  const text = `${store.name} ${store.domain} ${store.url}`.toLowerCase();
  const rules: Array<[string, RegExp]> = [
    ['Electronics', /tech|electronic|computer|pc|laptop|phone|mobile|camera|audio|gadget|newegg|samsung|lenovo|dell|hp|apple|microsoft/],
    ['Fashion', /fashion|clothing|apparel|shoe|sneaker|dress|wear|jacket|watch|style|boutique|nike|adidas/],
    ['Home and Garden', /home|garden|furniture|decor|mattress|bedding|kitchen|appliance|lighting|dyson|wayfair/],
    ['Beauty and Health', /beauty|skin|cosmetic|makeup|hair|health|wellness|vitamin|pharmacy|derma|spa/],
    ['Travel', /travel|hotel|flight|vacation|trip|booking|cruise|airline|luggage|resort/],
    ['Food and Grocery', /food|grocery|wine|coffee|tea|restaurant|meal|snack|drink|kitchen/],
    ['Sports and Outdoors', /sport|outdoor|fitness|bike|camp|golf|hiking|run|yoga|gym/],
    ['Automotive', /auto|car|motor|tire|truck|vehicle|parts|garage/],
    ['Baby and Kids', /baby|kid|toy|stroller|children|child|nursery/],
    ['Pets', /pet|dog|cat|aquarium|chewy/],
    ['Office and Business', /office|business|print|supply|software|saas|hosting|domain/],
    ['Gaming', /game|gaming|xbox|playstation|nintendo|steam/],
    ['Jewelry', /jewel|diamond|ring|gold|silver/],
    ['Finance', /finance|bank|credit|loan|card|money|insurance/],
    ['Education', /course|learn|school|education|book|training/],
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] ?? 'General';
}

function domainFromUrl(url: string) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

