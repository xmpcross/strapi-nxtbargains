/**
 * Local fallback logos for merchants that have no image in Strapi.
 *
 * Offer rows read `offer.merchant.logo`, a Strapi media field, and fall back to
 * the merchant's first letter when it is empty. Merchants discovered through
 * Google Shopping sellers arrive with no logo at all, so a price table can end
 * up as a column of grey initials.
 *
 * These files are committed under public/logos rather than uploaded to the
 * media library: they belong to the frontend, survive a CMS rebuild, and cost
 * no request at render time.
 */
const LOCAL_MERCHANT_LOGOS: Array<[RegExp, string]> = [
  [/micro\s*center/i, '/logos/micro-center-logo.svg'],
  [/oneplus/i, '/logos/oneplus-logo.png'],
  [/amazon/i, '/logos/amazon-logo.svg'],
  [/ebay/i, '/logos/ebay-logo.svg'],
  [/walmart/i, '/logos/walmart-logo.svg'],
  [/newegg/i, '/logos/newegg-logo.svg'],
  [/target/i, '/logos/target-logo.svg'],
];

/** A local logo path for this merchant name, or null when none is known. */
export function localMerchantLogo(name?: string | null): string | null {
  const n = (name ?? '').trim();
  if (!n) return null;
  return LOCAL_MERCHANT_LOGOS.find(([re]) => re.test(n))?.[1] ?? null;
}
