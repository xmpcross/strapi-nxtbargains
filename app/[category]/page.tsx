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
import { buildDefaultCategoryConfig, getEditorialCategoryConfig } from '@/lib/editorial-category-config';
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

  const config = editorialConfig ?? buildDefaultCategoryConfig(category, name, heroBlurb);

  return (
    <>
      {listingJsonLd}
      <EditorialCategoryLayout
        config={config}
        posts={posts}
        total={total}
        page={page}
        pageCount={pageCount}
        filters={filters}
        activeFilterCount={activeFilterCount}
        categorySlug={category}
        categoryName={name}
        categoryBlurb={heroBlurb}
      />
    </>
  );
}

