import type { Metadata } from 'next';
import { SITE } from '@/lib/site';

export function cmsOrigin(): string {
  return new URL(process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.fxnstudio.com').origin;
}

// Site-wide Organization + WebSite JSON-LD now lives in lib/jsonld.ts
// (organizationJsonLd / websiteJsonLd) and is emitted from the root layout via
// the <JsonLd> component.

export function pageOpenGraph({
  title,
  description,
  path,
  image,
  type = 'website',
}: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: 'website' | 'article';
}): Pick<Metadata, 'openGraph' | 'twitter'> {
  const url = `${SITE.url}${path.startsWith('/') ? path : `/${path}`}`;
  // Always emit a share image: use the page's own image when provided,
  // otherwise fall back to the site-wide default (never leave OG imageless,
  // since this openGraph object overrides the layout default).
  const ogImageUrl = image || `${SITE.url}${SITE.ogImage}`;
  const images = image
    ? [{ url: image }]
    : [{ url: ogImageUrl, width: 1200, height: 630, alt: title }];

  return {
    openGraph: {
      type,
      title,
      description,
      url,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      site: SITE.twitterHandle,
      creator: SITE.twitterHandle,
      images: [ogImageUrl],
    },
  };
}
