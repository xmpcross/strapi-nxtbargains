import Link from 'next/link';
import {
  POST_TYPE_OPTIONS,
  articlePageQuery,
  type ArticleFilters,
} from '@/lib/article-filters';
import type { ArticleCategoryNavItem } from '@/lib/site';

type Props = {
  action: string;
  clearHref: string;
  filters: ArticleFilters;
  categories: ArticleCategoryNavItem[];
  currentCategory: string;
  totalItems: number;
  activeFilterCount: number;
  searchPlaceholder?: string;
  className?: string;
  hidePostType?: boolean;
};

export default function ArticleFiltersSidebar({
  action,
  clearHref,
  filters,
  categories,
  currentCategory,
  totalItems,
  activeFilterCount,
  searchPlaceholder = 'Search articles',
  className = '',
  hidePostType = false,
}: Props) {
  return (
    <aside
      className={`rounded-2xl border border-ink/10 bg-white p-6 shadow-xs lg:sticky lg:top-28 ${className}`}
      aria-label="Article filters"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Filter</p>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
          {activeFilterCount ? `${activeFilterCount} active` : `${totalItems} items`}
        </span>
      </div>

      <form action={action} className="mt-5 grid gap-5 border-t border-ink/10 pt-5">
        <div>
          <label htmlFor="article-filter-search" className="text-sm font-bold text-ink">
            Search
          </label>
          <input
            id="article-filter-search"
            name="q"
            defaultValue={filters.q}
            placeholder={searchPlaceholder}
            className="mt-2 min-h-11 w-full rounded-xl border border-ink/15 bg-[#f8fafc] px-3.5 py-2 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {!hidePostType ? (
          <div>
            <label htmlFor="article-filter-post-type" className="text-sm font-bold text-ink">
              Post type
            </label>
            <select
              id="article-filter-post-type"
              name="postType"
              defaultValue={filters.postType}
              className="mt-2 min-h-11 w-full rounded-xl border border-ink/15 bg-[#f8fafc] px-3.5 py-2 text-sm text-ink outline-none transition focus:border-primary focus:bg-white"
            >
              <option value="">All types</option>
              {POST_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-ink px-3 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white shadow-2xs transition hover:bg-primary"
          >
            Apply
          </button>
          <Link
            href={clearHref}
            className="flex min-h-11 items-center justify-center rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-ink/70 transition hover:border-primary hover:text-primary"
          >
            Clear
          </Link>
        </div>
      </form>

      <div className="mt-6 border-t border-ink/10 pt-5">
        <p className="text-sm font-bold text-ink">Categories</p>
        <nav aria-label="Article categories" className="mt-3 space-y-1 rounded-xl border border-ink/10 bg-[#f8fafc] p-1.5">
          {categories.map((section) => {
            const href = `/${section.slug}${articlePageQuery(filters)}`;
            const active = currentCategory === section.slug;

            return (
              <Link
                key={section.slug}
                href={href}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-ink/75 hover:bg-white hover:text-primary'
                }`}
              >
                <span>{section.title}</span>
                {active ? <span className="text-xs">✓</span> : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

