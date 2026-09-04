import Link from 'next/link';
import type { Metadata } from 'next';
import {
  listAllCommerceProductSlugs,
  listAllPostSlugs,
  listCategories,
  listCommerceCategories,
  type CommerceCategory,
  type NxtCategory,
} from '@/lib/strapi';
import {
  couponStoreCanonicalSlug,
  highIntentStoreAliases,
  indexableCouponStoreIds,
  listCouponStores,
} from '@/lib/coupon-stores';
import { primaryCategorySlug, productCanonicalPath } from '@/lib/product-url';
import { BLOG_NAV_LINKS, SECTIONS, SITE } from '@/lib/site';
import { fmtDate } from '@/lib/format';
import SitemapExplorer from '@/components/SitemapExplorer';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Site Map',
  description: `Browse every page on ${SITE.name} — products, categories, articles, coupons, deals and the XML feed.`,
  alternates: { canonical: '/sitemap' },
};

type PostSlug = { slug: string; category: string; updatedAt: string };
type ProductSlug = Awaited<ReturnType<typeof listAllCommerceProductSlugs>>[number];

const LINK_GROUPS: Array<{ title: string; links: Array<{ href: string; label: string }> }> = [
  {
    title: 'Shop',
    links: [
      { href: '/all-products', label: 'All Products' },
      { href: '/best-deals', label: 'Best Deals' },
      { href: '/price-drops', label: 'Price Drops' },
      { href: '/coupons', label: 'Coupons' },
      { href: '/stores', label: 'Stores' },
      { href: '/brands', label: 'Brands' },
      { href: '/best-sellers', label: 'Best Sellers' },
      { href: '/category', label: 'All Categories' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/', label: 'Home' },
      { href: '/about', label: 'About Us' },
      { href: '/contact', label: 'Contact Us' },
      { href: '/search', label: 'Search' },
      { href: '/feed.xml', label: 'RSS Feed' },
      { href: '/sitemap.xml', label: 'XML Sitemap' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/legal/notice', label: 'Legal Notice' },
      { href: '/legal/terms', label: 'Terms & Conditions' },
      { href: '/legal/privacy', label: 'Privacy Policy' },
      { href: '/legal/cookies', label: 'Cookie Policy' },
    ],
  },
];

export default async function HtmlSitemapPage() {
  const [posts, cmsCats, products, commerceCats]: [
    PostSlug[],
    NxtCategory[],
    ProductSlug[],
    CommerceCategory[],
  ] = await Promise.all([
    listAllPostSlugs().catch(() => [] as PostSlug[]),
    listCategories().catch(() => [] as NxtCategory[]),
    listAllCommerceProductSlugs().catch(() => [] as ProductSlug[]),
    listCommerceCategories().catch(() => [] as CommerceCategory[]),
  ]);

  const indexableStoreIds = indexableCouponStoreIds();
  const couponStores = listCouponStores()
    .stores.filter((store) => indexableStoreIds.has(store.id))
    .map((store) => ({ name: store.name, href: `/coupons/${couponStoreCanonicalSlug(store)}` }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));

  // Curated coupon brands (high-intent aliases) → brand coupon pages.
  const couponBrands = highIntentStoreAliases()
    .map((alias) => ({
      name: alias.label || humanizeSlug(alias.slug),
      href: alias.slug === 'amazon' ? '/coupons/amazon' : `/coupons/${alias.slug}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));

  // Group posts by primary category slug
  const postsByCat = new Map<string, PostSlug[]>();
  for (const p of posts) {
    if (!postsByCat.has(p.category)) postsByCat.set(p.category, []);
    postsByCat.get(p.category)!.push(p);
  }

  const orderedArticleCats = [
    ...SECTIONS.map((s) => ({ slug: s.slug, name: s.title })),
    ...cmsCats
      .filter((c) => !SECTIONS.some((s) => s.slug === c.slug))
      .map((c) => ({ slug: c.slug, name: c.name })),
  ];

  // "Read" column lists All Articles plus every article category (the nav
  // categories, then any additional CMS categories).
  const articleCategoryLinks: Array<{ href: string; label: string }> = [];
  const seenArticleCat = new Set<string>();
  for (const link of BLOG_NAV_LINKS) {
    const slug = link.href.replace(/^\//, '');
    if (seenArticleCat.has(slug)) continue;
    seenArticleCat.add(slug);
    articleCategoryLinks.push({ href: link.href, label: link.label });
  }
  for (const c of cmsCats) {
    if (seenArticleCat.has(c.slug)) continue;
    seenArticleCat.add(c.slug);
    articleCategoryLinks.push({ href: `/${c.slug}`, label: c.name });
  }
  const readGroup = {
    title: 'Read',
    links: [{ href: '/all-posts', label: 'All Articles' }, ...articleCategoryLinks],
  };
  const linkGroups = [LINK_GROUPS[0], readGroup, ...LINK_GROUPS.slice(1)];

  // Group products by primary category slug (matches their canonical URL)
  const commerceCatName = new Map(commerceCats.map((c) => [c.slug, c.name]));
  const productsByCat = new Map<string, Array<{ href: string; slug: string; updatedAt: string }>>();
  for (const product of products) {
    const slug = primaryCategorySlug(product) ?? 'products';
    if (!productsByCat.has(slug)) productsByCat.set(slug, []);
    productsByCat.get(slug)!.push({
      href: productCanonicalPath(product),
      slug: product.slug,
      updatedAt: product.updatedAt,
    });
  }
  const orderedProductCats = [...productsByCat.keys()].sort((a, b) =>
    (commerceCatName.get(a) ?? a).localeCompare(commerceCatName.get(b) ?? b, 'en'),
  );

  const pageLinkCount = linkGroups.reduce((sum, g) => sum + g.links.length, 0);
  const totalLinks =
    pageLinkCount + products.length + couponStores.length + posts.length + productsByCat.size;

  // Serializable props for the client-side sidebar filter.
  const productCatSections = orderedProductCats.map((slug) => ({
    slug,
    name: commerceCatName.get(slug) ?? humanizeSlug(slug),
    href: `/category/${slug}`,
    items: (productsByCat.get(slug) ?? []).map((p) => ({
      href: p.href,
      label: humanizeSlug(p.slug),
      date: fmtDate(p.updatedAt),
    })),
  }));

  const articleCatSections = orderedArticleCats
    .filter(({ slug }) => (postsByCat.get(slug)?.length ?? 0) > 0)
    .map(({ slug, name }) => ({
      slug,
      name,
      href: `/${slug}`,
      items: (postsByCat.get(slug) ?? []).map((p) => ({
        href: `/${slug}/${p.slug}`,
        label: humanizeSlug(p.slug),
        date: fmtDate(p.updatedAt),
      })),
    }));

  return (
    <main data-testid="sitemap-page">
      {/* Hero — matches the /products two-column layout with an "At a glance" panel */}
      <section
        className="page-hero"
        data-testid="sitemap-page-header"
      >
        <div className="page-hero-inner">
          <nav className="page-hero-crumbs">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <span className="page-hero-crumbs-current">Site map</span>
          </nav>

          <div className="mt-7">
            <p className="page-hero-eyebrow">Site map</p>
            <h1 className="page-hero-title">Everything on {SITE.name}</h1>
            <p className="page-hero-desc">
              A human-readable index of everything on {SITE.name} &mdash; products, categories, articles and
              coupon stores. Use the sidebar to jump straight to the section you need. Every link points to a
              live page, so this doubles as a quick way to see what we cover.
            </p>
          </div>
        </div>
      </section>

      <SitemapExplorer
        mainGroups={linkGroups}
        productCats={productCatSections}
        articleCats={articleCatSections}
        couponStores={couponStores}
        couponBrands={couponBrands}
      />
    </main>
  );
}


function humanizeSlug(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
