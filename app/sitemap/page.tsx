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
        className="relative overflow-hidden border-b border-ink/10 bg-[#1d252c] text-white"
        data-testid="sitemap-page-header"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              'radial-gradient(at 80% 20%, rgba(0,70,190,0.22) 0%, transparent 50%), radial-gradient(at 15% 85%, rgba(255,224,0,0.12) 0%, transparent 50%)',
          }}
        />
        <div className="relative mx-auto max-w-[1366px] px-4 py-10 sm:px-6 sm:py-14">
          <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/45">
            <Link href="/" className="transition hover:text-white">Home</Link>
            <span aria-hidden>/</span>
            <span className="text-[#ffe000]">Site map</span>
          </nav>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ffe000]">Site map</p>
              <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
                Everything on {SITE.name}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
                A human-readable index of every page — products, categories, articles, and coupon stores.
                Use the sidebar to jump straight to the section you need.
              </p>

              <ul className="mt-6 max-w-2xl space-y-3 text-sm leading-6 text-white/75 sm:text-base">
                <li className="flex gap-3">
                  <span className="mt-0.5 shrink-0 text-[#ffe000]" aria-hidden>✓</span>
                  <span>Every product, category, article, and coupon store in one index.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 shrink-0 text-[#ffe000]" aria-hidden>✓</span>
                  <span>Filter by section in the sidebar to drill into a single category.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 shrink-0 text-[#ffe000]" aria-hidden>✓</span>
                  <span>Prefer machines? Grab the XML feed for crawlers.</span>
                </li>
              </ul>

              <div className="mt-10 flex flex-wrap gap-3">
                <a href="#sitemap-explorer" className="inline-flex bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary-emphasis">
                  Browse sections
                </a>
                <Link href="/sitemap.xml" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white/80 transition hover:border-white/40 hover:text-white">
                  XML sitemap
                </Link>
                <Link href="/all-products" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white/75 transition hover:border-white/40 hover:text-white">
                  All products
                </Link>
              </div>
            </div>

            <aside className="border border-white/15 bg-white/5 p-5 backdrop-blur sm:p-6" aria-label="Site map statistics">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ffe000]">At a glance</p>
              <p className="mt-3 text-sm leading-6 text-white/70">
                A live snapshot of everything indexed on {SITE.name} — {totalLinks} links across products,
                articles, categories, and coupon stores.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-5">
                <Stat label="Total links" value={String(totalLinks)} />
                <Stat label="Products" value={String(products.length)} />
                <Stat label="Articles" value={String(posts.length)} />
                <Stat label="Coupon stores" value={String(couponStores.length)} />
              </div>
              <div className="mt-5 border-t border-white/10 pt-4 text-xs text-white/55">
                Also available as{' '}
                <Link href="/sitemap.xml" className="font-semibold text-[#ffe000] underline-offset-2 hover:underline">
                  /sitemap.xml
                </Link>
                .
              </div>
            </aside>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-white/55">{label}</p>
    </div>
  );
}

function humanizeSlug(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
