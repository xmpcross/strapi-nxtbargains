import type {
  CommerceCategory,
  CommerceOffer,
  CommercePriceSnapshot,
  CommerceProduct,
} from '@/lib/strapi';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

type SupabaseComparison = {
  canonical_product_id: string;
  slug?: string | null;
  canonical_title: string;
  brand?: string | null;
  model?: string | null;
  mpn?: string | null;
  asin?: string | null;
  gtin_upc_ean?: string | null;
  category?: string | null;
  canonical_image?: string | null;
  description?: string | null;
  specifications?: Record<string, unknown> | null;
  updated_at?: string | null;
  offers?: SupabaseOffer[] | null;
};

type SupabaseOffer = {
  offer_id: string;
  marketplace: string;
  seller_name?: string | null;
  price?: number | string | null;
  original_price?: number | string | null;
  discount_percent?: number | string | null;
  currency?: string | null;
  coupon_code?: string | null;
  product_url: string;
  is_available?: boolean;
  scraped_at?: string | null;
  provider?: string | null;
};

export function useSupabaseCommerce(): boolean {
  return process.env.COMMERCE_DATA_SOURCE === 'supabase';
}

export function assertSupabaseCommerceConfigured(): void {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('COMMERCE_DATA_SOURCE=supabase requires SUPABASE_URL and a server-side Supabase key');
  }
}

function slugify(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function rest<T>(path: string, revalidate = 60): Promise<T> {
  assertSupabaseCommerceConfigured();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    next: { revalidate },
  });
  if (!response.ok) throw new Error(`Supabase ${response.status} on ${path}: ${await response.text()}`);
  return response.json();
}

function merchant(offer: SupabaseOffer) {
  const name = offer.marketplace.replace(/[_-]+/g, ' ');
  return {
    id: offer.marketplace,
    documentId: offer.marketplace,
    name,
    slug: slugify(offer.marketplace),
    status: 'active' as const,
  };
}

function mapOffer(offer: SupabaseOffer): CommerceOffer {
  return {
    id: offer.offer_id,
    documentId: offer.offer_id,
    price: offer.price,
    originalPrice: offer.original_price,
    currency: offer.currency,
    discountPercent: offer.discount_percent,
    productUrl: offer.product_url,
    couponCode: offer.coupon_code,
    availability: offer.is_available === false ? 'out_of_stock' : 'in_stock',
    source: offer.provider || 'supabase',
    lastCheckedAt: offer.scraped_at,
    status: offer.is_available === false ? 'expired' : 'active',
    merchant: merchant(offer),
  };
}

const CATEGORY_SLUG_MAP: Record<string, string> = {
  'smartphones': 'smart-phones',
  'smartphone': 'smart-phones',
  'smart-phones': 'smart-phones',
  'smartwatches': 'smartwatches',
  'smartwatch': 'smartwatches',
  'tablets': 'tablets',
  'tablet': 'tablets',
  'laptops': 'laptops',
  'laptop': 'laptops',
  'smart light bulbs': 'smart-light-bulbs',
  'smart-light-bulbs': 'smart-light-bulbs',
  'smart tvs': 'smart-tvs',
  'smart-tvs': 'smart-tvs',
  'smart cameras': 'smart-cameras',
  'smart-cameras': 'smart-cameras',
  'smart speakers': 'smart-speakers',
  'smart-speakers': 'smart-speakers',
  'smart door locks': 'smart-door-locks',
  'smart-door-locks': 'smart-door-locks',
  'smart plugs': 'smart-plugs',
  'smart-plugs': 'smart-plugs',
  'video doorbells': 'video-doorbells',
  'video-doorbells': 'video-doorbells',
  'headphones': 'headphones',
  'headphone': 'headphones',
  'raspberry pi': 'raspberry-pi',
  'raspberry-pi': 'raspberry-pi',
  'smart home': 'smart-home',
  'smart-home': 'smart-home',
};

function normalizeCategorySlug(val: string): string {
  const raw = slugify(val);
  return CATEGORY_SLUG_MAP[raw] || CATEGORY_SLUG_MAP[val.toLowerCase()] || raw;
}

function mapProduct(row: SupabaseComparison): CommerceProduct {
  const categoryName = row.category?.trim() || 'General';
  const catSlug = normalizeCategorySlug(categoryName);
  const category: CommerceCategory = {
    id: catSlug,
    documentId: catSlug,
    name: categoryName,
    slug: catSlug,
    status: 'active',
  };
  return {
    id: row.canonical_product_id,
    documentId: row.canonical_product_id,
    name: row.canonical_title,
    slug: row.slug?.trim() || slugify(row.canonical_title),
    brand: row.brand,
    shortDescription: row.description,
    description: row.description,
    primaryImage: row.canonical_image ? { url: row.canonical_image } : null,
    category: categoryName,
    categories: [category],
    tags: ['nxt-bargains'],
    specs: row.specifications,
    asin: row.asin,
    gtin: row.gtin_upc_ean,
    mpn: row.mpn,
    status: 'active',
    offers: (row.offers ?? []).map(mapOffer),
    updatedAt: row.updated_at || new Date(0).toISOString(),
  };
}

function normalizeSupabaseProduct(row: any): SupabaseComparison {
  const rawOffers: any[] = Array.isArray(row.offers) ? row.offers : [];
  const validOffers: SupabaseOffer[] = rawOffers
    .filter((o) => o && o.is_available !== false && o.current_price != null)
    .map((o) => ({
      offer_id: o.id,
      marketplace: o.marketplace || 'marketplace_store',
      seller_name: o.seller_name || o.marketplace,
      price: o.current_price,
      original_price: o.original_price,
      discount_percent: o.discount_percent,
      currency: o.currency || 'USD',
      coupon_code: o.coupon_code,
      product_url: o.product_url,
      is_available: o.is_available,
      scraped_at: o.scraped_at,
      provider: o.metadata?.provider || 'supabase',
    }));

  return {
    canonical_product_id: row.id,
    canonical_title: row.title,
    brand: row.brand,
    model: row.model,
    mpn: row.mpn,
    asin: row.asin,
    gtin_upc_ean: row.gtin_upc_ean,
    category: row.category,
    canonical_image: row.image_url,
    description: row.description,
    specifications: row.specifications,
    updated_at: row.updated_at,
    slug: row.slug,
    offers: validOffers,
  };
}

export async function listSupabaseProducts(opts: { page?: number; pageSize?: number; q?: string; category?: string } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.max(1, opts.pageSize ?? 24);

  let comparisons: SupabaseComparison[] = [];
  try {
    const [rawProducts, rawOffers] = await Promise.all([
      rest<any[]>('canonical_products?select=id,title,brand,model,mpn,asin,gtin_upc_ean,category,image_url,description,specifications,updated_at,slug&is_active=eq.true&order=updated_at.desc&limit=1000'),
      rest<any[]>('marketplace_products?select=id,canonical_product_id,marketplace,seller_name,current_price,original_price,discount_percent,currency,coupon_code,product_url,is_available&is_available=eq.true&limit=2000').catch(() => []),
    ]);

    const offersByProduct = new Map<string, any[]>();
    for (const offer of rawOffers) {
      if (offer && offer.canonical_product_id) {
        const existing = offersByProduct.get(offer.canonical_product_id) || [];
        existing.push(offer);
        offersByProduct.set(offer.canonical_product_id, existing);
      }
    }

    comparisons = rawProducts.map((p) => {
      p.offers = offersByProduct.get(p.id) || [];
      return normalizeSupabaseProduct(p);
    });
  } catch (err) {
    console.error('Error in listSupabaseProducts:', err);
    comparisons = await rest<any[]>('canonical_products?select=id,title,brand,model,mpn,asin,gtin_upc_ean,category,image_url,description,specifications,updated_at,slug&is_active=eq.true&order=updated_at.desc&limit=1000')
      .then((rows) => rows.map(normalizeSupabaseProduct))
      .catch(() => []);
  }

  let products = comparisons.map(mapProduct);
  if (opts.category) {
    const targetSlug = normalizeCategorySlug(opts.category);
    products = products.filter((p) => p.categories?.some((c) => c.slug === targetSlug || c.slug === opts.category));
  }
  if (opts.q?.trim()) {
    const q = opts.q.trim().toLowerCase();
    products = products.filter((p) => [p.name, p.brand, p.category, p.shortDescription].some((v) => v?.toLowerCase().includes(q)));
  }
  const total = products.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return {
    data: products.slice((page - 1) * pageSize, page * pageSize),
    meta: { pagination: { page, pageSize, pageCount, total } },
  };
}

export async function getSupabaseProduct(slug: string): Promise<CommerceProduct | null> {
  try {
    const rawProducts = await rest<any[]>(`canonical_products?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&limit=1`);
    if (rawProducts && rawProducts.length > 0) {
      const p = rawProducts[0];
      const rawOffers = await rest<any[]>(`marketplace_products?canonical_product_id=eq.${p.id}&is_available=eq.true`).catch(() => []);
      p.offers = rawOffers;
      return mapProduct(normalizeSupabaseProduct(p));
    }
  } catch (err) {
    console.error('Error in getSupabaseProduct:', err);
  }
  const result = await listSupabaseProducts({ pageSize: 1000 });
  return result.data.find((product) => product.slug === slug) ?? null;
}

export async function listSupabaseCategories(): Promise<CommerceCategory[]> {
  const result = await listSupabaseProducts({ pageSize: 1000 });
  const categories = new Map<string, CommerceCategory>();
  for (const product of result.data) for (const category of product.categories ?? []) categories.set(category.slug, category);
  return [...categories.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listSupabasePriceSnapshots(productIds: string[], pageSize = 240): Promise<CommercePriceSnapshot[]> {
  if (!productIds.length) return [];
  const encoded = encodeURIComponent(productIds.join(','));
  type Row = { id: string; price: number; original_price?: number; currency?: string; recorded_at: string; marketplace_products?: { canonical_product_id?: string; marketplace?: string } };
  const rows = await rest<Row[]>(`price_history?select=*,marketplace_products!inner(canonical_product_id,marketplace)&marketplace_products.canonical_product_id=in.(${encoded})&order=recorded_at.asc&limit=${pageSize}`, 300);
  return rows.map((row) => ({
    id: row.id,
    documentId: row.id,
    price: row.price,
    originalPrice: row.original_price,
    currency: row.currency,
    checkedAt: row.recorded_at,
    source: 'supabase',
    merchant: row.marketplace_products?.marketplace ? merchant({ offer_id: row.id, marketplace: row.marketplace_products.marketplace, product_url: '' }) : null,
    product: row.marketplace_products?.canonical_product_id ? { id: row.marketplace_products.canonical_product_id, documentId: row.marketplace_products.canonical_product_id, name: '', slug: '', updatedAt: row.recorded_at } : null,
  }));
}
