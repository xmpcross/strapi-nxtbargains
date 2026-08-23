import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import BestSellerCard from '@/components/BestSellerCard';
import BestSellerCategoryTabs from '@/components/BestSellerCategoryTabs';
import {
  BEST_SELLER_MARKETPLACES,
  getBestSellerMarketplace,
  listAmazonNewReleases,
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
  const newReleases = marketplace.key === 'amazon' ? listAmazonNewReleases() : [];
  const categoryGroups = listBestSellerCategoryGroupsForMarketplace(marketplace.key);
  const showCategoryGroups = categoryGroups.length > 1 || categoryGroups[0]?.key !== 'top-products';

  return (
    <main data-page="best-sellers" data-testid={`best-sellers-${marketplace.key}-page`}>
      {/* Hero — matches /products */}
      <section className="page-hero" data-testid="best-sellers-page-header">
        <div className="page-hero-inner">
          <nav className="page-hero-crumbs">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <Link href="/best-sellers" className="transition hover:text-ink">Best sellers</Link>
            <span aria-hidden>/</span>
            <span className="page-hero-crumbs-current">{marketplace.label}</span>
          </nav>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-start">
            <div>
              <p className="page-hero-eyebrow">Best sellers</p>
              <h1 className="page-hero-title">
                {marketplace.label} best sellers, ranked.
              </h1>
              <p className="page-hero-desc">
              {marketplace.description} Rankings refresh daily, so the order reflects what is moving now
              rather than an all-time list. Prices and availability change fast &mdash; confirm the final
              details on {marketplace.label} before you buy.
            </p>
            </div>

            {/* stats card */}
            <div className="page-hero-panel p-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink/50">At a glance</p>
              <dl className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink/50">Products ranked</dt>
                  <dd className="mt-1 font-display text-3xl font-bold text-ink">{items.length.toLocaleString()}</dd>
                </div>
                {showCategoryGroups ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-ink/50">Categories</dt>
                    <dd className="mt-1 font-display text-3xl font-bold text-ink">{categoryGroups.length}</dd>
                  </div>
                ) : (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-ink/50">Marketplace</dt>
                    <dd className="mt-1 font-display text-xl font-bold text-ink">{marketplace.label}</dd>
                  </div>
                )}
                <div className="col-span-2 border-t border-ink/12 pt-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink/50">Refresh</dt>
                  <dd className="mt-1 text-sm font-semibold text-ink/75">Rankings update daily</dd>
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

      {newReleases.length > 0 ? (
        <section className="border-t border-ink/10 bg-white py-10 sm:py-12" data-testid="amazon-new-releases">
          <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3 border border-ink/10 bg-white p-5 sm:p-6">
              <div>
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-primary">Just launched</p>
                <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">New on Amazon</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/55">The newest electronics releases on Amazon, refreshed weekly.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
              {newReleases.map((item) => (
                <BestSellerCard key={`newrelease-${item.asin || item.rank}`} item={item} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
