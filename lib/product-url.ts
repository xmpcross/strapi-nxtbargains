import type { CommerceProduct } from '@/lib/strapi';

export const COMMERCE_PRODUCT_CATEGORY_SLUGS = [
  'smart-phones',
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
] as const;

export function isCommerceProductCategorySlug(slug: string): boolean {
  return (COMMERCE_PRODUCT_CATEGORY_SLUGS as readonly string[]).includes(slug);
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
