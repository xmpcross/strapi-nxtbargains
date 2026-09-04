import type { CommerceOffer, CommerceProduct } from '@/lib/strapi';
import { merchantName, resolveOfferDestination, sanitizeOfferUrl } from '@/lib/commerce';
import { trackedUrl } from '@/lib/click-tracking';
import { wrapGeniuslinkUrl } from '@/lib/geniuslink';

export function amazonHost(offer: CommerceOffer): string {
  for (const candidate of [offer.productUrl, offer.affiliateUrl]) {
    try {
      const host = new URL(candidate ?? '').hostname.toLowerCase();
      if (/(^|\.)amazon\.(com|co\.uk|com\.au|de|fr|it|es|ca|co\.jp)$/i.test(host)) return host;
    } catch {
      // not a URL — try the next candidate
    }
  }
  return 'www.amazon.com';
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

  const host = amazonHost(offer);
  const tag = process.env.AMAZON_AFFILIATE_TAG || process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG || 'unitradeco-20';
  return `https://${host}/dp/${asin}?tag=${tag}`;
}

export function buyDestination(
  offer: CommerceOffer,
  product?: CommerceProduct,
): { url: string | null; network: string } {
  const affiliate = sanitizeOfferUrl(offer.affiliateUrl);
  const resolved = resolveOfferDestination(offer, product);

  const rawTarget = affiliate || resolved || offer.productUrl;
  if (!rawTarget || rawTarget === '#') {
    return { url: offer.merchant?.websiteUrl ?? '#', network: 'merchant-home' };
  }

  const geniusUrl = wrapGeniuslinkUrl(rawTarget);
  return { url: geniusUrl, network: 'geniuslink' };
}

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
