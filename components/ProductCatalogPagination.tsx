import Link from 'next/link';

type ProductCatalogPaginationProps = {
  page: number;
  pageCount: number;
  pageHref: (page: number) => string;
  /** Max page number squares shown at once (default 4, like the reference design). */
  maxVisible?: number;
};

const PAGE_BTN =
  'catalog-pager-btn inline-flex h-10 w-10 shrink-0 items-center justify-center text-sm font-medium tabular-nums transition';
const PAGE_BTN_IDLE = 'catalog-pager-idle';
const PAGE_BTN_ACTIVE = 'catalog-pager-active';
const PAGE_BTN_DISABLED = 'catalog-pager-disabled cursor-not-allowed';

function visiblePages(page: number, pageCount: number, maxVisible: number) {
  if (pageCount <= maxVisible) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  let end = start + maxVisible - 1;

  if (end > pageCount) {
    end = pageCount;
    start = Math.max(1, end - maxVisible + 1);
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function ChevronLeft() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export default function ProductCatalogPagination({
  page,
  pageCount,
  pageHref,
  maxVisible = 4,
}: ProductCatalogPaginationProps) {
  if (pageCount <= 1) return null;

  const pages = visiblePages(page, pageCount, maxVisible);
  const hasPrev = page > 1;
  const hasNext = page < pageCount;

  return (
    <nav
      className="product-catalog-pagination mt-8 flex justify-end"
      aria-label="Product pagination"
      data-testid="product-catalog-pagination"
    >
      <div className="inline-flex items-center gap-1.5">
        {hasPrev ? (
          <Link
            href={pageHref(page - 1)}
            className={`${PAGE_BTN} ${PAGE_BTN_IDLE}`}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Link>
        ) : (
          <span className={`${PAGE_BTN} ${PAGE_BTN_DISABLED}`} aria-hidden="true">
            <ChevronLeft />
          </span>
        )}

        {pages.map((pageNumber) =>
          pageNumber === page ? (
            <span
              key={pageNumber}
              className={`${PAGE_BTN} ${PAGE_BTN_ACTIVE}`}
              aria-current="page"
            >
              {pageNumber}
            </span>
          ) : (
            <Link
              key={pageNumber}
              href={pageHref(pageNumber)}
              className={`${PAGE_BTN} ${PAGE_BTN_IDLE}`}
              aria-label={`Page ${pageNumber}`}
            >
              {pageNumber}
            </Link>
          ),
        )}

        {hasNext ? (
          <Link
            href={pageHref(page + 1)}
            className={`${PAGE_BTN} ${PAGE_BTN_IDLE}`}
            aria-label="Next page"
          >
            <ChevronRight />
          </Link>
        ) : (
          <span className={`${PAGE_BTN} ${PAGE_BTN_DISABLED}`} aria-hidden="true">
            <ChevronRight />
          </span>
        )}
      </div>
    </nav>
  );
}
