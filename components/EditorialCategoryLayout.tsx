'use client';

import { useState } from 'react';
import Link from 'next/link';
import ArticleFiltersSidebar from '@/components/ArticleFiltersSidebar';
import { articlePageQuery, type ArticleFilters } from '@/lib/article-filters';
import type { EditorialCategoryConfig } from '@/lib/editorial-category-config';
import { fmtDate, firstImageUrl, postPath } from '@/lib/format';
import { mediaUrl, type NxtPost } from '@/lib/strapi';
import { ARTICLE_SIDEBAR_CATEGORIES, SITE } from '@/lib/site';

type Props = {
  config: EditorialCategoryConfig;
  posts: NxtPost[];
  total: number;
  page: number;
  pageCount: number;
  filters: ArticleFilters;
  activeFilterCount: number;
  categorySlug: string;
  categoryName: string;
  categoryBlurb?: string;
};

function postImage(post: NxtPost): string | null {
  return mediaUrl(post.coverImage ?? null) ?? firstImageUrl(post.content);
}

function readMinutes(post: NxtPost): number {
  return post.readingTimeMinutes ?? 5;
}

function CategoryHeroDescription({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  if (!text) return null;

  const words = text.trim().split(/\s+/);
  if (words.length <= 20) {
    return (
      <p className="mt-4 w-full text-base leading-7 text-ink/75 sm:text-lg sm:leading-8">
        {text}
      </p>
    );
  }

  const first20 = words.slice(0, 20).join(' ');

  return (
    <p className="mt-4 w-full text-base leading-7 text-ink/75 sm:text-lg sm:leading-8">
      {isExpanded ? (
        <>
          {text}{' '}
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="inline-flex items-center font-bold text-primary transition hover:underline cursor-pointer"
          >
            Show Less <span aria-hidden="true" className="ml-1">↑</span>
          </button>
        </>
      ) : (
        <>
          {first20}…{' '}
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="inline-flex items-center font-bold text-primary transition hover:underline cursor-pointer"
          >
            Read More <span aria-hidden="true" className="ml-1">↓</span>
          </button>
        </>
      )}
    </p>
  );
}

export default function EditorialCategoryLayout({
  config,
  posts,
  total,
  page,
  pageCount,
  filters,
  activeFilterCount,
  categorySlug,
  categoryName,
  categoryBlurb,
}: Props) {
  const showEditorialLead = page === 1 && activeFilterCount === 0 && posts.length > 0;
  const featured = showEditorialLead ? posts[0] : null;
  const spotlight = showEditorialLead ? posts.slice(1, 4) : [];
  const gridPosts = showEditorialLead ? posts.slice(4) : posts;
  const action = `/${categorySlug}`;

  return (
    <main
      className="article-category-page editorial-category-page"
      data-testid={`editorial-category-${categorySlug}`}
    >
      <section className="relative overflow-hidden border-b border-ink/10 bg-white text-ink">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{ background: config.heroGradient }}
        />
        <div className="editorial-category-hero-inner relative mx-auto px-4 py-10 sm:px-6 sm:py-14">
          <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink/55">
            <Link href="/" className="transition hover:text-ink">
              Home
            </Link>
            <span aria-hidden>/</span>
            <span style={{ color: config.accentColor }}>{config.breadcrumbLabel}</span>
          </nav>

          <div className="mt-8 w-full">
            <p
              className="text-xs font-bold uppercase tracking-[0.18em]"
              style={{ color: config.accentColor }}
            >
              {config.eyebrow}
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl lg:text-[2.65rem]">
              {categoryName}
            </h1>
            <CategoryHeroDescription text={config.glanceDescription ?? categoryBlurb ?? ''} />

            {(() => {
              const quickLinks = config.quickLinks ?? config.marketplaceLinks;
              if (!quickLinks?.length) return null;
              const quickLinksLabel = config.quickLinksLabel ?? 'Shop by marketplace';
              return (
              <div className="mt-8 border-t border-ink/10 pt-6">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-ink/55">
                  {quickLinksLabel}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {quickLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="inline-flex min-h-9 items-center rounded-lg border border-ink/15 bg-white/80 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-ink/80 shadow-2xs transition hover:border-primary hover:bg-white hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
              );
            })()}
          </div>
        </div>
      </section>

      <section id="editorial-category-articles" className="border-t border-ink/10 bg-[#f8fafc] pb-14 pt-8 sm:pb-20 sm:pt-10">
        <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(240px,24%)_minmax(0,76%)] lg:items-start">
            <ArticleFiltersSidebar
              action={action}
              clearHref={action}
              filters={filters}
              categories={ARTICLE_SIDEBAR_CATEGORIES}
              currentCategory={categorySlug}
              totalItems={total}
              activeFilterCount={activeFilterCount}
              searchPlaceholder={config.searchPlaceholder}
              hidePostType={config.hidePostType}
              className="editorial-category-filters"
            />

            <div className="min-w-0">
              {config.topicChips?.length ? (
                <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-ink/10 bg-white p-3.5 sm:p-4 shadow-2xs">
                  <span className="mr-1 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-ink/50">
                    Topics:
                  </span>
                  {config.topicChips.map((chip) => (
                    <span
                      key={chip}
                      className="inline-flex items-center rounded-full border border-ink/10 bg-slate-50 px-3.5 py-1 text-xs font-semibold text-ink/80 transition hover:border-primary/40 hover:bg-white hover:text-primary hover:shadow-2xs"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              ) : null}

              {filters.q || activeFilterCount > 0 || page > 1 ? (
                <div className="mb-8 rounded-2xl border border-ink/10 bg-white p-5 shadow-xs sm:p-6">
                  <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-primary">
                    {filters.q ? 'Search results' : 'Filtered articles'}
                  </span>
                  <h2 className="mt-2.5 font-display text-2xl font-bold text-ink sm:text-3xl">
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
              ) : null}

              {posts.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-ink/20 bg-white px-6 py-16 text-center shadow-2xs">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 font-display text-xl font-bold text-primary">
                    ?
                  </div>
                  <h3 className="mt-4 font-display text-xl font-bold text-ink">No articles found</h3>
                  <p className="mt-2 text-sm text-ink/60">
                    {filters.q ? config.emptySearchMessage : config.emptyDefaultMessage}
                  </p>
                </div>
              ) : (
                <>
                  {featured ? (
                    <EditorialFeatureArticle post={featured} featuredLabel={config.featuredLabel} />
                  ) : null}

                  {spotlight.length > 0 ? (
                    <section className="mt-12" data-testid="editorial-category-spotlight">
                      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink/10 pb-4">
                        <div>
                          <span className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-primary">
                            {config.spotlightEyebrow}
                          </span>
                          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                            {config.spotlightTitle}
                          </h2>
                        </div>
                      </div>
                      <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                        {spotlight.map((post) => (
                          <EditorialSpotlightCard key={post.id} post={post} cardLabel={config.cardLabel} />
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {gridPosts.length > 0 ? (
                    <section
                      className={featured || spotlight.length > 0 ? 'mt-14' : ''}
                      data-testid="editorial-category-grid"
                    >
                      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink/10 pb-4">
                        <div>
                          <span className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-primary">
                            {showEditorialLead ? 'More to read' : 'All articles'}
                          </span>
                          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                            {showEditorialLead ? config.gridArchiveTitle : `${total} article${total === 1 ? '' : 's'}`}
                          </h2>
                        </div>
                        {!showEditorialLead ? (
                          <span className="rounded-full bg-slate-200/70 px-3.5 py-1 text-xs font-bold text-ink/70">
                            Page {page} of {pageCount}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {gridPosts.map((post) => (
                          <EditorialGridCard key={post.id} post={post} cardLabel={config.cardLabel} />
                        ))}
                      </div>
                    </section>
                  ) : null}
                </>
              )}

              {pageCount > 1 ? (
                <nav
                  className="mt-14 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-xs"
                  data-testid="pagination"
                  aria-label="Article pagination"
                >
                  {page > 1 ? (
                    <Link
                      href={`${action}${articlePageQuery(filters, page - 1)}`}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-ink/15 bg-white px-6 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-ink/80 transition hover:border-primary hover:bg-primary/5 hover:text-primary shadow-2xs"
                    >
                      ← Previous
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span className="text-sm font-semibold text-ink/65">
                    Page <strong className="font-bold text-ink">{page}</strong> of {pageCount}
                  </span>
                  {page < pageCount ? (
                    <Link
                      href={`${action}${articlePageQuery(filters, page + 1)}`}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-6 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-white shadow-2xs transition hover:bg-primary"
                    >
                      Next →
                    </Link>
                  ) : (
                    <span />
                  )}
                </nav>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function EditorialFeatureArticle({
  post,
  featuredLabel,
}: {
  post: NxtPost;
  featuredLabel: string;
}) {
  const img = postImage(post);
  const href = postPath(post);

  return (
    <article
      className="group overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-sm transition-all duration-500 hover:border-primary/40 hover:shadow-2xl"
      data-testid={`editorial-feature-${post.slug}`}
    >
      <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-stretch">
        <Link href={href} className="editorial-feature-image-box relative block overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 p-6 lg:p-8">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt={post.coverImage?.alternativeText || post.title}
              className="editorial-feature-image aspect-[16/10] w-full object-contain mix-blend-multiply transition duration-500 group-hover:scale-105 lg:aspect-auto lg:h-full lg:min-h-[340px]"
            />
          ) : (
            <div className="grid aspect-[16/10] w-full place-items-center bg-[#f3f6fa] font-display text-3xl font-bold text-ink/15 lg:min-h-[340px]">
              NXT
            </div>
          )}
        </Link>

        <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
          <span className="w-fit rounded-full bg-primary/10 px-3.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-primary">
            {featuredLabel}
          </span>
          <Link href={href}>
            <h2 className="editorial-feature-title mt-3.5 font-display text-2xl font-bold leading-tight text-ink transition-colors group-hover:text-primary sm:text-3xl lg:text-[2rem]">
              {post.title}
            </h2>
          </Link>
          {post.excerpt ? (
            <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-ink/75 sm:text-base">{post.excerpt}</p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-ink/55 border-t border-ink/10 pt-5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary font-display text-xs font-bold text-white shadow-2xs">
              N
            </span>
            <span className="font-bold text-ink/80">{SITE.name} Editorial</span>
            <span className="text-ink/30">•</span>
            <span>{fmtDate(post.publishedAt)}</span>
            <span className="text-ink/30">•</span>
            <span className="font-semibold text-primary">{readMinutes(post)} min read</span>
          </div>
          <Link
            href={href}
            className="mt-6 inline-flex w-fit min-h-11 items-center justify-center rounded-xl bg-ink px-6 py-3 text-xs font-bold uppercase tracking-[0.14em] text-white shadow-2xs transition hover:bg-primary hover:shadow-md"
          >
            Read full article →
          </Link>
        </div>
      </div>
    </article>
  );
}

function EditorialSpotlightCard({ post, cardLabel }: { post: NxtPost; cardLabel: string }) {
  const img = postImage(post);
  const href = postPath(post);
  const cat = post.categories?.[0]?.name ?? cardLabel;

  return (
    <article
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white p-5 shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-xl"
      data-testid={`editorial-spotlight-${post.slug}`}
    >
      <Link href={href} className="editorial-spotlight-image-box relative block aspect-[16/10] w-full overflow-hidden rounded-xl bg-[#f8fafc]">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={post.coverImage?.alternativeText || post.title}
            loading="lazy"
            className="editorial-spotlight-image h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[#f3f6fa] font-display text-xl font-bold text-ink/15">
            NXT
          </div>
        )}
        <span className="absolute top-3 left-3 rounded-md bg-primary px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-white shadow-xs">
          {cat}
        </span>
      </Link>
      <div className="flex flex-1 flex-col pt-4">
        <Link href={href}>
          <h3 className="editorial-spotlight-title line-clamp-2 font-display text-lg font-bold leading-snug text-ink transition-colors group-hover:text-primary">
            {post.title}
          </h3>
        </Link>
        {post.excerpt ? (
          <p className="mt-2.5 line-clamp-3 flex-1 text-xs leading-6 text-ink/70">{post.excerpt}</p>
        ) : null}
        <div className="mt-4 flex items-center justify-between border-t border-ink/5 pt-3 text-xs text-ink/50">
          <span>{fmtDate(post.publishedAt)}</span>
          <span className="font-semibold text-primary">{readMinutes(post)} min read</span>
        </div>
      </div>
    </article>
  );
}

function EditorialGridCard({ post, cardLabel }: { post: NxtPost; cardLabel: string }) {
  const img = postImage(post);
  const href = postPath(post);
  const cat = post.categories?.[0]?.name ?? cardLabel;

  return (
    <article
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
      data-testid={`editorial-grid-${post.slug}`}
    >
      <Link href={href} className="editorial-grid-image-box relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#f8fafc]">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={post.coverImage?.alternativeText || post.title}
            loading="lazy"
            className="editorial-grid-image h-full w-full object-contain p-2.5 transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[#f3f6fa] font-display text-lg font-bold text-ink/15">
            NXT
          </div>
        )}
        <span className="absolute top-2.5 left-2.5 rounded-md bg-ink/80 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-white backdrop-blur-xs">
          {cat}
        </span>
      </Link>
      <div className="mt-4 flex flex-1 flex-col">
        <Link href={href}>
          <h3 className="editorial-grid-title line-clamp-2 font-display text-base font-bold leading-snug text-ink transition-colors group-hover:text-primary">
            {post.title}
          </h3>
        </Link>
        {post.excerpt ? (
          <p className="mt-2 line-clamp-2 flex-1 text-xs leading-5 text-ink/65">{post.excerpt}</p>
        ) : null}
        <div className="mt-4 flex items-center justify-between border-t border-ink/5 pt-3 text-[0.7rem] text-ink/45">
          <span>{fmtDate(post.publishedAt)}</span>
          <span className="font-semibold text-primary">{readMinutes(post)} min read</span>
        </div>
      </div>
    </article>
  );
}

