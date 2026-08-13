import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isCommerceProductCategorySlug } from '@/lib/product-url';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const legacyMatch = pathname.match(/^\/category\/([^/]+)\/([^/]+)\/?$/);
  if (legacyMatch) {
    const [, categorySlug, productSlug] = legacyMatch;
    if (isCommerceProductCategorySlug(categorySlug)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${categorySlug}/${productSlug}`;
      return NextResponse.redirect(url, 308);
    }
  }

  const match = pathname.match(/^\/([^/]+)\/([^/]+)\/?$/);
  if (!match) return NextResponse.next();

  const [, categorySlug, productSlug] = match;
  if (!isCommerceProductCategorySlug(categorySlug)) return NextResponse.next();

  /*
   * Same-origin rewrite. /products/[slug] is a route in this app, so pointing
   * the rewrite at an absolute origin made the app proxy a request to itself.
   * That origin defaulted to http://127.0.0.1:3008 — the port the old
   * `nxt-bargains.service` listened on when the site was self-hosted behind
   * nginx. On Netlify nothing listens there, so every product page returned
   * "tcp connect error: Connection refused" and 500'd. Cloning nextUrl keeps
   * the query string and works on any host.
   */
  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = `/products/${productSlug}`;

  /*
   * The flag has to travel on the REQUEST. app/products/[slug]/page.tsx reads it
   * with headers() and, without it, canonicalises /products/<slug> back to
   * /<category>/<slug> — which this middleware rewrites again, so the page
   * redirects to itself forever. Setting it on the response only tells the
   * browser, never the route.
   */
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-product-category-route', '1');

  const response = NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
  response.headers.set('x-product-category-route', '1');
  return response;
}

export const config = {
  matcher: [
    '/category/:category/:productSlug',
    '/smart-phones/:productSlug',
    '/smartwatches/:productSlug',
    '/tablets/:productSlug',
    '/laptops/:productSlug',
    '/smart-light-bulbs/:productSlug',
    '/smart-tvs/:productSlug',
    '/smart-cameras/:productSlug',
    '/smart-speakers/:productSlug',
    '/smart-door-locks/:productSlug',
    '/smart-plugs/:productSlug',
    '/video-doorbells/:productSlug',
    '/headphones/:productSlug',
    '/raspberry-pi/:productSlug',
  ],
};
