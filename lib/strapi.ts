import qs from 'qs';

const PUBLIC_BASE = (process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.fxnstudio.com').replace(/\/$/, '');
const API_BASE = (process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.fxnstudio.com').replace(/\/$/, '');
const TOKEN = process.env.STRAPI_API_TOKEN;

// commerce-products is a Strapi pool SHARED with other sites (e.g. bestlooking.skin).
// Each storefront only shows products tagged for it. nxt.bargains products carry the
// `nxt-bargains` tag (set by the sourcing tool / search.fxnstudio.com when sourced for
// this site). Override via env if needed. `tags` is filtered with $containsi (the only
// JSON-array operator Strapi serves reliably here; $contains 500s).
const SITE_PRODUCT_TAG = process.env.NEXT_PUBLIC_SITE_PRODUCT_TAG || 'nxt-bargains';

/** Commerce categories hidden on NXT.Bargains (shared Strapi taxonomy includes other storefronts). */
const EXCLUDED_COMMERCE_CATEGORY_SLUGS = new Set([
  'exfoliators-and-scrubs',
]);

function isVisibleCommerceCategory(category: Pick<CommerceCategory, 'slug'>): boolean {
  return !EXCLUDED_COMMERCE_CATEGORY_SLUGS.has(category.slug);
}

export type StrapiImage = { url: string; alternativeText?: string; width?: number; height?: number } | null;

export type NxtPostType =
  | 'product-comparison'
  | 'product-review'
  | 'product-roundup'
  | 'how-to-guide'
  | 'informative'
  | 'top-rated'
  | 'other';

export type NxtCategory = {
  id: number;
  documentId?: string;
  name: string;
  slug: string;
  description?: string;
  order?: number;
  icon?: string;
  legacyWpId?: number;
  parent?: { id: number; name: string; slug: string } | null;
  children?: { id: number; name: string; slug: string }[];
};

export type PostPriceComparisonOffer = {
  merchantSlug: string;
  merchantName: string;
  productName: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  productUrl?: string;
  affiliateUrl?: string;
  price?: number | string | null;
  originalPrice?: number | string | null;
  currency?: string;
  availability?: 'in_stock' | 'out_of_stock' | 'preorder' | 'unknown';
  condition?: 'new' | 'used' | 'refurbished' | 'open_box' | 'unknown';
  source?: string;
};

export type PostPriceComparisonSnapshot = {
  keyword?: string;
  generatedAt?: string;
  source?: string;
  mode?: string;
  message?: string;
  rawCount?: number;
  perMerchantLimit?: number;
  results?: PostPriceComparisonOffer[];
};

export type NxtPost = {
  id: number;
  documentId?: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  /** Optional editor-authored TL;DR / key takeaways (markdown or HTML), shown
   *  as a callout at the top of comparisons, reviews and guides. */
  keyTakeaways?: string;
  postType?: NxtPostType;
  amazonAffiliateTag?: string;
  priceComparisonEnabled?: boolean;
  priceComparisonKeyword?: string;
  priceComparisonMerchantLimit?: number;
  priceComparisonStatus?: 'idle' | 'success' | 'failed';
  priceComparisonLastRunAt?: string;
  priceComparisonError?: string | null;
  priceComparisonResults?: PostPriceComparisonSnapshot | null;
  sourceUrl?: string;
  legacyWpId?: number;
  readingTimeMinutes?: number;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  publishedAt: string;
  updatedAt: string;
  coverImage?: StrapiImage;
  ogImage?: StrapiImage;
  gallery?: NonNullable<StrapiImage>[];
  categories?: NxtCategory[];
  faqs?: { question: string; answer: string }[];
  steps?: { name: string; text: string; image?: StrapiImage }[];
};

export type CommerceBrand = {
  id: number;
  documentId?: string;
  name: string;
  slug: string;
  websiteUrl?: string | null;
  country?: string | null;
  status?: 'active' | 'draft' | 'archived';
};

export type CommerceCategory = {
  id: number;
  documentId?: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  status?: 'active' | 'draft' | 'archived';
};

export type CommerceMerchant = {
  id: number;
  documentId?: string;
  name: string;
  slug: string;
  websiteUrl?: string | null;
  logo?: StrapiImage;
  country?: string | null;
  affiliateNetwork?: string | null;
  status?: 'active' | 'inactive';
};

export type CommerceOffer = {
  id: number;
  documentId?: string;
  title?: string | null;
  price?: number | string | null;
  originalPrice?: number | string | null;
  currency?: string | null;
  discountPercent?: number | string | null;
  productUrl: string;
  affiliateUrl?: string | null;
  couponCode?: string | null;
  availability?: 'in_stock' | 'out_of_stock' | 'preorder' | 'unknown';
  shippingCost?: number | string | null;
  condition?: 'new' | 'used' | 'refurbished' | 'open_box' | 'unknown';
  merchantSku?: string | null;
  source?: string | null;
  lastCheckedAt?: string | null;
  status?: 'active' | 'expired' | 'stale' | 'error';
  displayOrder?: number | null;
  merchant?: CommerceMerchant | null;
};

export type CommercePriceSnapshot = {
  id: number;
  documentId?: string;
  price?: number | string | null;
  originalPrice?: number | string | null;
  currency?: string | null;
  availability?: CommerceOffer['availability'];
  checkedAt: string;
  source?: string | null;
  merchant?: CommerceMerchant | null;
  product?: Pick<CommerceProduct, 'id' | 'documentId' | 'name' | 'slug' | 'updatedAt'> | null;
};

export type CommerceProduct = {
  id: number;
  documentId?: string;
  name: string;
  slug: string;
  brand?: string | null;
  brandRef?: CommerceBrand | null;
  shortDescription?: string | null;
  description?: string | null;
  primaryImage?: StrapiImage;
  gallery?: NonNullable<StrapiImage>[];
  category?: string | null;
  categories?: CommerceCategory[];
  tags?: string[] | null;
  specs?: Record<string, unknown> | null;
  asin?: string | null;
  gtin?: string | null;
  mpn?: string | null;
  sku?: string | null;
  rating?: number | string | null;
  ratingCount?: number | null;
  status?: 'active' | 'draft' | 'archived';
  offers?: CommerceOffer[];
  publishedAt?: string;
  updatedAt: string;
  createdAt?: string;
};

type ListResponse<T> = {
  data: T[];
  meta: { pagination: { page: number; pageSize: number; pageCount: number; total: number } };
};

async function strapiFetch<T>(path: string, params?: Record<string, unknown>, revalidate = 60): Promise<T> {
  const query = params ? '?' + qs.stringify(params, { encodeValuesOnly: true }) : '';
  const url = `${API_BASE}/api/${path}${query}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    ...(revalidate <= 0 ? { cache: 'no-store' as const } : { next: { revalidate } }),
  });
  if (!res.ok) {
    throw new Error(`Strapi ${res.status} on ${url}: ${await res.text().catch(() => '')}`);
  }
  return res.json();
}

export function mediaUrl(img: StrapiImage): string | null {
  if (!img?.url) return null;
  return img.url.startsWith('http') ? img.url : `${PUBLIC_BASE}${img.url}`;
}

const POST_POPULATE = {
  coverImage: true,
  ogImage: true,
  categories: true,
  gallery: true,
  faqs: true,
  steps: { populate: ['image'] },
};
const COMMERCE_PRODUCT_POPULATE = {
  primaryImage: true,
  gallery: true,
  brandRef: true,
  categories: true,
  offers: {
    populate: {
      merchant: {
        populate: {
          logo: true,
        },
      },
    },
  },
};

export async function listPosts(
  opts: { page?: number; pageSize?: number; category?: string; postType?: NxtPostType; q?: string } = {},
) {
  const filters: Record<string, unknown> = {};
  if (opts.category) filters.categories = { slug: { $eqi: opts.category } };
  if (opts.postType) filters.postType = { $eq: opts.postType };
  if (opts.q?.trim()) {
    const q = opts.q.trim();
    filters.$or = [
      { title: { $containsi: q } },
      { excerpt: { $containsi: q } },
      { content: { $containsi: q } },
      { categories: { name: { $containsi: q } } },
    ];
  }

  return strapiFetch<ListResponse<NxtPost>>('nxt-posts', {
    sort: ['publishedAt:desc'],
    populate: POST_POPULATE,
    pagination: { page: opts.page ?? 1, pageSize: opts.pageSize ?? 12 },
    filters,
  });
}

export async function getPost(slug: string): Promise<NxtPost | null> {
  const res = await strapiFetch<ListResponse<NxtPost>>('nxt-posts', {
    filters: { slug: { $eq: slug } },
    populate: POST_POPULATE,
    pagination: { pageSize: 1 },
  });
  return res.data?.[0] ?? null;
}

export async function listCategories(): Promise<NxtCategory[]> {
  const res = await strapiFetch<ListResponse<NxtCategory>>('nxt-categories', {
    sort: ['order:asc', 'name:asc'],
    populate: ['parent', 'children'],
    pagination: { pageSize: 100 },
  });
  return res.data;
}

export async function getCategory(slug: string): Promise<NxtCategory | null> {
  const res = await strapiFetch<ListResponse<NxtCategory>>('nxt-categories', {
    filters: { slug: { $eqi: slug } },
    populate: ['parent', 'children'],
    pagination: { pageSize: 1 },
  });
  return res.data?.[0] ?? null;
}

export async function listCommerceProducts(
  opts: { page?: number; pageSize?: number; q?: string; category?: string } = {},
) {
  const filters: Record<string, unknown> = {
    productStatus: { $eq: 'active' },
    tags: { $containsi: SITE_PRODUCT_TAG },
  };
  if (opts.category?.trim()) {
    filters.categories = { slug: { $eqi: opts.category.trim() } };
  }
  if (opts.q?.trim()) {
    const q = opts.q.trim();
    filters.$or = [
      { name: { $containsi: q } },
      { brand: { $containsi: q } },
      { category: { $containsi: q } },
      { shortDescription: { $containsi: q } },
      { brandRef: { name: { $containsi: q } } },
      { categories: { name: { $containsi: q } } },
      { offers: { merchant: { name: { $containsi: q } } } },
    ];
  }

  return strapiFetch<ListResponse<CommerceProduct>>('commerce-products', {
    sort: ['updatedAt:desc'],
    populate: COMMERCE_PRODUCT_POPULATE,
    pagination: { page: opts.page ?? 1, pageSize: opts.pageSize ?? 24 },
    filters,
  });
}

export async function listCommerceCategories(): Promise<CommerceCategory[]> {
  const res = await strapiFetch<ListResponse<CommerceCategory>>('commerce-categories', {
    filters: { categoryStatus: { $eq: 'active' } },
    sort: ['name:asc'],
    pagination: { pageSize: 100 },
  });
  return res.data.filter(isVisibleCommerceCategory);
}

export async function getCommerceCategory(slug: string): Promise<CommerceCategory | null> {
  if (!isVisibleCommerceCategory({ slug })) return null;
  const res = await strapiFetch<ListResponse<CommerceCategory>>('commerce-categories', {
    filters: { slug: { $eqi: slug }, categoryStatus: { $eq: 'active' } },
    pagination: { pageSize: 1 },
  });
  return res.data?.[0] ?? null;
}

// ---------------------------------------------------------------------------
// Coupons (nxt-coupons) — CMS-curated coupon source. When the collection does
// not exist yet (or Strapi errors), these return [] so callers fall back to the
// legacy RapidAPI/JSON-cache coupon data. See strapi-cms/nxt-coupon/.
// ---------------------------------------------------------------------------
export type NxtCoupon = {
  id: number;
  documentId?: string;
  title: string;
  store: string;
  storeSlug?: string | null;
  code?: string | null;
  discount?: string | null;
  category?: string | null;
  couponType?: 'Coupon' | 'Promo code' | 'Sale';
  destinationUrl?: string | null;
  affiliateUrl?: string | null;
  featured?: boolean;
  isBrand?: boolean;
  verifiedLabel?: string | null;
  expiresAt?: string | null;
  displayOrder?: number | null;
  externalId?: string | null;
  source?: string | null;
  publishedAt?: string;
  updatedAt?: string;
};

export async function listNxtCoupons(
  opts: { store?: string; storeSlug?: string; pageSize?: number } = {},
): Promise<NxtCoupon[]> {
  const filters: Record<string, unknown> = {};
  if (opts.storeSlug?.trim()) filters.storeSlug = { $eqi: opts.storeSlug.trim() };
  if (opts.store?.trim()) filters.store = { $containsi: opts.store.trim() };

  try {
    const res = await strapiFetch<ListResponse<NxtCoupon>>(
      'nxt-coupons',
      {
        sort: ['featured:desc', 'displayOrder:asc', 'updatedAt:desc'],
        pagination: { pageSize: opts.pageSize ?? 200 },
        filters,
      },
      300,
    );
    return res.data ?? [];
  } catch {
    // Collection missing / Strapi unreachable → let the caller fall back.
    return [];
  }
}

export async function getCommerceProduct(slug: string): Promise<CommerceProduct | null> {
  const res = await strapiFetch<ListResponse<CommerceProduct>>('commerce-products', {
    filters: { slug: { $eq: slug }, productStatus: { $eq: 'active' }, tags: { $containsi: SITE_PRODUCT_TAG } },
    populate: COMMERCE_PRODUCT_POPULATE,
    pagination: { pageSize: 1 },
  }, 0);
  return res.data?.[0] ?? null;
}

export async function listCommercePriceSnapshots(
  productDocumentIds: string[],
  pageSize = 240,
): Promise<CommercePriceSnapshot[]> {
  const ids = Array.from(new Set(productDocumentIds.filter(Boolean)));
  if (ids.length === 0) return [];

  const res = await strapiFetch<ListResponse<CommercePriceSnapshot>>(
    'commerce-price-snapshots',
    {
      filters: {
        product: {
          documentId: ids.length === 1 ? { $eq: ids[0] } : { $in: ids },
        },
      },
      populate: {
        merchant: {
          fields: ['name', 'slug'],
        },
        product: {
          fields: ['name', 'slug', 'updatedAt'],
        },
      },
      sort: ['checkedAt:asc'],
      pagination: { pageSize },
    },
    300,
  );
  return res.data;
}

export async function listCommerceProductsForDeals(pageSize = 120): Promise<CommerceProduct[]> {
  const res = await strapiFetch<ListResponse<CommerceProduct>>(
    'commerce-products',
    {
      filters: { productStatus: { $eq: 'active' }, tags: { $containsi: SITE_PRODUCT_TAG } },
      populate: COMMERCE_PRODUCT_POPULATE,
      sort: ['updatedAt:desc'],
      pagination: { pageSize },
    },
    120,
  );
  return res.data;
}

export async function listSimilarCommerceProducts(
  product: Pick<CommerceProduct, 'name' | 'brand' | 'brandRef'>,
  pageSize = 24,
): Promise<CommerceProduct[]> {
  const tokens = productMatchTokens(product);
  if (tokens.length < 2) return [];

  const res = await strapiFetch<ListResponse<CommerceProduct>>('commerce-products', {
    filters: {
      productStatus: { $eq: 'active' },
      tags: { $containsi: SITE_PRODUCT_TAG },
      $and: tokens.map((token) => ({ name: { $containsi: token } })),
    },
    populate: COMMERCE_PRODUCT_POPULATE,
    sort: ['updatedAt:desc'],
    pagination: { pageSize },
  });
  return res.data;
}

export type Store = {
  name: string;
  slug: string;
  logo: string | null;
  websiteUrl: string | null;
  productCount: number;
};

function storeSlug(name: string, slug?: string) {
  return slug || name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Distinct merchants/stores that have offers on this storefront's products.
export async function listStores(): Promise<Store[]> {
  const res = await strapiFetch<ListResponse<CommerceProduct>>('commerce-products', {
    filters: { productStatus: { $eq: 'active' }, tags: { $containsi: SITE_PRODUCT_TAG } },
    populate: COMMERCE_PRODUCT_POPULATE,
    pagination: { pageSize: 100 },
  });
  const map = new Map<string, { name: string; slug: string; logo: string | null; websiteUrl: string | null; products: Set<string> }>();
  for (const product of res.data) {
    for (const offer of product.offers ?? []) {
      const m = offer.merchant;
      if (!m?.name) continue;
      const slug = storeSlug(m.name, m.slug);
      if (!map.has(slug)) map.set(slug, { name: m.name, slug, logo: mediaUrl(m.logo ?? null), websiteUrl: m.websiteUrl ?? null, products: new Set() });
      map.get(slug)!.products.add(product.slug);
    }
  }
  return [...map.values()]
    .map((s) => ({ name: s.name, slug: s.slug, logo: s.logo, websiteUrl: s.websiteUrl, productCount: s.products.size }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

// Products on this storefront that have an offer from a given store/merchant.
export async function listStoreProducts(slug: string): Promise<{ store: Store | null; products: CommerceProduct[] }> {
  const res = await strapiFetch<ListResponse<CommerceProduct>>('commerce-products', {
    filters: {
      productStatus: { $eq: 'active' },
      tags: { $containsi: SITE_PRODUCT_TAG },
      offers: { merchant: { slug: { $eqi: slug } } },
    },
    populate: COMMERCE_PRODUCT_POPULATE,
    sort: ['updatedAt:desc'],
    pagination: { pageSize: 48 },
  });
  const products = res.data;
  let store: Store | null = null;
  for (const p of products) {
    for (const o of p.offers ?? []) {
      const m = o.merchant;
      if (m && storeSlug(m.name, m.slug) === slug) {
        store = { name: m.name, slug, logo: mediaUrl(m.logo ?? null), websiteUrl: m.websiteUrl ?? null, productCount: products.length };
        break;
      }
    }
    if (store) break;
  }
  return { store, products };
}

export type CommerceReview = {
  id: number;
  authorName: string;
  rating: number;
  title?: string | null;
  body: string;
  createdAt: string;
};

export type NxtComment = {
  id: number;
  documentId?: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export async function listPostComments(postDocumentId: string): Promise<NxtComment[]> {
  if (!postDocumentId) return [];
  try {
    const res = await strapiFetch<ListResponse<NxtComment>>('nxt-comments', {
      filters: {
        post: { documentId: { $eq: postDocumentId } },
        commentStatus: { $eq: 'approved' },
      },
      sort: ['createdAt:desc'],
      pagination: { pageSize: 50 },
    });
    return res.data;
  } catch {
    return [];
  }
}

// Approved reviews for a product (shown in the Reviews tab).
export async function listProductReviews(productDocumentId: string): Promise<CommerceReview[]> {
  if (!productDocumentId) return [];
  try {
    const res = await strapiFetch<ListResponse<CommerceReview>>('commerce-reviews', {
      filters: {
        product: { documentId: { $eq: productDocumentId } },
        reviewStatus: { $eq: 'approved' },
      },
      sort: ['createdAt:desc'],
      pagination: { pageSize: 50 },
    });
    return res.data;
  } catch {
    return [];
  }
}

export async function listAllCommerceProductSlugs(): Promise<
  { slug: string; updatedAt: string; categories?: CommerceProduct['categories']; category?: string | null }[]
> {
  const all: { slug: string; updatedAt: string; categories?: CommerceProduct['categories']; category?: string | null }[] = [];
  let page = 1;
  while (true) {
    const res = await strapiFetch<ListResponse<CommerceProduct>>('commerce-products', {
      fields: ['slug', 'updatedAt', 'category'],
      populate: { categories: { fields: ['slug', 'name'] } },
      // Match the field/tag used everywhere else (listCommerceProducts). The old
      // `status` filter didn't match the `productStatus` field, so products were
      // silently excluded from the sitemap.
      filters: { productStatus: { $eq: 'active' }, tags: { $containsi: SITE_PRODUCT_TAG } },
      sort: ['updatedAt:desc'],
      pagination: { page, pageSize: 100 },
    });
    for (const product of res.data) {
      all.push({
        slug: product.slug,
        updatedAt: product.updatedAt,
        categories: product.categories,
        category: product.category,
      });
    }
    const pageCount = res.meta?.pagination?.pageCount ?? 1;
    if (page >= pageCount) break;
    page++;
  }
  return all;
}

// Slug→category lookup for sitemap, etc.
export async function listAllPostSlugs(): Promise<{ slug: string; category: string; updatedAt: string }[]> {
  const all: { slug: string; category: string; updatedAt: string }[] = [];
  let page = 1;
  while (true) {
    const res = await strapiFetch<ListResponse<NxtPost>>('nxt-posts', {
      fields: ['slug', 'updatedAt'],
      populate: { categories: { fields: ['slug'] } },
      sort: ['publishedAt:desc'],
      pagination: { page, pageSize: 100 },
    });
    for (const p of res.data) {
      const cat = p.categories?.[0]?.slug ?? 'uncategorized';
      all.push({ slug: p.slug, category: cat, updatedAt: p.updatedAt });
    }
    const pageCount = res.meta?.pagination?.pageCount ?? 1;
    if (page >= pageCount) break;
    page++;
  }
  return all;
}

const KNOWN_BRANDS = [
  'apple',
  'samsung',
  'sony',
  'microsoft',
  'nintendo',
  'google',
  'amazon',
  'lg',
  'hp',
  'dell',
  'lenovo',
  'asus',
  'acer',
  'bose',
  'jbl',
  'anker',
];

const PRODUCT_TOKEN_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'all',
  'at',
  'battery',
  'black',
  'blue',
  'box',
  'cellular',
  'condition',
  'for',
  'factory',
  'gb',
  'gray',
  'green',
  'in',
  'lte',
  'new',
  'on',
  'open',
  'owned',
  'pink',
  'pre',
  'preowned',
  'red',
  'silver',
  'the',
  'tm',
  'to',
  'unlocked',
  'used',
  'white',
  'with',
]);

function tokenizeProductName(value?: string | null): string[] {
  return (value ?? '')
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((token) => token.length > 1 && !PRODUCT_TOKEN_STOPWORDS.has(token)) ?? [];
}

function uniqueTokens(tokens: string[]): string[] {
  return Array.from(new Set(tokens));
}

function productMatchTokens(product: Pick<CommerceProduct, 'name' | 'brand' | 'brandRef'>): string[] {
  const nameTokens = uniqueTokens(tokenizeProductName(product.name));
  const explicitBrandTokens = tokenizeProductName(product.brandRef?.name ?? product.brand);
  const inferredBrand = nameTokens.find((token) => KNOWN_BRANDS.includes(token));
  const brandTokens = uniqueTokens(explicitBrandTokens.length ? explicitBrandTokens : inferredBrand ? [inferredBrand] : []);

  if (brandTokens.length > 0) {
    const firstBrandIndex = nameTokens.findIndex((token) => brandTokens.includes(token));
    const familyTokens = nameTokens
      .slice(firstBrandIndex >= 0 ? firstBrandIndex + 1 : 0)
      .filter((token) => !brandTokens.includes(token))
      .slice(0, 2);
    return uniqueTokens([...brandTokens.slice(0, 1), ...familyTokens]).slice(0, 3);
  }

  return nameTokens.slice(0, 3);
}
