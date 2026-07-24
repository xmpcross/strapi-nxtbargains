import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getPost, listPostComments, listPosts, mediaUrl, type NxtPost } from '@/lib/strapi';
import { SECTIONS, SITE } from '@/lib/site';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { enrichPostCarouselHtml } from '@/lib/enrich-post-carousel';
import { clampDescription, firstImageUrl, fmtDate, primaryCategorySlug, postPath, stripHtml, warnSeoLength } from '@/lib/format';
import PostContent from '@/components/PostContent';
import PostPriceComparison from '@/components/PostPriceComparison';
import CommentForm from '@/components/CommentForm';
import ProductCarousel from '@/components/ProductCarousel';

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

  // Pull up to 10 related posts from the same category, excluding this one.
  const related = await listPosts({ category, pageSize: 11 })
    .then((r) => r.data.filter((p) => p.id !== post.id).slice(0, 10))
    .catch(() => [] as NxtPost[]);

  const recentPosts = await listPosts({ pageSize: 6 })
    .then((r) => r.data.filter((p) => p.id !== post.id).slice(0, 5))
    .catch(() => [] as NxtPost[]);

  const [merchantProducts, comments] = await Promise.all([
    listMerchantTopProducts(post),
    listPostComments(post.documentId ?? ''),
  ]);

  const cover = mediaUrl(post.coverImage ?? null) || mediaUrl(post.ogImage ?? null);
  const cat = post.categories?.[0];

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': post.postType === 'product-review' ? 'Review' : 'Article',
    headline: post.title,
    description: post.seoDescription || post.excerpt,
    image: cover ? [cover] : undefined,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    publisher: {
      '@type': 'Organization',
      name: SITE.name,
      url: SITE.url,
    },
    mainEntityOfPage: `${SITE.url}/${category}/${post.slug}`,
  };

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
  const faqLd =
    faqs.length >= 2
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: stripHtml(f.answer) },
          })),
        }
      : null;

  const postContent = await enrichPostCarouselHtml(post.content);

  return (
    <article
      className="bg-white"
      data-testid={`post-${post.slug}`}
      data-category={category}
      data-post-type={post.postType}
    >
      {/* Vendor stylesheets used by the imported product-comparison blocks
          (Content Egg + scoped Bootstrap). Only loaded on post pages. */}
      <link rel="stylesheet" href="/vendor/cegg-bootstrap.min.css" />
      <link rel="stylesheet" href="/vendor/cegg-products.min.css" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {faqLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      ) : null}

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
        <h1 className="sr-only">{post.title}</h1>

        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="w-full" data-testid="post-body">
            <PostContent html={postContent} />
            <PostPriceComparison post={post} />

            <div className="mt-14 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink/10 pt-8 text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink/10 text-ink/40">
                N
              </span>
              <span>By {SITE.name}</span>
              <span>{fmtDate(post.publishedAt)}</span>
              {post.readingTimeMinutes && <span>{post.readingTimeMinutes} min read</span>}
            </div>

            <div className="mt-8 border-y border-ink/10 py-8 text-sm leading-7 text-ink/60">
              <strong className="text-ink">Affiliate disclosure.</strong> {SITE.name} earns a
              commission when you buy through links on this page, at no extra cost to you.
              Prices and availability are accurate as of {fmtDate(post.updatedAt)} and subject to change.
            </div>

            <div className="mt-10 bg-muted p-8" data-testid="post-author-box">
              <div className="grid gap-6 sm:grid-cols-[72px_minmax(0,1fr)]">
                <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white text-2xl font-bold text-ink/30">
                  N
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink/45">Written by</p>
                  <h2 className="mt-2 font-display text-xl font-bold text-ink">{SITE.name}</h2>
                  <p className="mt-3 text-sm leading-7 text-ink/60">
                    Product comparisons, reviews and practical buying guides for smart tech shoppers.
                  </p>
                </div>
              </div>
            </div>

            {faqs.length > 0 ? (
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

            <section className="mt-10" data-testid="post-comments">
              <h3 className="font-display text-2xl font-bold tracking-tight text-ink">Comments</h3>
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
              <CommentForm postDocumentId={post.documentId ?? ''} />
            </section>
          </div>

          <aside className="space-y-10 lg:sticky lg:top-28" data-testid="post-side-rail">
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

            {recentPosts.length > 0 && (
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

        {related.length > 0 && (
          <aside className="mt-24 border-t border-ink/10 py-16">
            <div className="w-full text-left">
              <h3 className="font-display text-3xl font-bold tracking-tight text-ink">Editor's Choice</h3>
              <p className="mt-2 text-sm uppercase tracking-[0.16em] text-ink/45">
                More in {cat?.name ?? categoryName(category)}
              </p>
            </div>
            <div className="mt-10" data-testid="editors-choice-slider">
              <ProductCarousel
                items={related.map((r) => {
                  const img = mediaUrl(r.coverImage ?? null) ?? firstImageUrl(r.content);
                  const href = postPath(r);

                  return (
                    <article key={r.id} className="group flex h-full flex-col" data-testid={`editors-choice-${r.slug}`}>
                      <Link href={href} className="block overflow-hidden rounded-3xl bg-muted p-5">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
                            alt={r.coverImage?.alternativeText || r.title}
                            className="aspect-[4/3] w-full object-contain mix-blend-multiply transition duration-500 group-hover:scale-[1.02]"
                            loading="lazy"
                          />
                        ) : (
                          <div className="aspect-[4/3] w-full bg-gradient-to-br from-primary-hover to-primary" />
                        )}
                      </Link>
                      <div className="mt-4">
                        {r.categories?.[0] && (
                          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                            {r.categories[0].name}
                          </p>
                        )}
                        <Link href={href}>
                          <h4 className="mt-2 line-clamp-2 font-display !text-base font-bold leading-snug text-ink transition group-hover:text-primary">
                            {r.title}
                          </h4>
                        </Link>
                        <p className="mt-3 text-xs text-ink/50">
                          {fmtDate(r.publishedAt)} · {r.readingTimeMinutes ?? 5} min
                        </p>
                      </div>
                    </article>
                  );
                })}
              />
            </div>
          </aside>
        )}
      </div>
    </article>
  );
}
