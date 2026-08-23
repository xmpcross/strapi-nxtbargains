'use client';

import { useEffect, useRef } from 'react';

/**
 * Auto-sliding, single-row product carousel. Shows `perView` cards per row on
 * desktop (3 on tablet, 2 on mobile) and auto-advances on an interval,
 * looping. Pauses on hover; subtle prev/next arrows appear on hover.
 */
export default function ProductCarousel({
  items,
  interval = 3500,
  perView = 5,
  gapPx = 20,
}: {
  items: React.ReactNode[];
  interval?: number;
  perView?: number;
  gapPx?: 15 | 20;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const paused = useRef(false);

  function step(dir: 1 | -1 = 1) {
    const el = trackRef.current;
    if (!el) return;
    const slide = el.querySelector('[data-slide]') as HTMLElement | null;
    const amount = slide ? slide.getBoundingClientRect().width + gapPx : el.clientWidth;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    const atStart = el.scrollLeft <= 4;
    if (dir === 1 && atEnd) el.scrollTo({ left: 0, behavior: 'smooth' });
    else if (dir === -1 && atStart) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
    else el.scrollBy({ left: dir * amount, behavior: 'smooth' });
  }

  useEffect(() => {
    const id = setInterval(() => {
      if (!paused.current) step(1);
    }, interval);
    return () => clearInterval(id);
  }, [interval]);

  if (!items.length) return null;

  const compactGap = gapPx === 15;
  const trackGapClass = compactGap ? 'gap-[15px]' : 'gap-5';
  const mobileBasis = compactGap
    ? 'basis-[calc((100%_-_15px)/2)]'
    : 'basis-[calc((100%_-_1.25rem)/2)]';
  const tabletBasis = compactGap
    ? 'sm:basis-[calc((100%_-_30px)/3)]'
    : 'sm:basis-[calc((100%_-_2.5rem)/3)]';
  const desktopBasis = compactGap
    ? perView === 6
      ? 'lg:basis-[calc((100%_-_75px)/6)]'
      : perView === 3
        ? 'lg:basis-[calc((100%_-_30px)/3)]'
        : 'lg:basis-[calc((100%_-_60px)/5)]'
    : perView === 6
      ? 'lg:basis-[calc((100%_-_6.25rem)/6)]'
      : perView === 3
        ? 'lg:basis-[calc((100%_-_2.5rem)/3)]'
        : 'lg:basis-[calc((100%_-_5rem)/5)]';

  return (
    <div
      className="group relative"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      <div
        ref={trackRef}
        className={`flex snap-x snap-mandatory ${trackGapClass} overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
      >
        {items.map((item, i) => (
          <div
            key={i}
            data-slide
            className={`shrink-0 snap-start ${mobileBasis} ${tabletBasis} ${desktopBasis}`}
          >
            {item}
          </div>
        ))}
      </div>

      <button
        type="button"
        aria-label="Previous"
        onClick={() => step(-1)}
        className="absolute left-0 top-1/2 hidden -translate-y-1/2 -translate-x-1/2 items-center justify-center rounded-full border border-ink/10 bg-white p-2 text-ink shadow-md transition hover:border-primary hover:text-primary group-hover:flex"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={() => step(1)}
        className="absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-ink/10 bg-white p-2 text-ink shadow-md transition hover:border-primary hover:text-primary group-hover:flex"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
      </button>
    </div>
  );
}
