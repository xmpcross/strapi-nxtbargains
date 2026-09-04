import Link from 'next/link';
import {
  bestOffer,
  collectOfferRows,
  formatMoney,
  merchantName,
  offerPrice,
  offerUrl,
  productImageUrl,
} from '@/lib/commerce';
import { buyUrl } from '@/lib/offer-links';
import { couponMerchantLogo, localMerchantLogo } from '@/lib/merchant-logos';
import { mediaUrl, type CommerceProduct } from '@/lib/strapi';
import { productHref } from '@/lib/product-url';

/**
 * Comparison card for the category listings, following the nxtsmarthome.com.au
 * product card: rank, category and price on one line, then the image, title,
 * rating, a strip of the cheapest retailer prices, and a buy button.
 *
 * Separate from CommerceProductCard rather than another variant of it. That
 * card is used by the homepage, search, related products and price drops, and
 * this layout is different enough — a whole retailer strip it does not have —
 * that folding both into one component would leave every caller paying for
 * branches it never renders.
 *
 * The retailer strip is the point of the card: it is the only place in a
 * listing where a reader sees more than one price without opening the product.
 */
export default function CategoryProductCard({
  product,
  rank,
}: {
  product: CommerceProduct;
  /** 1-based position in the listing, continuing across pages. */
  rank?: number;
}) {
  const rows = collectOfferRows(product);
  const best = bestOffer(rows);
  const image = productImageUrl(product);
  const href = productHref(product);
  const category = product.categories?.[0]?.name ?? product.category ?? 'Product';
  const currency = best?.offer.currency ?? 'USD';

  const rating = Number(product.rating);
  const hasRating = Number.isFinite(rating) && rating > 0;
  const ratingCount = product.ratingCount ?? 0;

  // Cheapest first, one row per merchant: two listings from the same store are
  // a duplicate to a reader comparing retailers, not a second option.
  const seen = new Set<string>();
  const priced = rows
    .filter((row) => offerPrice(row.offer) !== null)
    .sort((a, b) => (offerPrice(a.offer) ?? 0) - (offerPrice(b.offer) ?? 0))
    .filter((row) => {
      const key = (row.offer.merchant?.slug ?? merchantName(row.offer)).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);

  return (
    <article className="category-card flex h-full flex-col" data-testid={`category-product-${product.slug}`}>
      <div className="flex items-center gap-2">
        {rank ? <span className="category-card-rank">#{rank}</span> : null}
        <span className="category-card-chip truncate">{category}</span>
        <span className="ml-auto shrink-0 whitespace-nowrap">
          <span className="font-display text-lg font-bold text-ink">
            {best ? formatMoney(best.offer.price ?? best.offer.originalPrice, currency) : '—'}
          </span>
          {best ? <span className="ml-1 text-[11px] font-semibold text-ink/40">{currency}</span> : null}
        </span>
      </div>

      <Link href={href} className="category-card-image-box mt-3 block w-full overflow-hidden">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.primaryImage?.alternativeText || product.name}
            loading="lazy"
            width={800}
            height={800}
            className="category-card-image"
          />
        ) : (
          <span className="category-card-image grid place-items-center font-display text-lg font-bold text-ink/25">
            {product.brandRef?.name ?? product.brand ?? 'NXT'}
          </span>
        )}
      </Link>

      <h3 className="category-card-title mt-4">
        <Link href={href}>{product.name}</Link>
      </h3>

      {hasRating ? (
        <p className="mt-2 flex items-center gap-1.5 text-[13px]">
          <span aria-hidden="true" className="category-card-stars">
            {'★'.repeat(Math.round(Math.min(5, rating)))}
            <span className="category-card-stars-off">{'★'.repeat(5 - Math.round(Math.min(5, rating)))}</span>
          </span>
          <span className="font-bold text-ink">{rating.toFixed(1)}</span>
          {ratingCount > 0 ? <span className="text-ink/45">({ratingCount.toLocaleString()})</span> : null}
        </p>
      ) : null}

      {priced.length > 0 ? (
        <div className="category-card-offers mt-4">
          {/* These are affiliate links, so the strip says so rather than
              presenting itself as a neutral price index. */}
          <p className="category-card-offers-label">Promoted</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {priced.map((row) => {
              const logo =
                couponMerchantLogo(merchantName(row.offer), offerUrl(row.offer))
                ?? mediaUrl(row.offer.merchant?.logo ?? null)
                ?? localMerchantLogo(merchantName(row.offer));
              return (
                <a
                  key={row.offer.documentId ?? row.offer.id}
                  href={buyUrl(row.offer, row.product)}
                  target="_blank"
                  rel="nofollow sponsored noopener noreferrer"
                  className="category-card-offer"
                >
                  <span className="block font-display text-[13px] font-bold text-ink">
                    {formatMoney(row.offer.price ?? row.offer.originalPrice, row.offer.currency ?? currency)}
                  </span>
                  <span className="mt-1.5 flex h-5 items-center justify-center">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logo}
                        alt={merchantName(row.offer)}
                        referrerPolicy="no-referrer"
                        className="max-h-5 max-w-full object-contain"
                      />
                    ) : (
                      <span className="truncate text-[10px] font-bold uppercase tracking-wide text-ink/50">
                        {merchantName(row.offer)}
                      </span>
                    )}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Pushed to the bottom so buttons line up across a row of uneven cards. */}
      <div className="mt-auto pt-4">
        {best ? (
          <a
            href={buyUrl(best.offer, best.product)}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            className="category-card-cta"
          >
            Check price at {merchantName(best.offer)}
          </a>
        ) : (
          <Link href={href} className="category-card-cta">
            View product
          </Link>
        )}

        <Link href={href} className="category-card-more mt-2.5">
          View full specs &amp; price comparison →
        </Link>
      </div>
    </article>
  );
}
