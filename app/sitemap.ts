import type { MetadataRoute } from 'next';
import { couponStoreCanonicalSlug, indexableCouponStoreIds, listCouponStores } from '@/lib/coupon-stores';
import { listAllCommerceProductSlugs, listAllPostSlugs, listCategories, listCommerceCategories } from '@/lib/strapi';
import { productCanonicalPath } from '@/lib/product-url';
import { SECTIONS, SITE } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const [posts, products, cmsCategories, commerceCategories] = await Promise.all([
    listAllPostSlugs().catch(() => []),
    listAllCommerceProductSlugs().catch(() => []),
    listCategories().catch(() => []),
    listCommerceCategories().catch(() => []),
  ]);
  // Only include coupon stores that actually have coupon content. The store
  // pool is ~18k auto-imported records; the vast majority render thin/empty
  // pages, so listing them all buries real content and wastes crawl budget.
  const indexableStoreIds = indexableCouponStoreIds();
  const couponStores = listCouponStores().stores.filter((store) => indexableStoreIds.has(store.id));

  const cmsCatSlugs = new Set(cmsCategories.map((c) => c.slug));
  const sectionCatSlugs = SECTIONS.map((s) => s.slug);
  const categorySlugs = Array.from(new Set([...cmsCatSlugs, ...sectionCatSlugs]));

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE.url}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE.url}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE.url}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE.url}/products`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE.url}/category`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE.url}/price-drops`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE.url}/best-deals`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE.url}/coupons`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE.url}/stores`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE.url}/brands`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE.url}/best-sellers`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE.url}/deals`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE.url}/sitemap`, lastModified: now, changeFrequency: 'weekly', priority: 0.3 },
    { url: `${SITE.url}/legal/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE.url}/legal/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE.url}/legal/cookies`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];

  const commerceCategoryEntries: MetadataRoute.Sitemap = commerceCategories.map((category) => ({
    url: `${SITE.url}/category/${category.slug}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.75,
  }));

  const couponStoreEntries: MetadataRoute.Sitemap = couponStores.map((store) => ({
    url: `${SITE.url}/coupons/${couponStoreCanonicalSlug(store)}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.55,
  }));

  const categoryEntries: MetadataRoute.Sitemap = categorySlugs.map((slug) => ({
    url: `${SITE.url}/${slug}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  const postEntries: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${SITE.url}/${p.category}/${p.slug}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${SITE.url}${productCanonicalPath(product)}`,
    lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  return [
    ...staticEntries,
    ...commerceCategoryEntries,
    ...couponStoreEntries,
    ...categoryEntries,
    ...postEntries,
    ...productEntries,
  ];
}
