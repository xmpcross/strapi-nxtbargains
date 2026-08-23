// Server-only: append eBay Partner Network tracking to an eBay item URL.
//
// eBay is a direct relationship, like Impact and Amazon, so it is applied
// before Takeads in the link chain — and Takeads does not convert eBay item
// URLs anyway.
//
// The parameter set is not hand-rolled: it is exactly what eBay's own Browse
// API returns as `itemAffiliateWebUrl` when called with the
// `X-EBAY-C-ENDUSERCTX: affiliateCampaignId=<id>` header that
// scripts/fetch-ebay.mjs already uses. Confirmed against the live API:
//
//   …&mkevt=1&mkcid=1&mkrid=711-53200-19255-0&campid=<campaign>&customid=
//
// `mkrid` is the site-specific rotation id. 711-53200-19255-0 is eBay US, and
// every eBay offer in this catalogue is ebay.com — other eBay domains are left
// untouched rather than sent through a US rotation, which would not track.

const CAMPAIGN = process.env.EBAY_EPN_CAMPAIGN_ID || '';
const CUSTOM_ID = process.env.EBAY_EPN_CUSTOM_ID || '';

/** eBay US rotation id, as returned by the Browse API. */
const US_ROTATION = '711-53200-19255-0';

/** Hosts this rotation id is valid for. */
function isEbayUsHost(host: string): boolean {
  const h = host.replace(/^www\./, '').toLowerCase();
  return h === 'ebay.com';
}

/**
 * An EPN-tracked version of `url`, or null when it is not an eBay US URL, the
 * campaign id is unset, or the link already carries tracking.
 */
export function wrapEbayAffiliate(url?: string | null): string | null {
  if (!CAMPAIGN || !url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!isEbayUsHost(parsed.hostname)) return null;
  // Already affiliated — re-tagging would overwrite whoever earned the click.
  if (parsed.searchParams.has('campid') || parsed.pathname.startsWith('/ulk')) return null;

  parsed.searchParams.set('mkevt', '1');
  parsed.searchParams.set('mkcid', '1');
  parsed.searchParams.set('mkrid', US_ROTATION);
  parsed.searchParams.set('campid', CAMPAIGN);
  parsed.searchParams.set('customid', CUSTOM_ID);

  return parsed.toString();
}
