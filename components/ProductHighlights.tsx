'use client';

import { PRODUCT_PEEK_OPEN_EVENT, type ProductPeekOpenDetail } from '@/components/ProductSidePeek';

export type ProductHighlight = { label: string; value: string };

/**
 * Headline product attributes, shown above "About this item".
 *
 * The tiles are a summary, not a second source of truth: every value here is
 * also a row in the Specifications panel. Clicking a tile opens that panel
 * rather than repeating the whole table in a drawer of its own, which is why
 * the chevron leads somewhere real instead of being decoration.
 *
 * Values are chosen server-side by `productHighlightEntries`, so a product
 * with nothing tile-worthy renders nothing at all rather than an empty card.
 */
export default function ProductHighlights({
  highlights,
  panelId = 'specifications',
}: {
  highlights: ProductHighlight[];
  /** Peek panel the tiles open. Must match a panel id on the page's ProductSidePeek. */
  panelId?: string;
}) {
  if (!highlights.length) return null;

  return (
    <div className="product-info-section">
      <h2 className="product-info-section-title">Highlights</h2>
      <div className="product-highlights-grid">
        {highlights.map((highlight) => (
          <button
            key={highlight.label}
            type="button"
            className="product-highlight-tile"
            aria-haspopup="dialog"
            // The visible text alone reads as "Field of View 105° field of
            // view", which says nothing about where the tile goes.
            aria-label={`${highlight.label}: ${highlight.value}. Open full specifications.`}
            onClick={(event) => {
              const detail: ProductPeekOpenDetail = { id: panelId, trigger: event.currentTarget };
              window.dispatchEvent(new CustomEvent(PRODUCT_PEEK_OPEN_EVENT, { detail }));
            }}
          >
            <span className="product-highlight-text">
              <span className="product-highlight-label">{highlight.label}</span>
              <span className="product-highlight-value">{highlight.value}</span>
            </span>
            <span aria-hidden="true" className="product-highlight-chevron">
              ›
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
