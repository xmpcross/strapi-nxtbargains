/**
 * Where an offer's buy button actually goes, and which affiliate relationship
 * produced it.
 *
 * Lifted out of the product page so the catalogue cards use the identical
 * chain. Two copies of this logic would drift, and the failure mode is silent:
 * a card would keep linking out and simply stop earning.
 */
import type { CommerceOffer, CommerceProduct } from '@/lib/strapi';
import { merchantName, resolveOfferDestination, sanitizeOfferUrl } from '@/lib/commerce';
import { wrapImpactAffiliate } from '@/lib/impact-links';
import { wrapTakeadsAffiliate } from '@/lib/takeads-links';
import { wrapEbayAffiliate } from '@/lib/ebay-links';
import { trackedUrl } from '@/lib/click-tracking';

/**
 * Associates tag per storefront. A US tag on amazon.com.au tracks nothing, so
 * the offer's own domain decides which one is used; anything unrecognised
 * falls back to the US tag, which is also the default storefront below.
 */
const AMAZON_TAGS: Array<[RegExp, string | undefined]> = [
  [/(^|\.)amazon\.com\.au$/i, process.env.AMAZON_AFFILIATE_TAG_AU],
  [/(^|\.)amazon\.co\.uk$/i, process.env.AMAZON_AFFILIATE_TAG_UK],
  [/(^|\.)amazon\.com$/i, process.env.AMAZON_AFFILIATE_TAG],
];

export function amazonHost(offer: CommerceOffer): string {
  for (const candidate of [offer.productUrl, offer.affiliateUrl]) {
    try {
      const host = new URL(candidate ?? '').hostname;
      if (/(^|\.)amazon\./i.test(host)) return host;
    } catch {
      // not a URL — try the next candidate
    }
  }
  return 'www.amazon.com';
}

function amazonTagForHost(host: string): string | undefined {
  return (
    AMAZON_TAGS.find(([pattern]) => pattern.test(host))?.[1]
    || process.env.AMAZON_AFFILIATE_TAG
    || undefined
  );
}

function asinFromUrl(value?: string): string | null {
  return value?.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1]?.toUpperCase() ?? null;
}

function validAsin(value?: string): string | null {
  const candidate = value?.trim().toUpperCase();
  return candidate && /^[A-Z0-9]{10}$/.test(candidate) ? candidate : null;
}

export function safeAffiliateUrl(offer: CommerceOffer): string | null {
  return sanitizeOfferUrl(offer.affiliateUrl);
}

export function amazonProductUrl(offer: CommerceOffer, product?: CommerceProduct): string | null {
  const merchantSlug = offer.merchant?.slug?.toLowerCase();
  const merchant = merchantSlug || merchantName(offer).toLowerCase();
  if (!merchant.includes('amazon')) return null;

  const asin = [
    asinFromUrl(offer.productUrl),
    asinFromUrl(offer.affiliateUrl || undefined),
    validAsin(offer.merchantSku || undefined),
    validAsin(product?.asin || undefined),
    validAsin(product?.sku?.replace(/^amazon-/i, '') || undefined),
  ].find(Boolean);

  if (!asin) return null;

  // The tag was never appended here at all, so every Amazon product link on
  // this page was untagged and earned nothing.
  const host = amazonHost(offer);
  const tag = amazonTagForHost(host);
  return tag
    ? `https://${host}/dp/${asin}?tag=${encodeURIComponent(tag)}`
    : `https://${host}/dp/${asin}`;
}

/* The destination itself, and which relationship produced it. Split out from
   buyUrl so the tracking wrapper has one place to sit and the choice of network
   is recorded rather than guessed from the final host — after wrapping, every
   Impact link looks like Impact. */
export function buyDestination(
  offer: CommerceOffer,
  product?: CommerceProduct,
): { url: string | null; network: string } {
  const affiliate = sanitizeOfferUrl(offer.affiliateUrl);
  const resolved = resolveOfferDestination(offer, product);

  if (affiliate) {
    const normalizedOffer: CommerceOffer = {
      ...offer,
      affiliateUrl: affiliate,
      productUrl: resolved ?? offer.productUrl,
    };
    const impact = wrapImpactAffiliate(normalizedOffer);
    return impact ? { url: impact, network: 'impact' } : { url: affiliate, network: 'offer-affiliate' };
  }

  if (!resolved) return { url: offer.merchant?.websiteUrl ?? '#', network: 'merchant-home' };

  const normalizedOffer: CommerceOffer = { ...offer, productUrl: resolved, affiliateUrl: null };
  // Order matters: Impact and Amazon are direct relationships, so they win.
  // Takeads covers the long tail of merchants neither of them has, and only
  // ever substitutes a URL it has actually converted.
  const impact = wrapImpactAffiliate(normalizedOffer);
  if (impact) return { url: impact, network: 'impact' };

  const amazon = amazonProductUrl(normalizedOffer, product);
  if (amazon) return { url: amazon, network: 'amazon' };

  // eBay is a direct relationship too, and Takeads does not convert eBay item
  // URLs, so EPN goes ahead of it.
  const ebay = wrapEbayAffiliate(resolved);
  if (ebay) return { url: ebay, network: 'ebay-epn' };

  const takeads = wrapTakeadsAffiliate(normalizedOffer, product);
  if (takeads) return { url: takeads, network: 'takeads' };

  return { url: resolved, network: 'direct' };
}

// Outbound buy link: Impact deep-link if the merchant matches an approved Impact
// campaign (e.g. Whatnot), otherwise the offer's own affiliate/product URL.
export function buyUrl(offer: CommerceOffer, product?: CommerceProduct): string {
  const { url, network } = buyDestination(offer, product);
  if (!url || url === '#') return '#';

  return trackedUrl(url, {
    merchant: offer.merchant?.slug ?? offer.merchant?.name ?? null,
    network,
    offerDocumentId: offer.documentId ?? null,
    productDocumentId: product?.documentId ?? null,
  });
}
