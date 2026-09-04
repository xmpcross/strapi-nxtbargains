import Link from 'next/link';
import type { Metadata } from 'next';
import CommerceProductCard from '@/components/CommerceProductCard';
import ProductCatalogPagination from '@/components/ProductCatalogPagination';
import ProductFiltersSidebar from '@/components/ProductFiltersSidebar';
import { SITE } from '@/lib/site';
import {
  PRICE_FILTERS,
  SORT_OPTIONS,
  activeFiltersCount,
  applyProductFilters,
  buildFilterOptions,
  productFiltersFromSearchParams,
  productPageQuery,
  sortProducts,
  type ProductFilters,
} from '@/lib/product-filters';
import { listCommerceCategories, listCommerceProducts } from '@/lib/strapi';
import { productCanonicalPath } from '@/lib/product-url';
import { productImageUrl } from '@/lib/commerce';
import { breadcrumbJsonLd, collectionPageJsonLd, itemListJsonLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'All Products — Compare Prices Across Marketplaces',
  description:
    'Browse every product on NXT.Bargains and compare live prices from Amazon, eBay, Walmart, and more. Filter by category, brand, store, and price to find the best deal before you buy.',
  alternates: { canonical: '/all-products' },
};

const PAGE_SIZE = 24;
/*
 * Filtering, sorting and faceting all run over the fetched array, so this has to
 * cover the whole catalogue — at 240 it silently hid two thirds of the products
 * and reported the fetch size as the catalogue total. Strapi imposes no ceiling
 * of its own, so the guard is the assertion below rather than this number.
 */
const CATALOG_PAGE_SIZE = 1000;

type SearchParams = {
  q?: string;
  page?: string;
  category?: string;
  brand?: string;
  merchant?: string;
  availability?: string;
  condition?: string;
  price?: string;
  sort?: string;
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  /*
   * The catalogue defaults to a shuffled order rather than newest-first, so the
   * same handful of recently-updated products do not permanently own the first
   * page. Any explicit ?sort= still wins.
   */
  const requestedFilters = productFiltersFromSearchParams(sp);
  const filters = { ...requestedFilters, sort: requestedFilters.sort || 'random' };

  const [res, categories] = await Promise.all([
    listCommerceProducts({ page: 1, pageSize: CATALOG_PAGE_SIZE }).catch(() => null),
    listCommerceCategories().catch(() => []),
  ]);

  const allProducts = res?.data ?? [];
  /*
   * The real catalogue size, straight from Strapi. Reporting allProducts.length
   * instead made the page claim exactly CATALOG_PAGE_SIZE products once the
   * catalogue outgrew it — a number that looked plausible and was wrong.
   */
  const catalogTotal = res?.meta?.pagination?.total ?? allProducts.length;
  if (catalogTotal > allProducts.length) {
    console.warn(
      `[/products] catalogue has ${catalogTotal} products but only ${allProducts.length} were fetched; ` +
      'raise CATALOG_PAGE_SIZE or move filtering server-side.',
    );
  }
  const filterOptions = buildFilterOptions(allProducts);
  const categoryOptions = categories.map((category) => ({
    label: category.name,
    value: category.slug,
  }));
  const filteredProducts = sortProducts(applyProductFilters(allProducts, filters), filters.sort);
  const total = filteredProducts.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const products = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeFilterCount = activeFiltersCount(filters);
  const activeCategory = categories.find((category) => category.slug === filters.category);
  const filterChips = buildActiveFilterChips(filters, categoryOptions, filterOptions);
  const featuredCategories = categoryOptions.slice(0, 8);

  const pageJsonLd = collectionPageJsonLd({
    name: 'All Products',
    url: `${SITE.url}/products`,
    description: metadata.description,
    numberOfItems: total,
  });

  const breadcrumbLd = breadcrumbJsonLd([
    { name: 'Home', url: SITE.url },
    { name: 'Products', url: `${SITE.url}/products` },
  ]);
  const productListItems = products
    .filter((product) => product.slug)
    .map((product, index) => ({
      name: product.name,
      url: productCanonicalPath(product),
      image: productImageUrl(product) ?? undefined,
      position: (page - 1) * PAGE_SIZE + index + 1,
    }));
  const itemListLd = productListItems.length > 0 ? itemListJsonLd(productListItems) : null;

  return (
    <main data-testid="products-page">
      <JsonLd graph={[pageJsonLd, breadcrumbLd, itemListLd]} />

      <ProductsHero
        totalProducts={catalogTotal}
        showing={total}
        categoryCount={categories.length}
        storeCount={filterOptions.merchants.length}
        activeCategory={activeCategory?.name}
      />

      {featuredCategories.length > 0 ? (
        <section className="border-b border-ink/10 bg-white py-5" data-testid="products-category-strip">
          <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-bold uppercase tracking-[0.14em] text-ink/45">Browse:</span>
              {featuredCategories.map((category) => (
                <Link
                  key={category.value}
                  href={`/category/${category.value}`}
                  className={`inline-flex border px-3 py-1.5 text-xs font-bold transition ${
                    filters.category === category.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-ink/10 bg-[#f0f2f4] text-ink/65 hover:border-primary hover:text-primary'
                  }`}
                >
                  {category.label}
                </Link>
              ))}
              <Link
                href="/category"
                className="inline-flex border border-ink/10 bg-white px-3 py-1.5 text-xs font-bold text-ink/55 transition hover:border-primary hover:text-primary"
              >
                All categories →
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="bg-white py-8" id="catalog">
        <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
            <ProductFiltersSidebar
              action="/all-products"
              clearHref="/all-products"
              filters={filters}
              filterOptions={filterOptions}
              categories={categoryOptions}
              categoryMode="list"
              totalItems={catalogTotal}
              activeFilterCount={activeFilterCount}
              searchPlaceholder="Search Apple iPhone 16..."
              className="products-filters-panel"
            />

            <div>
              {/* Results bar in the reference's shape: the count on the left,
                  dismissible chips for the active filters on the right. The
                  boxed heading and the Best deals / Price drops buttons that
                  used to sit here are in the hero and the nav already. */}
              <div className="catalog-results-bar">
                <p className="text-sm text-ink/55">
                  Showing <strong className="font-bold text-ink">{products.length}</strong> of{' '}
                  <strong className="font-bold text-ink">{total}</strong> products
                  {filters.q ? <> for &ldquo;<strong className="font-bold text-ink">{filters.q}</strong>&rdquo;</> : null}
                  {pageCount > 1 ? <span className="text-ink/40"> · page {page} of {pageCount}</span> : null}
                </p>

                {filterChips.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2" data-testid="products-active-filters">
                    {filterChips.map((chip) => (
                      <span key={chip.key} className="catalog-chip">
                        {chip.label}
                        <Link href={chip.href} aria-label={`Remove ${chip.label}`}>×</Link>
                      </span>
                    ))}
                    <Link href="/all-products" className="text-xs font-semibold text-[#118757] hover:underline">
                      Clear all
                    </Link>
                  </div>
                ) : null}
              </div>

              {products.length > 0 ? (
                <div className="products-catalog-grid grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {products.map((product) => (
                    <CommerceProductCard
                      key={product.id}
                      product={product}
                      showCompareButton={false}
                      catalogLayout
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-6 border border-ink/10 bg-white p-8 sm:p-10">
                  <h3 className="font-display text-2xl font-bold text-ink">No products found</h3>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-ink/60">
                    Try adjusting your filters, choosing another category, or searching with a different keyword.
                  </p>
                  <Link
                    href="/all-products"
                    className="mt-5 inline-flex bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary-emphasis"
                  >
                    Reset filters
                  </Link>
                </div>
              )}

              <ProductCatalogPagination
                page={page}
                pageCount={pageCount}
                pageHref={(targetPage) => `/products${productPageQuery(filters, targetPage)}`}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-ink/10 bg-white py-10">
        <div className="mx-auto grid max-w-[1366px] gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <BrowseCard href="/best-deals" title="Best deals" subtitle="Highest discounts right now" />
          <BrowseCard href="/price-drops" title="Price drops" subtitle="Recently tracked price movements" />
          <BrowseCard href="/coupons" title="Coupons" subtitle="Promo codes and store deals" />
          <BrowseCard href="/deals" title="Buying guides" subtitle="Editorial deals and roundups" />
        </div>
      </section>
    </main>
  );
}

function ProductsHero({
  totalProducts,
  categoryCount,
  storeCount,
  activeCategory,
}: {
  totalProducts: number;
  showing: number;
  categoryCount: number;
  storeCount: number;
  activeCategory?: string;
}) {
  return (
    <section className="bg-white pb-2 pt-8" data-testid="products-hero">
      <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
        <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink/45" aria-label="Breadcrumb">
          <Link href="/" className="transition hover:text-ink">Home</Link>
          <span aria-hidden>/</span>
          <span className="text-ink/70">All products</span>
        </nav>

        <p className="mt-6 text-xs font-bold uppercase tracking-[0.14em] text-[#118757]">
          {SITE.name} catalog
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">
          {activeCategory ?? 'Every product. Every marketplace. One place to compare.'}
        </h1>
        {/* The counts the old "At a glance" card carried, folded into the intro
            rather than given a panel of their own — the catalogue is what this
            page is for, and the panel pushed it below the fold. */}
        <p className="mt-4 w-full text-sm leading-relaxed text-ink/60 sm:w-4/5 sm:text-base">
          Search {totalProducts.toLocaleString()} products across {categoryCount} categories and{' '}
          {storeCount} stores. Filter by category, brand, store or price, and compare current offers
          from major retailers side by side.
        </p>
      </div>
    </section>
  );
}

function Stat({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div>
      <p className={`font-display font-bold text-ink ${compact ? 'text-2xl' : 'text-3xl'}`}>{value}</p>
      <p className="mt-1 text-sm text-ink/55">{label}</p>
    </div>
  );
}

function BrowseCard({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Link
      href={href}
      className="group border border-ink/10 bg-[#f0f2f4] p-5 transition hover:-translate-y-0.5 hover:border-primary"
    >
      <h3 className="font-display text-lg font-bold text-ink transition group-hover:text-primary">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink/55">{subtitle}</p>
    </Link>
  );
}

function buildActiveFilterChips(
  filters: ProductFilters,
  categories: Array<{ label: string; value: string }>,
  filterOptions: ReturnType<typeof buildFilterOptions>,
) {
  const chips: Array<{ key: string; label: string; href: string }> = [];

  if (filters.q) {
    chips.push({
      key: 'q',
      label: `Search: ${filters.q}`,
      href: `/products${productPageQuery({ ...filters, q: '' })}`,
    });
  }
  if (filters.category) {
    const category = categories.find((item) => item.value === filters.category);
    chips.push({
      key: 'category',
      label: `Category: ${category?.label ?? filters.category}`,
      href: `/products${productPageQuery({ ...filters, category: '' })}`,
    });
  }
  if (filters.brand) {
    chips.push({
      key: 'brand',
      label: `Brand: ${filters.brand}`,
      href: `/products${productPageQuery({ ...filters, brand: '' })}`,
    });
  }
  if (filters.merchant) {
    const merchant = filterOptions.merchants.find((item) => item.value === filters.merchant);
    chips.push({
      key: 'merchant',
      label: `Store: ${merchant?.label ?? filters.merchant}`,
      href: `/products${productPageQuery({ ...filters, merchant: '' })}`,
    });
  }
  if (filters.availability) {
    chips.push({
      key: 'availability',
      label: `Availability: ${filters.availability.replace(/_/g, ' ')}`,
      href: `/products${productPageQuery({ ...filters, availability: '' })}`,
    });
  }
  if (filters.condition) {
    chips.push({
      key: 'condition',
      label: `Condition: ${filters.condition.replace(/_/g, ' ')}`,
      href: `/products${productPageQuery({ ...filters, condition: '' })}`,
    });
  }
  if (filters.price) {
    const price = PRICE_FILTERS.find((item) => item.value === filters.price);
    chips.push({
      key: 'price',
      label: `Price: ${price?.label ?? filters.price}`,
      href: `/products${productPageQuery({ ...filters, price: '' })}`,
    });
  }
  if (filters.sort) {
    const sort = SORT_OPTIONS.find((item) => item.value === filters.sort);
    chips.push({
      key: 'sort',
      label: `Sort: ${sort?.label ?? filters.sort}`,
      href: `/products${productPageQuery({ ...filters, sort: '' })}`,
    });
  }

  return chips;
}
