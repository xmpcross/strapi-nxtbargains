import Link from 'next/link';
import {
  bestOffer,
  collectOfferRows,
  formatMoney,
  merchantName,
  productImageUrl,
} from '@/lib/commerce';
import { mediaUrl, type CommerceProduct } from '@/lib/strapi';
import { productHref } from '@/lib/product-url';

export default function CommerceProductCard({
  product,
  showStoreLogo = false,
  showCompareButton = true,
  titleClassName = '',
  uniformImage = false,
  catalogLayout = false,
}: {
  product: CommerceProduct;
  showStoreLogo?: boolean;
  showCompareButton?: boolean;
  titleClassName?: string;
  uniformImage?: boolean;
  catalogLayout?: boolean;
}) {
  const rows = collectOfferRows(product);
  const best = bestOffer(rows);
  const image = productImageUrl(product);
  const category = product.categories?.[0]?.name ?? product.category ?? 'Product';
  const href = productHref(product);
  const bestMerchant = best?.offer.merchant ?? null;
  const storeLogo = bestMerchant?.logo ? mediaUrl(bestMerchant.logo) : null;
  const storeName = best ? merchantName(best.offer) : null;
  const useUniformImage = uniformImage || catalogLayout;
  const imageBoxClass = useUniformImage
    ? `price-drop-image-box uniform-product-image-box commerce-product-image-box grid aspect-square w-full place-items-center overflow-hidden bg-white p-4 sm:p-5 ${catalogLayout ? 'mb-3.5 rounded-[11px]' : ''}`
    : 'commerce-product-image-box grid overflow-hidden bg-white';
  const imageClass = useUniformImage
    ? 'price-drop-image uniform-product-image commerce-product-image block h-full w-full object-contain mix-blend-multiply transition duration-500 group-hover:scale-[1.04]'
    : 'commerce-product-image h-52 w-full object-contain p-5 mix-blend-multiply transition duration-500 group-hover:scale-[1.03]';

  return (
    <article
      className={`group flex h-full flex-col bg-white ${
        catalogLayout
          ? 'rounded-2xl border border-ink/10 p-[18px] transition hover:-translate-y-1 hover:shadow-[0_26px_46px_-26px_rgba(13,27,42,0.42)]'
          : 'border border-ink/10'
      }`}
      data-testid={`commerce-product-${product.slug}`}
    >
      <Link href={href} className={imageBoxClass}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.primaryImage?.alternativeText || product.name}
            loading="lazy"
            className={imageClass}
          />
        ) : (
          <span className={`flex items-center justify-center bg-muted px-6 text-center font-display font-bold text-ink/25 ${
            useUniformImage ? 'h-full w-full text-lg' : 'h-52 w-full text-2xl'
          }`}>
            {product.brandRef?.name ?? product.brand ?? 'NXT'}
          </span>
        )}
      </Link>

      <div className={`flex flex-1 flex-col ${catalogLayout ? '' : 'p-5'}`}>
        {showStoreLogo ? (
          <div className="flex h-5 items-center">
            {storeLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={storeLogo} alt={storeName ?? 'Marketplace'} referrerPolicy="no-referrer" className="h-5 max-w-[96px] object-contain object-left" />
            ) : (
              <span className="line-clamp-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{storeName ?? category}</span>
            )}
          </div>
        ) : (
          <p className="line-clamp-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
            {category}
          </p>
        )}
        <Link href={href}>
          <h3 className={`product-card-title line-clamp-2 font-display leading-tight text-ink transition group-hover:text-primary ${
            catalogLayout ? 'mb-3 mt-1.5 h-[2.6em] overflow-hidden leading-[1.3]' : 'mt-3'
          } ${titleClassName}`}>
            {product.name}
          </h3>
        </Link>

        {/* From price on one line (no border) + store/marketplace name */}
        <div className={`mt-auto flex items-end justify-between gap-3 ${catalogLayout ? 'border-t border-ink/10 pt-3' : 'pt-5'}`}>
          <div className={catalogLayout ? 'text-[0.74rem] text-ink/55' : undefined}>
            {catalogLayout ? (
              <>
                From
                <b className="block font-display text-[1.1rem] font-extrabold text-ink">
                  {best ? formatMoney(best.offer.price ?? best.offer.originalPrice, best.offer.currency ?? 'USD') : 'Check price'}
                </b>
              </>
            ) : (
              <p className="font-display text-base font-bold text-ink">
                <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink/40">From</span>
                {best ? formatMoney(best.offer.price ?? best.offer.originalPrice, best.offer.currency ?? 'USD') : 'Check price'}
              </p>
            )}
          </div>
          {catalogLayout ? (
            <Link
              href={href}
              className="rounded-[9px] bg-primary px-3.5 py-2 font-display text-[0.8rem] font-semibold text-white transition hover:bg-primary-emphasis"
            >
              Compare
            </Link>
          ) : storeLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={storeLogo} alt={storeName ?? 'Store'} referrerPolicy="no-referrer" className="h-5 max-w-[84px] shrink-0 object-contain object-right" />
          ) : (
            <p className="line-clamp-1 text-right text-xs font-bold text-ink/55">
              {best ? merchantName(best.offer) : 'No offers yet'}
            </p>
          )}
        </div>

        {showCompareButton && !catalogLayout && (
          <div className="mt-4 flex justify-start">
            <Link
              href={href}
              className="inline-flex bg-primary px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary-emphasis"
            >
              Compare
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
