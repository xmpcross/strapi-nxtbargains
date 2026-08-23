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
  listCommerceCategoriesForSite,
  listCommerceProducts,
} from '@/lib/strapi';
import { SITE } from '@/lib/site';
import { categoryDescriptionParagraphs, categoryDescriptionSummary } from '@/lib/category-descriptions';
import { pageOpenGraph } from '@/lib/seo';

export const revalidate = 300;
export const dynamicParams = true;

/** Six rows of three in the three-column grid. */
const PAGE_SIZE = 18;

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

  const description = categoryDescriptionSummary(category);
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
    // Same reason as /products: filters run over the fetched array, so a cap
    // here silently hides products from a large category.
    pageSize: 1000,
  }).catch(() => null);

  // Categories this storefront actually sells into, with counts, so the sidebar
  // can list them with the current one marked.
  const allCategories = await listCommerceCategoriesForSite().catch(() => []);

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
      {/*
        Header follows the nxtsmarthome.com.au category page: eyebrow, title,
        intro, and nothing else. The gradient banner, the tick list and the
        "At a glance" stat card that used to sit here pushed the catalogue
        itself below the fold, which is the one thing this page exists to show.
        The counts they carried are now in the results bar above the grid.
      */}
      <section className="bg-white pb-2 pt-8" data-testid="product-category-header">
        <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
          <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink/45" aria-label="Breadcrumb">
            <Link href="/" className="transition hover:text-ink">Home</Link>
            <span aria-hidden>/</span>
            <Link href="/category" className="transition hover:text-ink">Categories</Link>
            <span aria-hidden>/</span>
            <span className="text-ink/70">{category.name}</span>
          </nav>

          <p className="mt-6 text-xs font-bold uppercase tracking-[0.14em] text-[#118757]">
            {SITE.name} catalog
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">
            {category.name}
          </h1>
          <div className="category-intro mt-4 w-full sm:w-4/5">
            {categoryDescriptionParagraphs(category).map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      <section id="catalog" className="bg-white pb-12 pt-6">
        <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
            <ProductFiltersSidebar
              action={`/category/${category.slug}`}
              clearHref={`/category/${category.slug}`}
              filters={{ ...filters, category: category.slug }}
              filterOptions={filterOptions}
              /* The category list is the point of this sidebar — it is how a
                 reader moves between categories, with the current one marked. */
              categories={allCategories.map((item) => ({
                label: item.name, value: item.slug, count: item.productCount,
              }))}
              categoryMode="list"
              totalItems={allProducts.length}
              activeFilterCount={activeFilterCount}
              searchPlaceholder="Search this category"
            />

            <div>
              {/* Count on the left, dismissible chips for whatever is narrowing
                  the list on the right — the reference's results bar. */}
              <div className="catalog-results-bar">
                <p className="text-sm text-ink/55">
                  Showing <strong className="font-bold text-ink">{products.length}</strong> of{' '}
                  <strong className="font-bold text-ink">{total}</strong> products
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="catalog-chip">
                    Category: {category.name}
                    <Link href="/all-products" aria-label="Clear category filter">×</Link>
                  </span>
                  {activeFilterCount > 0 ? (
                    <Link href={`/category/${category.slug}`} className="text-xs font-semibold text-[#118757] hover:underline">
                      Reset filters
                    </Link>
                  ) : null}
                </div>
              </div>

              {products.length > 0 ? (
                <div className="product-category-grid grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
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


