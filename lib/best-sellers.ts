import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isGeniusLinkUrl } from '@/lib/commerce';
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
    description: 'Amazon best-selling products from the refreshed marketplace cache.',
  },
  {
    key: 'ebay',
    label: 'eBay',
    file: 'best-sellers-ebay.json',
    description: 'Popular eBay products from the refreshed marketplace cache.',
  },
  {
    key: 'walmart',
    label: 'Walmart',
    file: 'best-sellers-walmart.json',
    description: 'Walmart electronics deal picks from the refreshed marketplace cache.',
  },
  {
    key: 'target',
    label: 'Target',
    file: 'best-sellers-target.json',
    description: 'Target product picks from the refreshed marketplace cache.',
  },
  {
    key: 'bestbuy',
    label: 'Best Buy',
    file: 'best-sellers-bestbuy.json',
    description: 'Best Buy product picks from the refreshed marketplace cache.',
  },
  {
    key: 'newegg',
    label: 'Newegg',
    file: 'best-sellers-newegg.json',
    description: 'Newegg product picks from the refreshed marketplace cache.',
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
    return (parsed.items ?? [])
      .map((item) => ({
        ...item,
        marketplace: marketplace.key,
        // A Google Shopping results page is not a destination, and a geni.us
        // link is a dead one (see isGeniusLinkUrl). Both are replaced by a
        // search on the marketplace the item actually came from.
        url: isGoogleShoppingUrl(item.url) || isGeniusLinkUrl(item.url)
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

// SEO-friendly blurbs shown under each Amazon best-seller category tab.
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'smart-phones':
    "Amazon's best-selling smartphones right now — unlocked flagships and budget picks ranked by real sales, with ratings, Prime availability and current deals so you can compare before you buy.",
  laptops:
    'The top-selling laptops on Amazon, from lightweight ultrabooks to gaming machines — ranked by popularity so you can see exactly which models shoppers are buying most.',
  tablets:
    "Amazon's most popular tablets — iPads, Android slates and e-readers — ranked by sales, with star ratings and prices at a glance.",
  smartwatches:
    'Best-selling smartwatches and fitness trackers on Amazon, ranked by sales — compare health features, battery life, ratings and price in one place.',
  headphones:
    'The top-selling headphones and earbuds on Amazon — noise-cancelling over-ears, true-wireless buds and workout pairs — ranked by what people are actually buying.',
  'smart-tvs':
    "Amazon's best-selling smart TVs ranked by sales — 4K, QLED, OLED and budget models with ratings and the latest deals.",
  'smart-home':
    'The most popular smart home devices on Amazon — smart plugs, cameras, video doorbells, lights, locks and hubs — ranked by current demand.',
  'smart-electronics':
    'Top-selling smart electronics and connected gadgets on Amazon, ranked by popularity — the trending tech worth a look.',
};

/** A category blurb for the best-seller tabs, with a sensible generated fallback. */
export function categoryDescription(key: string, label?: string): string {
  return (
    CATEGORY_DESCRIPTIONS[key] ??
    `The best-selling ${(label ?? key).toLowerCase()} on Amazon right now, ranked by real sales with ratings, Prime availability and current deals.`
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
