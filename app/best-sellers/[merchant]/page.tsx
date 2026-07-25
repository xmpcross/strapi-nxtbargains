import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import BestSellerCard from '@/components/BestSellerCard';
import BestSellerCategoryTabs from '@/components/BestSellerCategoryTabs';
import {
  BEST_SELLER_MARKETPLACES,
  getBestSellerMarketplace,
  listBestSellerCategoryGroupsForMarketplace,
  listBestSellersForMarketplace,
} from '@/lib/best-sellers';
import { SITE } from '@/lib/site';

export const revalidate = 300;

type Params = { merchant: string };

export function generateStaticParams() {
  return BEST_SELLER_MARKETPLACES.map((marketplace) => ({ merchant: marketplace.key }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { merchant } = await params;
  const marketplace = getBestSellerMarketplace(merchant);
  if (!marketplace) return { title: 'Best Sellers' };

  return {
    title: `${marketplace.label} Best Sellers — Top-Ranked Products`,
    description: `The top-selling ${marketplace.label} products right now, ranked and refreshed daily on ${SITE.name}. Compare ratings, badges and prices before you buy.`,
    alternates: { canonical: `/best-sellers/${marketplace.key}` },
  };
}

export default async function MarketplaceBestSellersPage({ params }: { params: Promise<Params> }) {
  const { merchant } = await params;
  const marketplace = getBestSellerMarketplace(merchant);
  if (!marketplace) notFound();

  const items = listBestSellersForMarketplace(marketplace.key);
  const categoryGroups = listBestSellerCategoryGroupsForMarketplace(marketplace.key);
  const showCategoryGroups = categoryGroups.length > 1 || categoryGroups[0]?.key !== 'top-products';

  return (
    <main data-page="best-sellers" data-testid={`best-sellers-${marketplace.key}-page`}>
      {/* Hero — matches /products */}
      <section className="relative overflow-hidden border-b border-ink/10 bg-[#1d252c] text-white" data-testid="best-sellers-page-header">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              'radial-gradient(at 80% 20%, rgba(0,70,190,0.22) 0%, transparent 50%), radial-gradient(at 15% 85%, rgba(255,224,0,0.12) 0%, transparent 50%)',
          }}
        />
        <div className="relative mx-auto max-w-[1366px] px-4 py-10 sm:px-6 sm:py-14">
          <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/45">
            <Link href="/" className="transition hover:text-white">Home</Link>
            <span aria-hidden>/</span>
            <Link href="/best-sellers" className="transition hover:text-white">Best sellers</Link>
            <span aria-hidden>/</span>
            <span className="text-[#ffe000]">{marketplace.label}</span>
          </nav>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ffe000]">Best sellers</p>
              <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
                {marketplace.label} best sellers, ranked.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
                {marketplace.description} Prices and availability change fast — confirm the final details on {marketplace.label} before you buy.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#ranking" className="inline-flex bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary-emphasis">
                  View ranking
                </a>
                <Link href="/best-sellers" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white/80 transition hover:border-white/40 hover:text-white">
                  All marketplaces
                </Link>
                <Link href="/products" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white/75 transition hover:border-white/40 hover:text-white">
                  All products
                </Link>
              </div>
            </div>

            {/* stats card */}
            <div className="border border-white/12 bg-white/[0.04] p-6 backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">At a glance</p>
              <dl className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-white/45">Products ranked</dt>
                  <dd className="mt-1 font-display text-3xl font-bold text-white">{items.length.toLocaleString()}</dd>
                </div>
                {showCategoryGroups ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-white/45">Categories</dt>
                    <dd className="mt-1 font-display text-3xl font-bold text-white">{categoryGroups.length}</dd>
                  </div>
                ) : (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-white/45">Marketplace</dt>
                    <dd className="mt-1 font-display text-xl font-bold text-white">{marketplace.label}</dd>
                  </div>
                )}
                <div className="col-span-2 border-t border-white/12 pt-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-white/45">Refresh</dt>
                  <dd className="mt-1 text-sm font-semibold text-white/80">Rankings update daily</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section id="ranking" className="bg-white py-10 sm:py-12">
        <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
          {/* marketplace switcher */}
          <div className="border border-ink/10 bg-white p-4 sm:p-5">
            <p className="mb-3 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-ink/45">Switch marketplace</p>
            <nav className="flex flex-wrap gap-2" aria-label="Best seller marketplaces">
              {BEST_SELLER_MARKETPLACES.map((option) => (
                <Link
                  key={option.key}
                  href={`/best-sellers/${option.key}`}
                  aria-current={option.key === marketplace.key ? 'page' : undefined}
                  className={`inline-flex border px-3.5 py-2 text-xs font-bold uppercase tracking-[0.1em] transition ${
                    option.key === marketplace.key
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-ink/10 bg-[#f0f2f4] text-ink/65 hover:border-primary hover:text-primary'
                  }`}
                >
                  {option.label}
                </Link>
              ))}
            </nav>
          </div>

          {items.length === 0 ? (
            <div className="mt-6 border border-ink/10 bg-white p-8">
              <h2 className="font-display text-2xl font-bold text-ink">No {marketplace.label} best sellers cached yet</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-ink/60">
                This page will populate after the next Best Sellers refresh writes the {marketplace.label} cache.
              </p>
            </div>
          ) : showCategoryGroups ? (
            <div className="mt-6">
              <div className="flex flex-wrap items-end justify-between gap-3 border border-ink/10 bg-white p-5 sm:p-6">
                <div>
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-primary">{items.length} products ranked</p>
                  <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">Top {marketplace.label} products</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/55">Pick a category to see its top-ranked products.</p>
                </div>
              </div>
              <div className="mt-5">
                <BestSellerCategoryTabs groups={categoryGroups} />
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <div className="flex flex-wrap items-end justify-between gap-3 border border-ink/10 bg-white p-5 sm:p-6">
                <div>
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-primary">{items.length} products ranked</p>
                  <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">Top {marketplace.label} products</h2>
                </div>
              </div>
              <div className="mt-5 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
                {items.map((item) => (
                  <BestSellerCard key={`${item.marketplace}-${item.asin || item.id || item.rank}`} item={item} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
