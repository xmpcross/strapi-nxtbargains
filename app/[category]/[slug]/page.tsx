import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getPost, listPostComments, listPosts, mediaUrl, type NxtPost } from '@/lib/strapi';
import { SECTIONS, SITE } from '@/lib/site';
import { articleJsonLd, breadcrumbJsonLd, faqJsonLd, howToJsonLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';
import { enrichPostCarouselHtml } from '@/lib/enrich-post-carousel';
import { clampDescription, firstImageUrl, fmtDate, parseHowToSteps, primaryCategorySlug, postPath, stripHtml, warnSeoLength } from '@/lib/format';
import PostContent from '@/components/PostContent';
import { KeyTakeaways } from '@/components/KeyTakeaways';
import PostPriceComparison from '@/components/PostPriceComparison';
import CommentForm from '@/components/CommentForm';
import ProductCarousel from '@/components/ProductCarousel';
import PostMetabar from '@/components/PostMetabar';
import { applyHtmlHeadingIds, extractHeadings, isMarkdownContent, splitHtmlAtSection } from '@/lib/post-headings';
import ReadAlso from '@/components/ReadAlso';
import RelatedPosts from '@/components/RelatedPosts';
import QuestionsAnswered from '@/components/QuestionsAnswered';
import PostFooterNav from '@/components/PostFooterNav';
import ReadNext from '@/components/ReadNext';
import PostInfobar from '@/components/PostInfobar';

export const revalidate = 60;
export const dynamicParams = true;

type Params = { category: string; slug: string };
type SidebarProduct = {
  rank?: number | string | null;
  title: string;
  price?: string | null;
  image?: string | null;
  url: string;
};
type RawSidebarProduct = Partial<SidebarProduct>;
type MerchantConfig = {
  key: string;
  label: string;
  file: string;
};

const BEST_SELLERS_DIR = '/var/www/html/nxt.bargains/data';
const MERCHANTS: MerchantConfig[] = [
  { key: 'amazon', label: 'Amazon', file: 'best-sellers.json' },
  { key: 'ebay', label: 'eBay', file: 'best-sellers-ebay.json' },
  { key: 'walmart', label: 'Walmart', file: 'best-sellers-walmart.json' },
  { key: 'target', label: 'Target', file: 'best-sellers-target.json' },
  { key: 'newegg', label: 'Newegg', file: 'best-sellers-newegg.json' },
  { key: 'bestbuy', label: 'Best Buy', file: 'best-sellers-bestbuy.json' },
];

function categoryName(slug?: string): string {
  if (!slug) return '';
  return SECTIONS.find((s) => s.slug === slug)?.title ?? slug.replace(/-/g, ' ');
}

function spotlightDate(iso?: string): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

/**
 * Categories that do NOT use the editorial post layout.
 *
 * An exclusion list rather than an allow-list: the editorial layout is now the
 * default for the site, and best-sellers-articles is the one exception. Those
 * posts promote their first body heading to the visible <h1> and are built
 * around a product carousel, so the two-column header and contents rail fight
 * with what is already there.
 *
 * The CSS keys off data-layout="recap" on the article rather than off any
 * individual category, so this stays the only place the decision lives.
 */
const RECAP_LAYOUT_EXCLUDED = new Set(['best-sellers-articles']);

/**
 * Categories that drop the left contents rail and run two columns instead.
 * Independent of the editorial layout — Best Sellers is not on that layout but
 * still gets a rail.
 */
const METABAR_EXCLUDED = new Set(['nxt-bargains-informative-articles']);

function recentPostDate(iso?: string): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

function detectMerchant(post: NxtPost): MerchantConfig | null {
  const merchantMatch = post.content.match(/<strong>Merchant:<\/strong>\s*([^<]+)/i);
  const haystack = `${post.title}\n${post.sourceUrl ?? ''}\n${merchantMatch?.[1] ?? ''}\n${post.content}`.toLowerCase();

  return MERCHANTS.find((merchant) => {
    if (merchant.key === 'bestbuy') return haystack.includes('best buy') || haystack.includes('bestbuy');
    return haystack.includes(merchant.key);
  }) ?? null;
}

async function listMerchantTopProducts(post: NxtPost): Promise<{ merchant: MerchantConfig; products: SidebarProduct[] } | null> {
  const merchant = detectMerchant(post);
  if (!merchant) return null;

  try {
    const raw = await fs.readFile(path.join(BEST_SELLERS_DIR, merchant.file), 'utf8');
    const parsed = JSON.parse(raw);
    const items: RawSidebarProduct[] = Array.isArray(parsed?.items) ? parsed.items : [];
    const products = items
      .filter((item): item is SidebarProduct => Boolean(item?.title && item?.url && item?.image))
      .filter((item) => item.url !== post.sourceUrl)
      .slice(0, 5);

    return products.length ? { merchant, products } : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug, category } = await params;
  const post = await getPost(slug).catch(() => null);
  if (!post) return { title: 'Not found' };

  const cover = mediaUrl(post.coverImage ?? null) || mediaUrl(post.ogImage ?? null);
  warnSeoLength(post.slug, {
    description: post.seoDescription || post.excerpt,
    title: post.seoTitle || post.title,
  });
  const description = clampDescription(post.seoDescription || post.excerpt || SITE.description);

  return {
    title: post.seoTitle || post.title,
    description,
    keywords: post.seoKeywords,
    alternates: { canonical: `/${category}/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.seoTitle || post.title,
      description,
      url: `${SITE.url}/${category}/${post.slug}`,
      images: cover ? [{ url: cover }] : undefined,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
    },
    twitter: {
      card: cover ? 'summary_large_image' : 'summary',
      title: post.seoTitle || post.title,
      description,
      images: cover ? [cover] : undefined,
    },
  };
}

export default async function PostPage({ params }: { params: Promise<Params> }) {
  const { slug, category } = await params;
  const post = await getPost(slug).catch(() => null);
  if (!post) notFound();

  // If the URL category doesn't match the post's primary category, send them to the canonical URL.
  const canonicalCat = primaryCategorySlug(post);
  if (canonicalCat !== category) {
    const { redirect } = await import('next/navigation');
    redirect(postPath(post));
  }

  // One wide fetch feeds every rail on the page — spotlight, read-also,
  // related and prev/next — rather than a query each.
  const allPosts = await listPosts({ pageSize: 100 })
    .then((r) => r.data)
    .catch(() => [] as NxtPost[]);
  const recentPool = allPosts.filter((p) => p.id !== post.id);

  // Neighbours in publish order. The list is sorted newest first, so the entry
  // after this one is the older post.
  const selfIndex = allPosts.findIndex((p) => p.id === post.id);
  const prevPost = selfIndex >= 0 ? allPosts[selfIndex + 1] ?? null : null;
  const nextPost = selfIndex > 0 ? allPosts[selfIndex - 1] ?? null : null;

  // Same category first, so the suggestions are actually related.
  const sameCategory = recentPool.filter((p) =>
    (p.categories ?? []).some((c) => (post.categories ?? []).some((pc) => pc.slug === c.slug)),
  );
  const suggestionPool = [...sameCategory, ...recentPool.filter((p) => !sameCategory.includes(p))];
  const readAlsoPosts = suggestionPool.slice(0, 2);
  const relatedPostsList = suggestionPool.slice(2, 4);
  const nextUpPosts = suggestionPool.slice(0, 4);
  const readNextPosts = suggestionPool.slice(0, 4);

  // One post per category, newest first. Without this the list is whichever
  // category published most recently -- five rows all reading "Best Sellers",
  // which defeats the point of a spotlight. Falls back to filling from the
  // pool if there are not enough distinct categories.
  const spotlightPosts = (() => {
    const seen = new Set<string>();
    const picked: NxtPost[] = [];
    for (const p of recentPool) {
      const key = p.categories?.[0]?.slug ?? '';
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(p);
      if (picked.length === 5) break;
    }
    for (const p of recentPool) {
      if (picked.length >= 5) break;
      if (!picked.includes(p)) picked.push(p);
    }
    return picked;
  })();

  const [merchantProducts, comments, readAlsoCounts] = await Promise.all([
    listMerchantTopProducts(post),
    listPostComments(post.documentId ?? ''),
    // Counts for the inline Read Also rows. Failures degrade to 0 rather than
    // taking the page down for a decorative number.
    Promise.all(
      readAlsoPosts.map((p) =>
        listPostComments(p.documentId ?? '')
          .then((c) => c.length)
          .catch(() => 0),
      ),
    ),
  ]);

  const cover = mediaUrl(post.coverImage ?? null) || mediaUrl(post.ogImage ?? null);
  const cat = post.categories?.[0];

  const pageUrl = `${SITE.url}/${category}/${post.slug}`;

  // HowTo detection + steps. Authored Strapi `steps` are preferred; otherwise
  // fall back to confidently parsing step-like headings from the body. Emit HowTo
  // (instead of Article) only for how-to guides that have >=2 usable steps.
  const isHowTo =
    category === 'how-to-guides' || cat?.slug === 'how-to-guides' || post.postType === 'how-to-guide';
  const authoredSteps = (post.steps ?? [])
    .map((s) => ({ name: (s.name ?? '').trim(), text: (s.text ?? '').trim(), image: mediaUrl(s.image ?? null) }))
    .filter((s) => s.name && s.text);
  const stepsAreAuthored = authoredSteps.length >= 2;
  const howToSteps: { name: string; text: string; image?: string | null }[] = stepsAreAuthored
    ? authoredSteps
    : isHowTo
      ? parseHowToSteps(post.content)
      : [];
  const useHowTo = isHowTo && howToSteps.length >= 2;

  const articleLd = useHowTo
    ? null
    : articleJsonLd({
        type: post.postType === 'product-review' ? 'Review' : 'Article',
        headline: post.title,
        description: post.seoDescription || post.excerpt,
        image: cover,
        datePublished: post.publishedAt,
        dateModified: post.updatedAt,
        url: pageUrl,
        author: post.author
          ? { name: post.author.name, sameAs: post.author.sameAs ?? null }
          : { name: SITE.name },
      });

  const howToLd = useHowTo
    ? howToJsonLd({
        name: post.seoTitle || post.title,
        description: clampDescription(stripHtml(post.seoDescription || post.excerpt || post.title)),
        image: cover,
        steps: howToSteps.map((s, i) => ({
          name: s.name,
          text: s.text,
          image: s.image,
          url: stepsAreAuthored ? `${pageUrl}#step-${i + 1}` : pageUrl,
        })),
      })
    : null;

  const breadcrumbLd = breadcrumbJsonLd([
    { name: 'Home', url: `${SITE.url}/` },
    { name: categoryName(category), url: `${SITE.url}/${category}` },
    { name: post.title, url: `${SITE.url}/${category}/${post.slug}` },
  ]);

  // FAQs — drop any empty/placeholder Q&A. Visible block renders when there is
  // at least one; FAQPage schema is only emitted with two or more.
  const faqs = (post.faqs ?? [])
    .map((f) => ({ question: (f.question ?? '').trim(), answer: (f.answer ?? '').trim() }))
    .filter((f) => f.question && f.answer);
  const faqLd = faqs.length >= 2 ? faqJsonLd(faqs) : null;

  const isBestSellersArticle = category === 'best-sellers-articles' || cat?.slug === 'best-sellers-articles';
  // The editorial ("recap") post layout: two-column header, left contents rail,
  // Spotlight sidebar, Read Also / Related / Read Next. Applied to every
  // category except those listed in RECAP_LAYOUT_EXCLUDED.
  const isRecapLayout =
    !RECAP_LAYOUT_EXCLUDED.has(category) && !RECAP_LAYOUT_EXCLUDED.has(cat?.slug ?? '');
  const showMetabar =
    !METABAR_EXCLUDED.has(category) && !METABAR_EXCLUDED.has(cat?.slug ?? '');
  let postContent = await enrichPostCarouselHtml(post.content);
  // best-sellers-articles: promote the first body heading (the product title) to
  // a semantic <h1> while keeping the h4 size (.post-title-h1), and drop the
  // redundant screen-reader h1 below so there's a single visible h1.
  if (isBestSellersArticle) {
    postContent = postContent.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/i, '<h1 class="post-title-h1">$2</h1>');
  }

  // Featured image at the top of the post. Much of this catalogue was imported
  // from WordPress and a good number of those bodies open with the same image
  // as the cover, so render it only when the body does not already lead with
  // it — otherwise the reader gets the identical picture twice.
  // Contents list for the metabar. Built from the post source with the same
  // slug helper PostContent uses to emit the ids, so the two cannot drift apart.
  //
  // Extract first, filter second — never filter inside extractHeadings. The
  // helper de-duplicates slugs as it walks the headings in order, so dropping
  // the H3s beforehand would change the numbering of any repeated H2 and leave
  // the rail pointing at ids the body never rendered.
  //
  // Top-level sections only: the H3s stay in the body with their anchors
  // intact, they are just not listed here.
  // Best Sellers posts open with a product card the generator injects into the
  // body. It is lifted out here so it can span the full container instead of
  // being boxed into the narrower article column beside the sidebar.
  let bestSellerCard: string | null = null;
  if (isBestSellersArticle) {
    const match = postContent.match(/<aside\b[^>]*class="[^"]*nxt-product-card[^"]*"[\s\S]*?<\/aside>/i);
    if (match) {
      bestSellerCard = match[0];
      postContent = postContent.replace(match[0], '');
    }
  }

  // Header image for the editorial layout. Most posts outside smart-home and
  // buying-guides carry no coverImage or ogImage at all, which left the header's
  // right column empty; the first image in the body — a product shot on these
  // posts — stands in. It sits well down the article rather than at the top, so
  // promoting it does not put the same picture twice in a row, and it is left in
  // place because it belongs to a product card that would break without it.
  const headerImage = cover || (isRecapLayout ? firstImageUrl(postContent) : null);

  let toc: { id: string; text: string; level: 2 | 3 }[] = [];
  if (showMetabar) {
    if (isMarkdownContent(postContent)) {
      // PostContent emits the ids for Markdown, through the same slug helper.
      toc = extractHeadings(postContent);
    } else {
      // HTML bodies get their ids assigned here, and the rail is built from
      // exactly what was written into the markup.
      const anchored = applyHtmlHeadingIds(postContent);
      postContent = anchored.html;
      toc = anchored.headings;
    }
    toc = toc.filter((h) => h.level === 2);
  }

  const leadImage = firstImageUrl(postContent);
  const sameFile = (a: string, b: string) =>
    decodeURIComponent(a.split('?')[0].split('/').pop() ?? a) ===
    decodeURIComponent(b.split('?')[0].split('/').pop() ?? b);
  // best-sellers-articles are excluded: those posts promote their first body
  // heading to the visible <h1>, so a cover above it would sit apart from the
  // title rather than beneath it.
  const showFeatured =
    !isBestSellersArticle
    && Boolean(cover)
    && !(leadImage && sameFile(cover as string, leadImage));

  const readAlso =
    readAlsoPosts.length > 0 ? (
      <ReadAlso items={readAlsoPosts.map((rp, i) => ({ post: rp, commentCount: readAlsoCounts[i] ?? 0 }))} />
    ) : null;
  const htmlSplit = readAlso && !isMarkdownContent(postContent) ? splitHtmlAtSection(postContent) : null;

  return (
    <article
      className="bg-white"
      data-testid={`post-${post.slug}`}
      data-category={category}
      data-layout={isRecapLayout ? 'recap' : undefined}
      data-post-type={post.postType}
    >
      {/* Vendor stylesheets used by the imported product-comparison blocks
          (Content Egg + scoped Bootstrap). Only loaded on post pages. */}
      <link rel="stylesheet" href="/vendor/cegg-bootstrap.min.css" />
      <link rel="stylesheet" href="/vendor/cegg-products.min.css" />
      <JsonLd graph={[articleLd, howToLd, breadcrumbLd, faqLd]} />

      <section className="article-breadcrumb-section bg-[#f8f8f8] py-4">
        <div className="mx-auto max-w-7xl px-6">
          <nav
            className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-ink/45"
            data-testid="breadcrumb"
            aria-label="Breadcrumb"
          >
            <Link href="/" className="shrink-0 hover:text-primary">Home</Link>
            <span className="shrink-0">/</span>
            <Link href={`/${category}`} className="shrink-0 hover:text-primary">
              {cat?.name ?? categoryName(category)}
            </Link>
            <span className="shrink-0">/</span>
            <span className="line-clamp-1 text-ink/70">{post.title}</span>
          </nav>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6">
        {!isBestSellersArticle && !isRecapLayout && <h1 className="sr-only">{post.title}</h1>}

        {showFeatured && !isRecapLayout ? (
          <figure className="post-featured-image" data-testid="post-featured-image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover as string}
              alt={post.coverImage?.alternativeText || post.title}
              width={1200}
              height={675}
              fetchPriority="high"
            />
          </figure>
        ) : null}

        {isRecapLayout ? (
          <header className="recap-header" data-testid="post-recap-header">
            <div className="recap-header-content">
              <p className="recap-eyebrow">
                <Link href={`/${category}`}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="3" y="4" width="7" height="16" rx="1.5" stroke="currentColor" strokeWidth="2" />
                    <rect x="14" y="4" width="7" height="16" rx="1.5" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  {cat?.name ?? categoryName(category)}
                </Link>
              </p>

              <h1 className="recap-title">{post.title}</h1>

              {post.excerpt ? <p className="recap-subtitle">{post.excerpt}</p> : null}
            </div>

            {headerImage ? (
              <figure className={cover ? 'recap-media' : 'recap-media recap-media-product'}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={headerImage}
                  alt={post.coverImage?.alternativeText || post.title}
                  width={1200}
                  height={750}
                  fetchPriority="high"
                />
              </figure>
            ) : null}

            <PostInfobar
              authorName={post.author?.name ?? SITE.name}
              publishedAt={post.publishedAt}
              commentCount={comments.length}
              shareUrl={`${SITE.url}/${category}/${post.slug}`}
              shareTitle={post.title}
            />
          </header>
        ) : null}

        {bestSellerCard ? (
          <div className="bestseller-header" data-testid="bestseller-card-full">
            <div className="post-content bestseller-card-full" dangerouslySetInnerHTML={{ __html: bestSellerCard }} />
            <PostInfobar
              authorName={post.author?.name ?? SITE.name}
              publishedAt={post.publishedAt}
              commentCount={comments.length}
              shareUrl={`${SITE.url}/${category}/${post.slug}`}
              shareTitle={post.title}
            />
          </div>
        ) : null}

        <div
          className={
            showMetabar
              ? 'mt-12 grid gap-10 lg:grid-cols-[228px_minmax(0,1fr)_340px] lg:items-start'
              : 'mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start'
          }
        >
          {showMetabar ? (
            <div className="metabar-col" data-testid="post-metabar">
              <PostMetabar
                readingTimeMinutes={post.readingTimeMinutes}
                toc={toc}
                targetId="post-article-body"
              />
            </div>
          ) : null}

          <div className="w-full" id="post-article-body" data-testid="post-body">
            <KeyTakeaways content={post.keyTakeaways} />
            {readAlso && htmlSplit ? (
              // HTML body: rendered as two blocks with the card between them.
              // PostContent can only splice a node into its Markdown path, and
              // most of this catalogue is HTML — this is why Read Also had
              // never appeared outside the Markdown posts.
              <>
                <PostContent html={htmlSplit[0]} />
                {readAlso}
                <PostContent html={htmlSplit[1]} />
              </>
            ) : (
              <PostContent html={postContent} midBlock={readAlso ?? undefined} />
            )}
            {/* No safe split point in this body — the card goes after it
                rather than being wedged into broken markup. */}
            {readAlso && !htmlSplit && !isMarkdownContent(postContent) ? readAlso : null}

            {stepsAreAuthored && useHowTo ? (
              <section className="mt-10" data-testid="howto-steps" aria-labelledby="howto-heading">
                <h2 id="howto-heading" className="font-display text-2xl font-bold tracking-tight text-ink">
                  Step-by-step
                </h2>
                <ol className="mt-6 space-y-6">
                  {howToSteps.map((s, i) => (
                    <li key={i} id={`step-${i + 1}`} className="flex scroll-mt-24 gap-4" data-testid="howto-step">
                      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-white">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-display text-lg font-semibold text-ink">{s.name}</h3>
                        <p className="mt-1 text-[0.95rem] leading-7 text-ink/70">{s.text}</p>
                        {s.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.image} alt={s.name} referrerPolicy="no-referrer" className="mt-3 max-w-full rounded-lg border border-ink/10" />
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            <PostPriceComparison post={post} />

            <div
              className={`mt-14 flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink/10 pt-8 text-xs font-semibold uppercase tracking-[0.12em] text-ink/45 ${
                isRecapLayout ? 'hidden' : 'flex'
              }`}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink/10 text-ink/40">
                {(post.author?.name ?? SITE.name).charAt(0)}
              </span>
              <span>By {post.author?.name ?? SITE.name}</span>
              <span>{fmtDate(post.publishedAt)}</span>
              {post.readingTimeMinutes && <span>{post.readingTimeMinutes} min read</span>}
            </div>

            <div className="mt-8 border-y border-ink/10 py-8 text-sm leading-7 text-ink/60">
              <strong className="text-ink">Affiliate disclosure.</strong> {SITE.name} earns a
              commission when you buy through links on this page, at no extra cost to you.
              Prices and availability are accurate as of {fmtDate(post.updatedAt)} and subject to change.
            </div>
            <>
                <RelatedPosts posts={relatedPostsList} />
                <QuestionsAnswered items={faqs} />
                <PostFooterNav
                  nextUp={nextUpPosts}
                  category={category}
                  categoryName={cat?.name ?? categoryName(category)}
                  commentCount={comments.length}
                  updatedAt={post.updatedAt}
                  shareUrl={`${SITE.url}/${category}/${post.slug}`}
                  shareTitle={post.title}
                  prev={prevPost}
                  next={nextPost}
                />
            </>


            <section className="mt-10" id="post-comments" data-testid="post-comments">
              <h3 className="comments-eyebrow">Comments</h3>
              {comments.length > 0 ? (
                <div className="mt-5 space-y-4">
                  {comments.map((comment) => (
                    <article key={comment.documentId ?? comment.id} className="border border-ink/10 bg-white p-5">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h4 className="font-display text-base font-bold text-ink">{comment.authorName}</h4>
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/40">
                          {fmtDate(comment.createdAt)}
                        </span>
                      </div>
                      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-ink/65">{comment.body}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="comments-empty">No comments yet. Start the conversation.</p>
              )}
              <CommentForm postDocumentId={post.documentId ?? ''} collapsible />
            </section>
          </div>

          <aside className="post-side-rail-recap space-y-10" data-testid="post-side-rail">

            {spotlightPosts.length > 0 ? (
              <div data-testid="sidebar-spotlight">
                <h5 className="spotlight-heading">Spotlight</h5>
                <ul className="spotlight-list">
                  {spotlightPosts.map((recent) => {
                    const img = mediaUrl(recent.coverImage ?? null) ?? firstImageUrl(recent.content);
                    const rc = recent.categories?.[0];
                    return (
                      <li key={recent.id} className="spotlight-item">
                        <div className="spotlight-text">
                          {rc ? (
                            <Link href={`/${rc.slug}`} className="spotlight-cat">{rc.name}</Link>
                          ) : null}
                          <Link href={postPath(recent)} className="spotlight-title">{recent.title}</Link>
                          <span className="spotlight-date">{spotlightDate(recent.publishedAt)}</span>
                        </div>
                        <Link href={postPath(recent)} className="spotlight-thumb" tabIndex={-1} aria-hidden>
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={img} alt="" loading="lazy" />
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <aside className="trailcard" data-testid="sidebar-trailcard">
                <p className="trailcard-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M21 3L3 10.5l7 2.5 2.5 7L21 3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                  Deals Live Here
                </p>

                <div className="trailcard-body">
                  <h2 className="trailcard-title">Follow the Price Trail</h2>
                  <p className="trailcard-text">
                    Explore every category and find the ones that matter to you.
                  </p>
                  <Link href="/category" className="trailcard-cta">Explore Categories</Link>
                </div>
            </aside>

            {merchantProducts && (
              <div className="rounded p-5 shadow-[rgba(17,17,26,0.1)_0px_1px_0px]" data-testid="sidebar-merchant-products">
                <h5 className="text-sm font-bold uppercase tracking-wide text-[#111111]">
                  Top {merchantProducts.merchant.label} Products
                </h5>
                <div className="mt-4 space-y-4">
                  {merchantProducts.products.map((product) => (
                    <a
                      key={`${merchantProducts.merchant.key}-${product.rank ?? product.url}`}
                      href={product.url}
                      target="_blank"
                      rel="nofollow sponsored noopener"
                      className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 transition hover:opacity-80"
                    >
                      <span className="block h-16 w-16 overflow-hidden rounded bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.image ?? ''}
                          alt={product.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-2 text-sm font-normal leading-snug text-[#123d83]">
                          {product.title}
                        </span>
                        <span className="mt-1 block text-sm font-normal leading-none text-[#6a83aa]">
                          {product.price || 'Check current price'}
                          {product.rank ? ` · #${product.rank}` : ''}
                        </span>
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

      </div>

      {readNextPosts.length > 0 ? <ReadNext posts={readNextPosts} /> : null}
    </article>
  );
}
