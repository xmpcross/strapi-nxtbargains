import Link from 'next/link';
import {
  PRICE_FILTERS,
  SORT_OPTIONS,
  productPageQuery,
  type FilterOption,
  type ProductFilters,
} from '@/lib/product-filters';

/**
 * Product filter sidebar, following the layout of the nxtsmarthome.com.au
 * product grid: a header with a reset, a keyword box, a sort selector, then
 * counted lists for categories, price bands and stores.
 *
 * The layout is taken from that reference; the colours and typography stay on
 * this site's own tokens (`ink`, `primary`, `paper`) so the sidebar still looks
 * like nxt.bargains rather than a transplant.
 *
 * The reference drives its filters from client-side React state. This one stays
 * link- and form-driven on purpose: every filter is a real URL, so a filtered
 * view can be shared and indexed, and the sidebar keeps working without
 * JavaScript. Rows are therefore <Link>s that look like the reference's buttons.
 *
 * The reference also nests subcategories under each category. This storefront's
 * commerce taxonomy is flat, so that level is simply absent rather than faked
 * with an empty disclosure arrow.
 */

type Props = {
  action: string;
  clearHref: string;
  filters: ProductFilters;
  filterOptions: {
    brands: FilterOption[];
    merchants: FilterOption[];
    availabilities: FilterOption[];
    conditions: FilterOption[];
  };
  categories?: FilterOption[];
  categoryMode?: 'select' | 'list';
  totalItems: number;
  activeFilterCount: number;
  searchPlaceholder?: string;
  className?: string;
};

const SECTION_LABEL = 'mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-ink/55';

/** One counted row. Selected rows invert, as the reference's buttons do. */
function FilterRow({
  href,
  label,
  count,
  active,
  tone = 'ink',
}: {
  href: string;
  label: string;
  count?: number;
  active: boolean;
  tone?: 'ink' | 'primary';
}) {
  const activeClass = tone === 'primary'
    ? 'bg-primary font-bold text-white'
    : 'bg-ink font-bold text-white';
  return (
    <Link
      href={href}
      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-sm transition ${
        active ? activeClass : 'font-medium text-ink/75 hover:bg-primary/5 hover:text-primary'
      }`}
    >
      <span className="truncate">{label}</span>
      {count !== undefined ? (
        <span className={`shrink-0 text-[10px] ${active ? 'opacity-80' : 'text-ink/45'}`}>({count})</span>
      ) : null}
    </Link>
  );
}

function FilterSelect({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: keyof ProductFilters;
  value: string;
  options: FilterOption[];
}) {
  return (
    <div>
      <label htmlFor={`filter-${name}`} className={SECTION_LABEL}>{label}</label>
      <select
        id={`filter-${name}`}
        name={name}
        defaultValue={value}
        className="min-h-10 w-full border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-primary"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}{option.count !== undefined ? ` (${option.count})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function ProductFiltersSidebar({
  action,
  clearHref,
  filters,
  filterOptions,
  categories = [],
  categoryMode = 'select',
  totalItems,
  activeFilterCount,
  searchPlaceholder = 'Search products',
  className = '',
}: Props) {
  const hrefFor = (patch: Partial<ProductFilters>) =>
    `${action}${productPageQuery({ ...filters, ...patch })}`;

  const categoryHref = (value: string) =>
    action === '/all-products' && value
      ? `/category/${value}`
      : hrefFor({ category: value });

  return (
    <aside
      className={`border border-ink/10 bg-white p-5 shadow-[0_18px_44px_-34px_rgba(13,27,42,0.28)] lg:sticky lg:top-28 ${className}`}
      aria-label="Product filters"
    >
      <div className="flex items-center justify-between gap-3 border-b border-ink/10 pb-3">
        {/* Size is pinned with Tailwind's important modifier so the heading is
            not re-sized by the surrounding page's typography rules. */}
        <h2 className="!text-[1rem] font-bold uppercase tracking-[0.2em] text-ink">Filter Products</h2>
        {activeFilterCount > 0 ? (
          <Link href={clearHref} className="text-xs font-bold text-primary hover:underline">
            Reset All
          </Link>
        ) : (
          <span className="text-xs font-semibold text-ink/45">{totalItems} items</span>
        )}
      </div>

      {/* Search and sort post the whole form; the lists below are plain links. */}
      <form action={action} className="mt-5 grid gap-5">
        {categoryMode === 'list' && filters.category ? (
          <input type="hidden" name="category" value={filters.category} />
        ) : null}

        <div>
          <label htmlFor="product-filter-search" className={SECTION_LABEL}>Search Products</label>
          <input
            id="product-filter-search"
            name="q"
            defaultValue={filters.q}
            placeholder={searchPlaceholder}
            className="min-h-10 w-full border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-primary"
          />
        </div>

        <FilterSelect label="Sort By" name="sort" value={filters.sort} options={SORT_OPTIONS} />

        {/* Filters the reference does not have, kept so nothing is lost. */}
        <FilterSelect label="Brand" name="brand" value={filters.brand} options={filterOptions.brands} />
        <FilterSelect label="Availability" name="availability" value={filters.availability} options={filterOptions.availabilities} />
        <FilterSelect label="Condition" name="condition" value={filters.condition} options={filterOptions.conditions} />

        <button
          type="submit"
          className="min-h-10 bg-ink px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary"
        >
          Apply
        </button>
      </form>

      {categories.length > 0 ? (
        <div className="mt-6 border-t border-ink/10 pt-5">
          <p className={SECTION_LABEL}>Categories</p>
          <nav aria-label="Product categories" className="max-h-72 overflow-y-auto border border-ink/10">
            <FilterRow
              href={categoryHref('')}
              label="All Categories"
              count={totalItems}
              active={!filters.category}
              tone="primary"
            />
            {categories.map((category) => (
              <FilterRow
                key={category.value}
                href={categoryHref(category.value)}
                label={category.label}
                count={category.count}
                active={filters.category === category.value}
                tone="primary"
              />
            ))}
          </nav>
        </div>
      ) : null}

      <div className="mt-6 border-t border-ink/10 pt-5">
        <p className={SECTION_LABEL}>Price</p>
        <div className="border border-ink/10">
          <FilterRow href={hrefFor({ price: '' })} label="Any price" count={totalItems} active={!filters.price} />
          {PRICE_FILTERS.map((band) => (
            <FilterRow
              key={band.value}
              href={hrefFor({ price: band.value })}
              label={band.label}
              count={band.count}
              active={filters.price === band.value}
            />
          ))}
        </div>
      </div>

      {filterOptions.merchants.length > 0 ? (
        <div className="mt-6 border-t border-ink/10 pt-5">
          <p className={SECTION_LABEL}>Store</p>
          <div className="border border-ink/10">
            <FilterRow href={hrefFor({ merchant: '' })} label="All Stores" count={totalItems} active={!filters.merchant} />
          </div>
          {/* Too many stores to list in full: capped and scrolled, with
              "All Stores" left outside so it is always reachable. */}
          <div className="mt-1.5 max-h-56 overflow-y-auto border border-ink/10">
            {filterOptions.merchants.map((merchant) => (
              <FilterRow
                key={merchant.value}
                href={hrefFor({ merchant: merchant.value })}
                label={merchant.label}
                count={merchant.count}
                active={filters.merchant === merchant.value}
              />
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
