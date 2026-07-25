'use client';

import Link from 'next/link';
import { useState } from 'react';
import { bestSellerBadges, type BestSeller, type Marketplace, MARKETPLACE_LABEL } from './BestSellerCard';

type Group = { key: Marketplace; items: BestSeller[] };

export default function MarketplaceBestSellers({
  groups,
  eyebrow,
  title,
  intro,
}: {
  groups: Group[];
  eyebrow?: string;
  title?: string;
  intro?: string;
}) {
  const [active, setActive] = useState<Marketplace>(groups[0]?.key ?? 'amazon');
  if (!groups.length) return null;
  const current = groups.find((g) => g.key === active) ?? groups[0];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        {(eyebrow || title || intro) && (
          <div className="max-w-[52ch]">
            {eyebrow && <p className="text-[0.74rem] font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>}
            {title && <h2 className="mt-2 font-display !text-[clamp(1.35rem,2.4vw,1.65rem)] font-extrabold leading-[1.12] tracking-[-0.02em] text-ink">{title}</h2>}
            {intro && <p className="mt-2 text-[0.98rem] leading-relaxed text-ink/55">{intro}</p>}
          </div>
        )}

        {/* tabs */}
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-end sm:overflow-visible" role="tablist" aria-label="Marketplace">
          {groups.map((g) => (
            <button
              key={g.key}
              type="button"
              role="tab"
              aria-selected={active === g.key}
              onClick={() => setActive(g.key)}
              className={`best-seller-tab shrink-0 border bg-white px-4 py-2 font-display text-[0.78rem] font-bold leading-none transition hover:border-[#0046be] hover:text-[#0046be] sm:px-[18px] sm:text-[0.82rem] ${
                active === g.key
                  ? 'border-[#0046be] text-[#0046be] shadow-[inset_0_0_0_1px_#0046be]'
                  : 'border-[#c5cbd5] text-ink hover:bg-white'
              }`}
            >
              {MARKETPLACE_LABEL[g.key]}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 mt-6 flex justify-end">
        <Link
          href={`/best-sellers/${current.key}`}
          className="text-xs font-bold uppercase tracking-[0.14em] text-primary transition hover:text-primary-emphasis"
        >
          View all {MARKETPLACE_LABEL[current.key]}
        </Link>
      </div>

      {/* ranked list */}
      {(current?.items ?? []).length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {(current?.items ?? []).slice(0, 10).map((it, i) => {
            const badge = bestSellerBadges(it)[0];
            return (
              <a
                key={`${it.marketplace}-${it.asin || it.id || i}`}
                href={it.url}
                target="_blank"
                rel="nofollow sponsored noopener noreferrer"
                className="group flex items-center gap-3.5 rounded-[13px] border border-ink/10 bg-white p-3 transition hover:translate-x-[3px] hover:border-primary"
              >
                <span className="w-[30px] shrink-0 font-display text-[1.05rem] font-extrabold text-primary">{i + 1}</span>
                {it.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image} alt={it.title} loading="lazy" referrerPolicy="no-referrer" className="h-[64px] w-[64px] shrink-0 rounded-[9px] object-contain mix-blend-multiply" />
                ) : (
                  <span className="h-[64px] w-[64px] shrink-0 rounded-[9px] bg-muted" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="home-best-seller-title line-clamp-2 block text-[14px] leading-snug text-ink transition group-hover:text-primary">{it.title}</span>
                  <span className="mt-0.5 block text-[0.76rem] text-ink/55">
                    {it.rating ? <span className="font-semibold text-primary">★ {it.rating}</span> : null}
                    {it.rating ? ' · ' : ''}
                    {MARKETPLACE_LABEL[it.marketplace ?? active]}
                    {badge ? ` · ${badge}` : ''}
                  </span>
                </span>
                <span className="shrink-0 font-display text-[0.95rem] font-bold text-ink">{it.price ?? ''}</span>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="border border-ink/10 bg-white p-6 text-sm leading-6 text-ink/60">
          {MARKETPLACE_LABEL[current.key]} best sellers will appear here after the next refresh.
        </div>
      )}
    </div>
  );
}
