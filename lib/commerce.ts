import { mediaUrl, type CommerceOffer, type CommerceProduct } from '@/lib/strapi';

export type CommerceOfferRow = {
  offer: CommerceOffer;
  product: CommerceProduct;
};

/**
 * A Geniuslink short link.
 *
 * The Geniuslink account behind these is gone — every geni.us link in the
 * cached feeds now answers HTTP 410, so they are dead outbound links that earn
 * nothing. The destination cannot be recovered from the short code either (410
 * carries no redirect), so callers substitute a merchant search URL where they
 * can derive one and drop the entry where they cannot.
 */
export function isGeniusLinkUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'geni.us' || host.endsWith('.geni.us');
  } catch {
    return false;
  }
}

export function numericValue(value?: number | string | null): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function offerPrice(offer: CommerceOffer): number | null {
  return numericValue(offer.price) ?? numericValue(offer.originalPrice);
}

export function formatMoney(value?: number | string | null, currency = 'USD'): string {
  const price = numericValue(value);
  if (price === null) return 'Check price';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price);
}

export function merchantName(offer: CommerceOffer): string {
  return (offer.merchant?.name ?? 'Merchant').replace(/\s+Affiliate Program$/i, '');
}

function parsedHttpUrl(value?: string | null): URL | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null;
  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

function isGoogleHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'googleadservices.com'
    || host.endsWith('.googleadservices.com')
    || host === 'shopping.google.com'
    || host.endsWith('.shopping.google.com')
    || /^google\.[a-z.]+$/.test(host)
    || /\.google\.[a-z.]+$/.test(host);
}

export function isGoogleShoppingUrl(value?: string | null): boolean {
  const parsed = parsedHttpUrl(value);
  if (!parsed || !isGoogleHost(parsed.hostname)) return false;
  return parsed.hostname.includes('googleadservices')
    || parsed.hostname.includes('shopping.google')
    || ['/search', '/shopping', '/aclk', '/url'].some((path) => parsed.pathname.startsWith(path))
    || parsed.searchParams.get('tbm') === 'shop'
    || parsed.searchParams.get('udm') === '28'
    || parsed.searchParams.has('ibp');
}

function isAmazonSearchUrl(value: string): boolean {
  const parsed = parsedHttpUrl(value);
  if (!parsed) return false;
  const hostname = parsed.hostname.replace(/^www\./, '').toLowerCase();
  const isAmazon = hostname === 'amazon.com' || hostname.endsWith('.amazon.com') || hostname.includes('amazon.');
  return isAmazon && (parsed.pathname === '/s' || parsed.searchParams.has('k'));
}

function nestedMerchantUrl(value: string): string | null {
  const parsed = parsedHttpUrl(value);
  if (!parsed) return null;
  for (const key of ['url', 'u', 'q', 'adurl', 'target', 'redirect']) {
    const nested = parsed.searchParams.get(key);
    if (nested && /^https?:\/\//i.test(nested) && !isGoogleShoppingUrl(nested) && !isAmazonSearchUrl(nested)) {
      return nested;
    }
  }
  return null;
}

export function sanitizeOfferUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null;
  if (isGoogleShoppingUrl(trimmed)) {
    return nestedMerchantUrl(trimmed);
  }
  if (isAmazonSearchUrl(trimmed)) return null;
  return trimmed;
}

function searchQueryFromGoogleUrl(value?: string | null): string | null {
  const parsed = parsedHttpUrl(value);
  if (!parsed || !isGoogleShoppingUrl(parsed.toString())) return null;
  return parsed.searchParams.get('q')?.trim() || null;
}

function merchantSearchUrl(offer: CommerceOffer, product?: CommerceProduct, googleUrl?: string | null): string | null {
  const queryText = (
    searchQueryFromGoogleUrl(googleUrl)
    ?? offer.title?.trim()
    ?? product?.name?.trim()
    ?? merchantName(offer)
  ).trim();
  if (!queryText) return offer.merchant?.websiteUrl ?? null;

  const query = encodeURIComponent(queryText);
  const slug = (offer.merchant?.slug ?? merchantName(offer)).toLowerCase();
  if (slug.includes('amazon')) return `https://www.amazon.com/s?k=${query}`;
  if (slug.includes('bestbuy') || slug.includes('best-buy')) return `https://www.bestbuy.com/site/searchpage.jsp?st=${query}`;
  if (slug.includes('target')) return `https://www.target.com/s?searchTerm=${query}`;
  if (slug.includes('walmart')) return `https://www.walmart.com/search?q=${query}`;
  if (slug.includes('ebay')) return `https://www.ebay.com/sch/i.html?_nkw=${query}`;
  if (slug.includes('newegg')) return `https://www.newegg.com/p/pl?d=${query}`;
  // Specialist and brand-direct stores that carry the sports-watch catalogue.
  // Without these the chain falls back to a merchant homepage, which drops the
  // reader somewhere they still have to search for the product themselves.
  if (slug.includes('rei')) return `https://www.rei.com/search?q=${query}`;
  if (slug.includes('dick')) return `https://www.dickssportinggoods.com/search/SearchDisplay?searchTerm=${query}`;
  if (slug.includes('scheels')) return `https://www.scheels.com/search?q=${query}`;
  if (slug.includes('garmin')) return `https://www.garmin.com/en-US/search/?q=${query}`;
  if (slug.includes('suunto')) return `https://www.suunto.com/search/?q=${query}`;
  if (slug.includes('amazfit')) return `https://www.amazfit.com/search?q=${query}`;

  return offer.merchant?.websiteUrl ?? null;
}

export function resolveOfferDestination(offer: CommerceOffer, product?: CommerceProduct): string | null {
  const candidates = [offer.affiliateUrl, offer.productUrl];
  let googleFallback: string | null = null;

  for (const candidate of candidates) {
    const cleaned = sanitizeOfferUrl(candidate);
    if (cleaned) return cleaned;
    if (!googleFallback && candidate && isGoogleShoppingUrl(candidate)) {
      googleFallback = candidate;
    }
  }

  return merchantSearchUrl(offer, product, googleFallback);
}

export function offerUrl(offer: CommerceOffer, product?: CommerceProduct): string {
  return resolveOfferDestination(offer, product) ?? offer.merchant?.websiteUrl ?? offer.productUrl ?? offer.affiliateUrl ?? '#';
}

export function availabilityLabel(value?: CommerceOffer['availability']): string {
  switch (value) {
    case 'in_stock':
      return 'In stock';
    case 'out_of_stock':
      return 'Out of stock';
    case 'preorder':
      return 'Preorder';
    default:
      return 'Check availability';
  }
}

export function conditionLabel(value?: CommerceOffer['condition']): string {
  switch (value) {
    case 'open_box':
      return 'Open box';
    case 'refurbished':
      return 'Refurbished';
    case 'used':
      return 'Used';
    case 'new':
      return 'New';
    default:
      return 'Condition varies';
  }
}

export function productImageUrl(product: CommerceProduct): string | null {
  return mediaUrl(product.primaryImage ?? null) ?? mediaUrl(product.gallery?.[0] ?? null) ?? productSourceImageUrl(product);
}

function productSourceImageUrl(product: CommerceProduct): string | null {
  const specs = product.specs ?? {};
  const value = specs.imageUrl || specs.sourceImageUrl;
  if (typeof value !== 'string') return null;
  if (!/^https?:\/\//i.test(value)) return null;
  return value;
}

export function comparableProducts(baseProduct: CommerceProduct, products: CommerceProduct[]): CommerceProduct[] {
  if (isAccessoryProduct(baseProduct)) return products;
  return products.filter((product) => !isAccessoryProduct(product));
}

export function collectOfferRows(product: CommerceProduct, similarProducts: CommerceProduct[] = []): CommerceOfferRow[] {
  const rows: CommerceOfferRow[] = [];
  const seen = new Set<string>();

  for (const candidate of [product, ...similarProducts]) {
    for (const offer of candidate.offers ?? []) {
      if (offer.status && offer.status !== 'active') continue;
      const key = offer.documentId ?? `${offer.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ offer, product: candidate });
    }
  }

  const sorted = rows.sort((a, b) => {
    const aPrice = offerPrice(a.offer);
    const bPrice = offerPrice(b.offer);
    if (aPrice !== null && bPrice !== null && aPrice !== bPrice) return aPrice - bPrice;
    if (aPrice !== null) return -1;
    if (bPrice !== null) return 1;
    return merchantName(a.offer).localeCompare(merchantName(b.offer));
  });

  /*
   * One row per merchant: the cheapest, since the sort above is price-ascending.
   *
   * A product routinely carries several offers from the same store — four eBay
   * listings from different sellers, or two Amazon entries for different
   * variants. Showing them all makes the comparison table repeat a merchant
   * with conflicting prices, which reads as a data error rather than choice.
   *
   * Keyed on the merchant's documentId where present, falling back to its name;
   * offers with no merchant at all fall back to the offer key so they are never
   * collapsed into a single anonymous row.
   */
  const perMerchant = new Set<string>();
  return sorted.filter((row) => {
    const key = row.offer.merchant?.documentId
      ?? row.offer.merchant?.name
      ?? `offer:${row.offer.documentId ?? row.offer.id}`;
    if (perMerchant.has(key)) return false;
    perMerchant.add(key);
    return true;
  });
}

export function bestOffer(rows: CommerceOfferRow[]): CommerceOfferRow | null {
  return rows.find((row) => offerPrice(row.offer) !== null) ?? rows[0] ?? null;
}

export function merchantCount(rows: CommerceOfferRow[]): number {
  return new Set(rows.map((row) => row.offer.merchant?.slug ?? merchantName(row.offer))).size;
}

const ACCESSORY_TERMS = [
  'case',
  'cases',
  'cover',
  'covers',
  'screen protector',
  'protector',
  'tempered glass',
  'charger',
  'charging',
  'cable',
  'cord',
  'mount',
  'holder',
  'stand',
  'wallet',
  'skin',
  'lens protector',
  'camera protector',
];

function isAccessoryProduct(product: CommerceProduct): boolean {
  const text = [
    product.name,
    product.shortDescription,
    product.category,
    product.categories?.map((category) => category.name).join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return ACCESSORY_TERMS.some((term) => text.includes(term));
}
