import Link from 'next/link';
import type { ReactNode } from 'react';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import {
  bestOffer,
  collectOfferRows,
  comparableProducts,
  formatMoney,
  isGeniusLinkUrl,
  merchantName,
  numericValue,
  offerPrice,
  offerUrl,
  productImageUrl,
  resolveOfferDestination,
  sanitizeOfferUrl,
  type CommerceOfferRow,
} from '@/lib/commerce';
import {
  getCommerceProduct,
  listCommercePriceSnapshots,
  listCommerceProducts,
  listProductReviews,
  listSimilarCommerceProducts,
  mediaUrl,
  type CommerceOffer,
  type CommercePriceSnapshot,
  type CommerceProduct,
  type CommerceReview,
} from '@/lib/strapi';
import { buyUrl } from '@/lib/offer-links';
import { listCouponPageData, type CouponBrandGroup, type Retailer } from '@/lib/coupon-data';
import { buildCouponStoreLinks, couponRetailersForStoreLinks } from '@/lib/coupon-store-links';
import StoreLinkTile from '@/components/StoreLinkTile';
import { productCanonicalPath, primaryCategorySlug } from '@/lib/product-url';
import { clampDescription, fmtDate, fmtDateTime } from '@/lib/format';
import { SITE } from '@/lib/site';
import { pageOpenGraph } from '@/lib/seo';
import { breadcrumbJsonLd, productJsonLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';
import PriceAlertForm from '@/components/PriceAlertForm';
import ReviewForm from '@/components/ReviewForm';
import ProductSidePeek from '@/components/ProductSidePeek';
import ProductHighlights from '@/components/ProductHighlights';
import ProductReviewsSection from '@/components/ProductReviewsSection';
import { couponMerchantLogo, localMerchantLogo } from '@/lib/merchant-logos';
import CommerceProductCard from '@/components/CommerceProductCard';
import ProductCarousel from '@/components/ProductCarousel';

export const revalidate = 60;
export const dynamicParams = true;

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCommerceProduct(slug).catch(() => null);
  if (!product) return { title: 'Product not found' };

  const image = productImageUrl(product);
  const description = clampDescription(
    product.shortDescription ||
      `Compare current merchant prices for ${product.name} on ${SITE.name}.`,
  );
  const canonicalPath = productCanonicalPath(product);

  return {
    title: `${product.name} Prices`,
    description,
    alternates: { canonical: canonicalPath },
    ...pageOpenGraph({
      title: `${product.name} Prices`,
      description,
      path: canonicalPath,
      image,
    }),
  };
}

export default async function ProductPricePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const product = await getCommerceProduct(slug).catch(() => null);
  if (!product) notFound();

  const categorySlug = primaryCategorySlug(product);
  const headerList = await headers();
  const isCategoryRoute = headerList.get('x-product-category-route') === '1';
  if (categorySlug && !isCategoryRoute) {
    redirect(`/${categorySlug}/${slug}`);
  }

  const productCategorySlugs = new Set(product.categories?.map((item) => item.slug).filter(Boolean) ?? []);
  const relatedCategorySlug = product.categories?.[0]?.slug;
  const sharesProductCategory = (item: CommerceProduct) =>
    item.categories?.some((category) => productCategorySlugs.has(category.slug)) ?? false;
  const similarProducts = await listSimilarCommerceProducts(product).catch(() => [] as CommerceProduct[]);
  const comparable = comparableProducts(product, similarProducts);
  let related = comparable.filter((p) => p.slug !== product.slug && sharesProductCategory(p)).slice(0, 10);
  // Sparse catalog: if no name-similar products share this category, fall back
  // to other products from the same category only.
  if (related.length < 5 && relatedCategorySlug) {
    const more = await listCommerceProducts({ category: relatedCategorySlug, pageSize: 12 })
      .then((r) => r.data)
      .catch(() => [] as CommerceProduct[]);
    const seen = new Set([product.slug, ...related.map((p) => p.slug)]);
    related = [...related, ...more.filter((p) => !seen.has(p.slug))].slice(0, 10);
  }
  const rows = collectOfferRows(product);
  const priceSnapshots = await listCommercePriceSnapshots(
    [product.documentId].filter(Boolean) as string[],
  ).catch(() => [] as CommercePriceSnapshot[]);
  const reviews = await listProductReviews(product.documentId ?? '').catch(() => [] as CommerceReview[]);
  const couponPageData = await listCouponPageData().catch(() => ({
    coupons: [],
    retailers: [] as Retailer[],
    brandGroups: [] as CouponBrandGroup[],
  }));
  const best = bestOffer(rows);
  const image = productImageUrl(product);
  const brand = product.brandRef?.name ?? product.brand;

  // Multi-store offers from the data/live-offers.json cache (static snapshot).
  // Only show when the match is confident (2+ stores), so we never display a
  // mis-matched single offer. Links are affiliate-wrapped at fetch time.
  let liveOffers: LiveOffer[] = [];
  let liveCapturedAt: string | null = null;
  try {
    const p = join(process.cwd(), 'data', 'live-offers.json');
    if (existsSync(p)) {
      const entry = (JSON.parse(readFileSync(p, 'utf8')).items ?? {})[slug];
      // Dead Geniuslinks are dropped before the 2-offer test, so a product left
      // with a single live offer hides the section rather than showing one 410.
      const usable = (Array.isArray(entry?.offers) ? entry.offers : []).filter(
        (offer: LiveOffer) => offer.url && !isGeniusLinkUrl(offer.url),
      );
      if (usable.length >= 2) {
        liveOffers = usable as LiveOffer[];
        liveCapturedAt = entry.capturedAt ?? null;
      }
    }
  } catch {}
  const category = product.categories?.[0]?.name ?? product.category;
  const bestPrice = best ? offerPrice(best.offer) : null;
  const pricedRows = rows.filter((row) => offerPrice(row.offer) !== null);
  const initialVisibleOfferCount = 4;
  const hiddenOfferCount = Math.max(rows.length - initialVisibleOfferCount, 0);
  const offerToggleId = `offer-list-toggle-${product.id}`;
  const summary =
    product.shortDescription ||
    product.description ||
    (category
      ? `Compare current prices for this ${category.toLowerCase()} across trusted merchants.`
      : `Compare current prices for ${product.name} across trusted merchants.`);
  const highlights = productHighlightEntries(product);
  const shortCopy = shortDescriptionCopy(product.shortDescription);
  const discount = best ? discountPercent(best.offer) : null;
  const updatedLabel = product.updatedAt ? fmtDate(product.updatedAt) : 'Today';
  const updatedAtLabel = product.updatedAt ? fmtDateTime(product.updatedAt) : '';
  const canonicalPath = productCanonicalPath(product);
  const reviewCount = reviews.length;
  const averageRating =
    reviewCount > 0 ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount : null;
  // The catalogue aggregate is what the reviews section headlines, so the title
  // shows the same number; on-site reviews stand in only where it is missing
  // (the catalogue carries a rating for 350 of the 515 products on this site).
  // `Number(null)` is 0 and passes a finite check, which rendered "0.0" on the
  // 165 products that carry no rating at all. An actual zero is not a rating
  // worth showing either, so both are treated as absent.
  const catalogueRating = positiveRating(product.rating);
  const titleRating = catalogueRating ?? positiveRating(averageRating);
  const titleRatingCount = catalogueRating != null ? product.ratingCount || null : reviewCount || null;

  const productLd = productJsonLd({
    name: product.name,
    brand,
    category,
    image,
    sku: product.sku ?? product.mpn ?? product.gtin ?? undefined,
    gtin: product.gtin ?? undefined,
    mpn: product.mpn ?? undefined,
    description: product.shortDescription ?? product.description ?? undefined,
    averageRating,
    reviewCount,
    reviews,
    offers: rows.length
      ? {
          offerCount: rows.length,
          lowPrice: bestPrice ?? undefined,
          highPrice: pricedRows.length
            ? Math.max(...pricedRows.map((row) => offerPrice(row.offer) ?? 0))
            : undefined,
          priceCurrency: best?.offer.currency ?? 'USD',
          offers: rows.map((row) => offerJsonLd(row.offer)),
        }
      : null,
  });

  const breadcrumbLd = breadcrumbJsonLd([
    { name: 'Home', url: `${SITE.url}/` },
    { name: 'Products', url: `${SITE.url}/products` },
    ...(category && categorySlug
      ? [{ name: category, url: `${SITE.url}/category/${categorySlug}` }]
      : category
        ? [{ name: category }]
        : []),
    { name: product.name, url: `${SITE.url}${canonicalPath}` },
  ]);

  return (
    <main className="bg-white" data-testid={`product-price-${product.slug}`}>
      <JsonLd graph={[productLd, breadcrumbLd]} />

      <section className="product-breadcrumb-section bg-[#f8f8f8] py-4">
        <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
          <nav className="flex items-center gap-2 overflow-hidden whitespace-nowrap text-sm text-ink/45" aria-label="Breadcrumb">
            <Link href="/" className="shrink-0 text-primary hover:underline">Home</Link>
            <span aria-hidden className="shrink-0 text-ink/40">/</span>
            <Link href="/all-products" className="shrink-0 text-primary hover:underline">Products</Link>
            {category && categorySlug && (
              <>
                <span aria-hidden className="shrink-0 text-ink/40">/</span>
                <Link href={`/category/${categorySlug}`} className="shrink-0 text-primary hover:underline">{category}</Link>
              </>
            )}
            {category && !categorySlug && (
              <>
                <span aria-hidden className="shrink-0 text-ink/40">/</span>
                <span className="shrink-0 text-ink/70">{category}</span>
              </>
            )}
            <span aria-hidden className="shrink-0 text-ink/40">/</span>
            <span className="min-w-0 flex-1 truncate text-ink/80" title={product.name}>{product.name}</span>
          </nav>
        </div>
      </section>

      <section className="bg-white py-6 sm:py-8">
        <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
          <article className="border border-ink/10 bg-white">
            <div className="grid lg:grid-cols-[34%_minmax(0,1fr)] lg:gap-[10px]">
              <div className="relative flex h-[560px] items-center justify-center border-b border-ink/10 p-7 lg:border-b-0 lg:border-r">
                {discount !== null && (
                  <span className="absolute right-6 top-6 bg-[#ff2447] px-3 py-2 text-sm font-bold text-white">
                    -{discount}%
                  </span>
                )}
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image}
                    alt={product.primaryImage?.alternativeText || product.name}
                    fetchPriority="high"
                    decoding="async"
                    className="product-main-image max-h-[330px] w-full object-contain lg:max-h-[390px]"
                  />
                ) : (
                  <div className="flex h-[280px] w-full items-center justify-center bg-muted px-8 text-center font-display text-3xl font-bold text-ink/25">
                    {brand ?? 'NXT.Bargains'}
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="border-b border-ink/10 p-6 sm:p-8">
                  {brand ? <p className="product-title-brand">{brand}</p> : null}

                  <h1 className="product-title font-display font-bold leading-tight text-ink">
                    {product.name}
                  </h1>

                  {titleRating != null || (category && categorySlug) ? (
                    <div className="product-title-meta">
                      {titleRating != null ? (
                        <span className="product-title-rating">
                          <span aria-hidden="true" className="product-title-star">★</span>
                          <span className="product-title-rating-value">{titleRating.toFixed(1)}</span>
                          {titleRatingCount ? (
                            <span className="product-title-rating-count">
                              ({titleRatingCount.toLocaleString()} {titleRatingCount === 1 ? 'review' : 'reviews'})
                            </span>
                          ) : null}
                        </span>
                      ) : null}

                      {category && categorySlug ? (
                        <span className="product-title-type">
                          Type: <Link href={`/category/${categorySlug}`}>{category}</Link>
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="grid lg:grid-cols-2">
                  <div className="border-b border-ink/10 p-6 sm:p-8 lg:border-b-0 lg:border-r">
                    {shortCopy.bullets.length ? (
                      <ul className="product-description-bullets product-short-description">
                        {shortCopy.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="line-clamp-5 text-[14px] leading-7 text-ink/80">
                        {shortCopy.lead ?? summary}
                      </p>
                    )}

                    <div className="mt-8">
                      {best?.offer.originalPrice && numericValue(best.offer.originalPrice) !== numericValue(best.offer.price) && (
                        <span className="mr-2 text-lg text-ink/25 line-through">
                          {formatMoney(best.offer.originalPrice, best.offer.currency ?? 'USD')}
                        </span>
                      )}
                      <span className="font-display text-3xl font-bold text-ink">
                        {best ? formatMoney(best.offer.price ?? best.offer.originalPrice, best.offer.currency ?? 'USD') : 'Check price'}
                      </span>
                    </div>

                    <PriceAlertForm
                      productDocumentId={product.documentId}
                      currency={best?.offer.currency ?? 'USD'}
                      currentPrice={bestPrice ?? undefined}
                      buyHref={best ? buyUrl(best.offer, best.product) : undefined}
                    />

                    <p className="mt-5 text-sm text-ink/55">
                      Updated {updatedLabel}
                    </p>
                  </div>

                  <aside className="self-center p-5 sm:p-7">
                    {rows.length > 0 ? (
                      <div className="product-offer-list rounded-[10px] border border-[#e5e7eb] bg-white p-5">
                        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink/45">
                          Lowest price
                        </p>
                        <p className="mt-1.5 font-display text-[24px] font-bold leading-none tracking-tight text-ink">
                          {best
                            ? formatMoney(best.offer.price ?? best.offer.originalPrice, best.offer.currency ?? 'USD')
                            : 'Check price'}
                        </p>
                        <p className="mt-2 text-[13px] text-ink/55">
                          {best ? `at ${merchantName(best.offer)} · ` : ''}
                          {rows.length} retailer{rows.length === 1 ? '' : 's'} compared
                        </p>

                        {/* Extra rows stay behind the existing CSS-only toggle, so
                            the list opens at four as the reference does without
                            needing client JavaScript. */}
                        <input id={offerToggleId} type="checkbox" className="product-offer-toggle sr-only" />
                        <div className="mt-4 grid gap-2">
                          {rows.map((row, index) => (
                            <CompactOfferRow
                              key={row.offer.documentId ?? row.offer.id}
                              row={row}
                              className={index >= initialVisibleOfferCount ? 'product-offer-row-extra' : ''}
                            />
                          ))}
                        </div>

                        {hiddenOfferCount > 0 ? (
                          <label htmlFor={offerToggleId} className="mt-3 block cursor-pointer text-[12px] font-semibold text-[#c9636b]">
                            <span className="show-more-offers">Show all {rows.length} retailers +</span>
                            <span className="show-less-offers">Show fewer</span>
                          </label>
                        ) : null}

                        <p className="mt-4 text-[12px] text-ink/45">
                          Last price update was: {updatedAtLabel || updatedLabel}
                        </p>

                        {best ? (
                          <a
                            href={buyUrl(best.offer, best.product)}
                            target="_blank"
                            rel="nofollow sponsored noopener noreferrer"
                            className="mt-4 block rounded-[8px] bg-[#ffe000] px-4 py-3.5 text-center font-display text-[15px] font-bold text-ink transition hover:brightness-95"
                          >
                            Buy at {merchantName(best.offer)}
                          </a>
                        ) : null}

                        <p className="mt-4 text-center text-[12px] leading-5 text-ink/45">
                          We may earn a commission from links on this page, at no extra cost to you.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-[10px] border border-[#e5e7eb] bg-white p-6">
                        <h2 className="font-display text-xl font-bold text-ink">No merchant prices yet</h2>
                        <p className="mt-3 text-sm leading-6 text-ink/60">
                          This product is in the catalog, but it does not have active merchant offers attached yet.
                        </p>
                      </div>
                    )}
                  </aside>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      {highlights.length > 0 && (
        <section className="pt-2 pb-10" data-testid="product-highlights">
          <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
            <ProductHighlights highlights={highlights} />
          </div>
        </section>
      )}

      <section className="pb-6">
        <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
          <ProductInfoTabs
            product={product}
            productId={product.id}
            productName={product.name}
            summary={summary}
            description={product.description}
            specs={product.specs}
            reviews={reviews}
            productDocumentId={product.documentId ?? ''}
            retailers={couponPageData.retailers}
            brandGroups={couponPageData.brandGroups}
          />
        </div>
      </section>

      <section className="border-t border-ink/10 bg-white pb-12 pt-6" data-testid="price-history">
        <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
          <PriceHistorySection
            productName={product.name}
            rows={rows}
            snapshots={priceSnapshots}
            fallbackDate={product.updatedAt}
          />
        </div>
      </section>

      <section className="border-t border-ink/10 bg-white py-12" data-testid="product-reviews">
        <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
          {/* The section renders its own "Reviews" heading, as the reference
              layout does — a second one here would duplicate it. */}
          <ProductReviewsSection
            productName={product.name}
            productDocumentId={product.documentId ?? ''}
            reviews={reviews}
            aggregateRating={product.rating != null ? Number(product.rating) : null}
            aggregateCount={product.ratingCount != null ? Number(product.ratingCount) : null}
          />
        </div>
      </section>

      {rows.length > 0 && (
        <section className="border-t border-ink/10 bg-white py-12" data-testid="saved-price-comparison">
          <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[0.74rem] font-bold uppercase tracking-[0.18em] text-primary">Compare stores</p>
                <h2 className="mt-2 font-display text-[1.625rem] font-bold text-ink">Current prices across merchants</h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-ink/55">
                Saved merchant offers refresh daily when a confident match is found. Always confirm the final price, shipping, and condition at checkout.
              </p>
            </div>
            <SavedPriceComparison rows={rows} />
          </div>
        </section>
      )}

      {liveOffers.length >= 2 && (
        <section className="border-t border-ink/10 py-12" data-testid="live-prices">
          <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-2xl font-bold text-ink">Live prices across stores</h2>
              <p className="text-xs text-ink/45">
                <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
                </span>
                Real-time offers{liveCapturedAt ? ` · updated ${timeAgo(liveCapturedAt)}` : ''}
              </p>
            </div>
            <LivePrices offers={liveOffers} />
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="border-t border-ink/10 bg-white py-12" data-testid="related-products">
          <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
            <h2 className="font-display text-2xl font-bold text-ink">Related products</h2>
            <div className="mt-6">
              <ProductCarousel
                perView={6}
                items={related.slice(0, 10).map((p) => (
                  <CommerceProductCard key={p.id} product={p} showCompareButton={false} uniformImage />
                ))}
              />
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function ProductInfoTabs({
  product,
  productId,
  productName,
  summary,
  description,
  specs,
  reviews,
  productDocumentId,
  retailers,
  brandGroups,
}: {
  product: CommerceProduct;
  productId: number;
  productName: string;
  summary: string;
  description?: string | null;
  specs?: Record<string, unknown> | null;
  reviews: CommerceReview[];
  productDocumentId: string;
  retailers: Retailer[];
  brandGroups: CouponBrandGroup[];
}) {
  const gsmarenaSpecGroups = gsmarenaSpecificationGroups(specs);
  // Phones prefer the GSMArena spec tables, but only where that import actually
  // ran. Suppressing the generic list unconditionally left a phone sourced from
  // Google Shopping with an empty Specifications panel while it held dozens of
  // specs of its own, so the generic list stands in whenever GSMArena is absent.
  const useGsmarenaSpecsInSpecifications =
    productHasCategory(product, 'Smart Phones') && gsmarenaSpecGroups.length > 0;
  const heroImage = mediaUrl(product.primaryImage ?? null);
  const galleryImages = (product.gallery ?? [])
    .map((img) => mediaUrl(img))
    .filter((url): url is string => Boolean(url) && url !== heroImage);
  const detailBullets = descriptionBullets(description);
  const additionalInfoEntries = productAdditionalInfoEntries(product);
  const specEntries = useGsmarenaSpecsInSpecifications ? [] : productSpecificationEntries(specs);

  const accordionId = `product-info-accordion-${productId}`;

  return (
    <div className="product-info-section">
      <div className="product-info-layout">
        <div className="product-info-main">
          <div className="product-info-accordion bg-white" id={accordionId}>
            <details className="product-accordion-item" name={accordionId} open>
              <summary>Product details</summary>
              <div className="product-accordion-panel tab-panel-description">
                {detailBullets.length ? (
                  <ul className="product-description-bullets">
                    {detailBullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : description ? (
                  <div className="leading-7 text-ink/70">
                    <ProductDescription markdown={description} />
                  </div>
                ) : (
                  // Not `summary`: that falls back to the short description,
                  // which this panel must not repeat.
                  <p className="leading-7 text-ink/70">
                    {`Compare current prices for ${productName} across trusted merchants.`}
                  </p>
                )}

              </div>
            </details>

            <ProductSidePeek
              panels={[
                { id: 'specifications', label: 'Specifications', content: (
                  <>
                {/* Photography leads the panel, above the spec rows. */}
                <ProductGallery images={galleryImages} name={productName} />
                {useGsmarenaSpecsInSpecifications ? (
                  <GsmarenaSpecGroups groups={gsmarenaSpecGroups} />
                ) : specEntries.length ? (
                  <KeySpecsList entries={specEntries} className="mt-0" />
                ) : (
                  <div className="border border-ink/10 bg-paper p-6 leading-6 text-ink/60">
                    Product specifications have not been imported for this item yet.
                  </div>
                )}
                  </>
                ) },
                { id: 'additional-info', label: 'Additional Info', content: (
                  <>
                {additionalInfoEntries.length ? (
                  <dl className="grid overflow-hidden border-0">
                    {additionalInfoEntries.map((entry) => (
                      <div key={entry.label} className="grid gap-2 border-b border-ink/10 px-4 py-3 last:border-b-0 sm:grid-cols-[190px_minmax(0,1fr)]">
                        <dt className="font-bold text-ink/55">{entry.label}</dt>
                        {/* break-words: the restored Image URL row is a single
                            unbroken 200-character string with no spaces to wrap
                            at, and would otherwise run past the table. */}
                        <dd className="break-words text-ink">{entry.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <div className="border border-ink/10 bg-paper p-6 leading-6 text-ink/60">
                    Additional product information is not available for this item yet.
                  </div>
                )}
                  </>
                ) },
              ]}
            />
          </div>
        </div>

        <ProductStoreLinksSidebar retailers={retailers} brandGroups={brandGroups} />
      </div>
    </div>
  );
}

function ProductStoreLinksSidebar({
  retailers,
  brandGroups,
}: {
  retailers: Retailer[];
  brandGroups: CouponBrandGroup[];
}) {
  const focusedRetailers = couponRetailersForStoreLinks(retailers, brandGroups);
  const storeLinks = buildCouponStoreLinks(focusedRetailers);

  return (
    <aside className="product-info-sidebar">
      <p className="product-info-sidebar-eyebrow">Shop by store</p>
      <h3 className="product-info-sidebar-title">Popular Coupons</h3>
      {storeLinks.length > 0 ? (
        <>
          <div className="product-info-sidebar-stores">
            {storeLinks.slice(0, 6).map((store) => (
              <StoreLinkTile key={store.slug} store={store} newTab />
            ))}
          </div>
          <Link href="/stores" className="product-info-sidebar-directory" target="_blank" rel="noopener noreferrer">
            View More →
          </Link>
        </>
      ) : (
        <p className="product-info-sidebar-empty">Popular store coupon pages will appear here when available.</p>
      )}
    </aside>
  );
}

type PriceHistoryEntry = {
  price: number;
  currency: string;
  checkedAt: string;
  merchantName?: string;
};

/**
 * Imported product photography, shown at the end of the Product details panel.
 *
 * Files are served from our own media library rather than hotlinked, so they
 * survive Amazon rotating its CDN URLs. The featured image is filtered out by
 * the caller — it is already the main product shot at the top of the page.
 *
 * Reuses the carousel the related-products strip runs on rather than a second
 * implementation: three across, auto-advancing, pausing on hover.
 */
function ProductGallery({ images, name }: { images: string[]; name: string }) {
  if (!images.length) return null;

  return (
    <div className="mb-6">
      <ProductCarousel
        perView={3}
        interval={4000}
        items={images.map((src, index) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt={`${name} — image ${index + 2}`}
            loading="lazy"
            width={800}
            height={800}
            className="product-gallery-image"
          />
        ))}
      />
    </div>
  );
}

function KeySpecsList({ entries, className = 'mt-5' }: { entries: SpecificationEntry[]; className?: string }) {
  return (
    <dl className={`product-key-specs ${className}`}>
      {entries.map((entry) => (
        <div key={entry.label} className="product-key-specs-row">
          <dt>{entry.label}</dt>
          <dd>{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function GsmarenaSpecGroups({ groups }: { groups: SpecificationGroup[] }) {
  if (!groups.length) {
    return null;
  }

  return (
    <div className="grid gap-8">
      {groups.map((group) => (
        <section key={group.category}>
          <h6 className="mb-3 font-display text-base font-bold text-ink">{group.category}</h6>
          <KeySpecsList entries={group.specifications} />
        </section>
      ))}
    </div>
  );
}

type PriceHistoryPoint = PriceHistoryEntry & {
  dateKey: string;
  label: string;
};

function PriceHistorySection({
  productName,
  rows,
  snapshots,
  fallbackDate,
  embedded = false,
}: {
  productName: string;
  rows: CommerceOfferRow[];
  snapshots: CommercePriceSnapshot[];
  fallbackDate?: string;
  embedded?: boolean;
}) {
  const entries = collectPriceHistoryEntries(snapshots, rows, fallbackDate);
  const points = buildDailyLowestPricePoints(entries);
  const latestUpdates = [...points]
    .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())
    .slice(0, 3);

  const highest = highestPricePoint(points);
  const lowest = lowestPricePoint(points);
  const since = points[0]?.checkedAt;

  const content = (
    <div className={embedded ? 'p-6 sm:p-8' : 'p-5'}>
      <div className="border border-ink/10 bg-white">
        <div className="bg-muted px-5 py-4 text-center font-display text-base font-bold text-ink">
          Price history for {productName}
        </div>

        {points.length > 0 ? (
          <div className="grid lg:grid-cols-[190px_minmax(0,1fr)]">
            <aside className="bg-gradient-to-r from-paper to-white px-4 py-6 text-xs text-ink">
              <p className="font-bold">Latest updates:</p>
              <div className="mt-5 space-y-5">
                {latestUpdates.map((entry, index) => (
                  <p key={`${entry.checkedAt}:${entry.price}:${index}`}>
                    <span className="font-medium">{formatMoney(entry.price, entry.currency)}</span>
                    <span className="text-ink/70"> - {fmtDate(entry.checkedAt)}</span>
                  </p>
                ))}
              </div>
              {since && <p className="mt-8">Since: {fmtDate(since)}</p>}
            </aside>

            <div className="min-w-0 px-4 py-6 sm:px-6">
              <PriceHistoryChart points={points} />
              <div className="mt-6 space-y-3 text-base">
                {highest && (
                  <p>
                    <span className="font-medium text-red-600">Highest Price:</span>{' '}
                    <span className="text-ink">{formatMoney(highest.price, highest.currency)} - {fmtDate(highest.checkedAt)}</span>
                  </p>
                )}
                {lowest && (
                  <p>
                    <span className="font-medium text-green-600">Lowest Price:</span>{' '}
                    <span className="text-ink">{formatMoney(lowest.price, lowest.currency)} - {fmtDate(lowest.checkedAt)}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-10 text-center text-sm leading-6 text-ink/60">
            Price tracking will appear here after this product has at least one saved merchant price.
          </div>
        )}
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <div className="border border-ink/10 bg-white">
      <div className="flex min-h-11 items-center justify-between border-b border-ink/10 bg-white px-4">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-bold text-ink">Price History</h2>
        </div>
      </div>
      {content}
    </div>
  );
}

function PriceHistoryChart({ points }: { points: PriceHistoryPoint[] }) {
  const width = 980;
  const height = 280;
  const margin = { top: 30, right: 34, bottom: 50, left: 70 };
  const plotLeft = margin.left;
  const plotRight = width - margin.right;
  const plotTop = margin.top;
  const plotBottom = height - margin.bottom;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;
  const maxPrice = Math.max(...points.map((point) => point.price));
  const chartMax = niceChartMax(maxPrice);
  const yTicks = Array.from({ length: 5 }, (_, index) => chartMax - (chartMax / 4) * index);
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? plotRight : plotLeft + (plotWidth * index) / (points.length - 1);
    const y = plotTop + (1 - point.price / chartMax) * plotHeight;
    return { ...point, x, y };
  });
  const first = coords[0];
  const last = coords[coords.length - 1];
  const linePath =
    coords.length === 1
      ? `M ${plotLeft} ${first.y} L ${plotRight} ${first.y}`
      : coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath =
    coords.length === 1
      ? `M ${plotLeft} ${plotBottom} L ${plotLeft} ${first.y} L ${plotRight} ${first.y} L ${plotRight} ${plotBottom} Z`
      : `M ${plotLeft} ${plotBottom} ${coords
          .map((point, index) => `${index === 0 ? 'L' : 'L'} ${point.x} ${point.y}`)
          .join(' ')} L ${last.x} ${plotBottom} Z`;
  const xTicks = chartTickPoints(points);
  const tooltipWidth = 112;
  const tooltipHeight = 62;
  const tooltipX = clamp(last.x > width - 150 ? last.x - tooltipWidth - 12 : last.x + 12, plotLeft, width - tooltipWidth - 4);
  const tooltipY = clamp(last.y + 12, plotTop + 4, plotBottom - tooltipHeight + 2);
  const midlineY = plotTop + plotHeight / 2;

  return (
    <div className="overflow-x-auto rounded-xl bg-[#fbfcff] p-3 shadow-[inset_0_0_0_1px_rgba(13,27,42,0.06)]">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Product price history chart"
        className="h-auto min-w-[720px] w-full"
      >
        <defs>
          <linearGradient id="priceHistoryArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0072de" stopOpacity="0.24" />
            <stop offset="62%" stopColor="#9bcffc" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <filter id="priceHistoryGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width={width} height={height} rx="18" fill="#fbfcff" />
        <rect x={plotLeft} y={plotTop} width={plotWidth} height={plotHeight} rx="14" fill="#ffffff" />

        {yTicks.map((tick) => {
          const y = plotTop + (1 - tick / chartMax) * plotHeight;
          return (
            <g key={tick}>
              <line x1={plotLeft} x2={plotRight} y1={y} y2={y} stroke="#edf1f7" strokeWidth="1" strokeDasharray={tick === 0 ? undefined : '4 6'} />
              <text x={plotLeft - 14} y={y + 4} textAnchor="end" fontSize="11" fontWeight="600" fill="#667085">
                {formatAxisPrice(tick, points[0]?.currency ?? 'USD')}
              </text>
            </g>
          );
        })}

        <line x1={plotLeft} x2={plotRight} y1={midlineY} y2={midlineY} stroke="#d7e8fb" strokeWidth="1.5" strokeDasharray="2 7" />
        {xTicks.map((tick) => {
          const index = points.findIndex((point) => point.dateKey === tick.dateKey);
          const x = points.length === 1 ? plotRight : plotLeft + (plotWidth * Math.max(index, 0)) / Math.max(points.length - 1, 1);
          return <line key={`${tick.dateKey}-grid`} x1={x} x2={x} y1={plotTop} y2={plotBottom} stroke="#f3f6fa" strokeWidth="1" />;
        })}

        <path d={areaPath} fill="url(#priceHistoryArea)" />
        <path d={linePath} fill="none" stroke="#014fd3" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter="url(#priceHistoryGlow)" />
        {coords.map((point, index) => (
          <circle
            key={`${point.dateKey}:${index}`}
            cx={point.x}
            cy={point.y}
            r={index === coords.length - 1 ? 7 : 4.5}
            fill={index === coords.length - 1 ? '#014fd3' : '#ffffff'}
            stroke="#014fd3"
            strokeWidth={index === coords.length - 1 ? 3 : 2}
          />
        ))}
        <circle
          cx={last.x}
          cy={last.y}
          r="13"
          fill="none"
          stroke="#014fd3"
          strokeOpacity="0.14"
          strokeWidth="7"
        />

        {xTicks.map((tick) => {
          const index = points.findIndex((point) => point.dateKey === tick.dateKey);
          const x = points.length === 1 ? plotRight : plotLeft + (plotWidth * Math.max(index, 0)) / Math.max(points.length - 1, 1);
          const tickX = clamp(x, plotLeft + 34, plotRight - 34);
          return (
            <text key={tick.dateKey} x={tickX} y={plotBottom + 30} textAnchor="middle" fontSize="11" fontWeight="600" fill="#667085">
              {tick.dateKey}
            </text>
          );
        })}

        <rect
          x={tooltipX}
          y={tooltipY}
          width={tooltipWidth}
          height={tooltipHeight}
          rx="12"
          fill="#ffffff"
          stroke="#d7e8fb"
          strokeWidth="1.25"
        />
        <text x={tooltipX + 12} y={tooltipY + 24} fontSize="11" fontWeight="700" fill="#667085">
          Latest price
        </text>
        <text x={tooltipX + 12} y={tooltipY + 48} fontSize="15" fontWeight="800" fill="#014fd3">
          {formatPlainPrice(last.price, last.currency)}
        </text>
        <text x={plotRight} y={plotTop - 10} textAnchor="end" fontSize="11" fontWeight="700" fill="#667085">
          {last.dateKey}
        </text>
      </svg>
    </div>
  );
}

function CompactOfferRow({ row, className = '' }: { row: CommerceOfferRow; className?: string }) {
  const { offer, product } = row;
  // Curated SVG, then an uploaded Strapi logo, then the merchant's favicon —
  // the same marks the Coupons store tiles show. Merchants discovered via
  // Google Shopping sellers have no uploaded logo, so without the favicon leg
  // the price table shows a column of grey initials.
  const logo =
    couponMerchantLogo(merchantName(offer), offerUrl(offer))
    ?? mediaUrl(offer.merchant?.logo ?? null)
    ?? localMerchantLogo(merchantName(offer));
  const price = offer.price ?? offer.originalPrice;
  const unavailable = offer.availability === 'out_of_stock';

  return (
    <div className={`product-offer-row flex items-center gap-3 rounded-[8px] bg-[#f2f3f5] px-3 py-3 text-sm ${className}`}>
      {/* The reference sets the merchant mark straight on the grey rather than
          on a white chip, so the row reads as one block. */}
      <a
        href={buyUrl(offer, product)}
        target="_blank"
        rel="nofollow sponsored noopener noreferrer"
        aria-label={merchantName(offer)}
        className="flex h-8 w-[86px] shrink-0 items-center justify-start"
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={`${merchantName(offer)} logo`} className="max-h-7 max-w-full object-contain object-left" />
        ) : (
          <span className="truncate text-[11px] font-bold text-ink/60">{merchantName(offer)}</span>
        )}
      </a>

      <div className="ml-auto text-right">
        <p className="font-bold text-ink">{formatMoney(price, offer.currency ?? 'USD')}</p>
        {unavailable && <p className="mt-0.5 text-[10px] font-bold text-red-600">out of stock</p>}
      </div>

      <a
        href={buyUrl(offer, product)}
        target="_blank"
        rel="nofollow sponsored noopener noreferrer"
        aria-label={`See offer for ${offer.title || product.name} at ${merchantName(offer)}`}
        className="shrink-0 rounded-[6px] bg-[#118757] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#0d6f47]"
      >
        View
      </a>
    </div>
  );
}

function SavedPriceComparison({ rows }: { rows: CommerceOfferRow[] }) {
  const sorted = [...rows].sort((a, b) => {
    const priceA = offerPrice(a.offer) ?? Number.POSITIVE_INFINITY;
    const priceB = offerPrice(b.offer) ?? Number.POSITIVE_INFINITY;
    return priceA - priceB;
  });

  return (
    <div className="mt-7 overflow-hidden border border-ink/10 bg-white">
      <div className="hidden grid-cols-[minmax(0,1fr)_112px_118px_118px_120px] gap-x-4 border-b border-ink/10 bg-paper px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/50 lg:grid">
        <span>Store</span>
        <span className="text-center">Price</span>
        <span className="text-center">Condition</span>
        <span className="text-center">Updated</span>
        <span className="text-center">Action</span>
      </div>
      {sorted.map((row, index) => (
        <SavedPriceRow key={`${row.offer.documentId ?? row.offer.id}-${row.product.slug}`} row={row} best={index === 0} />
      ))}
    </div>
  );
}

function SavedPriceRow({ row, best }: { row: CommerceOfferRow; best: boolean }) {
  const { offer, product } = row;
  const logo =
    couponMerchantLogo(merchantName(offer), offerUrl(offer))
    ?? mediaUrl(offer.merchant?.logo ?? null)
    ?? localMerchantLogo(merchantName(offer));
  const price = offerPrice(offer);
  const updated = offer.lastCheckedAt || product.updatedAt;
  const unavailable = offer.availability === 'out_of_stock';

  return (
    <article className="grid gap-y-3 border-b border-ink/10 px-5 py-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_112px_118px_118px_120px] lg:items-center lg:gap-x-4">
      <div className="flex min-w-0 items-start gap-3">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={`${merchantName(offer)} logo`} className="mt-0.5 h-9 w-auto max-w-[120px] shrink-0 object-contain object-left" />
        ) : (
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center bg-muted text-sm font-bold text-ink/45">
            {merchantName(offer).slice(0, 1)}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-base font-bold text-ink">{merchantName(offer)}</h3>
            {best && <span className="bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Best price</span>}
            {unavailable && <span className="bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">Out of stock</span>}
          </div>
          <p className="mt-1 line-clamp-1 text-sm text-ink/55">{offer.title || product.name}</p>
        </div>
      </div>

      <div className="text-left lg:text-center">
        <p className="font-display text-[15px] font-semibold leading-none text-ink">{price !== null ? formatMoney(price, offer.currency ?? 'USD') : 'Check price'}</p>
        {offer.originalPrice && numericValue(offer.originalPrice) !== price && (
          <p className="text-xs text-ink/40 line-through">{formatMoney(offer.originalPrice, offer.currency ?? 'USD')}</p>
        )}
      </div>

      <div className="text-left text-[13px] capitalize text-ink/65 lg:text-center">
        {formatOfferCondition(offer.condition)}
      </div>

      <div className="text-left text-[13px] text-ink/55 lg:text-center">
        {updated ? timeAgo(updated) : 'Recently'}
      </div>

      <a
        href={buyUrl(offer, product)}
        target="_blank"
        rel="nofollow sponsored noopener noreferrer"
        className="inline-flex min-w-[108px] justify-center justify-self-start bg-primary px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white transition hover:bg-primary-emphasis lg:justify-self-center"
      >
        View offer
      </a>
    </article>
  );
}

function formatOfferCondition(value?: CommerceOffer['condition']) {
  if (!value || value === 'unknown') return 'Check store';
  return value.replace(/_/g, ' ');
}

type SpecificationEntry = {
  label: string;
  value: string;
};

type SpecificationGroup = {
  category: string;
  specifications: SpecificationEntry[];
};

const PRODUCT_IDENTIFIER_FIELDS = [
  { label: 'MPN', productKey: 'mpn', specKeys: ['MPN', 'mpn'] },
  { label: 'UPC', productKey: null, specKeys: ['UPC', 'upc', 'UPC Code', 'upcCode'] },
  { label: 'EAN', productKey: null, specKeys: ['EAN', 'ean', 'EAN Code', 'eanCode'] },
  { label: 'GTIN', productKey: 'gtin', specKeys: ['GTIN', 'gtin'] },
  { label: 'ePID', productKey: null, specKeys: ['ePID', 'EPID', 'epid'] },
  { label: 'ASIN', productKey: 'asin', specKeys: ['ASIN', 'asin', 'amazonAsin'] },
] as const;

const HIDDEN_SPEC_KEYS = new Set([
  // Leaked out of Amazon's A+ media blocks when product_information was
  // flattened. `alt` is worse than noise — on the Galaxy A17 it read
  // "Galaxy S26 Ultra" — and `gallery` is a list of image URLs, not a spec.
  'alt',
  'url',
  'gallery',
  'amazonAsin',
  'technicalSpecs',
  'features',
  'Features',
  'source',
  'confidence',
  'sourceUrl',
  'importedAt',
  'imageUrl',
  'sourceImageUrl',
  'imageSource',
  'imageImportedAt',
  'imageBackgroundRemoved',
  'imageBackgroundProvider',
  'imageBackgroundStorage',
  'imageBackgroundRemovedAt',
  'imageBackgroundError',
  'specSourceMerchant',
  'specSourceMerchantSlug',
  'specSourceUrl',
  'specImportedAt',
  'gsmarena',
  'gsmarenaImportedAt',
  'additionalInfo',
]);

/**
 * Look an identifier up on the product record first, then in `specs`.
 *
 * `productSpecificationEntries` deliberately strips identifier keys out of the
 * Specifications panel so they are not repeated as ordinary rows — but this
 * panel only read the product's own columns, so a UPC or ASIN that arrived
 * inside `specs` was hidden from both panels and effectively invisible.
 */
function identifierValue(
  product: CommerceProduct,
  field: (typeof PRODUCT_IDENTIFIER_FIELDS)[number],
): string | undefined {
  if (field.productKey) {
    const own = formatSpecValue((product as unknown as Record<string, unknown>)[field.productKey]);
    if (own) return own;
  }
  const specs = product.specs;
  if (!isPlainRecord(specs)) return undefined;
  const technicalSpecs = isPlainRecord(specs.technicalSpecs) ? specs.technicalSpecs : {};
  for (const source of [specs, technicalSpecs]) {
    for (const [key, value] of Object.entries(source)) {
      if (field.specKeys.some((specKey) => normalizeSpecKey(specKey) === normalizeSpecKey(key))) {
        const formatted = formatSpecValue(value);
        if (formatted) return formatted;
      }
    }
  }
  return undefined;
}

function productAdditionalInfoEntries(product: CommerceProduct): SpecificationEntry[] {
  const categories = product.categories?.map((category) => category.name).filter(Boolean).join(', ');
  const rating = formatSpecValue(product.rating);
  const ratingCount = product.ratingCount ? `${product.ratingCount}` : undefined;
  const entries: Array<{ label: string; value?: string }> = [
    { label: 'Brand', value: product.brandRef?.name || product.brand || undefined },
    { label: 'Category', value: categories || product.category || undefined },
    { label: 'SKU', value: product.sku || undefined },
    // ASIN, UPC, EAN, GTIN, MPN, ePID — whichever the product actually carries.
    ...PRODUCT_IDENTIFIER_FIELDS.map((field) => ({
      label: field.label,
      value: identifierValue(product, field),
    })),
    { label: 'Rating', value: rating && ratingCount ? `${rating} (${ratingCount} reviews)` : rating },
    { label: 'Status', value: product.status || undefined },
    { label: 'Last Updated', value: product.updatedAt ? fmtDate(product.updatedAt) : undefined },
  ];

  return entries.filter((entry): entry is SpecificationEntry => Boolean(entry.value));
}

/**
 * Headline attributes for the Highlights tiles above "About this item".
 *
 * Reads the same flat spec map the Specifications panel does, then keeps only
 * what survives being squeezed into a tile. Two things are dropped that a spec
 * row is happy to carry: long prose (`Cellular Protocols` runs to 180
 * characters, `descriptionSource` flattens into a paragraph of provenance) and
 * bare negatives — "Night Vision: No" is not a highlight.
 *
 * Well-known attributes lead in the fixed order below; anything left follows in
 * source order, which the importers already write roughly most-notable-first.
 */
const HIGHLIGHT_PRIORITY_LABELS = [
  'Brand',
  'Model',
  'Screen Size',
  'Display Size',
  'Display Resolution',
  'Resolution',
  'Display Type',
  'Refresh Rate',
  'Display Refresh Rate',
  'Operating System',
  'Processor',
  'Processor Brand',
  'Number of Cores',
  'RAM',
  'Installed Memory',
  'Storage Capacity',
  'Storage',
  'Drive Capacity',
  'Drive Type',
  'Battery Life',
  'Max Battery Life',
  'Battery Capacity',
  'Camera Resolution',
  'Rear Camera Resolution',
  'Front Camera Resolution',
  'Lens Type',
  'Field of View',
  'Night Vision',
  'Motion Sensing',
  'With Audio',
  'Connectivity',
  'Network Connectivity',
  'Wireless Connectivity',
  'With Wi-Fi',
  'Wi-Fi',
  'Wireless',
  'Bluetooth',
  'With GPS',
  'NFC',
  'Assistant Support',
  'Water Resistant',
  'Form Factor',
  'Material',
  'Color',
  'Weight',
];

/** Longest value that still fits a tile without wrapping past two lines. */
const HIGHLIGHT_MAX_VALUE_LENGTH = 48;
/** Two full rows of four on desktop. */
const HIGHLIGHT_LIMIT = 8;
/** Below this the row reads as a stray chip rather than a section. */
const HIGHLIGHT_MIN_COUNT = 3;
const HIGHLIGHT_NEGATIVE_VALUES = new Set(['no', 'none', 'n/a', 'na', 'not applicable', 'unknown', '-']);

/** A rating only counts when it is a real number above zero. */
function positiveRating(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function productHighlightEntries(product: CommerceProduct): SpecificationEntry[] {
  const specs = product.specs;
  if (!isPlainRecord(specs)) return [];

  const technicalSpecs = isPlainRecord(specs.technicalSpecs) ? specs.technicalSpecs : {};
  const source = Object.keys(technicalSpecs).length ? technicalSpecs : specs;

  const entries: SpecificationEntry[] = [];
  const seen = new Set<string>();

  for (const [key, value] of Object.entries(source)) {
    if (HIDDEN_SPEC_KEYS.has(key) || isProductIdentifierKey(key)) continue;
    const label = cleanHighlightLabel(key);
    const formatted = formatSpecValue(value);
    if (!label || !formatted) continue;
    if (formatted.length > HIGHLIGHT_MAX_VALUE_LENGTH) continue;
    if (HIGHLIGHT_NEGATIVE_VALUES.has(formatted.toLowerCase())) continue;
    const dedupeKey = normalizeSpecKey(label);
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    entries.push({ label, value: formatted });
  }

  // Brand is the one highlight worth synthesising: every product record carries
  // it, but only about three quarters of them repeat it inside `specs`.
  if (!seen.has('brand')) {
    const brand = product.brandRef?.name || product.brand;
    if (brand) entries.unshift({ label: 'Brand', value: brand });
  }

  const priority = new Map(HIGHLIGHT_PRIORITY_LABELS.map((label, index) => [normalizeSpecKey(label), index]));
  const rank = (entry: SpecificationEntry) =>
    priority.get(normalizeSpecKey(entry.label)) ?? HIGHLIGHT_PRIORITY_LABELS.length;

  const ordered = entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => rank(a.entry) - rank(b.entry) || a.index - b.index)
    .map(({ entry }) => entry);

  return ordered.length >= HIGHLIGHT_MIN_COUNT ? ordered.slice(0, HIGHLIGHT_LIMIT) : [];
}

/**
 * Bullets for the short description under the product title.
 *
 * 168 of the 169 products carrying a `shortDescription` store it as a markdown
 * "- " list of short, hedged, spec-derived lines, which is rendered verbatim.
 * The rare prose one is cut at sentence boundaries instead, and a single
 * sentence stays a paragraph rather than becoming a lone bullet.
 */
function shortDescriptionCopy(shortDescription?: string | null): { bullets: string[]; lead: string | null } {
  const short = (shortDescription ?? '').trim();
  if (!short) return { bullets: [], lead: null };

  const authored = markdownBulletLines(short);
  if (authored.length) return { bullets: authored, lead: null };

  const split = sentenceBullets(short);
  if (split.length > 1) return { bullets: split, lead: null };

  return { bullets: [], lead: short };
}

/**
 * Bullets for the Product details panel — the long `description` only.
 *
 * The short description belongs under the title and is deliberately not
 * repeated here. Structured markdown keeps its own shape and is handed to
 * `ProductDescription`; plain prose, which is 513 of the 515 descriptions on
 * this site, is cut into one bullet per sentence. Nothing is reworded.
 */
function descriptionBullets(description?: string | null): string[] {
  const long = (description ?? '').trim();
  if (!long) return [];
  if (long.includes('\n') || /^\s*[-*]\s+/m.test(long) || /^#{2,3}\s/m.test(long)) return [];
  const split = sentenceBullets(long);
  // A one-item list is just a paragraph wearing a bullet.
  return split.length > 1 ? split : [];
}

/** Lines of a markdown "- " list, or [] if the text is not one. */
function markdownBulletLines(text: string): string[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean);
  if (!lines.length || !lines.every((line) => /^[-*]\s+/.test(line))) return [];
  return lines.map((line) => line.replace(/^[-*]\s+/, '').trim()).filter(Boolean);
}

/** One entry per sentence, with decimals and abbreviations held together. */
function sentenceBullets(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const sentences: string[] = [];
  let current = '';
  // The lookahead requires the next sentence to start with a capital, a digit
  // or an opening quote, which is what keeps "16.4 feet" and "$5.99 each" in
  // one piece; ABBREVIATION_TAIL then re-joins the "e.g." / "Inc." cases the
  // lookahead cannot see.
  for (const part of normalized.split(/(?<=[.!?])\s+(?=["'\u201c(]?[A-Z0-9])/)) {
    current = current ? `${current} ${part}` : part;
    if (ABBREVIATION_TAIL.test(current)) continue;
    sentences.push(current);
    current = '';
  }
  if (current) sentences.push(current);
  return sentences.map((sentence) => sentence.trim()).filter(Boolean);
}

const ABBREVIATION_TAIL =
  /(?:\b(?:approx|e\.g|i\.e|vs|etc|Inc|Ltd|Co|Corp|Dept|Est|Fig|Vol|No|Dr|Mr|Mrs|Ms|Prof|St|Jr|Sr)|\b[A-Z])\.$/;

/** `Pan <wbr>/<wbr> Tilt` — some importers leave the source markup in the key. */
function cleanHighlightLabel(key: string) {
  return key.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function productHasCategory(product: CommerceProduct, categoryName: string) {
  const expected = categoryName.trim().toLowerCase();
  return product.categories?.some((category) => category.name.trim().toLowerCase() === expected || category.slug.trim().toLowerCase() === expected.replace(/\s+/g, '-')) ?? false;
}

function productSpecificationEntries(specs?: Record<string, unknown> | null): SpecificationEntry[] {
  if (!isPlainRecord(specs)) return [];

  const technicalSpecs = isPlainRecord(specs.technicalSpecs) ? specs.technicalSpecs : {};
  const source = Object.keys(technicalSpecs).length ? technicalSpecs : specs;

  return Object.entries(source)
    .filter(([key]) => !HIDDEN_SPEC_KEYS.has(key) && !isProductIdentifierKey(key) && !/^features?$/i.test(key))
    .map(([key, value]) => ({
      label: key,
      value: formatSpecValue(value),
    }))
    .filter((entry): entry is SpecificationEntry => Boolean(entry.value))
    .slice(0, 80);
}

/**
 * Spec rows that carry plumbing rather than a specification.
 *
 * "Image URL" was hidden here too, as the source photo the importer pulls from.
 * It is shown again on request: it is the only place the source of a product
 * photo is visible from the page, which matters while the image imports are
 * still being worked through.
 */
const HIDDEN_GSMARENA_LABELS = new Set(['image', 'source url', 'popularity (hits)']);

function gsmarenaSpecificationGroups(specs?: Record<string, unknown> | null): SpecificationGroup[] {
  if (!isPlainRecord(specs) || !isPlainRecord(specs.gsmarena)) return [];

  const rawGroups = Array.isArray(specs.gsmarena.specifications) ? specs.gsmarena.specifications : [];
  return rawGroups
    .map((group): SpecificationGroup | null => {
      if (!isPlainRecord(group)) return null;
      const category = formatSpecValue(group.category);
      const rawEntries = Array.isArray(group.specifications) ? group.specifications : [];
      const specifications = rawEntries
        .map((entry): SpecificationEntry | null => {
          if (!isPlainRecord(entry)) return null;
          const label = formatSpecValue(entry.name || entry.label);
          const value = formatSpecValue(entry.value);
          if (!label || HIDDEN_GSMARENA_LABELS.has(label.trim().toLowerCase())) return null;
          return label && value ? { label, value } : null;
        })
        .filter((entry): entry is SpecificationEntry => Boolean(entry));

      return category && specifications.length ? { category, specifications } : null;
    })
    .filter((group): group is SpecificationGroup => Boolean(group));
}

function isProductIdentifierKey(key: string) {
  return PRODUCT_IDENTIFIER_FIELDS.some((field) => field.specKeys.some((specKey) => normalizeSpecKey(specKey) === normalizeSpecKey(key)));
}

function normalizeSpecKey(key: string) {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function formatSpecValue(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim() || undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    const items = value.map((item) => formatSpecValue(item)).filter(Boolean);
    return items.length ? items.join(', ') : undefined;
  }
  if (isPlainRecord(value)) {
    const items = Object.entries(value)
      .map(([key, entryValue]) => {
        const formatted = formatSpecValue(entryValue);
        return formatted ? `${key}: ${formatted}` : undefined;
      })
      .filter(Boolean);
    return items.length ? items.join('; ') : undefined;
  }
  return undefined;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function collectPriceHistoryEntries(
  snapshots: CommercePriceSnapshot[],
  rows: CommerceOfferRow[],
  fallbackDate?: string,
): PriceHistoryEntry[] {
  const snapshotEntries = snapshots
    .map((snapshot): PriceHistoryEntry | null => {
      const price = numericValue(snapshot.price);
      if (price === null || !snapshot.checkedAt) return null;
      return {
        price,
        currency: snapshot.currency || 'USD',
        checkedAt: snapshot.checkedAt,
        merchantName: snapshot.merchant?.name,
      };
    })
    .filter((entry): entry is PriceHistoryEntry => Boolean(entry));

  if (snapshotEntries.length > 0) return snapshotEntries;

  return rows
    .map((row): PriceHistoryEntry | null => {
      const price = offerPrice(row.offer);
      if (price === null) return null;
      return {
        price,
        currency: row.offer.currency || 'USD',
        checkedAt: row.offer.lastCheckedAt || fallbackDate || new Date().toISOString(),
        merchantName: merchantName(row.offer),
      };
    })
    .filter((entry): entry is PriceHistoryEntry => Boolean(entry));
}

function buildDailyLowestPricePoints(entries: PriceHistoryEntry[]): PriceHistoryPoint[] {
  const byDate = new Map<string, PriceHistoryPoint>();

  for (const entry of entries) {
    const dateKey = isoDateKey(entry.checkedAt);
    if (!dateKey) continue;
    const current = byDate.get(dateKey);
    if (!current || entry.price < current.price) {
      byDate.set(dateKey, {
        ...entry,
        dateKey,
        label: fmtDate(entry.checkedAt),
      });
    }
  }

  return Array.from(byDate.values()).sort(
    (a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime(),
  );
}

function highestPricePoint(points: PriceHistoryPoint[]): PriceHistoryPoint | null {
  return points.reduce<PriceHistoryPoint | null>((highest, point) => {
    if (!highest || point.price > highest.price) return point;
    return highest;
  }, null);
}

function lowestPricePoint(points: PriceHistoryPoint[]): PriceHistoryPoint | null {
  return points.reduce<PriceHistoryPoint | null>((lowest, point) => {
    if (!lowest || point.price < lowest.price) return point;
    return lowest;
  }, null);
}

function chartTickPoints(points: PriceHistoryPoint[], maxTicks = 8): PriceHistoryPoint[] {
  if (points.length <= maxTicks) return points;
  const indexes = new Set<number>();
  for (let i = 0; i < maxTicks; i++) {
    indexes.add(Math.round((i * (points.length - 1)) / (maxTicks - 1)));
  }
  return Array.from(indexes)
    .sort((a, b) => a - b)
    .map((index) => points[index]);
}

function niceChartMax(maxPrice: number): number {
  if (!Number.isFinite(maxPrice) || maxPrice <= 0) return 100;
  return niceStep((maxPrice * 1.1) / 4) * 4;
}

function niceStep(value: number): number {
  const exponent = Math.floor(Math.log10(value));
  const magnitude = 10 ** exponent;
  const fraction = value / magnitude;
  const niceFraction =
    fraction <= 1 ? 1 : fraction <= 1.5 ? 1.5 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return niceFraction * magnitude;
}

function isoDateKey(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function formatAxisPrice(value: number, currency: string): string {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)} ${currency || 'USD'}`;
}

function formatPlainPrice(value: number, currency: string): string {
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)} ${currency || 'USD'}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function discountPercent(offer: CommerceOffer): number | null {
  const price = numericValue(offer.price);
  const originalPrice = numericValue(offer.originalPrice);
  if (price === null || originalPrice === null || originalPrice <= price) return null;
  return Math.max(1, Math.round((1 - price / originalPrice) * 100));
}

function offerJsonLd(offer: CommerceOffer) {
  const price = offerPrice(offer);
  return {
    '@type': 'Offer',
    url: offerUrl(offer),
    price: price ?? undefined,
    priceCurrency: offer.currency ?? 'USD',
    availability: schemaAvailability(offer.availability),
    itemCondition: schemaCondition(offer.condition),
    seller: offer.merchant?.name ? { '@type': 'Organization', name: merchantName(offer) } : undefined,
  };
}

function schemaAvailability(value?: CommerceOffer['availability']): string {
  switch (value) {
    case 'in_stock':
      return 'https://schema.org/InStock';
    case 'out_of_stock':
      return 'https://schema.org/OutOfStock';
    case 'preorder':
      return 'https://schema.org/PreOrder';
    default:
      return 'https://schema.org/LimitedAvailability';
  }
}

function schemaCondition(value?: CommerceOffer['condition']): string {
  switch (value) {
    case 'used':
      return 'https://schema.org/UsedCondition';
    case 'refurbished':
      return 'https://schema.org/RefurbishedCondition';
    default:
      return 'https://schema.org/NewCondition';
  }
}

/* Tiny markdown renderer for the product description format we generate
   (### headings + "- " bullets + paragraphs separated by blank lines).
   No external dependency; the format is constrained so a hand-rolled parser
   is shorter than wiring up `marked` and safer than dangerouslySetInnerHTML. */
function ProductDescription({ markdown }: { markdown: string }) {
  function inline(text: string): ReactNode {
    const parts: ReactNode[] = [];
    const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let key = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      const tok = m[0];
      if (tok.startsWith('**')) parts.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
      else parts.push(<em key={key++}>{tok.slice(1, -1)}</em>);
      last = m.index + tok.length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  }

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }
    if (line.startsWith('### ')) {
      blocks.push(
        <h3 key={key++} className="mt-6 pt-1 font-display text-base font-bold text-ink first:mt-0">
          {inline(line.slice(4).trim())}
        </h3>,
      );
      i += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(
        <h3 key={key++} className="mt-6 font-display text-lg font-bold text-ink first:mt-0">
          {inline(line.slice(3).trim())}
        </h3>,
      );
      i += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={key++} className="mt-3 list-disc space-y-1.5 pl-5">
          {items.map((it, idx) => <li key={idx}>{inline(it)}</li>)}
        </ul>,
      );
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length
      && lines[i].trim()
      && !lines[i].startsWith('### ')
      && !lines[i].startsWith('## ')
      && !/^\s*[-*]\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(<p key={key++} className="mt-3 first:mt-0">{inline(para.join(' '))}</p>);
  }
  return <div>{blocks}</div>;
}

type LiveOffer = {
  store: string;
  price: string | null;
  priceValue: number | null;
  originalPrice: string | null;
  onSale: boolean;
  condition: string | null;
  favicon: string | null;
  url: string;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3.6e6);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* Live multi-store price comparison rows (cheapest first; row #0 is "Best
   price"). Links are affiliate-wrapped at fetch time. */
function LivePrices({ offers }: { offers: LiveOffer[] }) {
  return (
    <div className="mt-6 overflow-hidden border border-ink/10">
      {offers.map((o, i) => (
        <a
          key={`${o.store}-${i}`}
          href={o.url}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          className="flex items-center gap-4 border-b border-ink/10 px-4 py-3 transition last:border-b-0 hover:bg-paper"
        >
          {o.favicon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={o.favicon} alt="" referrerPolicy="no-referrer" className="h-6 w-6 shrink-0 rounded object-contain" />
          ) : (
            <span className="h-6 w-6 shrink-0 rounded bg-muted" />
          )}
          <span className="min-w-0 flex-1">
            <span className="line-clamp-1 block font-display text-sm font-bold text-ink">{o.store}</span>
            {o.condition && o.condition.toLowerCase() !== 'new' ? (
              <span className="text-xs text-ink/45">{o.condition}</span>
            ) : null}
          </span>
          {i === 0 && (
            <span className="hidden rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 sm:inline">Best price</span>
          )}
          <span className="text-right">
            <span className="block font-display text-base font-bold text-ink">{o.price ?? '—'}</span>
            {o.onSale && o.originalPrice ? (
              <span className="text-xs text-ink/40 line-through">{o.originalPrice}</span>
            ) : null}
          </span>
          <span className="ml-2 hidden shrink-0 border border-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary sm:inline">View</span>
        </a>
      ))}
    </div>
  );
}
