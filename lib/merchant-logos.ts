import { sourceLogoForStore } from '@/lib/coupon-store-links';

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
  [/samsung/i, '/logos/samsung-official.png'],
  [/micro\s*center/i, '/logos/micro-center-logo.svg'],
  [/oneplus/i, '/logos/oneplus-logo.png'],
  [/amazon/i, '/logos/amazon-logo.svg'],
  [/ebay/i, '/logos/ebay-logo.svg'],
  [/walmart/i, '/logos/walmart-logo.svg'],
  [/newegg/i, '/logos/newegg-logo.svg'],
  [/target/i, '/logos/target-logo.svg'],
];

/**
 * The logo the Coupons pages would show for this merchant.
 *
 * Same chain the coupon store tiles use (see sourceLogoForStore / storeLogoUrl):
 * the committed SVG when there is one, then Google's favicon service keyed on
 * the merchant's own domain. The domain is read off the offer's URL, so a
 * merchant discovered through Google Shopping — which reaches Strapi with no
 * uploaded logo — still shows its real mark instead of a grey initial.
 *
 * Callers put an uploaded Strapi logo between the two: a curated SVG beats it,
 * a 128px favicon does not.
 */
export function couponMerchantLogo(name?: string | null, url?: string | null): string | null {
  const curated = sourceLogoForStore((name ?? '').trim());
  if (curated) return curated;

  const domain = domainFromUrl(url);
  return domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128` : null;
}

function domainFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

/** A local logo path for this merchant name, or null when none is known. */
export function localMerchantLogo(name?: string | null): string | null {
  const n = (name ?? '').trim();
  if (!n) return null;
  return LOCAL_MERCHANT_LOGOS.find(([re]) => re.test(n))?.[1] ?? null;
}
