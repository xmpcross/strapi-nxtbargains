import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import PillarPageTemplate from '@/components/pillar/PillarPageTemplate';
import { articleJsonLd, breadcrumbJsonLd } from '@/lib/jsonld';
import { buildPillarContent, buildSupportingArticles, categoryName, pillarPathForPost } from '@/lib/pillar';
import { getPost, listPosts, mediaUrl, type NxtPost } from '@/lib/strapi';
import { SITE } from '@/lib/site';
import { enrichPostCarouselHtml } from '@/lib/enrich-post-carousel';
import { clampDescription } from '@/lib/format';

/**
 * The shared body of a pillar route.
 *
 * Every pillar page is the same page with a different post behind it, so the
 * route files are three constants and a call to this. The first pillar was 81
 * lines of route; copying those per pillar guarantees the second one drifts
 * from the first the moment either is touched.
 *
 * A route file is still needed per pillar rather than one [pillar] segment,
 * because each pillar owns a real top-level URL — /best-deals-and-bargains,
 * not /pillar/best-deals-and-bargains — and those paths are what the
 * middleware redirects the underlying post to.
 */

export async function pillarMetadata(slug: string, path: string): Promise<Metadata> {
  const post = await getPost(slug).catch(() => null);
  if (!post) return { title: 'Not found' };

  const cover = mediaUrl(post.coverImage ?? null) || mediaUrl(post.ogImage ?? null);
  const description = clampDescription(post.seoDescription || post.excerpt || SITE.description);

  return {
    title: post.seoTitle || post.title,
    description,
    keywords: post.seoKeywords,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      title: post.seoTitle || post.title,
      description,
      url: SITE.url + path,
      images: cover ? [{ url: cover }] : undefined,
    },
    twitter: {
      card: cover ? 'summary_large_image' : 'summary',
      title: post.seoTitle || post.title,
      description,
      images: cover ? [cover] : undefined,
    },
  };
}

export default async function PillarRoute({
  slug,
  breadcrumbLabel,
}: {
  slug: string;
  /** Second crumb after Home. Falls back to the post's own title. */
  breadcrumbLabel?: string;
}) {
  const post = await getPost(slug).catch(() => null);
  if (!post) notFound();

  const [postContent, supportingPool] = await Promise.all([
    enrichPostCarouselHtml(post.content),
    /* The whole library. A hand-picked supporting slug outside the first page
       of results silently drops out of the cluster. */
    listPosts({ pageSize: 200 }).then((r) => r.data).catch(() => [] as NxtPost[]),
  ]);

  const path = pillarPathForPost(post) ?? `/${post.slug}`;
  const supportingArticles = buildSupportingArticles(post, supportingPool);
  const cover = mediaUrl(post.coverImage ?? null) || mediaUrl(post.ogImage ?? null);
  const pageUrl = SITE.url + path;

  const articleLd = articleJsonLd({
    type: post.postType === 'product-review' ? 'Review' : 'Article',
    headline: post.title,
    description: post.seoDescription || post.excerpt,
    image: cover,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    url: pageUrl,
    author: post.author ? { name: post.author.name, sameAs: post.author.sameAs ?? null } : { name: SITE.name },
  });
  const breadcrumbLd = breadcrumbJsonLd([
    { name: 'Home', url: SITE.url + '/' },
    { name: breadcrumbLabel || post.title, url: pageUrl },
  ]);

  /* The eyebrow argument is the pillar's own label, not the post's category —
     this post has no category at all, which is why its underlying URL was
     /uncategorized/. */
  return (
    <>
      <JsonLd graph={[articleLd, breadcrumbLd]} />
      <PillarPageTemplate
        content={buildPillarContent(post, postContent, breadcrumbLabel || categoryName(post.categories?.[0]?.slug), supportingArticles)}
      />
    </>
  );
}
