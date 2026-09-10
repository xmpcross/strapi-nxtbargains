import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { listStoreProducts } from '@/lib/strapi';
import { bestOffer, collectOfferRows, offerPrice, productImageUrl } from '@/lib/commerce';
import { productCanonicalPath } from '@/lib/product-url';
import { clampDescription } from '@/lib/format';
import { breadcrumbJsonLd, itemListJsonLd } from '@/lib/jsonld';
import { SITE } from '@/lib/site';
import CommerceProductCard from '@/components/CommerceProductCard';
import StoreFilter, { type StoreFilterItem } from '@/components/StoreFilter';

export const revalidate = 120;

/**
 * A store page needs enough products to be worth browsing.
 *
 * 364 of these pages exist, one per merchant that has ever carried an offer,
 * and 230 of them hold a single product — including marketplace-seller
 * artifacts like `walmart-acer` and `ebay-yakovgood1`, which are not retailers
 * at all. Every one was index,follow.
 *
 * The page's promise is "browse this retailer's products"; with one or two
 * there is nothing to browse, and the page restates a product page that
 * already exists. Three is the floor at which the listing does something the
 * product page does not.
 *
 * A threshold rather than a fixed allowlist, so a merchant that grows past it
 * becomes indexable on its own and one that shrinks drops out — the same
 * self-healing shape as the coupon-store and single-merchant-product rules.
 */
const MIN_PRODUCTS_TO_INDEX = 3;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { store, products } = await listStoreProducts(slug).catch(() => ({ store: null, products: [] }));
  const name = store?.name ?? 'Store';
  return {
    title: `${name} — Prices & Products`,
    description: clampDescription(`Products available at ${name}, price-compared across marketplaces on ${SITE.name}.`),
    alternates: { canonical: `/stores/${slug}` },
    // follow is kept so the product links on a thin store page still pass through.
    ...(products.length >= MIN_PRODUCTS_TO_INDEX ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { store, products } = await listStoreProducts(slug).catch(() => ({ store: null, products: [] }));
  if (!store) notFound();

  const filterItems: StoreFilterItem[] = products.map((p) => {
    const best = bestOffer(collectOfferRows(p));
    const categories = (p.categories?.map((c) => c.name).filter(Boolean) as string[]) ?? [];
    if (!categories.length && p.category) categories.push(p.category);
    return {
      key: String(p.id),
      card: <CommerceProductCard product={p} />,
      name: p.name,
      categories,
      brand: p.brandRef?.name ?? p.brand ?? null,
      price: best ? offerPrice(best.offer) : null,
    };
  });

  // Listing structured data — breadcrumb trail + an ItemList of the store's products.
  const breadcrumbLd = breadcrumbJsonLd([
    { name: 'Home', url: '/' },
    { name: 'Stores', url: '/stores' },
    { name: store.name, url: `/stores/${store.slug}` },
  ]);
  const storeListItems = products
    .filter((p) => p.slug)
    .map((p, index) => ({
      name: p.name,
      url: productCanonicalPath(p),
      image: productImageUrl(p) ?? undefined,
      position: index + 1,
    }));
  const itemListLd = storeListItems.length > 0 ? itemListJsonLd(storeListItems) : null;

  return (
    <main className="bg-white" data-testid={`store-${store.slug}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {itemListLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
        />
      ) : null}
      <section className="border-b border-ink/10 bg-paper">
        <div className="mx-auto max-w-[1366px] px-4 py-8 sm:px-6">
          <Link href="/stores" className="text-xs font-bold uppercase tracking-wider text-primary">← All stores</Link>
          <div className="mt-4 flex flex-wrap items-center gap-5">
            {store.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logo} alt={store.name} referrerPolicy="no-referrer" className="h-16 w-16 rounded-lg bg-white object-contain p-2" />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-lg border border-ink/10 bg-muted font-display text-2xl font-bold text-ink/40">{store.name[0]}</span>
            )}
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-bold text-ink">{store.name}</h1>
              <p className="mt-1 text-sm text-ink/55">
                {products.length} product{products.length === 1 ? '' : 's'} compared
                {store.websiteUrl ? (
                  <>
                    {' · '}
                    <a href={store.websiteUrl} target="_blank" rel="nofollow noopener noreferrer" className="text-primary hover:underline">visit site ↗</a>
                  </>
                ) : null}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1366px] px-4 py-10 sm:px-6">
        {products.length === 0 ? (
          <p className="text-ink/60">No products from this store yet.</p>
        ) : (
          <StoreFilter items={filterItems} />
        )}
      </div>
    </main>
  );
}
