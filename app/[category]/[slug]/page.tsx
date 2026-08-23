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
import { extractHeadings } from '@/lib/post-headings';
import ReadAlso from '@/components/ReadAlso';
import RelatedPosts from '@/components/RelatedPosts';
import QuestionsAnswered from '@/components/QuestionsAnswered';
import PostFooterNav from '@/components/PostFooterNav';
import ReadNext from '@/components/ReadNext';
import CopyLinkButton from '@/components/CopyLinkButton';

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
 * Categories rendered with the editorial post layout.
 *
 * A set rather than a per-category flag so adding one is a single edit here;
 * the CSS keys off data-layout="recap" on the article, not off the individual
 * category, for the same reason.
 */
const RECAP_LAYOUT_CATEGORIES = new Set(['smart-home', 'buying-guides', 'how-to-guides']);

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
  const recentPosts = recentPool.slice(0, 5);

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
  // Categories that use the editorial ("recap") post layout: two-column header,
  // left contents rail, Spotlight sidebar, Read Also / Related / Read Next.
  // Everything else keeps the original single-column template.
  const isRecapLayout =
    RECAP_LAYOUT_CATEGORIES.has(category) || RECAP_LAYOUT_CATEGORIES.has(cat?.slug ?? '');
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
  const toc = isRecapLayout ? extractHeadings(postContent).filter((h) => h.level === 2) : [];

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

            {cover ? (
              <figure className="recap-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cover}
                  alt={post.coverImage?.alternativeText || post.title}
                  width={1200}
                  height={750}
                  fetchPriority="high"
                />
              </figure>
            ) : null}

            <div className="recap-infobar">
              <div className="recap-header-meta">
                <span className="recap-author">
                  <span className="recap-avatar" aria-hidden>
                    {(post.author?.name ?? SITE.name).charAt(0)}
                  </span>
                  <span className="recap-author-name">{post.author?.name ?? SITE.name}</span>
                </span>
                <span className="recap-meta-line">
                  <a className="recap-comments" href="#post-comments">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M21 12a8 8 0 0 1-8 8H7l-4 3v-5.5A8 8 0 1 1 21 12z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {comments.length}
                  </a>
                  <time dateTime={post.publishedAt}>{spotlightDate(post.publishedAt)}</time>
                </span>
              </div>

              <div className="recap-share">
                <span className="recap-share-label">Share</span>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${SITE.url}/${category}/${post.slug}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on Facebook"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z" />
                  </svg>
                </a>
                <a
                  href={`https://x.com/intent/tweet?url=${encodeURIComponent(`${SITE.url}/${category}/${post.slug}`)}&text=${encodeURIComponent(post.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on X"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M17.53 3H20.5l-6.49 7.42L21.64 21h-5.97l-4.68-6.11L5.6 21H2.63l6.94-7.93L2.36 3h6.12l4.23 5.59L17.53 3zm-1.04 16.2h1.65L7.6 4.71H5.83L16.49 19.2z" />
                  </svg>
                </a>
                <CopyLinkButton url={`${SITE.url}/${category}/${post.slug}`} />
              </div>
            </div>
          </header>
        ) : null}

        <div
          className={
            isRecapLayout
              ? 'mt-12 grid gap-10 lg:grid-cols-[228px_minmax(0,1fr)_340px] lg:items-start'
              : 'mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start'
          }
        >
          {isRecapLayout ? (
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
            <PostContent
              html={postContent}
              semanticHeadings={isRecapLayout}
              midBlock={
                isRecapLayout && readAlsoPosts.length > 0 ? (
                  <ReadAlso
                    items={readAlsoPosts.map((rp, i) => ({ post: rp, commentCount: readAlsoCounts[i] ?? 0 }))}
                  />
                ) : undefined
              }
            />

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

            {isRecapLayout ? null : (
            <div className="mt-10 bg-muted p-8" data-testid="post-author-box">
              <div className="grid gap-6 sm:grid-cols-[72px_minmax(0,1fr)]">
                <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white text-2xl font-bold text-ink/30">
                  {(post.author?.name ?? SITE.name).charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink/45">Written by</p>
                  <h2 className="mt-2 font-display text-xl font-bold text-ink">{post.author?.name ?? SITE.name}</h2>
                  {post.author?.role ? (
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">{post.author.role}</p>
                  ) : null}
                  <p className="mt-3 text-sm leading-7 text-ink/60">
                    {post.author?.bio
                      ?? 'Product comparisons, reviews and practical buying guides for smart tech shoppers.'}
                  </p>
                </div>
              </div>
            </div>
            )}

            {isRecapLayout ? (
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
            ) : null}

            {!isRecapLayout && faqs.length > 0 ? (
              <section className="mt-10" data-testid="faq-section" aria-labelledby="faq-heading">
                <h2 id="faq-heading" className="font-display text-2xl font-bold tracking-tight text-ink">
                  Frequently asked questions
                </h2>
                <div className="mt-5 divide-y divide-ink/10 border-y border-ink/10">
                  {faqs.map((faq, i) => (
                    <div key={i} className="py-5" data-testid="faq-item">
                      <h3 className="font-display text-lg font-semibold text-ink">{faq.question}</h3>
                      <p className="mt-2 text-[0.95rem] leading-7 text-ink/70">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="mt-10" id="post-comments" data-testid="post-comments">
              {isRecapLayout ? (
                <h3 className="comments-eyebrow">Comments</h3>
              ) : (
                <h3 className="font-display text-2xl font-bold tracking-tight text-ink">Comments</h3>
              )}
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
                <p className="mt-3 text-sm leading-6 text-ink/55">No comments yet. Start the conversation.</p>
              )}
              <CommentForm postDocumentId={post.documentId ?? ''} collapsible={isRecapLayout} />
            </section>
          </div>

          <aside
            className={
              isRecapLayout
                ? 'post-side-rail-recap space-y-10'
                : 'space-y-10 lg:sticky lg:top-28'
            }
            data-testid="post-side-rail"
          >
            {!isRecapLayout && (
            <div className="rounded p-5 shadow-[rgba(17,17,26,0.1)_0px_1px_0px]" data-testid="sidebar-share">
              <h5 className="text-sm font-bold uppercase tracking-wide text-[#111111]">Share This Article</h5>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${SITE.url}/${category}/${post.slug}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on Facebook"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 text-sm font-bold text-ink transition hover:border-primary hover:text-primary"
                >
                  f
                </a>
                <a
                  href={`https://x.com/intent/tweet?url=${encodeURIComponent(`${SITE.url}/${category}/${post.slug}`)}&text=${encodeURIComponent(post.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on X"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 text-sm font-bold text-ink transition hover:border-primary hover:text-primary"
                >
                  X
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(`${SITE.url}/${category}/${post.slug}`)}`}
                  aria-label="Share by email"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 text-sm font-bold text-ink transition hover:border-primary hover:text-primary"
                >
                  @
                </a>
              </div>
            </div>
            )}

            {isRecapLayout && spotlightPosts.length > 0 ? (
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

            {isRecapLayout ? (
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
            ) : null}

            {!isRecapLayout && recentPosts.length > 0 && (
              <div className="rounded p-5 shadow-[rgba(17,17,26,0.1)_0px_1px_0px]">
                <h5 className="text-sm font-bold uppercase tracking-wide text-[#111111]">Latest Posts</h5>
                <div className="mt-4 space-y-4">
                  {recentPosts.map((recent) => {
                    const recentImage = mediaUrl(recent.coverImage ?? null) ?? firstImageUrl(recent.content);

                    return (
                      <Link
                        key={recent.id}
                        href={postPath(recent)}
                        className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 transition hover:opacity-80"
                      >
                        <span className="block h-16 w-16 overflow-hidden rounded bg-white">
                          {recentImage && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={recentImage}
                              alt={recent.coverImage?.alternativeText || recent.title}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="line-clamp-2 text-sm font-normal leading-snug text-[#123d83]">
                            {recent.title}
                          </span>
                          <span className="mt-1 block text-sm font-normal leading-none text-[#6a83aa]">
                            {recentPostDate(recent.publishedAt)}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
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

      {isRecapLayout && readNextPosts.length > 0 ? <ReadNext posts={readNextPosts} /> : null}
    </article>
  );
}
