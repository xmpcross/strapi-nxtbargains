import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import PillarPageTemplate from '@/components/pillar/PillarPageTemplate';
import { articleJsonLd, breadcrumbJsonLd } from '@/lib/jsonld';
import { buildPillarContent, buildSupportingArticles, categoryName } from '@/lib/pillar';
import { getPost, listPosts, mediaUrl, type NxtPost } from '@/lib/strapi';
import { SITE } from '@/lib/site';
import { enrichPostCarouselHtml } from '@/lib/enrich-post-carousel';
import { clampDescription } from '@/lib/format';

const PILLAR_POST_SLUG = 'best-deals-and-bargains-guide';
const PILLAR_CATEGORY = 'buying-guides';
const PILLAR_PATH = '/best-deals-and-bargains';

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const post = await getPost(PILLAR_POST_SLUG).catch(() => null);
  if (!post) return { title: 'Not found' };

  const cover = mediaUrl(post.coverImage ?? null) || mediaUrl(post.ogImage ?? null);
  const description = clampDescription(post.seoDescription || post.excerpt || SITE.description);

  return {
    title: post.seoTitle || post.title,
    description,
    keywords: post.seoKeywords,
    alternates: { canonical: PILLAR_PATH },
    openGraph: {
      type: 'website',
      title: post.seoTitle || post.title,
      description,
      url: SITE.url + PILLAR_PATH,
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

export default async function BestDealsAndBargainsPillarPage() {
  const post = await getPost(PILLAR_POST_SLUG).catch(() => null);
  if (!post) notFound();

  const [postContent, supportingPool] = await Promise.all([
    enrichPostCarouselHtml(post.content),
    listPosts({ pageSize: 60 }).then((r) => r.data).catch(() => [] as NxtPost[]),
  ]);
  const supportingArticles = buildSupportingArticles(post, supportingPool);
  const cover = mediaUrl(post.coverImage ?? null) || mediaUrl(post.ogImage ?? null);
  const pageUrl = SITE.url + PILLAR_PATH;
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
    { name: categoryName(PILLAR_CATEGORY), url: SITE.url + PILLAR_PATH },
  ]);

  return (
    <>
      <JsonLd graph={[articleLd, breadcrumbLd]} />
      <PillarPageTemplate content={buildPillarContent(post, postContent, PILLAR_CATEGORY, supportingArticles)} />
    </>
  );
}
