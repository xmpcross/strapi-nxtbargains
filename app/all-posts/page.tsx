import Link from 'next/link';
import type { Metadata } from 'next';
import PostCard from '@/components/PostCard';
import { listCategories, listPosts, type NxtCategory, type NxtPost } from '@/lib/strapi';
import { SITE } from '@/lib/site';
import { pageOpenGraph } from '@/lib/seo';
import { collectionPageJsonLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';

export const revalidate = 60;

const PAGE_SIZE = 24;

type SearchParams = { page?: string };

export const metadata: Metadata = {
  title: 'All Articles',
  description: `Browse every article from ${SITE.name} — product comparisons, reviews, roundups, how-to guides and buying advice, organised by category.`,
  alternates: { canonical: '/posts' },
  ...pageOpenGraph({
    title: 'All Articles',
    description: `Browse every article from ${SITE.name}, organised by category.`,
    path: '/posts',
  }),
};

export default async function PostsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);

  const [categories, res] = await Promise.all([
    listCategories().catch(() => [] as NxtCategory[]),
    listPosts({ page, pageSize: PAGE_SIZE }).catch(() => null),
  ]);

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

          {posts.length === 0 ? (
            <div className="mt-6 border border-dashed border-ink/15 bg-white px-6 py-16 text-center text-ink/55">
              No posts published yet.
            </div>
          ) : (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
                  href={`/posts?page=${page - 1}`}
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
                  href={`/posts?page=${page + 1}`}
                  className="inline-flex min-h-11 items-center justify-center bg-ink px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:bg-primary"
                >
                  Next
                </Link>
              )}
            </nav>
          )}
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
      className="relative overflow-hidden border-b border-ink/10 bg-[#1d252c] text-white"
      data-testid="posts-page-header"
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
          <span className="text-[#ffe000]">All articles</span>
        </nav>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ffe000]">{SITE.name} editorial</p>
            <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
              Every article. Every category. One place to read.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
              Product comparisons, honest reviews, roundups, how-to guides and buying advice — browse the full
              archive below, or jump straight into a category.
            </p>

            <ul className="mt-6 max-w-2xl space-y-3 text-sm leading-6 text-white/75 sm:text-base">
              <li className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-[#ffe000]" aria-hidden>✓</span>
                <span>Side-by-side comparisons and hands-on reviews across every category.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-[#ffe000]" aria-hidden>✓</span>
                <span>Buying guides and roundups to shortlist before you shop.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-[#ffe000]" aria-hidden>✓</span>
                <span>Free to read — no signup required.</span>
              </li>
            </ul>

            <div className="mt-10 flex flex-wrap gap-3">
              <a href="#articles" className="inline-flex bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary-emphasis">
                Browse articles
              </a>
              <Link href="/category" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white/80 transition hover:border-white/40 hover:text-white">
                Categories
              </Link>
              <Link href="/best-deals" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white/75 transition hover:border-white/40 hover:text-white">
                Best deals
              </Link>
            </div>
          </div>

          <aside className="border border-white/15 bg-white/5 p-5 backdrop-blur sm:p-6" aria-label="Article archive statistics">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ffe000]">At a glance</p>
            <p className="mt-3 text-sm leading-6 text-white/70">
              A live snapshot of the {SITE.name} article archive — updated as new comparisons, reviews, roundups
              and guides are published across {categoryCount} categories.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-5">
              <Stat label="Articles" value={String(totalPosts)} />
              <Stat label="Categories" value={String(categoryCount)} />
              <Stat label="On this page" value={String(showing)} />
              <Stat label="Pages" value={String(pageCount)} />
            </div>
            <div className="mt-5 border-t border-white/10 pt-4 text-xs text-white/55">
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
      <p className="font-display text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-white/55">{label}</p>
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
