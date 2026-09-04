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


/**
 * Emoji per category. Strapi's nxt-category has an `icon` field but none of the
 * nine categories set one, so the mapping lives here rather than the rail going
 * without. Anything unmapped simply renders no icon.
 */
const CATEGORY_ICON: Record<string, string> = {
  'best-sellers-articles': '\u{1F525}',
  'buying-guides': '\u{1F6D2}',
  'how-to-guides': '\u{1F6E0}\uFE0F',
  'nxt-bargains-informative-articles': '\u{1F4D8}',
  'product-comparisons': '\u2696\uFE0F',
  'product-reviews': '\u2B50',
  'product-roundups': '\u{1F4E6}',
  'smart-home': '\u{1F3E0}',
  'top-rated-smart-electronics-devices': '\u{1F3C6}',
};

function CategoryRow({
  href,
  label,
  count,
  active,
  icon,
}: {
  href: string;
  label: string;
  count?: number;
  active: boolean;
  icon?: string;
}) {
  return (
    <Link href={href} className={`browse-cat${active ? ' is-active' : ''}`}>
      {icon ? (
        <span className="browse-cat-icon" aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className="browse-cat-label">{label}</span>
      {count !== undefined ? <span className="browse-cat-count">{count}</span> : null}
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

  return (
    <aside className={`browse-cats ${className}`} aria-label="Article categories">
      <div className="browse-cats-head">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M6 2h11l-2.5 4.5L17 11H8v11H6z" />
        </svg>
        Browse by category
      </div>

      {categories.length > 0 ? (
        <nav className="browse-cats-list" aria-label="Article categories">
          <CategoryRow
            href={hrefFor({ category: '' })}
            label="All articles"
            count={totalItems}
            active={!filters.category}
          />
          {categories.map((c) => (
            <CategoryRow
              key={c.value}
              href={hrefFor({ category: c.value })}
              label={c.label}
              count={c.count}
              active={filters.category === c.value}
              icon={CATEGORY_ICON[c.value]}
            />
          ))}
        </nav>
      ) : null}
    </aside>
  );
}
