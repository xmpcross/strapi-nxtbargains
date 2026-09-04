/**
 * Geniuslink Integration module for NXT.Bargains
 * Handles Geniuslink link resolution, API short URL creation, and auto-localization.
 */

const GENIUSLINK_DOMAIN = process.env.GENIUSLINK_CUSTOM_DOMAIN || 'geni.us';
const GENIUSLINK_GROUP_ID = process.env.GENIUSLINK_GROUP_ID || '';
const GENIUSLINK_API_KEY = process.env.GENIUSLINK_API_KEY || '';
const GENIUSLINK_API_SECRET = process.env.GENIUSLINK_API_SECRET || '';

// In-memory cache for API-generated short URLs to prevent redundant network calls
const linkCache = new Map<string, string>();

/**
 * Checks if a given URL is already a Geniuslink / geni.us short URL.
 */
export function isGeniusLinkUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'geni.us' || host.endsWith('.geni.us') || host === GENIUSLINK_DOMAIN;
  } catch {
    return false;
  }
}

/**
 * Programmatically creates a Geniuslink short URL via the Geniuslink v2 REST API.
 * Falls back to the original destination if configuration or the API is unavailable.
 */
export async function createGeniusLink(destinationUrl: string): Promise<string> {
  if (!destinationUrl || destinationUrl === '#') return '#';
  if (isGeniusLinkUrl(destinationUrl)) return destinationUrl;

  if (linkCache.has(destinationUrl)) {
    return linkCache.get(destinationUrl)!;
  }

  if (!GENIUSLINK_API_KEY || !GENIUSLINK_API_SECRET) {
    return wrapGeniuslinkUrl(destinationUrl);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {

    const payload: Record<string, unknown> = { url: destinationUrl };
    if (GENIUSLINK_DOMAIN !== 'geni.us') payload.domain = GENIUSLINK_DOMAIN;
    if (GENIUSLINK_GROUP_ID) {
      const gid = parseInt(GENIUSLINK_GROUP_ID, 10);
      if (!isNaN(gid)) {
        payload.groupId = gid;
      }
    }

    const response = await fetch('https://api.geni.us/v2/shorturl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': GENIUSLINK_API_KEY,
        'X-Api-Secret': GENIUSLINK_API_SECRET,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (response.ok) {
      const data = await response.json();
      const shortUrl = data?.NewLink || data?.newLink || (data?.Code || data?.code ? `https://${GENIUSLINK_DOMAIN}/${data.Code || data.code}` : null);
      if (typeof shortUrl === 'string' && isGeniusLinkUrl(shortUrl)) {
        const secureUrl = new URL(shortUrl);
        secureUrl.protocol = 'https:';
        if (linkCache.size >= 5000) linkCache.delete(linkCache.keys().next().value!);
        linkCache.set(destinationUrl, secureUrl.href);
        return secureUrl.href;
      }
      console.warn('[Geniuslink] API returned no valid short link');
    } else {
      console.warn('[Geniuslink] Link creation failed:', response.status);
    }
  } catch {
    console.warn('[Geniuslink] Link creation timed out or failed');
  } finally {
    clearTimeout(timeout);
  }

  return wrapGeniuslinkUrl(destinationUrl);
}

/**
 * Reuses an existing short link synchronously. Uncached URLs are converted
 * by the /go redirect handler, not during page rendering.
 */
export function wrapGeniuslinkUrl(destinationUrl: string): string {
  if (!destinationUrl || destinationUrl === '#') return '#';
  if (isGeniusLinkUrl(destinationUrl)) return destinationUrl;

  if (linkCache.has(destinationUrl)) {
    return linkCache.get(destinationUrl)!;
  }

  return destinationUrl;
}
