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

const SECTION_LABEL = 'filter-label';

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
  const activeClass = tone === 'primary' ? 'filter-row-on-accent' : 'filter-row-on-dark';
  return (
    <Link href={href} className={`filter-row ${active ? activeClass : ''}`}>
      <span className="truncate">{label}</span>
      {count !== undefined ? <span className="filter-row-count">({count})</span> : null}
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
        className="filter-field"
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
      className={`filter-panel lg:sticky lg:top-24 ${className}`}
      aria-label="Product filters"
    >
      <div className="filter-panel-head">
        {/* Size is pinned with Tailwind's important modifier so the heading is
            not re-sized by the surrounding page's typography rules. */}
        <h2 className="!text-[0.875rem] font-bold uppercase tracking-[0.1em] text-ink">Filter Products</h2>
        {activeFilterCount > 0 ? (
          <Link href={clearHref} className="text-xs font-semibold text-[#118757] hover:underline">
            Reset All
          </Link>
        ) : (
          <span className="text-xs font-semibold text-ink/45">{totalItems} items</span>
        )}
      </div>

      {/* Search and sort post the whole form; the lists below are plain links. */}
      <form action={action} className="filter-section mt-5 grid gap-4">
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
            className="filter-field"
          />
        </div>

        <FilterSelect label="Sort By" name="sort" value={filters.sort} options={SORT_OPTIONS} />

        {/* Filters the reference does not have, kept so nothing is lost. */}
        <FilterSelect label="Brand" name="brand" value={filters.brand} options={filterOptions.brands} />
        <FilterSelect label="Availability" name="availability" value={filters.availability} options={filterOptions.availabilities} />
        <FilterSelect label="Condition" name="condition" value={filters.condition} options={filterOptions.conditions} />

        <button
          type="submit"
          className="min-h-10 rounded-lg bg-[#118757] px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white transition hover:bg-[#0d6f47]"
        >
          Apply
        </button>
      </form>

      {categories.length > 0 ? (
        <div className="filter-section">
          <p className={SECTION_LABEL}>Categories &amp; Subcategories</p>
          <nav aria-label="Product categories" className="filter-scroll grid gap-1">
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

      <div className="filter-section">
        <p className={SECTION_LABEL}>Price</p>
        <div className="grid gap-1">
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
        <div className="filter-section">
          <p className={SECTION_LABEL}>Store</p>
          <div className="grid gap-1">
            <FilterRow href={hrefFor({ merchant: '' })} label="All Stores" count={totalItems} active={!filters.merchant} />
          </div>
          {/* Too many stores to list in full: capped and scrolled, with
              "All Stores" left outside so it is always reachable. */}
          <div className="filter-scroll mt-1 grid gap-1">
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
