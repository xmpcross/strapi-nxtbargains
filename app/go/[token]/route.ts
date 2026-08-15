import { NextResponse } from 'next/server';
import { verifyClickToken } from '@/lib/click-tracking';

/**
 * Outbound affiliate redirect.
 *
 * Two rules shape everything here:
 *
 *   The visitor is never delayed. The 302 is issued as soon as the signature
 *   checks out; recording the click is fired off without being awaited, so a
 *   slow or down CMS costs statistics rather than a sale.
 *
 *   Nothing identifying is stored. Country comes from an edge header the CDN
 *   already resolved, and the referrer is reduced to a path on our own site.
 *   No address, user agent, cookie or session id is written anywhere.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STRAPI = (process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL || '').replace(/\/$/, '');
const WRITE_TOKEN = process.env.STRAPI_WRITE_TOKEN || process.env.STRAPI_API_TOKEN || '';
const SITE_SLUG = process.env.NEXT_PUBLIC_SITE_SLUG || 'nxt-bargains';

/** Our own path the click came from. Query string dropped — it can carry search terms. */
function referrerPath(referer: string | null): string | null {
  if (!referer) return null;
  try {
    const url = new URL(referer);
    const own = process.env.NEXT_PUBLIC_SITE_URL || '';
    if (own && new URL(own).host !== url.host) return null;
    return url.pathname.slice(0, 300);
  } catch {
    return null;
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host.slice(0, 180);
  } catch {
    return null;
  }
}

async function record(payload: Record<string, unknown>) {
  if (!STRAPI || !WRITE_TOKEN) return;
  try {
    await fetch(`${STRAPI}/api/affiliate-clicks`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${WRITE_TOKEN}`,
      },
      body: JSON.stringify({ data: payload }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // A click that cannot be logged is still a click that must be redirected.
  }
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const click = verifyClickToken(token);

  if (!click) {
    // An unsigned or tampered token gets no redirect at all — this endpoint
    // must never forward to a URL it did not itself produce.
    return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_SITE_URL || request.url), 302);
  }

  const headers = request.headers;
  const country =
    headers.get('cf-ipcountry') ||
    headers.get('x-vercel-ip-country') ||
    headers.get('x-geo-country') ||
    null;

  void record({
    clickedAt: new Date().toISOString(),
    targetUrl: click.u,
    targetHost: hostOf(click.u),
    merchant: click.merchant ?? null,
    network: click.network ?? null,
    offerDocumentId: click.offerDocumentId ?? null,
    productDocumentId: click.productDocumentId ?? null,
    country: country && /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : null,
    referrerPath: referrerPath(headers.get('referer')),
    siteSlug: SITE_SLUG,
  });

  const response = NextResponse.redirect(click.u, 302);
  // Affiliate destinations change; never let an intermediary keep this hop.
  response.headers.set('cache-control', 'no-store, max-age=0');
  return response;
}
