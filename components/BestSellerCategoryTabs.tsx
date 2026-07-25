'use client';

import { useState } from 'react';
import BestSellerCard, { type BestSeller } from '@/components/BestSellerCard';

export type BestSellerCategoryTab = {
  key: string;
  label: string;
  items: BestSeller[];
};

/**
 * Segmented pill tab control for a marketplace's best-seller categories
 * (styled after the iconscout converter tabs): a rounded light container with
 * the active tab as a white pill and the others muted. Switching a tab swaps
 * the visible product grid. All categories stay in the DOM (hidden when
 * inactive) so every product remains crawlable.
 */
export default function BestSellerCategoryTabs({ groups }: { groups: BestSellerCategoryTab[] }) {
  const [active, setActive] = useState(groups[0]?.key ?? '');

  if (groups.length === 0) return null;

  return (
    <div>
      <div className="overflow-x-auto">
        <div
          role="tablist"
          aria-label="Best seller categories"
          className="inline-flex min-w-full gap-1 rounded-2xl bg-[#e9eaf1] p-1.5"
        >
          {groups.map((group) => {
            const selected = group.key === active;
            return (
              <button
                key={group.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(group.key)}
                className={`flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  selected
                    ? 'bg-white text-ink shadow-[0_1px_3px_rgba(13,27,42,0.14)]'
                    : 'text-ink/45 hover:text-ink/80'
                }`}
              >
                {group.label}
                <span className={`ml-1.5 text-xs ${selected ? 'text-ink/40' : 'text-ink/30'}`}>{group.items.length}</span>
              </button>
            );
          })}
        </div>
      </div>

      {groups.map((group) => (
        <div
          key={group.key}
          role="tabpanel"
          hidden={group.key !== active}
          className="mt-6 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4"
        >
          {group.items.map((item) => (
            <BestSellerCard key={`${group.key}-${item.marketplace}-${item.asin || item.id || item.rank}`} item={item} />
          ))}
        </div>
      ))}
    </div>
  );
}
