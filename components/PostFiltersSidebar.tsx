import Link from 'next/link';

/**
 * Filter sidebar for the article index, following ProductFiltersSidebar so the
 * two listing pages read as the same site: a header with a reset, a keyword
 * box, then counted lists.
 *
 * Deliberately link and form driven, with no client JavaScript. Every filter is
 * a URL, so a filtered view is shareable, indexable and works before hydration —
 * the same choice the product sidebar makes.
 *
 * Counts come from the posts actually published, not from a category's own
 * count field, so a category that exists but has nothing in it does not appear
 * offering an empty page.
 */

export type PostFilterOption = { label: string; value: string; count: number };
export type PostFilters = { q: string; category: string; type: string };

const SECTION_LABEL = 'mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-ink/55';

function FilterRow({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count?: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex w-full items-center justify-between gap-2 border-b border-ink/8 px-3 py-2 text-sm transition last:border-b-0 ${
        active ? 'bg-primary font-bold text-white' : 'font-medium text-ink/75 hover:bg-primary/5 hover:text-primary'
      }`}
    >
      <span className="truncate">{label}</span>
      {count !== undefined ? (
        <span className={`shrink-0 text-xs ${active ? 'text-white/75' : 'text-ink/45'}`}>{count}</span>
      ) : null}
    </Link>
  );
}

export function postPageQuery(filters: Partial<PostFilters>, page?: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, String(value));
  if (page && page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `?${query}` : '';
}

export default function PostFiltersSidebar({
  filters,
  categories,
  totalItems,
  className = '',
}: {
  filters: PostFilters;
  categories: PostFilterOption[];
  totalItems: number;
  className?: string;
}) {
  const hrefFor = (patch: Partial<PostFilters>) => `/all-posts${postPageQuery({ ...filters, ...patch })}`;
  const activeCount = [filters.q, filters.category, filters.type].filter(Boolean).length;

  return (
    <aside
      className={`border border-ink/10 bg-white p-5 shadow-[0_18px_44px_-34px_rgba(13,27,42,0.28)] lg:sticky lg:top-28 ${className}`}
      aria-label="Article filters"
    >
      <div className="flex items-center justify-between gap-3 border-b border-ink/10 pb-3">
        {/* Size pinned so surrounding typography rules cannot re-scale it,
            matching Filter Products on the catalogue sidebar. */}
        <h2 className="!text-[1rem] font-bold uppercase tracking-[0.2em] text-ink">Filter Articles</h2>
        {activeCount > 0 ? (
          <Link href="/all-posts" className="text-xs font-bold text-primary hover:underline">
            Reset All
          </Link>
        ) : (
          <span className="text-xs font-semibold text-ink/45">{totalItems} articles</span>
        )}
      </div>

      <form action="/all-posts" className="mt-5 grid gap-5">
        {/* Preserve the other filters when the keyword form is submitted. */}
        {filters.category ? <input type="hidden" name="category" value={filters.category} /> : null}
        {filters.type ? <input type="hidden" name="type" value={filters.type} /> : null}

        <div>
          <label htmlFor="post-filter-search" className={SECTION_LABEL}>Search Articles</label>
          <input
            id="post-filter-search"
            name="q"
            defaultValue={filters.q}
            placeholder="Search articles"
            className="min-h-10 w-full border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-primary"
          />
        </div>

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
          <nav aria-label="Article categories" className="max-h-72 overflow-y-auto border border-ink/10">
            <FilterRow href={hrefFor({ category: '' })} label="All Categories" count={totalItems} active={!filters.category} />
            {categories.map((c) => (
              <FilterRow
                key={c.value}
                href={hrefFor({ category: c.value })}
                label={c.label}
                count={c.count}
                active={filters.category === c.value}
              />
            ))}
          </nav>
        </div>
      ) : null}

    </aside>
  );
}
