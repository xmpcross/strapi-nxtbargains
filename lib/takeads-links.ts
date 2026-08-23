// Server-only: swap a merchant offer URL for its Takeads affiliate link using
// data/takeads-links.json (produced by scripts/fetch-takeads-links.mjs).
// Returns null when the URL has not been converted, so callers fall through to
// whatever they used before.
//
// Reads a local map rather than calling the API: Takeads monetization is a
// per-URL conversion, and a network round trip during render would sit in the
// path of every product page and every ISR revalidation.
//
// Deliberately the LAST resort in the link chain. Impact holds direct
// advertiser relationships and Amazon has its own tag, so both take precedence;
// Takeads picks up the long tail neither covers.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveOfferDestination } from './commerce';
import type { CommerceOffer, CommerceProduct } from './strapi';

type Cache = { links: Record<string, string>; checkedAt: string | null };

let cache: Cache | null = null;
function links(): Record<string, string> {
  if (cache) return cache.links;
  try {
    const p = join(process.cwd(), 'data', 'takeads-links.json');
    cache = existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as Cache) : { links: {}, checkedAt: null };
  } catch {
    cache = { links: {}, checkedAt: null };
  }
  return cache.links;
}

/**
 * Hosts that already carry someone's affiliate tracking. Re-wrapping one would
 * either break attribution or hand a competitor's commission to Takeads, so
 * these are never substituted even if a stale cache entry exists.
 */
const ALREADY_AFFILIATED = [
  // Takeads' own domain: a stale cache entry pointing at an already-converted
  // link must not be substituted a second time.
  'tatrck.com',
  'goto.walmart.com',
  'linksynergy.com',
  'prf.hn',
  'imp.i',
  'ebay.com/ulk',
  'awin1.com',
  'tradedoubler.com',
  'admitad.com',
];

/**
 * Takeads link for a bare destination URL, or null when there is none.
 *
 * Coupons and deal feeds arrive as plain URLs with no CommerceOffer around
 * them, so the lookup lives here and `wrapTakeadsAffiliate` layers the offer
 * resolution on top rather than duplicating the guard.
 */
export function takeadsLinkForUrl(destination: string): string | null {
  if (!destination || !destination.startsWith('http')) return null;
  if (ALREADY_AFFILIATED.some((h) => destination.includes(h))) return null;

  const monetized = links()[destination];
  return monetized && monetized !== destination ? monetized : null;
}

export function wrapTakeadsAffiliate(
  offer: CommerceOffer,
  product?: CommerceProduct,
): string | null {
  const destination = resolveOfferDestination(offer, product);
  if (!destination) return null;

  return takeadsLinkForUrl(destination);
}

/** When the cache was last refreshed — for a build-time freshness warning. */
export function takeadsCheckedAt(): string | null {
  links();
  return cache?.checkedAt ?? null;
}
