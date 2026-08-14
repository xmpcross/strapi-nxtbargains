'use client';

export type HighlightEntry = { label: string; value: string };

/**
 * The at-a-glance spec tiles above the product accordion.
 *
 * Replaces the "About this item" heading: the heading only named the block
 * below it, while the same strip of space can answer the questions a shopper
 * actually opens the page with — field of view, battery, whether it has audio.
 *
 * Each tile opens the Specifications peek rather than only looking clickable.
 * The chevron matches `.product-peek-trigger`, and a chevron that does nothing
 * is a promise the page doesn't keep. The peek lives further down the tree
 * inside the accordion, so the two talk over a DOM event instead of threading
 * state through the server components between them.
 */
export default function ProductHighlights({
  entries,
  panelId = 'specifications',
}: {
  entries: HighlightEntry[];
  panelId?: string;
}) {
  if (!entries.length) return null;

  return (
    <section className="product-highlights" aria-label="Highlights">
      <h2 className="product-highlights-title">Highlights</h2>
      <div className="product-highlights-grid">
        {entries.map((entry) => (
          <button
            key={entry.label}
            type="button"
            className="product-highlights-tile"
            onClick={(e) =>
              window.dispatchEvent(
                new CustomEvent('product-peek:open', { detail: { id: panelId, trigger: e.currentTarget } }),
              )
            }
          >
            <span className="product-highlights-label">{entry.label}</span>
            <span className="product-highlights-value">{entry.value}</span>
            <span aria-hidden="true" className="product-highlights-chevron">
              ›
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
