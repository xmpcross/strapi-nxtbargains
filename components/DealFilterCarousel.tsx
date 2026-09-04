'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

const LABELS: Record<string, string> = {
  smartphone: 'Smart Phones',
  headphones: 'Headphones',
  smartwatch: 'Smartwatches',
  laptop: 'Laptops',
  'smart tv': 'Smart TVs',
  tablet: 'Tablets',
};

function filterLabel(query: string) {
  return LABELS[query] ?? query.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function DealFilterCarousel({
  queries,
  selected,
  anchor,
  autoSlide = false,
}: {
  queries: string[];
  selected: string | null;
  anchor: string;
  autoSlide?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (!autoSlide || queries.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      const track = trackRef.current;
      if (!track || pausedRef.current || track.scrollWidth <= track.clientWidth) return;
      const firstButton = track.firstElementChild as HTMLElement | null;
      const step = (firstButton?.offsetWidth ?? 120) + 8;
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      track.scrollTo({ left: atEnd ? 0 : track.scrollLeft + step, behavior: 'smooth' });
    }, 2200);
    return () => window.clearInterval(timer);
  }, [autoSlide, queries.length]);

  if (queries.length === 0) return null;

  return (
    <div
      ref={trackRef}
      className={`mt-6 flex gap-2 ${autoSlide ? 'flex-nowrap overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'flex-wrap'}`}
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onFocusCapture={() => { pausedRef.current = true; }}
      onBlurCapture={() => { pausedRef.current = false; }}
      onTouchStart={() => { pausedRef.current = true; }}
      onTouchEnd={() => { pausedRef.current = false; }}
      aria-label={autoSlide ? 'Popular deal categories' : 'Deal filters'}
    >
      {queries.map((query) => (
        <Link
          key={query}
          href={selected === query ? `/best-deals#${anchor}` : `/best-deals?filter=${encodeURIComponent(query)}#${anchor}`}
          aria-current={selected === query ? 'true' : undefined}
          className={`shrink-0 whitespace-nowrap border px-3 py-1.5 text-xs font-bold transition hover:border-ink/25 hover:text-ink ${
            selected === query
              ? 'border-ink/35 bg-ink text-white'
              : 'border-ink/10 bg-white text-ink/70'
          }`}
        >
          {filterLabel(query)}
        </Link>
      ))}
    </div>
  );
}
