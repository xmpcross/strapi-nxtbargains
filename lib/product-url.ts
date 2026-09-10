import type { CommerceProduct } from '@/lib/strapi';

export const COMMERCE_PRODUCT_CATEGORY_SLUGS = [
  'smart-phones',
  'smartphones',
  /* 'smart-home' is deliberately NOT here. It exists as a commerce category in
     Strapi but holds zero products — it is the nav grouping from
     lib/product-nav.ts and an editorial post category. Listing it made the
     middleware rewrite /smart-home/<post> to /products/<post>, which 404s, so
     all four articles filed under it were unreachable. Should products ever be
     assigned to it directly, add it back and move those posts first. */
  'smartwatches',
  'tablets',
  'laptops',
  'smart-light-bulbs',
  'smart-tvs',
  'smart-cameras',
  'smart-speakers',
  'smart-door-locks',
  'smart-plugs',
  'smart-doorbells',
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

/*
 * Editorial and static first path segments.
 *
 * Kept as documentation of which prefixes are NOT product categories, after
 * the routing check stopped consulting it: isCommerceProductCategorySlug is
 * now an allowlist, so nothing has to be named here for a route to survive.
 * The list is incomplete in exactly the way that caused the bug — it names
 * 'privacy' and 'terms', which are really /legal/privacy and /legal/terms —
 * so do not reintroduce it as a routing guard.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

/**
 * Whether /<slug>/<something> is a product URL the middleware should rewrite.
 *
 * An allowlist, and it has to stay one. This previously fell back to
 * `!EDITORIAL_AND_STATIC_SLUGS.has(slug)` — anything not explicitly named as
 * editorial was assumed to be a product category. That default is inverted:
 * it makes every route that nobody remembered to list disappear.
 *
 * It cost us the legal pages. EDITORIAL_AND_STATIC_SLUGS lists 'privacy' and
 * 'terms', but the routes are /legal/privacy and /legal/terms, so the segment
 * being tested was 'legal' — unlisted, therefore "a product category" —
 * and the middleware rewrote all four to /products/<slug>, which 404s. The
 * privacy policy and terms of service were unreachable on the live site while
 * still being advertised in the sitemap.
 *
 * The cost of an allowlist is that a genuinely new product category has to be
 * added here. That is already true of lib/product-nav.ts, which needs the same
 * edit to show the category at all, so this adds no step that was not there.
 * The cost of the denylist was silent 404s on pages nobody was watching.
 */
export function isCommerceProductCategorySlug(slug: string): boolean {
  if (!slug) return false;
  const normalized = slug.toLowerCase().trim();
  return (COMMERCE_PRODUCT_CATEGORY_SLUGS as readonly string[]).includes(normalized);
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

/**
 * Whether a product page is worth indexing.
 *
 * The page's entire proposition is "compare prices across merchants". With one
 * merchant there is nothing to compare — it restates a single retailer's
 * listing, which is what Google's thin-affiliate policy is about. Ten products
 * are in that state, all Amazon-only.
 *
 * A predicate rather than a list of slugs: a product that picks up a second
 * merchant on the next price run becomes indexable again by itself, and one
 * that loses its offers drops out without anyone remembering to edit a file.
 */
export function productIsIndexable(
  product: { offers?: Array<{ merchant?: { slug?: string | null } | null; status?: string | null }> | null },
): boolean {
  const merchants = new Set(
    (product.offers ?? [])
      .filter((offer) => !offer?.status || offer.status === 'active')
      .map((offer) => offer?.merchant?.slug)
      .filter(Boolean),
  );
  return merchants.size >= 2;
}
