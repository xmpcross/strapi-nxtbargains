import Link from 'next/link';
import type { Metadata } from 'next';
import CommerceProductCard from '@/components/CommerceProductCard';
import {
  listCategories,
  listCommerceProducts,
  listPosts,
  type NxtPostType,
} from '@/lib/strapi';
import PostCard from '@/components/PostCard';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Search',
  alternates: { canonical: '/search' },
};

type SearchParams = {
  q?: string;
  page?: string;
  category?: string;
  postType?: string;
};

const POST_TYPES: { value: NxtPostType; label: string }[] = [
  { value: 'product-comparison', label: 'Product Comparison' },
  { value: 'product-review', label: 'Product Review' },
  { value: 'product-roundup', label: 'Product Roundup' },
  { value: 'how-to-guide', label: 'How-to Guide' },
  { value: 'top-rated', label: 'Top Rated' },
  { value: 'informative', label: 'Informative' },
  { value: 'other', label: 'Other' },
];

function isValidPostType(value: string | undefined): value is NxtPostType {
  return !!value && POST_TYPES.some((t) => t.value === value);
}

function buildHref(base: SearchParams, override: Partial<SearchParams>) {
  const params = new URLSearchParams();
  const merged = { ...base, ...override };
  if (merged.q) params.set('q', merged.q);
  if (merged.category) params.set('category', merged.category);
  if (merged.postType) params.set('postType', merged.postType);
  if (merged.page && Number(merged.page) > 1) params.set('page', String(merged.page));
  const qs = params.toString();
  return qs ? `/search?${qs}` : '/search';
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? '').trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const category = (sp.category ?? '').trim();
  const postType = isValidPostType(sp.postType) ? sp.postType : undefined;
  const PAGE_SIZE = 12;

  const baseParams: SearchParams = {
    q: query,
    category: category || undefined,
    postType,
  };

  const categories = await listCategories().catch(() => []);

  let postRes: Awaited<ReturnType<typeof listPosts>> | null = null;
  let productRes: Awaited<ReturnType<typeof listCommerceProducts>> | null = null;
  if (query) {
    [postRes, productRes] = await Promise.all([
      listPosts({
        q: query,
        page,
        pageSize: PAGE_SIZE,
        category: category || undefined,
        postType,
      }).catch(() => null),
      listCommerceProducts({ q: query, page: 1, pageSize: 4 }).catch(() => null),
    ]);
  }
  const posts = postRes?.data ?? [];
  const products = productRes?.data ?? [];
  const postTotal = postRes?.meta?.pagination?.total ?? 0;
  const productTotal = productRes?.meta?.pagination?.total ?? 0;
  const total = postTotal + productTotal;
  const pageCount = postRes?.meta?.pagination?.pageCount ?? 1;

  const hasActiveFilters = Boolean(category) || Boolean(postType);

  return (
    <section className="mx-auto max-w-[1366px] px-4 py-12 sm:px-6" data-testid="search-page">
      <header>
        {/* Breadcrumb then a heading that names the query, as the reference
            does — the eyebrow said "Search" twice over. */}
        <nav aria-label="Breadcrumb" className="text-sm text-ink/50">
          <Link href="/" className="transition hover:text-ink">Home</Link>
          <span className="mx-2" aria-hidden="true">›</span>
          <span className="text-ink">{query ? `Search: ${query}` : 'Search'}</span>
        </nav>

        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          {query ? <>Results for “{query}”</> : 'Search'}
        </h1>

        {/* Separate controls rather than one pill: a labelled button beside the
            field is easier to hit than a word inside its border. */}
        <form action="/search" method="get" className="mt-7 flex max-w-xl gap-3">
          <label htmlFor="site-search" className="sr-only">Search</label>
          <input
            id="site-search"
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search products, brands, guides…"
            className="w-full rounded-lg border border-ink/15 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-ink/45 focus:border-primary"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-primary px-7 py-3 font-bold text-white transition hover:bg-primary-emphasis"
          >
            Search
          </button>
        </form>

        {query && (
          <p className="mt-4 text-sm text-ink/55">
            {total === 0 ? 'No results' : `${total} result${total === 1 ? '' : 's'}`}
            {hasActiveFilters && (
              <>
                {' '}·{' '}
                <Link href={buildHref(baseParams, { category: undefined, postType: undefined })} className="font-semibold text-primary hover:text-primary-emphasis">
                  Clear filters
                </Link>
              </>
            )}
          </p>
        )}
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Left sidebar – filters */}
        <aside data-testid="search-filters" className="lg:sticky lg:top-24 lg:self-start">
          <form action="/search" method="get" className="space-y-6 rounded-2xl border border-ink/10 bg-white p-5">
            <input type="hidden" name="q" value={query} />

            <div>
              <h2 className="font-display text-sm font-bold uppercase tracking-wider text-ink">Filters</h2>
              {hasActiveFilters && (
                <Link href={buildHref(baseParams, { category: undefined, postType: undefined })} className="mt-1 inline-block text-xs font-semibold text-primary hover:text-primary-emphasis">
                  Reset all
                </Link>
              )}
            </div>

            <fieldset className="space-y-2">
              <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-ink/60">Category</legend>
              <label className="flex items-center gap-2 text-sm text-ink/80">
                <input
                  type="radio"
                  name="category"
                  value=""
                  defaultChecked={!category}
                  className="accent-primary"
                />
                <span>All categories</span>
              </label>
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-ink/80">
                  <input
                    type="radio"
                    name="category"
                    value={c.slug}
                    defaultChecked={category === c.slug}
                    className="accent-primary"
                  />
                  <span className="truncate">{c.name}</span>
                </label>
              ))}
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-ink/60">Post Type</legend>
              <label className="flex items-center gap-2 text-sm text-ink/80">
                <input
                  type="radio"
                  name="postType"
                  value=""
                  defaultChecked={!postType}
                  className="accent-primary"
                />
                <span>Any type</span>
              </label>
              {POST_TYPES.map((t) => (
                <label key={t.value} className="flex items-center gap-2 text-sm text-ink/80">
                  <input
                    type="radio"
                    name="postType"
                    value={t.value}
                    defaultChecked={postType === t.value}
                    className="accent-primary"
                  />
                  <span>{t.label}</span>
                </label>
              ))}
            </fieldset>

            <button
              type="submit"
              className="w-full rounded-full bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-primary-emphasis"
            >
              Apply filters
            </button>
          </form>
        </aside>

        {/* Right column – results */}
        <div className="min-w-0">
          {products.length > 0 && (
            <section className="mb-10" data-testid="search-product-results">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 className="font-display text-xl font-bold text-ink">Product prices</h2>
                <Link
                  href={`/products?q=${encodeURIComponent(query)}`}
                  className="text-sm font-bold text-primary hover:text-primary-emphasis"
                >
                  View all products
                </Link>
              </div>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {products.map((product) => (
                  <CommerceProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          )}

          <section data-testid="search-post-results">
            {query && (
              <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
                <h2 className="font-display text-xl font-bold text-ink">Articles</h2>
                <span className="text-xs text-ink/55">
                  {postTotal} article{postTotal === 1 ? '' : 's'}
                </span>
              </div>
            )}

            {posts.length > 0 ? (
              <div className="divide-y divide-ink/10">
                {posts.map((p) => (
                  <PostCard key={p.id} post={p} variant="list" />
                ))}
              </div>
            ) : query ? (
              <div className="rounded-2xl border border-dashed border-ink/15 px-6 py-16 text-center text-sm text-ink/55">
                No articles match {hasActiveFilters ? 'these filters' : 'this search'}.
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-ink/15 px-6 py-16 text-center text-sm text-ink/55">
                Enter a search term to get started.
              </div>
            )}
          </section>

          {pageCount > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-3 text-sm">
              {page > 1 && (
                <Link
                  href={buildHref(baseParams, { page: String(page - 1) })}
                  className="inline-flex items-center rounded-full border border-ink/15 px-4 py-2 font-medium text-ink transition hover:border-primary hover:text-primary"
                >
                  ← Previous
                </Link>
              )}
              <span className="text-ink/55">
                Page {page} of {pageCount}
              </span>
              {page < pageCount && (
                <Link
                  href={buildHref(baseParams, { page: String(page + 1) })}
                  className="inline-flex items-center rounded-full border border-ink/15 px-4 py-2 font-medium text-ink transition hover:border-primary hover:text-primary"
                >
                  Next →
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>
    </section>
  );
}
