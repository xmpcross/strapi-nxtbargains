import { bestOffer, collectOfferRows, merchantName } from '@/lib/commerce';
import type { CommerceProduct } from '@/lib/strapi';

export type ProductFilters = {
  q: string;
  category: string;
  brand: string;
  merchant: string;
  availability: string;
  condition: string;
  price: string;
  sort: string;
};

export type FilterOption = {
  label: string;
  value: string;
  count?: number;
};

export const PRICE_FILTERS: FilterOption[] = [
  { label: 'Under $100', value: 'under-100' },
  { label: '$100 to $250', value: '100-250' },
  { label: '$250 to $500', value: '250-500' },
  { label: '$500 to $1,000', value: '500-1000' },
  { label: '$1,000+', value: '1000-plus' },
];

export const SORT_OPTIONS: FilterOption[] = [
  { label: 'Featured', value: 'random' },
  { label: 'Newest', value: 'newest' },
  { label: 'Price: Low to High', value: 'price-asc' },
  { label: 'Price: High to Low', value: 'price-desc' },
  { label: 'Name: A to Z', value: 'name-asc' },
];

export function emptyProductFilters(): ProductFilters {
  return {
    q: '',
    category: '',
    brand: '',
    merchant: '',
    availability: '',
    condition: '',
    price: '',
    sort: '',
  };
}

export function productFiltersFromSearchParams(
  params: Partial<Record<keyof ProductFilters | 'page', string | undefined>>,
): ProductFilters {
  return {
    q: normalizeFilterValue(params.q),
    category: normalizeFilterValue(params.category),
    brand: normalizeFilterValue(params.brand),
    merchant: normalizeFilterValue(params.merchant),
    availability: normalizeFilterValue(params.availability),
    condition: normalizeFilterValue(params.condition),
    price: normalizeFilterValue(params.price),
    sort: normalizeFilterValue(params.sort),
  };
}

export function buildFilterOptions(products: CommerceProduct[]) {
  const brands = new Map<string, FilterOption>();
  const merchants = new Map<string, FilterOption>();
  const availabilities = new Map<string, FilterOption>();
  const conditions = new Map<string, FilterOption>();

  for (const product of products) {
    const brand = product.brandRef?.name || product.brand;
    if (brand) incrementOption(brands, brand, brand);

    for (const row of collectOfferRows(product)) {
      const offer = row.offer;
      const merchantSlug = offer.merchant?.slug;
      const merchantLabel = merchantName(offer);
      if (merchantSlug && merchantLabel) incrementOption(merchants, merchantSlug, merchantLabel);
      if (offer.availability) incrementOption(availabilities, offer.availability, formatFilterLabel(offer.availability));
      if (offer.condition) incrementOption(conditions, offer.condition, formatFilterLabel(offer.condition));
    }
  }

  return {
    brands: sortOptions(Array.from(brands.values())),
    merchants: sortOptions(Array.from(merchants.values())),
    availabilities: sortOptions(Array.from(availabilities.values())),
    conditions: sortOptions(Array.from(conditions.values())),
  };
}

export function applyProductFilters(products: CommerceProduct[], filters: ProductFilters) {
  return products.filter((product) => {
    const rows = collectOfferRows(product);
    const searchable = [
      product.name,
      product.brand,
      product.brandRef?.name,
      product.category,
      product.shortDescription,
      product.categories?.map((item) => item.name).join(' '),
      rows.map((row) => merchantName(row.offer)).join(' '),
    ].filter(Boolean).join(' ').toLowerCase();

    if (filters.q && !searchable.includes(filters.q.toLowerCase())) return false;
    if (filters.category) {
      const hasCategory = product.categories?.some((item) => item.slug === filters.category);
      if (!hasCategory) return false;
    }
    if (filters.brand && (product.brandRef?.name || product.brand || '') !== filters.brand) return false;
    if (filters.merchant && !rows.some((row) => row.offer.merchant?.slug === filters.merchant)) return false;
    if (filters.availability && !rows.some((row) => row.offer.availability === filters.availability)) return false;
    if (filters.condition && !rows.some((row) => row.offer.condition === filters.condition)) return false;
    if (filters.price && !priceMatchesFilter(bestProductPrice(product), filters.price)) return false;

    return true;
  });
}

/**
 * Shuffle that is random between renders but stable within one.
 *
 * A plain Math.random() shuffle breaks pagination: page 1 and page 2 are
 * separate renders, so each would reshuffle and the visitor would see some
 * products twice and never see others. Seeding from a time bucket means every
 * page rendered in the same window agrees on the order, while the order still
 * changes from window to window.
 *
 * The bucket matches the page's revalidate window, so the order changes exactly
 * as often as the page is rebuilt anyway — no cache is invalidated for this.
 */
const SHUFFLE_BUCKET_MS = 60_000;

function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  // Mulberry32 — small, fast, and good enough for display ordering.
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function sortProducts(products: CommerceProduct[], sort: string) {
  const sorted = [...products];
  if (sort === 'random') {
    return seededShuffle(sorted, Math.floor(Date.now() / SHUFFLE_BUCKET_MS));
  }
  if (sort === 'price-asc') {
    sorted.sort((a, b) => (bestProductPrice(a) ?? Number.POSITIVE_INFINITY) - (bestProductPrice(b) ?? Number.POSITIVE_INFINITY));
  } else if (sort === 'price-desc') {
    sorted.sort((a, b) => (bestProductPrice(b) ?? Number.NEGATIVE_INFINITY) - (bestProductPrice(a) ?? Number.NEGATIVE_INFINITY));
  } else if (sort === 'name-asc') {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    sorted.sort((a, b) => Date.parse(b.updatedAt || '') - Date.parse(a.updatedAt || ''));
  }
  return sorted;
}

export function productPageQuery(filters: ProductFilters, page?: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  if (page && page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function activeFiltersCount(filters: ProductFilters) {
  return Object.entries(filters).filter(([key, value]) => key !== 'sort' && Boolean(value)).length;
}

function bestProductPrice(product: CommerceProduct) {
  const best = bestOffer(collectOfferRows(product));
  return numericValue(best?.offer.price ?? best?.offer.originalPrice);
}

function priceMatchesFilter(price: number | null, filter: string) {
  if (price === null) return false;
  if (filter === 'under-100') return price < 100;
  if (filter === '100-250') return price >= 100 && price <= 250;
  if (filter === '250-500') return price >= 250 && price <= 500;
  if (filter === '500-1000') return price >= 500 && price <= 1000;
  if (filter === '1000-plus') return price >= 1000;
  return true;
}

function incrementOption(map: Map<string, FilterOption>, value: string, label: string) {
  const existing = map.get(value);
  if (existing) {
    existing.count = (existing.count ?? 0) + 1;
  } else {
    map.set(value, { value, label, count: 1 });
  }
}

function sortOptions(options: FilterOption[]) {
  return options.sort((a, b) => a.label.localeCompare(b.label));
}

function normalizeFilterValue(value?: string) {
  return typeof value === 'string' ? value.trim() : '';
}

function formatFilterLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function numericValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
