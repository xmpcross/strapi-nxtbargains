'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export type SearchChip = { label: string; slug: string; count?: number };
export type SearchSuggestion = {
  title: string;
  href: string;
  image: string | null;
  date: string | null;
  comments?: number | null;
};

/**
 * Search opened from the header icon.
 *
 * The icon previously navigated straight to /search, which meant a full page
 * load before the visitor could type. This keeps them where they are and only
 * navigates once they have a query.
 *
 * Submitting is a real GET form to /search, so the result is an ordinary
 * shareable URL and the dialog keeps working with JavaScript disabled — the
 * icon falls back to a plain link to the same page.
 *
 * Chips and suggestions are fetched server-side by the header and passed in, so
 * opening the dialog costs no request.
 */
export default function SearchDialog({
  chips,
  suggestions,
  label,
}: {
  chips: SearchChip[];
  suggestions: SearchSuggestion[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    // Return focus to the icon, or a keyboard user is stranded at the top.
    openerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus the field so the visitor can type immediately.
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      window.clearTimeout(t);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="-m-1.5 inline-flex items-center justify-center rounded-lg p-1.5 text-ink/70 transition hover:text-primary"
        data-testid="header-search"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
             className="h-5 w-5" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex min-h-full items-center justify-center overflow-y-auto bg-ink/60 p-4 backdrop-blur-sm">
          {/* Backdrop click closes; the panel stops the event so inner clicks do not. */}
          <div className="absolute inset-0" onClick={close} aria-hidden="true" />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            className="relative w-full max-w-4xl rounded-lg bg-paper p-6 shadow-2xl sm:p-10"
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close search"
              className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink/50 transition hover:bg-ink/5 hover:text-ink"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            <h2 className="font-display text-[1.75rem] font-bold text-ink">Search</h2>

            {/* A plain GET form: the browser builds /search?q=… itself. */}
            <form action="/search" method="get" className="mt-6 flex flex-col gap-3 sm:flex-row">
              <input
                ref={inputRef}
                type="search"
                name="q"
                placeholder="What are you looking for?"
                autoComplete="off"
                className="w-full flex-1 rounded-full border border-ink/15 bg-white px-6 py-4 text-base text-ink outline-none transition placeholder:text-ink/40 focus:border-primary"
              />
              <button
                type="submit"
                className="shrink-0 rounded-full bg-ink px-10 py-4 font-bold text-white transition hover:bg-primary sm:min-w-[10.5rem]"
              >
                Search
              </button>
            </form>

            {chips.length > 0 ? (
              <ul className="mt-6 flex flex-wrap gap-3">
                {chips.map((chip) => (
                  <li key={chip.slug}>
                    <Link
                      href={`/search?category=${encodeURIComponent(chip.slug)}`}
                      onClick={close}
                      className="inline-flex items-center gap-2.5 rounded-xl border border-ink/12 bg-white px-5 py-3.5 text-sm font-medium text-ink transition hover:border-primary hover:text-primary"
                    >
                      {chip.label}
                      {typeof chip.count === 'number' ? (
                        <span className="rounded-md bg-ink/6 px-1.5 py-0.5 text-xs text-ink/55">{chip.count}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            {suggestions.length > 0 ? (
              <div className="mt-8">
                <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
                  <span aria-hidden="true" className="text-primary">✦</span> Recommended for you
                </h3>
                {/* A snap-scrolling row rather than a three-up grid, as the
                    reference does: suggestions can exceed three without
                    stretching the panel or dropping to a second row. Bleeds
                    into the panel padding so a card can sit half-visible at
                    the edge, which is what signals there is more to scroll. */}
                <ul className="-mx-6 mt-5 flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-2 sm:-mx-10 sm:px-10 [scrollbar-width:thin]">
                  {suggestions.map((s) => (
                    <li key={s.href} className="w-[19rem] shrink-0 snap-start">
                      <Link href={s.href} onClick={close} className="group flex items-start gap-4">
                        {s.image ? (
                          <span className="block h-[4.75rem] w-[6.5rem] shrink-0 overflow-hidden rounded-lg bg-ink/5">
                            <Image
                              src={s.image}
                              alt=""
                              width={220}
                              height={140}
                              className="h-full w-full object-cover transition group-hover:scale-105"
                            />
                          </span>
                        ) : null}
                        <span className="block min-w-0">
                          <span className="line-clamp-2 text-sm font-semibold leading-snug text-ink group-hover:text-primary">
                            {s.title}
                          </span>
                          {s.date ? (
                            <span className="mt-1 block text-xs text-ink/45">
                              {s.date}
                              {typeof s.comments === 'number' ? ` · ${s.comments}` : ''}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
