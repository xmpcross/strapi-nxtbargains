import { SITE } from '@/lib/site';

/**
 * Shared JSON-LD builders for listing / collection pages.
 *
 * Both helpers normalise every link to an ABSOLUTE URL against `SITE.url`
 * (schema.org / Google ignore relative URLs), so callers may pass either a
 * site-relative path (`/products`) or an already-absolute URL. Reuse these
 * everywhere rather than inlining `@type` objects per page.
 */

/** Absolute URL against SITE.url; already-absolute (http/https) URLs pass through. */
function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${SITE.url}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

/**
 * BreadcrumbList that mirrors a visible breadcrumb trail (Home / Section / …).
 * `url` is optional so the current (last) crumb can be linkless if desired.
 */
export function breadcrumbJsonLd(items: { name: string; url?: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.url ? { item: absoluteUrl(item.url) } : {}),
    })),
  };
}

/**
 * ItemList for a listing/collection page — one `ListItem` per card actually
 * rendered on the current page. Pass items in display order; supply an explicit
 * `position` to keep numbering continuous across paginated pages (otherwise it
 * defaults to the 1-based index within `items`). `image` is included when present.
 */
export function itemListJsonLd(
  items: { name: string; url: string; image?: string; position?: number }[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: item.position ?? index + 1,
      name: item.name,
      url: absoluteUrl(item.url),
      ...(item.image ? { image: absoluteUrl(item.image) } : {}),
    })),
  };
}

import { stripHtml } from '@/lib/format';

const SCHEMA_CONTEXT = 'https://schema.org' as const;

/**
 * Organization — the publisher/brand entity. Emitted once site-wide from the
 * root layout (paired with {@link websiteJsonLd}); pages reference it by @id
 * rather than repeating it.
 */
export function organizationJsonLd() {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'Organization',
    '@id': `${SITE.url}/#organization`,
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    sameAs: Object.values(SITE.social),
  };
}

/**
 * WebSite — the site entity with a sitelinks SearchAction. Emitted once
 * site-wide from the root layout alongside {@link organizationJsonLd}.
 */
export function websiteJsonLd() {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'WebSite',
    '@id': `${SITE.url}/#website`,
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    publisher: { '@id': `${SITE.url}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE.url}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

/** CollectionPage for a listing/collection route. */
export function collectionPageJsonLd(input: {
  name: string;
  url: string;
  description?: string | null;
  numberOfItems?: number;
  /** Optional list of parts (e.g. Offer[] for coupon collections). */
  hasPart?: unknown[];
}) {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'CollectionPage',
    name: input.name,
    url: absoluteUrl(input.url),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.numberOfItems !== undefined ? { numberOfItems: input.numberOfItems } : {}),
    ...(input.hasPart !== undefined ? { hasPart: input.hasPart } : {}),
  };
}

/** Article or Review for an editorial post (publisher = the Organization). */
export function articleJsonLd(input: {
  type: 'Article' | 'Review';
  headline: string;
  description?: string | null;
  image?: string | null;
  datePublished?: string;
  dateModified?: string;
  url: string;
}) {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': input.type,
    headline: input.headline,
    description: input.description,
    image: input.image ? [input.image] : undefined,
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url },
    mainEntityOfPage: input.url,
  };
}

/** HowTo with ordered steps. `steps[].text` is stripped to plain text. */
export function howToJsonLd(input: {
  name: string;
  description: string;
  image?: string | null;
  steps: { name: string; text: string; image?: string | null; url: string }[];
}) {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'HowTo',
    name: input.name,
    description: input.description,
    ...(input.image ? { image: [input.image] } : {}),
    step: input.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: stripHtml(s.text),
      url: s.url,
      ...(s.image ? { image: s.image } : {}),
    })),
  };
}

/** FAQPage from Q&A pairs. Answers are stripped to plain text. */
export function faqJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: stripHtml(f.answer) },
    })),
  };
}

/** Product with optional aggregateRating, reviews and an AggregateOffer. */
export function productJsonLd(input: {
  name: string;
  brand?: string | null;
  category?: string | null;
  image?: string | null;
  sku?: string | null;
  gtin?: string | null;
  mpn?: string | null;
  description?: string | null;
  averageRating?: number | null;
  reviewCount?: number;
  reviews?: { authorName: string; createdAt?: string | null; rating: number; title?: string | null; body?: string | null }[];
  offers?: { offerCount: number; lowPrice?: number; highPrice?: number; priceCurrency: string; offers: unknown[] } | null;
}) {
  const averageRating = input.averageRating ?? null;
  const reviewCount = input.reviewCount ?? 0;
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'Product',
    name: input.name,
    brand: input.brand ? { '@type': 'Brand', name: input.brand } : undefined,
    category: input.category,
    image: input.image ? [input.image] : undefined,
    sku: input.sku,
    gtin: input.gtin,
    mpn: input.mpn,
    description: input.description,
    ...(averageRating !== null
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Math.round(averageRating * 10) / 10,
            reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(reviewCount > 0 && input.reviews
      ? {
          review: input.reviews.slice(0, 10).map((review) => ({
            '@type': 'Review',
            author: { '@type': 'Person', name: review.authorName },
            datePublished: review.createdAt,
            reviewRating: {
              '@type': 'Rating',
              ratingValue: review.rating,
              bestRating: 5,
              worstRating: 1,
            },
            name: review.title ?? undefined,
            reviewBody: review.body,
          })),
        }
      : {}),
    offers: input.offers
      ? {
          '@type': 'AggregateOffer',
          offerCount: input.offers.offerCount,
          lowPrice: input.offers.lowPrice,
          highPrice: input.offers.highPrice,
          priceCurrency: input.offers.priceCurrency,
          offers: input.offers.offers,
        }
      : undefined,
  };
}
