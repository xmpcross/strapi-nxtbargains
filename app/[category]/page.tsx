import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ArticleFiltersSidebar from '@/components/ArticleFiltersSidebar';
import EditorialCategoryLayout from '@/components/EditorialCategoryLayout';
import PostCard from '@/components/PostCard';
import {
  activeArticleFiltersCount,
  articleFiltersFromSearchParams,
  articlePageQuery,
  isValidPostType,
} from '@/lib/article-filters';
import { getEditorialCategoryConfig } from '@/lib/editorial-category-config';
import { getCategory, listPosts, mediaUrl } from '@/lib/strapi';
import { ARTICLE_SIDEBAR_CATEGORIES, resolveArticleCategoryBlurb, SECTIONS, SITE } from '@/lib/site';
import { clampDescription, firstImageUrl } from '@/lib/format';
import { pageOpenGraph } from '@/lib/seo';
import { breadcrumbJsonLd, itemListJsonLd } from '@/lib/jsonld';

export const revalidate = 60;
export const dynamicParams = true;

const PAGE_SIZE = 16;

// Reserved top-level routes that aren't categories — keep them out of this segment.
const RESERVED = new Set(['about', 'search', 'feed.xml', 'sitemap.xml', 'robots.txt']);

type Params = { category: string };
type SearchParams = { page?: string; q?: string; postType?: string };

function isReserved(slug: string) {
  return RESERVED.has(slug);
}

async function resolveCategoryName(slug: string, cmsName?: string | null): Promise<string> {
  if (cmsName?.trim()) return cmsName.trim();
  const fromConfig = SECTIONS.find((s) => s.slug === slug);
  return fromConfig?.title ?? slug.replace(/-/g, ' ');
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { category } = await params;
  if (isReserved(category)) return {};
  const cmsCategory = await getCategory(category).catch(() => null);
  // Unknown slugs render a real 404 (see CategoryPage); keep their metadata
  // clean and non-indexable rather than echoing the slug back as a title.
  const known =
    Boolean(cmsCategory) ||
    SECTIONS.some((s) => s.slug === category) ||
    Boolean(getEditorialCategoryConfig(category)) ||
    ARTICLE_SIDEBAR_CATEGORIES.some((c) => c.slug === category);
  if (!known) {
    return { title: 'Page not found', robots: { index: false, follow: false } };
  }
  const name = await resolveCategoryName(category, cmsCategory?.name);
  const description = clampDescription(
    resolveArticleCategoryBlurb(category, cmsCategory?.description) ?? `${name} from ${SITE.name} — ${SITE.tagline}`,
  );
  return {
    title: name,
    description,
    alternates: { canonical: `/${category}` },
    ...pageOpenGraph({ title: name, description, path: `/${category}` }),
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { category } = await params;
  if (isReserved(category)) notFound();

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const filters = articleFiltersFromSearchParams(sp);
  const postType = isValidPostType(filters.postType) ? filters.postType : undefined;
  const activeFilterCount = activeArticleFiltersCount(filters);

  const [cmsCategory, res] = await Promise.all([
    getCategory(category).catch(() => null),
    listPosts({
      category,
      page,
      pageSize: PAGE_SIZE,
      q: filters.q || undefined,
      postType,
    }).catch(() => null),
  ]);

  const name = await resolveCategoryName(category, cmsCategory?.name);
  const categoryBlurb = resolveArticleCategoryBlurb(category, cmsCategory?.description);

  const posts = res?.data ?? [];
  const total = res?.meta?.pagination?.total ?? posts.length;
  const pageCount = res?.meta?.pagination?.pageCount ?? 1;

  if (page > 1 && posts.length === 0) notFound();

  const sectionMeta = SECTIONS.find((s) => s.slug === category);
  const editorialConfig = getEditorialCategoryConfig(category);

  // Return a real 404 for slugs that aren't a known category — a CMS category,
  // a defined section/editorial config, a sidebar category, or something that
  // actually has posts. Prevents soft-404s (200 pages for nonexistent URLs).
  const isKnownCategory =
    Boolean(cmsCategory) ||
    Boolean(sectionMeta) ||
    Boolean(editorialConfig) ||
    ARTICLE_SIDEBAR_CATEGORIES.some((c) => c.slug === category) ||
    total > 0;
  if (!isKnownCategory) notFound();

  const heroBlurb = categoryBlurb ?? sectionMeta?.blurb;

  // Listing structured data — breadcrumb trail + an ItemList of this page's posts.
  const breadcrumbLd = breadcrumbJsonLd([
    { name: 'Home', url: '/' },
    { name, url: `/${category}` },
  ]);
  const postListItems = posts
    .filter((post) => post.slug)
    .map((post, index) => ({
      name: post.title,
      url: `/${category}/${post.slug}`,
      image: mediaUrl(post.coverImage ?? null) ?? firstImageUrl(post.content) ?? undefined,
      position: (page - 1) * PAGE_SIZE + index + 1,
    }));
  const itemListLd = postListItems.length > 0 ? itemListJsonLd(postListItems) : null;
  const listingJsonLd = (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {itemListLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
        />
      ) : null}
    </>
  );

  if (editorialConfig) {
    return (
      <>
        {listingJsonLd}
        <EditorialCategoryLayout
          config={editorialConfig}
          posts={posts}
          total={total}
          page={page}
          pageCount={pageCount}
          filters={filters}
          activeFilterCount={activeFilterCount}
          categorySlug={category}
          categoryName={name}
          categoryBlurb={categoryBlurb ?? heroBlurb}
        />
      </>
    );
  }

  return (
    <main className="article-category-page" data-testid={`category-${category}`}>
      {listingJsonLd}
      <section className="bg-paper">
        <div className="mx-auto max-w-[1366px] px-4 pb-8 pt-12 sm:px-6 sm:pb-10 sm:pt-16">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Category</p>
          <h1 className="mt-3 max-w-4xl font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            {name}
          </h1>
          {heroBlurb ? (
            <p className="mt-4 max-w-2xl text-base leading-8 text-ink/65 sm:text-lg">{heroBlurb}</p>
          ) : null}
        </div>
      </section>

      <section className="bg-white pb-12 pt-6 sm:pb-16 sm:pt-8">
        <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(220px,25%)_minmax(0,75%)] lg:items-start">
            <ArticleFiltersSidebar
              action={`/${category}`}
              clearHref={`/${category}`}
              filters={filters}
              categories={ARTICLE_SIDEBAR_CATEGORIES}
              currentCategory={category}
              totalItems={total}
              activeFilterCount={activeFilterCount}
              searchPlaceholder={`Search ${name.toLowerCase()}...`}
            />

            <div>
              <div className="flex flex-wrap items-end justify-between gap-4 border border-ink/10 bg-white p-5 sm:p-6">
                <div>
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-primary">
                    {filters.q ? 'Search results' : 'Articles'}
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">
                    {filters.q
                      ? `${total} result${total === 1 ? '' : 's'} for "${filters.q}"`
                      : `${total} article${total === 1 ? '' : 's'}`}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-ink/55">
                    Page {page} of {pageCount}
                    {activeFilterCount > 0
                      ? ` · ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} applied`
                      : ''}
                  </p>
                </div>
                <Link
                  href="/deals"
                  className="inline-flex border border-ink/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-ink/60 transition hover:border-primary hover:text-primary"
                >
                  Deals
                </Link>
              </div>

              {posts.length === 0 ? (
                <div className="mt-8 border border-dashed border-ink/15 bg-paper px-6 py-16 text-center text-ink/55">
                  {filters.q || filters.postType
                    ? 'No articles match these filters.'
                    : 'No posts here yet.'}
                </div>
              ) : (
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} variant="tile" />
                  ))}
                </div>
              )}

              {pageCount > 1 && (
                <nav className="mt-12 flex flex-wrap items-center justify-center gap-3 text-sm" data-testid="pagination">
                  {page > 1 && (
                    <Link
                      href={`/${category}${articlePageQuery(filters, page - 1)}`}
                      className="inline-flex min-h-11 items-center justify-center border border-ink/15 px-6 py-3 text-sm font-bold uppercase tracking-[0.12em] text-ink/70 transition hover:border-primary hover:text-primary"
                    >
                      Previous
                    </Link>
                  )}
                  <span className="text-ink/55">
                    Page {page} of {pageCount}
                  </span>
                  {page < pageCount && (
                    <Link
                      href={`/${category}${articlePageQuery(filters, page + 1)}`}
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
    </main>
  );
}
