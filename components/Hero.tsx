'use client';

import { useEffect, useState } from 'react';

/**
 * NXT.Bargains — Hero section.
 * Animated price-history chart that counts the price down as the line draws in.
 * Uses the site's primary (blue) brand token + Inter via font-display.
 */
export default function Hero() {
  const [price, setPrice] = useState(799);

  // Count the price down from $799 → $369 as the chart line draws in.
  useEffect(() => {
    const start = 799, end = 369, dur = 1700, delay = 300;
    let t0: number | null = null;
    let raf = 0;
    const step = (ts: number) => {
      if (t0 === null) t0 = ts;
      const p = Math.min((ts - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setPrice(Math.round(start - (start - end) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    const timer = setTimeout(() => { raf = requestAnimationFrame(step); }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, []);

  return (
    <section id="home-hero" data-testid="home-hero" className="relative overflow-hidden py-16 lg:py-[86px]">
      {/* soft glow top-right */}
      <div className="pointer-events-none absolute -top-44 -right-40 z-0 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(0,70,190,0.14),transparent_62%)]" />

      <div className="relative z-10 mx-auto grid max-w-[1366px] grid-cols-1 items-center gap-12 px-7 lg:grid-cols-[1.02fr_1fr] lg:gap-[54px]">

        {/* ---------- LEFT ---------- */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-muted px-3.5 py-1.5 text-[0.78rem] font-semibold text-ink/55">
            <span className="h-[7px] w-[7px] animate-pulseDot rounded-full bg-primary" />
            Price tracking · Comparison · 8+ marketplaces
          </span>

          <h1 className="mt-6 font-display !text-[3rem] font-extrabold leading-[1.02] tracking-[-0.03em] text-ink">
            Never pay{' '}
            <span className="relative whitespace-nowrap text-primary">
              full price
              <svg viewBox="0 0 200 14" preserveAspectRatio="none" className="absolute -bottom-2.5 left-0 h-3.5 w-full">
                <path d="M2 8 C50 13 150 13 198 5" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </span>{' '}
            again.
          </h1>

          <p className="mt-6 max-w-[46ch] text-[1.12rem] leading-relaxed text-ink/55">
            Compare one product across Amazon, eBay and the major marketplaces,
            see its full price history, and track it so you buy at the lowest.
            One search in — the savings come to you.
          </p>

          {/* search — functional GET form → /search */}
          <form action="/search" method="get" role="search" className="mt-8 flex max-w-[520px] flex-col gap-2.5 sm:flex-row">
            <div className="flex flex-1 items-center gap-2.5 rounded-[13px] border border-ink/10 bg-white px-4 shadow-[0_10px_30px_-18px_rgba(13,27,42,0.4)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-ink/45">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
              </svg>
              <input
                type="search"
                name="q"
                placeholder="Search any product — e.g. iPhone 17 Pro"
                aria-label="Search any product"
                autoComplete="off"
                className="w-full bg-transparent py-[15px] text-[0.98rem] text-ink outline-none placeholder:text-ink/40"
              />
            </div>
            <button type="submit" className="rounded-[13px] bg-primary px-6 py-3.5 font-display text-[0.95rem] font-bold text-white transition hover:-translate-y-px hover:bg-primary-emphasis sm:py-0">
              Compare
            </button>
          </form>
          <div className="mt-3.5 flex items-center gap-2 text-[0.85rem] text-ink/55">
            ✓ <b className="font-semibold text-ink">Free, no signup</b> — prices compared across the major marketplaces.
          </div>

          {/* stats */}
          <div className="mt-10 flex gap-9">
            <div>
              <div className="font-display text-[1.7rem] font-bold leading-none text-ink">8+</div>
              <div className="mt-1.5 text-[0.82rem] text-ink/55">Marketplaces compared</div>
            </div>
            <div>
              <div className="font-display text-[1.7rem] font-bold leading-none text-ink">Daily</div>
              <div className="mt-1.5 text-[0.82rem] text-ink/55">Price checks</div>
            </div>
            <div>
              <div className="font-display text-[1.7rem] font-bold leading-none text-primary">54%</div>
              <div className="mt-1.5 text-[0.82rem] text-ink/55">Biggest live drop</div>
            </div>
          </div>
        </div>

        {/* ---------- RIGHT: animated price-history chart ---------- */}
        <div className="relative">
          <div className="rounded-[22px] border border-ink/10 bg-white p-[26px] pb-[22px] shadow-[0_40px_80px_-40px_rgba(13,27,42,0.45)]">
            {/* head */}
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-[46px] w-[46px] place-items-center rounded-xl bg-gradient-to-br from-ink to-[#1d3147] text-xl text-white">📱</div>
                <div>
                  <div className="font-display text-[0.96rem] font-semibold leading-tight text-ink">Google Pixel 10 (128GB)</div>
                  <div className="text-[0.78rem] text-ink/55">Refurbished · Obsidian</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[0.72rem] font-bold text-primary">● Tracking</div>
            </div>

            {/* price */}
            <div className="my-[18px] mb-1.5 flex items-end gap-3">
              <div className="font-display text-[2.5rem] font-extrabold leading-none tracking-[-0.02em] text-ink">${price}</div>
              <div className="mb-[5px] text-base text-ink/45 line-through">$799</div>
              <div className="mb-1.5 rounded-md bg-primary px-2.5 py-[5px] text-[0.78rem] font-bold text-white">−54%</div>
            </div>

            {/* chart */}
            <div className="relative mt-2.5">
              <svg viewBox="0 0 320 170" preserveAspectRatio="none" className="block h-[170px] w-full overflow-visible">
                <line x1="0" y1="40" x2="320" y2="40" className="stroke-ink/10 [stroke-dasharray:3_5]" strokeWidth="1" />
                <line x1="0" y1="85" x2="320" y2="85" className="stroke-ink/10 [stroke-dasharray:3_5]" strokeWidth="1" />
                <line x1="0" y1="130" x2="320" y2="130" className="stroke-ink/10 [stroke-dasharray:3_5]" strokeWidth="1" />
                <path
                  d="M0,38 L40,46 L80,40 L120,70 L160,62 L200,92 L240,108 L280,140 L320,150 L320,170 L0,170 Z"
                  className="animate-fadeArea fill-primary/20 opacity-0"
                />
                <path
                  d="M0,38 L40,46 L80,40 L120,70 L160,62 L200,92 L240,108 L280,140 L320,150"
                  className="animate-draw fill-none stroke-primary [stroke-dasharray:560] [stroke-dashoffset:560]"
                  strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                />
                <g className="animate-pop opacity-0" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
                  <circle cx="320" cy="150" r="7" className="animate-halo fill-primary opacity-20" />
                  <circle cx="320" cy="150" r="5.5" className="fill-primary" stroke="#fff" strokeWidth="2.5" />
                </g>
              </svg>
              <div className="animate-pop absolute bottom-[34px] right-1.5 rounded-md bg-ink px-2.5 py-[5px] font-display text-[0.72rem] font-bold text-white opacity-0 after:absolute after:bottom-[-5px] after:left-3.5 after:border-[5px] after:border-transparent after:border-t-ink after:border-b-0 after:content-['']">
                Lowest ever
              </div>
            </div>

            {/* markets */}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-4">
              <span className="mr-0.5 text-[0.74rem] text-ink/55">Best of</span>
              <span className="rounded-md border border-primary bg-primary px-2.5 py-[5px] text-[0.74rem] font-semibold text-white">US Mobile $369</span>
              <span className="rounded-md border border-ink/10 bg-muted px-2.5 py-[5px] text-[0.74rem] font-semibold text-ink">Amazon $412</span>
              <span className="rounded-md border border-ink/10 bg-muted px-2.5 py-[5px] text-[0.74rem] font-semibold text-ink">eBay $440</span>
              <span className="rounded-md border border-ink/10 bg-muted px-2.5 py-[5px] text-[0.74rem] font-semibold text-ink">Walmart $469</span>
            </div>
          </div>

          {/* floating badge */}
          <div className="animate-bob absolute -left-6 bottom-12 flex items-center gap-2.5 rounded-[14px] border border-ink/10 bg-white px-3.5 py-2.5 shadow-[0_18px_40px_-20px_rgba(13,27,42,0.45)] max-sm:bottom-3 max-sm:left-2">
            <div className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-primary/10 text-[1.1rem] text-primary">↓</div>
            <div>
              <b className="block font-display text-[0.86rem] text-ink">Price dropped $430</b>
              <span className="text-[0.72rem] text-ink/55">since you started tracking</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
