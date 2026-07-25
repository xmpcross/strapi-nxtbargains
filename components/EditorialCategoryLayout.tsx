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
      <section className="relative overflow-hidden border-b border-ink/10 bg-[#101828] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{ background: config.heroGradient }}
        />
        <div className="editorial-category-hero-inner relative mx-auto px-4 py-10 sm:px-6 sm:py-14">
          <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/45">
            <Link href="/" className="transition hover:text-white">
              Home
            </Link>
            <span aria-hidden>/</span>
            <span style={{ color: config.accentColor }}>{config.breadcrumbLabel}</span>
          </nav>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-start">
            <div>
              <p
                className="text-xs font-bold uppercase tracking-[0.18em]"
                style={{ color: config.accentColor }}
              >
                {config.eyebrow}
              </p>
              <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.65rem]">
                {categoryName}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
                {categoryBlurb ?? config.glanceDescription}
              </p>

              <ul className="mt-6 max-w-2xl space-y-3 text-sm leading-6 text-white/78 sm:text-base">
                {config.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3">
                    <span className="mt-0.5 shrink-0" style={{ color: config.accentColor }} aria-hidden>
                      ✓
                    </span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap gap-2">
                <Link
                  href={config.primaryCta.href}
                  className="inline-flex min-h-11 items-center justify-center bg-[#4778e6] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-[#3a67d4]"
                >
                  {config.primaryCta.label}
                </Link>
                <Link
                  href={config.secondaryCta.href}
                  className="inline-flex min-h-11 items-center justify-center border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white/85 transition hover:border-white/40 hover:text-white"
                >
                  {config.secondaryCta.label}
                </Link>
              </div>

              {(() => {
                const quickLinks = config.quickLinks ?? config.marketplaceLinks;
                if (!quickLinks?.length) return null;
                const quickLinksLabel = config.quickLinksLabel ?? 'Shop by marketplace';
                return (
                <div className="mt-8 border-t border-white/10 pt-6">
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-white/45">
                    {quickLinksLabel}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {quickLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="inline-flex min-h-9 items-center border border-white/15 bg-white/8 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-white/85 transition hover:border-white/35 hover:bg-white/12 hover:text-white"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
                );
              })()}
            </div>

            <aside className="border border-white/12 bg-white/5 p-5 backdrop-blur-sm">
              <p
                className="text-[0.68rem] font-bold uppercase tracking-[0.18em]"
                style={{ color: config.accentColor }}
              >
                At a glance
              </p>
              <p className="mt-3 text-sm leading-6 text-white/72">{config.glanceDescription}</p>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="border border-white/10 bg-white/5 px-3 py-3">
                  <dt className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/45">Articles</dt>
                  <dd className="mt-1 font-display text-2xl font-bold text-white">{total}</dd>
                </div>
                <div className="border border-white/10 bg-white/5 px-3 py-3">
                  <dt className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/45">Focus</dt>
                  <dd className="mt-1 font-display text-lg font-bold text-white">{config.focusLabel}</dd>
                </div>
              </dl>
              <div className="mt-5 flex flex-wrap gap-2">
                {config.topicChips.map((topic) => (
                  <span
                    key={topic}
                    className="inline-flex border border-white/12 bg-white/5 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-white/70"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="bg-[#f0f2f4] pb-12 pt-8 sm:pb-16 sm:pt-10">
        <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(220px,24%)_minmax(0,76%)] lg:items-start">
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
              {filters.q || activeFilterCount > 0 || page > 1 ? (
                <div className="border border-ink/10 bg-white p-5 sm:p-6">
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
              ) : null}

              {posts.length === 0 ? (
                <div className="mt-8 border border-dashed border-ink/15 bg-white px-6 py-16 text-center text-ink/55">
                  {filters.q ? config.emptySearchMessage : config.emptyDefaultMessage}
                </div>
              ) : (
                <>
                  {featured ? (
                    <EditorialFeatureArticle post={featured} featuredLabel={config.featuredLabel} />
                  ) : null}

                  {spotlight.length > 0 ? (
                    <section className="mt-8" data-testid="editorial-category-spotlight">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-primary">
                            {config.spotlightEyebrow}
                          </p>
                          <h2 className="mt-2 font-display text-xl font-bold text-ink sm:text-2xl">
                            {config.spotlightTitle}
                          </h2>
                        </div>
                      </div>
                      <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                        {spotlight.map((post) => (
                          <EditorialSpotlightCard key={post.id} post={post} cardLabel={config.cardLabel} />
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {gridPosts.length > 0 ? (
                    <section
                      className={featured || spotlight.length > 0 ? 'mt-10' : ''}
                      data-testid="editorial-category-grid"
                    >
                      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink/10 pb-4">
                        <div>
                          <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-primary">
                            {showEditorialLead ? 'More to read' : 'All articles'}
                          </p>
                          <h2 className="mt-2 font-display text-xl font-bold text-ink sm:text-2xl">
                            {showEditorialLead ? config.gridArchiveTitle : `${total} article${total === 1 ? '' : 's'}`}
                          </h2>
                        </div>
                        {!showEditorialLead ? (
                          <p className="text-sm text-ink/55">
                            Page {page} of {pageCount}
                          </p>
                        ) : null}
                      </div>
                      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
                  className="mt-12 flex flex-wrap items-center justify-center gap-3 text-sm"
                  data-testid="pagination"
                  aria-label="Article pagination"
                >
                  {page > 1 ? (
                    <Link
                      href={`${action}${articlePageQuery(filters, page - 1)}`}
                      className="inline-flex min-h-11 items-center justify-center border border-ink/15 px-6 py-3 text-sm font-bold uppercase tracking-[0.12em] text-ink/70 transition hover:border-primary hover:text-primary"
                    >
                      Previous
                    </Link>
                  ) : null}
                  <span className="text-ink/55">
                    Page {page} of {pageCount}
                  </span>
                  {page < pageCount ? (
                    <Link
                      href={`${action}${articlePageQuery(filters, page + 1)}`}
                      className="inline-flex min-h-11 items-center justify-center bg-ink px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:bg-primary"
                    >
                      Next
                    </Link>
                  ) : null}
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
    <article className="group overflow-hidden border border-ink/10 bg-white" data-testid={`editorial-feature-${post.slug}`}>
      <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-stretch">
        <Link href={href} className="editorial-feature-image-box block bg-white">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt={post.coverImage?.alternativeText || post.title}
              className="editorial-feature-image aspect-[16/10] w-full object-contain mix-blend-multiply transition duration-500 group-hover:scale-[1.02] lg:aspect-auto lg:h-full lg:min-h-[320px]"
            />
          ) : (
            <div className="grid aspect-[16/10] w-full place-items-center bg-[#f3f6fa] font-display text-3xl font-bold text-ink/15 lg:min-h-[320px]">
              NXT
            </div>
          )}
        </Link>

        <div className="flex flex-col justify-center p-6 sm:p-8">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-primary">{featuredLabel}</p>
          <Link href={href}>
            <h2 className="editorial-feature-title mt-3 font-display text-2xl font-bold leading-tight text-ink transition group-hover:text-primary sm:text-3xl">
              {post.title}
            </h2>
          </Link>
          {post.excerpt ? (
            <p className="mt-4 line-clamp-4 text-sm leading-7 text-ink/70 sm:text-base">{post.excerpt}</p>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-ink/55">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent font-display text-sm font-bold text-ink">
              N
            </span>
            <span>{SITE.name} Editorial</span>
            <span className="text-ink/30">|</span>
            <span>{fmtDate(post.publishedAt)}</span>
            <span className="text-ink/30">|</span>
            <span>{readMinutes(post)} min read</span>
          </div>
          <Link
            href={href}
            className="mt-6 inline-flex w-fit min-h-10 items-center justify-center bg-ink px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary"
          >
            Read article
          </Link>
        </div>
      </div>
    </article>
  );
}

function EditorialSpotlightCard({ post, cardLabel }: { post: NxtPost; cardLabel: string }) {
  const img = postImage(post);
  const href = postPath(post);

  return (
    <article
      className="group flex h-full flex-col border border-ink/10 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_18px_32px_-24px_rgba(3,3,3,0.35)]"
      data-testid={`editorial-spotlight-${post.slug}`}
    >
      <Link href={href} className="editorial-spotlight-image-box block bg-white">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={post.coverImage?.alternativeText || post.title}
            loading="lazy"
              className="editorial-spotlight-image aspect-[16/10] w-full object-contain mix-blend-multiply transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid aspect-[16/10] w-full place-items-center bg-[#f3f6fa] font-display text-xl font-bold text-ink/15">
            NXT
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-primary">{cardLabel}</p>
        <Link href={href}>
          <h3 className="editorial-spotlight-title mt-2 line-clamp-3 font-display font-bold leading-snug text-ink transition group-hover:text-primary">
            {post.title}
          </h3>
        </Link>
        {post.excerpt ? (
          <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-ink/65">{post.excerpt}</p>
        ) : null}
        <p className="mt-4 text-xs text-ink/45">
          {fmtDate(post.publishedAt)} · {readMinutes(post)} min
        </p>
      </div>
    </article>
  );
}

function EditorialGridCard({ post, cardLabel }: { post: NxtPost; cardLabel: string }) {
  const img = postImage(post);
  const href = postPath(post);

  return (
    <article className="group flex h-full flex-col" data-testid={`editorial-grid-${post.slug}`}>
      <Link href={href} className="editorial-grid-image-box block overflow-hidden rounded-2xl bg-white">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={post.coverImage?.alternativeText || post.title}
            loading="lazy"
              className="editorial-grid-image aspect-[4/3] w-full object-contain mix-blend-multiply transition duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="grid aspect-[4/3] w-full place-items-center bg-[#f3f6fa] font-display text-lg font-bold text-ink/15">
            NXT
          </div>
        )}
      </Link>
      <div className="mt-4 flex flex-1 flex-col">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-primary">{cardLabel}</p>
        <Link href={href}>
          <h3 className="editorial-grid-title mt-2 line-clamp-2 font-display font-bold leading-snug text-ink transition group-hover:text-primary">
            {post.title}
          </h3>
        </Link>
        {post.excerpt ? (
          <p className="mt-2 line-clamp-2 flex-1 text-sm leading-6 text-ink/65">{post.excerpt}</p>
        ) : null}
        <p className="mt-3 text-xs text-ink/45">
          {fmtDate(post.publishedAt)} · {readMinutes(post)} min
        </p>
      </div>
    </article>
  );
}
