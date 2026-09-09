import Link from 'next/link';
import {
  PRICE_FILTERS,
  SORT_OPTIONS,
  productPageQuery,
  type FilterOption,
  type ProductFilters,
} from '@/lib/product-filters';
import { PRODUCT_CATEGORY_TREE } from '@/lib/product-nav';

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

  const countBySlug = new Map(categories.map((category) => [category.value, category]));

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

      {/*
        Categories sit above the search form: browsing by category is the more
        common way into the catalogue, and it is a list of links rather than
        something to fill in.

        It is the whole form that moves below, not the search field on its own —
        the field posts alongside sort, brand, availability and condition, so
        lifting it out would submit a search without the other filters.
      */}
      {categories.length > 0 ? (
        <div className="filter-section mt-5">
          <p className={SECTION_LABEL}>Categories &amp; Subcategories</p>
          {/*
            Rendered from PRODUCT_CATEGORY_TREE, the same tree the header's
            Products menu uses, so the two agree on both order and nesting.
            Previously this listed whatever Strapi returned, in Strapi's order,
            which put Smart Doorbells loose between Smart Plugs and Headphones
            while the menu showed it under Smart Home.

            Counts still come from the `categories` prop, since those are
            per-site product totals the tree does not carry. A category absent
            from that prop holds nothing for this storefront and is skipped —
            the tree names what may appear, the data decides what does.
          */}
          <nav aria-label="Product categories" className="filter-category-list grid gap-1">
            <FilterRow
              href={categoryHref('')}
              label="All Categories"
              count={totalItems}
              active={!filters.category}
              tone="primary"
            />
            {PRODUCT_CATEGORY_TREE.map((node) => {
              if (!('children' in node)) {
                const found = countBySlug.get(node.slug);
                if (!found) return null;
                return (
                  <FilterRow
                    key={node.slug}
                    href={categoryHref(node.slug)}
                    label={node.label}
                    count={found.count}
                    active={filters.category === node.slug}
                    tone="primary"
                  />
                );
              }
              const children = node.children.filter((child) => countBySlug.has(child.slug));
              if (children.length === 0) return null;
              return (
                <div key={node.label} className="grid gap-1">
                  {/* A group heading, not a link: "Smart Home" is an editorial
                      grouping in the menu and has no category page of its own. */}
                  <p className="filter-group-label">{node.label}</p>
                  <div className="filter-group-children grid gap-1">
                    {children.map((child) => (
                      <FilterRow
                        key={child.slug}
                        href={categoryHref(child.slug)}
                        label={child.label}
                        count={countBySlug.get(child.slug)?.count}
                        active={filters.category === child.slug}
                        tone="primary"
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>
      ) : null}

      {/* Search and sort post the whole form; the lists below are plain links. */}
      <form action={action} className="filter-section grid gap-4">
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
