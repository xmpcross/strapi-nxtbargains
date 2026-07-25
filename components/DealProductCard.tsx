import Link from 'next/link';
import {
  formatMoney,
  merchantName,
  numericValue,
  offerPrice,
  productImageUrl,
  type CommerceOfferRow,
} from '@/lib/commerce';
import { mediaUrl, type CommerceProduct } from '@/lib/strapi';
import { productHref } from '@/lib/product-url';

export type DealCardMetric = {
  label: string;
  value: string;
  tone?: 'green' | 'red' | 'blue';
};

export default function DealProductCard({
  product,
  row,
  metric,
  note,
  titleAs = 'h2',
}: {
  product: CommerceProduct;
  row: CommerceOfferRow;
  metric: DealCardMetric;
  note?: string;
  titleAs?: 'h2' | 'h3' | 'h4' | 'h5';
}) {
  const image = productImageUrl(product);
  const offer = row.offer;
  const price = offerPrice(offer);
  const original = numericValue(offer.originalPrice);
  const logo = mediaUrl(offer.merchant?.logo ?? null);
  const toneClass =
    metric.tone === 'red'
      ? 'bg-red-50 text-red-700'
      : metric.tone === 'blue'
        ? 'bg-blue-50 text-blue-700'
        : 'bg-emerald-50 text-emerald-700';
  const TitleTag = titleAs;
  const href = productHref(product);

  return (
    <article className="group grid h-full border border-ink/10 bg-white sm:grid-cols-[180px_minmax(0,1fr)]">
      <Link href={href} className="flex min-h-[190px] items-center justify-center border-b border-ink/10 bg-white p-5 sm:border-b-0 sm:border-r">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.primaryImage?.alternativeText || product.name}
              loading="lazy"
            className="max-h-40 w-full object-contain mix-blend-multiply transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="flex h-40 w-full items-center justify-center bg-muted px-4 text-center font-display text-xl font-bold text-ink/25">
            {product.brandRef?.name ?? product.brand ?? 'NXT'}
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-col p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={`inline-flex px-2.5 py-1 text-xs font-bold ${toneClass}`}>
            {metric.label}: {metric.value}
          </span>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={`${merchantName(offer)} logo`} referrerPolicy="no-referrer" className="h-5 max-w-[96px] object-contain object-right" />
          ) : (
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{merchantName(offer)}</span>
          )}
        </div>

        <Link href={href} className="mt-4 block">
          <TitleTag className="line-clamp-2 font-display text-xl font-bold leading-tight text-ink transition group-hover:text-primary">
            {product.name}
          </TitleTag>
        </Link>

        <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink/60">
          {offer.title || product.shortDescription || `Compare current prices for ${product.name}.`}
        </p>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-5">
          <div>
            {original !== null && price !== null && original > price && (
              <p className="text-sm text-ink/35 line-through">{formatMoney(original, offer.currency ?? 'USD')}</p>
            )}
            <p className="font-display text-2xl font-bold text-ink">
              {price !== null ? formatMoney(price, offer.currency ?? 'USD') : 'Check price'}
            </p>
            <p className="mt-1 text-xs text-ink/45">{note ?? merchantName(offer)}</p>
          </div>
          <Link
            href={href}
            className="inline-flex bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary-emphasis"
          >
            Compare prices
          </Link>
        </div>
      </div>
    </article>
  );
}
