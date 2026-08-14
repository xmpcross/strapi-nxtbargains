import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type BestSeller, type Marketplace } from '@/components/BestSellerCard';

export type BestSellerMarketplace = {
  key: Marketplace;
  label: string;
  file: string;
  description: string;
};

export type BestSellerCategoryGroup = {
  key: string;
  label: string;
  items: BestSeller[];
};

export const BEST_SELLER_MARKETPLACES: BestSellerMarketplace[] = [
  {
    key: 'amazon',
    label: 'Amazon',
    file: 'best-sellers.json',
    description: 'The Amazon listings ranking highest for each category, refreshed daily.',
  },
  {
    key: 'ebay',
    label: 'eBay',
    file: 'best-sellers-ebay.json',
    description: 'The eBay listings ranking highest for each category, refreshed daily.',
  },
  {
    key: 'walmart',
    label: 'Walmart',
    file: 'best-sellers-walmart.json',
    description: 'Walmart electronics surfacing most across Google Shopping, refreshed daily.',
  },
  {
    key: 'target',
    label: 'Target',
    file: 'best-sellers-target.json',
    description: 'Target products surfacing most across Google Shopping, refreshed daily.',
  },
  {
    key: 'bestbuy',
    label: 'Best Buy',
    file: 'best-sellers-bestbuy.json',
    description: 'Best Buy products surfacing most across Google Shopping, refreshed daily.',
  },
  {
    key: 'newegg',
    label: 'Newegg',
    file: 'best-sellers-newegg.json',
    description: 'Newegg products surfacing most across Google Shopping, refreshed daily.',
  },
];

export function getBestSellerMarketplace(key: string) {
  return BEST_SELLER_MARKETPLACES.find((marketplace) => marketplace.key === key) ?? null;
}

export function listBestSellerGroups({ includeEmpty = false }: { includeEmpty?: boolean } = {}) {
  return BEST_SELLER_MARKETPLACES.map((marketplace) => ({
    key: marketplace.key,
    items: listBestSellersForMarketplace(marketplace.key),
  })).filter((group) => includeEmpty || group.items.length > 0);
}

export function listBestSellersForMarketplace(marketplaceKey: Marketplace): BestSeller[] {
  const marketplace = getBestSellerMarketplace(marketplaceKey);
  if (!marketplace) return [];

  try {
    const path = join(process.cwd(), 'data', marketplace.file);
    if (!existsSync(path)) return [];

    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { items?: BestSeller[] };
    const geniusDestinations = geniusDestinationMap();

    return (parsed.items ?? [])
      .map((item) => ({
        ...item,
        marketplace: marketplace.key,
        url: isGoogleShoppingUrl(geniusDestinations.get(item.url) ?? item.url)
          ? marketplaceSearchUrl(marketplace.key, item.title)
          : item.url,
      }))
      .filter((item) => Boolean(item.title && item.url));
  } catch {
    return [];
  }
}

export function listBestSellerCategoryGroupsForMarketplace(marketplaceKey: Marketplace): BestSellerCategoryGroup[] {
  const items = listBestSellersForMarketplace(marketplaceKey);
  const groups = new Map<string, BestSellerCategoryGroup>();

  for (const item of items) {
    const label = cleanCategoryLabel(item.categoryLabel ?? item.category);
    const key = slugifyCategory(label);

    if (!groups.has(key)) {
      groups.set(key, { key, label, items: [] });
    }

    groups.get(key)?.items.push(item);
  }

  return Array.from(groups.values());
}

function cleanCategoryLabel(value?: string | null) {
  const label = String(value ?? '').trim();
  return label || 'Top products';
}

function slugifyCategory(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'top-products';
}

function geniusDestinationMap() {
  try {
    const path = join(process.cwd(), 'data', 'geniuslink-cache.json');
    if (!existsSync(path)) return new Map<string, string>();
    const cache = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
    return new Map(Object.entries(cache).map(([destination, short]) => [short, destination]));
  } catch {
    return new Map<string, string>();
  }
}

function isGoogleShoppingUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const googleHost = host === 'googleadservices.com'
      || host.endsWith('.googleadservices.com')
      || host === 'shopping.google.com'
      || host.endsWith('.shopping.google.com')
      || /^google\.[a-z.]+$/.test(host)
      || /\.google\.[a-z.]+$/.test(host);
    if (!googleHost) return false;
    return host.includes('googleadservices')
      || host.includes('shopping.google')
      || ['/search', '/shopping', '/aclk', '/url'].some((path) => parsed.pathname.startsWith(path))
      || parsed.searchParams.get('tbm') === 'shop'
      || parsed.searchParams.get('udm') === '28'
      || parsed.searchParams.has('ibp');
  } catch {
    return false;
  }
}

function marketplaceSearchUrl(marketplace: Marketplace, title: string) {
  const query = encodeURIComponent(title.trim());
  if (marketplace === 'amazon') return `https://www.amazon.com/s?k=${query}`;
  if (marketplace === 'bestbuy') return `https://www.bestbuy.com/site/searchpage.jsp?st=${query}`;
  if (marketplace === 'ebay') return `https://www.ebay.com/sch/i.html?_nkw=${query}`;
  if (marketplace === 'newegg') return `https://www.newegg.com/p/pl?d=${query}`;
  if (marketplace === 'target') return `https://www.target.com/s?searchTerm=${query}`;
  if (marketplace === 'walmart') return `https://www.walmart.com/search?q=${query}`;
  return '';
}

// SEO blurbs under each Amazon category tab.
//
// These used to say "ranked by real sales" and "what people are actually
// buying". No feed behind this page has ever carried a sales figure — it was
// Google Shopping before and is DataForSEO now — so the claim was invented.
// Prominence is what the data supports, and that is what these say.
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'smart-phones':
    "The smartphones ranking highest on Amazon right now — unlocked flagships and budget picks, with ratings and prices so you can compare before you buy.",
  laptops:
    'The laptops ranking highest on Amazon, from lightweight ultrabooks to gaming machines — the models surfacing most for shoppers searching today.',
  tablets:
    "Amazon's most prominent tablets — iPads, Android slates and e-readers — with star ratings and prices at a glance.",
  smartwatches:
    'The smartwatches and fitness trackers ranking highest on Amazon — compare health features, battery life, ratings and price in one place.',
  headphones:
    'The headphones and earbuds ranking highest on Amazon — noise-cancelling over-ears, true-wireless buds and workout pairs.',
  'smart-tvs':
    "Amazon's most prominent smart TVs — 4K, QLED, OLED and budget models with ratings and current prices.",
  'smart-home':
    'The smart home devices surfacing most on Amazon — smart plugs, cameras, video doorbells, lights, locks and hubs.',
  'smart-electronics':
    'The smart electronics and connected gadgets ranking highest on Amazon — the trending tech worth a look.',
};

/** A category blurb for the best-seller tabs, with a sensible generated fallback. */
export function categoryDescription(key: string, label?: string): string {
  return (
    CATEGORY_DESCRIPTIONS[key] ??
    `The ${(label ?? key).toLowerCase()} ranking highest on Amazon right now, with ratings and current prices.`
  );
}

/** Amazon "New Releases" (OpenWeb Ninja Real-Time E-commerce Data). */
export function listAmazonNewReleases(): BestSeller[] {
  try {
    const path = join(process.cwd(), 'data', 'amazon-new-releases.json');
    if (!existsSync(path)) return [];
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { items?: BestSeller[] };
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}
