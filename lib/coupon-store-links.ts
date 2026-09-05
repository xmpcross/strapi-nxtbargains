import type { CouponBrandGroup, Retailer } from '@/lib/coupon-data';
import {
  highIntentStoreAliases,
  listCouponStores,
  storeLogoUrl,
  type CouponStore,
} from '@/lib/coupon-stores';

export type CouponStoreLink = {
  name: string;
  href: string;
  slug: string;
  domain?: string;
  logo?: string;
};

const knownStoreDomains: Array<[RegExp, string]> = [
  [/amazon/, 'amazon.com'],
  [/ebay/, 'ebay.com'],
  [/walmart/, 'walmart.com'],
  [/newegg/, 'newegg.com'],
  [/bestbuy/, 'bestbuy.com'],
  [/target/, 'target.com'],
  [/dell/, 'dell.com'],
  [/lenovo/, 'lenovo.com'],
  [/samsung/, 'samsung.com'],
  [/apple/, 'apple.com'],
  [/nike/, 'nike.com'],
  [/dyson/, 'dyson.com'],
  [/hp/, 'hp.com'],
];

export const sourceStoreLogos: Array<[RegExp, string]> = [
  [/amazon/, '/logos/amazon-logo.svg'],
  [/ebay/, '/logos/ebay-logo.svg'],
  [/walmart/, '/logos/walmart-logo.svg'],
  [/newegg/, '/logos/newegg-logo.svg'],
  [/hp/, '/logos/hp-logo.svg'],
  [/dell/, '/logos/dell-logo.svg'],
  [/lenovo/, '/logos/lenovo-logo.svg'],
  [/samsung/, '/logos/samsung-official.png'],
  [/apple/, '/logos/apple-logo.svg'],
  [/target/, '/logos/target-logo.svg'],
  [/nike/, '/logos/nike-logo.svg'],
  [/argos/, '/logos/argos-logo.svg'],
];

function storePageHref(name: string) {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === 'amazon' ? '/coupons/amazon' : `/coupons/${slug}`;
}

function brandCouponHref(slug: string) {
  return slug === 'amazon' ? '/coupons/amazon' : `/coupons/${slug}`;
}

function knownStoreDomain(name: string) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return knownStoreDomains.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}

function merchantLogo(store?: Pick<CouponStore, 'name' | 'logo' | 'domain' | 'url'>) {
  if (!store) return undefined;
  return storeLogoUrl(store) || undefined;
}

function titleCase(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function sourceLogoForStore(name: string) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return sourceStoreLogos.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}

export function couponRetailersForStoreLinks(
  retailers: Retailer[],
  brandGroups: CouponBrandGroup[],
): Retailer[] {
  return brandGroups.length > 0 ? brandGroups.map((group) => group.store) : retailers;
}

export function buildCouponStoreLinks(retailers: Retailer[]): CouponStoreLink[] {
  const couponStores = listCouponStores().stores;
  const storesById = new Map(couponStores.map((store) => [store.id, store]));
  const aliases = highIntentStoreAliases().map((store) => ({
    name: store.label || titleCase(store.slug),
    href: brandCouponHref(store.slug),
    slug: store.slug,
    domain: storesById.get(store.storeId)?.domain || knownStoreDomain(store.label || store.slug) || undefined,
    logo: merchantLogo(storesById.get(store.storeId)),
  }));

  const retailerLinks = retailers.map((retailer) => ({
    name: retailer.name,
    href: retailer.href.startsWith('/coupons/') ? retailer.href : storePageHref(retailer.name),
    slug: retailer.href.startsWith('/coupons/')
      ? retailer.href.split('/').filter(Boolean).pop() || ''
      : storePageHref(retailer.name).split('/').pop() || '',
    domain: retailer.domain || knownStoreDomain(retailer.name) || undefined,
    logo: retailer.logo || undefined,
  }));

  const seen = new Set<string>();
  return [...aliases, ...retailerLinks]
    .filter((store) => {
      const key = store.slug || store.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 36);
}
