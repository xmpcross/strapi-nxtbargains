import Link from 'next/link';
import type { Metadata } from 'next';
import PostCard from '@/components/PostCard';
import { listCategories, listPosts, type NxtCategory, type NxtPost } from '@/lib/strapi';
import { SITE } from '@/lib/site';
import { pageOpenGraph } from '@/lib/seo';
import { collectionPageJsonLd } from '@/lib/jsonld';
import PostFiltersSidebar, { postPageQuery, type PostFilterOption } from '@/components/PostFiltersSidebar';
import { JsonLd } from '@/components/JsonLd';

export const revalidate = 60;

const PAGE_SIZE = 24;

type SearchParams = { page?: string; q?: string; category?: string; type?: string };

export const metadata: Metadata = {
  title: 'All Articles',
  description: `Browse every article from ${SITE.name} — product comparisons, reviews, roundups, how-to guides and buying advice, organised by category.`,
  alternates: { canonical: '/all-posts' },
  ...pageOpenGraph({
    title: 'All Articles',
    description: `Browse every article from ${SITE.name}, organised by category.`,
    path: '/all-posts',
  }),
};

export default async function PostsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const filters = {
    q: (sp.q ?? '').trim(),
    category: (sp.category ?? '').trim(),
    type: (sp.type ?? '').trim(),
  };

  /*
   * facetSource is every published post, fetched once with only the fields the
   * counts need. It is what makes the sidebar counts real: a category is listed
   * with the number of articles actually in it, and a category with none is left
   * out rather than offering an empty page. 82 posts, so one page is enough.
   */
  const [categories, res, facetSource] = await Promise.all([
    listCategories().catch(() => [] as NxtCategory[]),
    listPosts({
      page,
      pageSize: PAGE_SIZE,
      q: filters.q || undefined,
      category: filters.category || undefined,
      postType: (filters.type || undefined) as NxtPost['postType'],
    }).catch(() => null),
    listPosts({ page: 1, pageSize: 500 }).then((r) => r.data).catch(() => [] as NxtPost[]),
  ]);

  const categoryFacets: PostFilterOption[] = (() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const post of facetSource) {
      for (const c of post.categories ?? []) {
        if (!c?.slug) continue;
        const row = counts.get(c.slug) ?? { label: c.name ?? c.slug, count: 0 };
        row.count += 1;
        counts.set(c.slug, row);
      }
    }
    return [...counts.entries()]
      .map(([value, r]) => ({ value, label: r.label, count: r.count }))
      .sort((a, b) => b.count - a.count);
  })();

  const typeFacets: PostFilterOption[] = (() => {
    const counts = new Map<string, number>();
    for (const post of facetSource) {
      if (post.postType) counts.set(post.postType, (counts.get(post.postType) ?? 0) + 1);
    }
    const label = (v: string) => v.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
    return [...counts.entries()]
      .map(([value, count]) => ({ value, label: label(value), count }))
      .sort((a, b) => b.count - a.count);
  })();

  const posts = res?.data ?? [];
  const total = res?.meta?.pagination?.total ?? posts.length;
  const pageCount = res?.meta?.pagination?.pageCount ?? 1;

  const pageJsonLd = collectionPageJsonLd({
    name: 'All Articles',
    url: `${SITE.url}/posts`,
    description: metadata.description,
    numberOfItems: total,
  });

  const featuredCategories = categories.slice(0, 10);

  return (
    <main data-testid="posts-page">
      <JsonLd graph={[pageJsonLd]} />

      <PostsHero
        totalPosts={total}
        showing={posts.length}
        categoryCount={categories.length}
        page={page}
        pageCount={pageCount}
      />

      {featuredCategories.length > 0 ? (
        <section className="border-b border-ink/10 bg-white py-5" data-testid="posts-category-strip">
          <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-bold uppercase tracking-[0.14em] text-ink/45">Browse:</span>
              {featuredCategories.map((category) => (
                <Link
                  key={category.id}
                  href={`/${category.slug}`}
                  className="inline-flex border border-ink/10 bg-[#f0f2f4] px-3 py-1.5 text-xs font-bold text-ink/65 transition hover:border-primary hover:text-primary"
                  data-testid={`posts-category-${category.slug}`}
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="bg-[#f0f2f4] py-10 sm:py-12" id="articles">
        <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4 border border-ink/10 bg-white p-5 sm:p-6">
            <div>
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-primary">All articles</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">
                {total} article{total === 1 ? '' : 's'} to read
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink/55">
                Page {page} of {pageCount}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/best-deals"
                className="inline-flex border border-ink/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-ink/60 transition hover:border-primary hover:text-primary"
              >
                Best deals
              </Link>
              <Link
                href="/all-products"
                className="inline-flex border border-ink/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-ink/60 transition hover:border-primary hover:text-primary"
              >
                All products
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
            <PostFiltersSidebar
              filters={filters}
              categories={categoryFacets}
              types={typeFacets}
              totalItems={facetSource.length}
            />

            <div>
              {posts.length === 0 ? (
                <div className="border border-dashed border-ink/15 bg-white px-6 py-16 text-center text-ink/55">
                  No articles match these filters.
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {posts.map((post: NxtPost) => (
                    <PostCard key={post.id} post={post} variant="tile" thumbBg="bg-white" />
                  ))}
                </div>
              )}

          {pageCount > 1 && (
            <nav
              className="mt-12 flex flex-wrap items-center justify-center gap-3 text-sm"
              data-testid="posts-pagination"
            >
              {page > 1 && (
                <Link
                  href={`/all-posts${postPageQuery(filters, page - 1)}`}
                  className="inline-flex min-h-11 items-center justify-center border border-ink/15 bg-white px-6 py-3 text-sm font-bold uppercase tracking-[0.12em] text-ink/70 transition hover:border-primary hover:text-primary"
                >
                  Previous
                </Link>
              )}
              <span className="text-ink/55">
                Page {page} of {pageCount}
              </span>
              {page < pageCount && (
                <Link
                  href={`/all-posts${postPageQuery(filters, page + 1)}`}
                  className="inline-flex min-h-11 items-center justify-center bg-ink px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:bg-primary"
                >
                  Next
                </Link>
              )}
            </nav>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-ink/10 bg-white py-10">
        <div className="mx-auto grid max-w-[1366px] gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <BrowseCard href="/best-deals" title="Best deals" subtitle="Highest discounts right now" />
          <BrowseCard href="/price-drops" title="Price drops" subtitle="Recently tracked price movements" />
          <BrowseCard href="/coupons" title="Coupons" subtitle="Promo codes and store deals" />
          <BrowseCard href="/all-products" title="All products" subtitle="Compare offers across merchants" />
        </div>
      </section>
    </main>
  );
}

function PostsHero({
  totalPosts,
  showing,
  categoryCount,
  page,
  pageCount,
}: {
  totalPosts: number;
  showing: number;
  categoryCount: number;
  page: number;
  pageCount: number;
}) {
  return (
    <section
      className="page-hero"
      data-testid="posts-page-header"
    >
      <div className="page-hero-inner">
        <nav className="page-hero-crumbs">
          <Link href="/">Home</Link>
          <span aria-hidden>/</span>
          <span className="page-hero-crumbs-current">All articles</span>
        </nav>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-start">
          <div>
            <p className="page-hero-eyebrow">{SITE.name} editorial</p>
            <h1 className="page-hero-title">
              Every article. Every category. One place to read.
            </h1>
            <p className="page-hero-desc">
              Product comparisons, honest reviews, roundups, how-to guides and buying advice, all in one
              archive. Browse everything below, or jump straight into the category you care about. Nothing
              here is behind a signup.
            </p>
          </div>

          <aside className="page-hero-panel p-5 sm:p-6" aria-label="Article archive statistics">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">At a glance</p>
            <p className="mt-3 text-sm leading-6 text-ink/70">
              A live snapshot of the {SITE.name} article archive — updated as new comparisons, reviews, roundups
              and guides are published across {categoryCount} categories.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-ink/10 pt-5">
              <Stat label="Articles" value={String(totalPosts)} />
              <Stat label="Categories" value={String(categoryCount)} />
              <Stat label="On this page" value={String(showing)} />
              <Stat label="Pages" value={String(pageCount)} />
            </div>
            <div className="mt-5 border-t border-ink/10 pt-4 text-xs text-ink/55">
              Viewing page {page} of {pageCount}.
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-sm text-ink/55">{label}</p>
    </div>
  );
}

function BrowseCard({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Link
      href={href}
      className="group border border-ink/10 bg-[#f0f2f4] p-5 transition hover:-translate-y-0.5 hover:border-primary"
    >
      <h3 className="font-display text-lg font-bold text-ink transition group-hover:text-primary">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink/55">{subtitle}</p>
    </Link>
  );
}
