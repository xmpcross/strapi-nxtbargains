import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import CommerceProductCard from '@/components/CommerceProductCard';
import ProductCatalogPagination from '@/components/ProductCatalogPagination';
import ProductFiltersSidebar from '@/components/ProductFiltersSidebar';
import {
  activeFiltersCount,
  applyProductFilters,
  buildFilterOptions,
  productFiltersFromSearchParams,
  productPageQuery,
  sortProducts,
} from '@/lib/product-filters';
import {
  getCommerceCategory,
  listCommerceCategories,
  listCommerceProducts,
} from '@/lib/strapi';
import { SITE } from '@/lib/site';
import { pageOpenGraph } from '@/lib/seo';

export const revalidate = 300;
export const dynamicParams = true;

const PAGE_SIZE = 12;

type Params = { slug: string };
type SearchParams = {
  page?: string;
  q?: string;
  brand?: string;
  merchant?: string;
  availability?: string;
  condition?: string;
  price?: string;
  sort?: string;
};

export async function generateStaticParams() {
  const categories = await listCommerceCategories().catch(() => []);
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCommerceCategory(slug).catch(() => null);
  if (!category) return { title: 'Product category' };

  const description = categoryPageDescription(category);
  const path = `/category/${category.slug}`;

  return {
    title: `${category.name} Products`,
    description,
    alternates: { canonical: path },
    ...pageOpenGraph({
      title: `${category.name} Products`,
      description,
      path,
    }),
  };
}

export default async function ProductCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { page: pageRaw } = sp;
  const page = Math.max(1, Number(pageRaw) || 1);
  const filters = productFiltersFromSearchParams(sp);

  const category = await getCommerceCategory(slug).catch(() => null);
  if (!category) notFound();

  const res = await listCommerceProducts({
    category: category.slug,
    page: 1,
    pageSize: 240,
  }).catch(() => null);

  const allProducts = res?.data ?? [];
  const filterOptions = buildFilterOptions(allProducts);
  const filteredProducts = sortProducts(applyProductFilters(allProducts, filters), filters.sort);
  const total = filteredProducts.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const products = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeFilterCount = activeFiltersCount(filters);

  if (page > pageCount && total > 0) notFound();

  return (
    <main data-testid={`product-category-${category.slug}`}>
      <section
        className="relative overflow-hidden border-b border-ink/10 bg-[#1d252c] text-white"
        data-testid="product-category-header"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              'radial-gradient(at 80% 20%, rgba(0,70,190,0.22) 0%, transparent 50%), radial-gradient(at 15% 85%, rgba(255,224,0,0.12) 0%, transparent 50%)',
          }}
        />
        <div className="relative mx-auto max-w-[1366px] px-4 py-10 sm:px-6 sm:py-14">
          <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/45" aria-label="Breadcrumb">
            <Link href="/" className="transition hover:text-white">Home</Link>
            <span aria-hidden>/</span>
            <Link href="/category" className="transition hover:text-white">Categories</Link>
            <span aria-hidden>/</span>
            <span className="text-[#ffe000]">{category.name}</span>
          </nav>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ffe000]">{SITE.name} catalog</p>
              <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
                {category.name}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
                {categoryPageDescription(category)}
              </p>

              <ul className="mt-6 max-w-2xl space-y-3 text-sm leading-6 text-white/75 sm:text-base">
                <li className="flex gap-3">
                  <span className="mt-0.5 shrink-0 text-[#ffe000]" aria-hidden>✓</span>
                  <span>Side-by-side prices from Amazon, eBay, Walmart, Newegg, and Best Buy.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 shrink-0 text-[#ffe000]" aria-hidden>✓</span>
                  <span>Filter by brand, store, availability, condition, and price range.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 shrink-0 text-[#ffe000]" aria-hidden>✓</span>
                  <span>See the lowest current offer before you leave {SITE.name}.</span>
                </li>
              </ul>

              <div className="mt-10 flex flex-wrap gap-3">
                <a href="#catalog" className="inline-flex bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary-emphasis">
                  Browse {category.name.toLowerCase()}
                </a>
                <Link href="/products" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white/80 transition hover:border-white/40 hover:text-white">
                  All products
                </Link>
                <Link href="/best-deals" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white/75 transition hover:border-white/40 hover:text-white">
                  Best deals
                </Link>
              </div>
            </div>

            <aside className="border border-white/15 bg-white/5 p-5 backdrop-blur sm:p-6" aria-label={`${category.name} statistics`}>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ffe000]">At a glance</p>
              <p className="mt-3 text-sm leading-6 text-white/70">
                A live snapshot of {category.name} on {SITE.name} — compare prices and current merchant
                offers side by side before you buy.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-5">
                <Stat label="Products" value={String(allProducts.length)} />
                <Stat label="Showing" value={String(total)} />
                <Stat label="Brands" value={String(filterOptions.brands.length)} />
                <Stat label="Stores" value={String(filterOptions.merchants.length)} />
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section id="catalog" className="bg-[#f0f2f4] pb-12 pt-10 sm:pb-16 sm:pt-12">
        <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(220px,25%)_minmax(0,75%)] lg:items-start">
            <ProductFiltersSidebar
              action={`/category/${category.slug}`}
              clearHref={`/category/${category.slug}`}
              filters={filters}
              filterOptions={filterOptions}
              totalItems={allProducts.length}
              activeFilterCount={activeFilterCount}
              searchPlaceholder="Search this category"
            />

            <div>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Product category</p>
                  <h4 className="mt-2 font-display font-bold text-ink" style={{ fontSize: '1.5rem' }}>
                    {total} {category.name} product{total === 1 ? '' : 's'}
                  </h4>
                </div>
                <Link
                  href="/products"
                  className="border border-ink/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-ink/60 transition hover:border-primary hover:text-primary"
                >
                  All products
                </Link>
              </div>

              {products.length > 0 ? (
                <div className="product-category-grid mt-8 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
                  {products.map((product) => (
                    <CommerceProductCard
                      key={product.id}
                      product={product}
                      showCompareButton={false}
                      uniformImage
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-8 border border-ink/10 bg-paper p-8">
                  <h3 className="font-display text-2xl font-bold text-ink">No products found</h3>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-ink/60">
                    This category will populate after products are assigned to it in Strapi.
                  </p>
                </div>
              )}

              <ProductCatalogPagination
                page={page}
                pageCount={pageCount}
                pageHref={(targetPage) =>
                  `/category/${category.slug}${productPageQuery(filters, targetPage)}`
                }
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-white/55">{label}</p>
    </div>
  );
}

function categoryPageDescription(category: { name: string; slug: string; description?: string | null }) {
  if (category.description) return category.description;

  if (category.slug === 'smart-phones' || category.name.trim().toLowerCase() === 'smart phones') {
    return 'Compare smart phones across leading merchants, review current prices, check availability, and explore detailed product information before choosing your next device. Browse popular iPhone, Samsung Galaxy, Google Pixel, and other unlocked smartphone deals in one place.';
  }

  return `Compare ${category.name.toLowerCase()} prices and current merchant offers.`;
}
