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
  [/^dell/, 'dell.com'],
  [/lenovo/, 'lenovo.com'],
  [/samsung/, 'samsung.com'],
  [/apple/, 'apple.com'],
  [/^nike/, 'nike.com'],
  [/dyson/, 'dyson.com'],
  [/hp/, 'hp.com'],
];

// Patterns are tested against the store name lowercased with every
// non-alphanumeric stripped, so "Best Buy" arrives as "bestbuy". First match
// wins, so put the more specific pattern first where two could both hit.
export const sourceStoreLogos: Array<[RegExp, string]> = [
  [/amazon/, '/logos/amazon-logo.svg'],
  [/ebay/, '/logos/ebay-logo.svg'],
  [/walmart/, '/logos/walmart-logo.svg'],
  [/newegg/, '/logos/newegg-logo.svg'],
  // best-buy-logo.svg and bjs-wholesale-club-logo.svg were committed but never
  // referenced from either logo map, so both merchants fell through to a 128px
  // Google favicon. Best Buy is the second-largest merchant in the catalogue.
  [/bestbuy/, '/logos/best-buy-logo.svg'],
  [/^bjs/, '/logos/bjs-wholesale-club-logo.svg'],
  /* B&H must be matched before HP and anchored.
     
     sourceLogoForStore strips every non-alphanumeric before testing, so
     "B&H Photo-Video-Audio" becomes "bhphotovideoaudio" — and the unanchored
     /hp/ below matched the "hp" inside "b·hp·hoto". Every B&H offer in the
     price table was rendering HP's logo.
     
     Listed first because the list returns its first match, and anchored so it
     cannot repeat the same trick on some other merchant. */
  /* Anchored. sourceLogoForStore strips every non-alphanumeric before testing,
     so "B&H Photo-Video-Audio" becomes "bhphotovideoaudio" and an unanchored
     /hp/ matched the "hp" inside "b·hp·hoto" — every B&H offer in the price
     table rendered HP's logo.
     
     Anchoring is the whole fix: with no curated match, B&H falls through to
     the favicon leg of couponMerchantLogo and gets its own mark from
     bhphotovideo.com. Committing a hand-drawn B&H wordmark would be inventing
     someone's brand asset. */
  [/^hp/, '/logos/hp-logo.svg'],
  [/dell/, '/logos/dell-logo.svg'],
  [/lenovo/, '/logos/lenovo-logo.svg'],
  [/samsung/, '/logos/samsung-official.png'],
  [/apple/, '/logos/apple-logo.svg'],
  [/target/, '/logos/target-logo.svg'],
  [/nike/, '/logos/nike-logo.svg'],
  [/argos/, '/logos/argos-logo.svg'],

  // Fetched from each merchant's own site by ops/fetch-merchant-logos.mjs.
  // Before this, 55 of the 72 merchants carrying offers had no entry here and
  // fell through to a 128px Google favicon, sitting beside crisp SVGs in the
  // same price table.
  //
  // Regional variants come first: /eufy/ also matches "eufyau", so the more
  // specific pattern has to be reached first or it is dead code.
  [/eufyau/, '/logos/eufy-au-logo.png'],
  [/reolinkau/, '/logos/reolink-au-logo.png'],
  [/koganau/, '/logos/kogan-au-logo.ico'],
  [/reebeloau/, '/logos/reebelo-au-logo.png'],
  [/lifxau/, '/logos/lifx-au-logo.png'],
  [/ankerau/, '/logos/anker-au-logo.png'],

  [/jbhifi/, '/logos/jb-hi-fi-logo.png'],
  [/adorama/, '/logos/adorama-logo.ico'],
  [/thegoodguys/, '/logos/the-good-guys-logo.png'],
  [/crutchfield/, '/logos/crutchfield-logo.ico'],
  [/harveynorman/, '/logos/harvey-norman-logo.ico'],
  [/officeworks/, '/logos/officeworks-logo.ico'],
  [/bunnings/, '/logos/bunnings-logo.png'],
  [/staples/, '/logos/staples-logo.ico'],
  [/binglee/, '/logos/bing-lee-logo.ico'],
  [/^eufy/, '/logos/eufy-logo.png'],
  [/mwave/, '/logos/mwave-logo.ico'],
  [/mercari/, '/logos/mercari-logo.ico'],
  [/telstra/, '/logos/telstra-logo.png'],
  [/swappa/, '/logos/swappa-logo.ico'],
  [/dicksmith/, '/logos/dick-smith-logo.ico'],
  [/poshmark/, '/logos/poshmark-logo.png'],
  [/^zoro/, '/logos/zoro-logo.png'],
  [/samsclub/, '/logos/sam-s-club-logo.ico'],
  [/appliancesonline/, '/logos/appliances-online-logo.png'],
  [/beaconlighting/, '/logos/beacon-lighting-logo.png'],
  [/jaycar/, '/logos/jaycar-logo.ico'],
  [/mobileciti/, '/logos/mobileciti-logo.ico'],
  [/domayne/, '/logos/domayne-logo.ico'],
  [/videopro/, '/logos/videopro-logo.ico'],
  [/kmart/, '/logos/kmart-logo.ico'],
  [/googlefi/, '/logos/google-fi-logo.ico'],
  [/reolink/, '/logos/reolink-logo.png'],
  [/motorola/, '/logos/motorola-logo.ico'],
  // Anchored: a bare /abt/ would also match any name containing those letters.
  [/^abt$/, '/logos/abt-logo.ico'],
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
