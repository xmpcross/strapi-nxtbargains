import type { CommerceProduct } from '@/lib/strapi';

export const COMMERCE_PRODUCT_CATEGORY_SLUGS = [
  'smart-phones',
  'smartphones',
  'smart-home',
  'smartwatches',
  'tablets',
  'laptops',
  'smart-light-bulbs',
  'smart-tvs',
  'smart-cameras',
  'smart-speakers',
  'smart-door-locks',
  'smart-plugs',
  'video-doorbells',
  'headphones',
  'raspberry-pi',
  'climate-comfort',
  'energy-solar',
  'entertainment-audio',
  'hubs-platforms',
  'lighting',
  'robot-vacuums',
  'security-cameras',
] as const;

const EDITORIAL_AND_STATIC_SLUGS = new Set([
  'product-comparisons',
  'product-reviews',
  'product-roundups',
  'how-to-guides',
  'top-rated-smart-electronics-devices',
  'nxt-bargains-informative-articles',
  'best-sellers-articles',
  'buying-guides',
  'category',
  'products',
  'all-products',
  'stores',
  'coupons',
  'blog',
  'search',
  'privacy',
  'terms',
  'contact',
  'about',
  'api',
]);

export function isCommerceProductCategorySlug(slug: string): boolean {
  if (!slug) return false;
  const normalized = slug.toLowerCase().trim();
  if ((COMMERCE_PRODUCT_CATEGORY_SLUGS as readonly string[]).includes(normalized)) return true;
  return !EDITORIAL_AND_STATIC_SLUGS.has(normalized);
}

export function primaryCategorySlug(
  product: Pick<CommerceProduct, 'categories' | 'category'>,
): string | null {
  const slug = product.categories?.[0]?.slug?.trim();
  if (slug) return slug;

  const legacyCategory = product.category?.trim();
  if (!legacyCategory) return null;

  return legacyCategory
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function productCanonicalPath(
  product: Pick<CommerceProduct, 'slug' | 'categories' | 'category'>,
): string {
  const categorySlug = primaryCategorySlug(product);
  if (categorySlug) return `/${categorySlug}/${product.slug}`;
  return `/products/${product.slug}`;
}

export function productHref(
  product: Pick<CommerceProduct, 'slug' | 'categories' | 'category'>,
): string {
  return productCanonicalPath(product);
}
