'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Open a peek panel from a trigger that lives outside this component.
 *
 * The Highlights tiles sit above "About this item" while the peek is rendered
 * inside it, so the two cannot share state through props without lifting it
 * across that section boundary. The tile asks for a panel by id instead, and
 * hands over its own element so focus can be returned when the peek closes.
 */
export const PRODUCT_PEEK_OPEN_EVENT = 'product-peek:open';

export type ProductPeekOpenDetail = { id: string; trigger?: HTMLButtonElement | null };

export type PeekPanel = {
  id: string;
  label: string;
  /** Rendered on the server and passed down, so the panel bodies stay server
   *  components — only the open/close behaviour needs the client. */
  content: React.ReactNode;
  /** Shown next to the label, e.g. a count. */
  hint?: string;
};

/**
 * Trigger buttons that open their content in a slide-out panel.
 *
 * Replaces an inline accordion for the reference material — features,
 * specifications, additional info. Those sections are long and rarely the
 * reason someone opened the page, so expanding them inline pushed the prices
 * and price history far down. In a peek they are one click away and cost no
 * vertical space until asked for.
 *
 * The panels are still rendered into the DOM rather than fetched on open, so
 * their content remains in the served HTML for crawlers and for anyone with
 * JavaScript disabled — hidden by CSS, not absent.
 */
export default function ProductSidePeek({ panels }: { panels: PeekPanel[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  // Read inside the listener below rather than closed over, so subscribing
  // once does not go stale when the panel array is rebuilt on a render.
  const panelsRef = useRef(panels);
  panelsRef.current = panels;

  const close = useCallback(() => {
    setOpenId(null);
    // Return focus to whatever opened the peek, or the keyboard user is
    // stranded at the top of the document.
    lastTrigger.current?.focus();
  }, []);

  // Only ids this peek actually owns are honoured, so a second peek elsewhere
  // on the page ignores an event that was not meant for it.
  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<ProductPeekOpenDetail>).detail;
      if (!detail?.id || !panelsRef.current.some((p) => p.id === detail.id)) return;
      lastTrigger.current = detail.trigger ?? null;
      setOpenId(detail.id);
    };
    window.addEventListener(PRODUCT_PEEK_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(PRODUCT_PEEK_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!openId) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    // A drawer that leaves the page scrolling behind it feels broken on mobile.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [openId, close]);

  const active = panels.find((p) => p.id === openId) ?? null;

  return (
    <>
      <div className="product-peek-triggers">
        {panels.map((p) => (
          <button
            key={p.id}
            type="button"
            className="product-peek-trigger"
            aria-haspopup="dialog"
            aria-expanded={openId === p.id}
            onClick={(e) => {
              lastTrigger.current = e.currentTarget;
              setOpenId(p.id);
            }}
          >
            <span>{p.label}</span>
            {p.hint ? <span className="product-peek-trigger-hint">{p.hint}</span> : null}
            <span aria-hidden="true" className="product-peek-trigger-chevron">›</span>
          </button>
        ))}
      </div>

      {/* Rendered always, hidden with CSS: the content stays crawlable. */}
      <div
        className={`product-peek-backdrop${active ? ' is-open' : ''}`}
        onClick={close}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={active?.label ?? 'Product information'}
        aria-hidden={active ? undefined : true}
        tabIndex={-1}
        className={`product-peek-panel${active ? ' is-open' : ''}`}
      >
        <div className="product-peek-header">
          <h3 className="product-peek-title">{active?.label ?? ''}</h3>
          <button type="button" className="product-peek-close" onClick={close} aria-label="Close">
            ×
          </button>
        </div>
        <div className="product-peek-body">
          {panels.map((p) => (
            <div key={p.id} hidden={p.id !== openId}>
              {p.content}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
