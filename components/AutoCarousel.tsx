'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Horizontal auto-advancing carousel.
 *
 * Scroll-snap does the layout and the paging; JavaScript only nudges the
 * scroll position on a timer. That means it degrades to an ordinary swipeable
 * row if the script never runs, and it stays keyboard and touch scrollable
 * throughout rather than being a JS-only widget.
 *
 * It advances by a whole viewport rather than one card, so a "page" of five is
 * replaced by the next five instead of shuffling by one.
 *
 * Auto-advance stops while the pointer is over the strip, while anything inside
 * has keyboard focus, and when the tab is hidden — otherwise a card can slide
 * out from under a reader mid-sentence, or from under the cursor mid-click.
 * It is disabled entirely for visitors who ask for reduced motion.
 */
export default function AutoCarousel({
  children,
  intervalMs = 5000,
  label = 'Products',
}: {
  children: React.ReactNode;
  intervalMs?: number;
  label?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const page = useCallback((dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    // One viewport minus a sliver, so the next page starts flush.
    const step = Math.max(el.clientWidth - 24, 1);
    const maxScroll = el.scrollWidth - el.clientWidth;

    if (dir === 1 && el.scrollLeft >= maxScroll - 8) {
      el.scrollTo({ left: 0, behavior: 'smooth' });   // wrap
      return;
    }
    if (dir === -1 && el.scrollLeft <= 8) {
      el.scrollTo({ left: maxScroll, behavior: 'smooth' });
      return;
    }
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  }, []);

  const syncEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 8);
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 8);
  }, []);

  useEffect(() => {
    if (paused) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    const id = window.setInterval(() => {
      if (document.hidden) return;
      page(1);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [paused, intervalMs, page]);

  useEffect(() => {
    syncEdges();
    const el = trackRef.current;
    if (!el) return undefined;
    el.addEventListener('scroll', syncEdges, { passive: true });
    return () => el.removeEventListener('scroll', syncEdges);
  }, [syncEdges]);

  const arrow =
    'absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-ink/10 bg-white text-ink shadow-[0_10px_24px_-12px_rgba(13,27,42,0.45)] transition hover:border-primary hover:text-primary lg:flex';

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <button
        type="button"
        aria-label="Previous products"
        onClick={() => page(-1)}
        className={`${arrow} -left-4 ${atStart ? 'opacity-60' : ''}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
          <path d="m15 5-7 7 7 7" />
        </svg>
      </button>

      <div
        ref={trackRef}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="carousel-track flex snap-x snap-mandatory gap-[18px] overflow-x-auto scroll-smooth pb-2"
      >
        {children}
      </div>

      <button
        type="button"
        aria-label="Next products"
        onClick={() => page(1)}
        className={`${arrow} -right-4 ${atEnd ? 'opacity-60' : ''}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
