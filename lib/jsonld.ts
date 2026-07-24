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
