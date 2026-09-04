'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { SITE } from '@/lib/site';
import type { NavItem } from './Header';

export default function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-ink/15 bg-white text-ink transition hover:border-primary md:hidden"
        data-testid="mobile-nav-toggle"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden
        >
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="14" y2="17" />
        </svg>
      </button>

      {/* Drawer — full screen slide-down. Always rendered, transitions in/out. */}
      <div
        id="mobile-nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        className={`fixed inset-0 z-[60] md:hidden ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
        data-testid="mobile-nav-drawer"
      >
        {/* Backdrop */}
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-ink/40 backdrop-blur-sm transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden
        />
        {/* Panel */}
        <div
          className={`absolute inset-x-0 top-0 origin-top bg-paper shadow-2xl transition duration-200 ease-out ${open ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}
        >
          <div className="flex items-center justify-between border-b border-ink/10 px-4 py-4 sm:px-6">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="block shrink-0"
              aria-label={`${SITE.name} home`}
            >
              <Image
                src="/nxt_bargains_logo.png"
                alt={SITE.name}
                width={450}
                height={218}
                className="h-10 w-auto"
              />
            </Link>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-ink/15 bg-white text-ink transition hover:border-primary"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden
              >
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>

          <div className="px-4 pb-8 pt-5 sm:px-6">
            <form
              action="/search"
              method="get"
              role="search"
              className="flex items-center gap-2 rounded-2xl border border-ink/15 bg-white px-4 py-3 focus-within:border-primary focus-within:shadow-[0_0_0_4px_rgba(0,70,190,0.12)]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 shrink-0 text-ink/45"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                name="q"
                placeholder="Search or paste a product link…"
                autoComplete="off"
                className="h-6 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink/40"
                aria-label="Search"
              />
            </form>

            <nav aria-label="Primary" className="mt-6">
              <ul className="divide-y divide-ink/10">
                {items.map((item) => (
                  <li key={`${item.label}-${item.href}`}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between py-4 text-lg font-semibold tracking-tight text-ink transition hover:text-primary"
                    >
                      {item.label}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 text-ink/30"
                        aria-hidden
                      >
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </Link>
                    {item.children && (
                      <ul className="pb-3 pl-4">
                        {item.children.map((child) => (
                          <li key={child.href || child.label}>
                            {child.children?.length ? (
                              <>
                                <p className="py-2 text-xs font-bold uppercase tracking-[0.14em] text-ink/45">
                                  {child.label}
                                </p>
                                <ul className="pb-2 pl-3">
                                  {child.children.map((nested) => (
                                    <li key={nested.href}>
                                      <Link
                                        href={nested.href}
                                        onClick={() => setOpen(false)}
                                        className="block py-2 text-sm font-semibold text-ink/65 transition hover:text-primary"
                                      >
                                        {nested.label}
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              </>
                            ) : (
                              <Link
                                href={child.href!}
                                onClick={() => setOpen(false)}
                                className="block py-2 text-sm font-semibold text-ink/65 transition hover:text-primary"
                              >
                                {child.label}
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </>
  );
}
