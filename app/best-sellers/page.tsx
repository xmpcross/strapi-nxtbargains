import Link from 'next/link';
import type { Metadata } from 'next';
import BestSellerCard from '@/components/BestSellerCard';
import { BEST_SELLER_MARKETPLACES, listBestSellersForMarketplace } from '@/lib/best-sellers';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Best Sellers — Top Products Across Every Marketplace',
  description:
    'The best-selling products on Amazon, eBay, Walmart, Target, Best Buy and Newegg — ranked and refreshed daily. Compare top sellers across marketplaces in one place.',
  alternates: { canonical: '/best-sellers' },
};

const PREVIEW_COUNT = 8;

export default function BestSellersIndexPage() {
  const groups = BEST_SELLER_MARKETPLACES.map((marketplace) => ({
    ...marketplace,
    items: listBestSellersForMarketplace(marketplace.key),
  })).filter((group) => group.items.length > 0);

  const totalProducts = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <main data-page="best-sellers" data-testid="best-sellers-index-page">
      {/* Hero — matches the /products header */}
      <section className="page-hero" data-testid="best-sellers-page-header">
        <div className="page-hero-inner">
          <nav className="page-hero-crumbs">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <span className="page-hero-crumbs-current">Best sellers</span>
          </nav>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-start">
            <div>
              <p className="page-hero-eyebrow">NXT.Bargains best sellers</p>
              <h1 className="page-hero-title">
                The top-selling products across every marketplace.
              </h1>
              <p className="page-hero-desc">
              See what is genuinely selling right now across Amazon, eBay, Walmart, Target, Best Buy and
              Newegg. Rankings are refreshed daily and broken out by category, so you can spot the products
              worth buying before you start shopping. Every listing links straight through to the retailer
              for the current price.
            </p>
            </div>

            {/* stats card */}
            <div className="page-hero-panel p-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink/50">At a glance</p>
              <dl className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink/50">Products ranked</dt>
                  <dd className="mt-1 font-display text-3xl font-bold text-ink">{totalProducts.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink/50">Marketplaces</dt>
                  <dd className="mt-1 font-display text-3xl font-bold text-ink">{groups.length}</dd>
                </div>
                <div className="col-span-2 border-t border-ink/12 pt-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink/50">Refresh</dt>
                  <dd className="mt-1 text-sm font-semibold text-ink/75">Rankings update daily</dd>
                </div>
              </dl>
              <nav className="mt-5 flex flex-wrap gap-2" aria-label="Jump to marketplace">
                {groups.map((group) => (
                  <a key={group.key} href={`#best-sellers-${group.key}`} className="page-hero-pill px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.1em]">
                    {group.label}
                  </a>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </section>

      {/* Marketplace sections — products listed under each merchant */}
      <section id="marketplaces" className="bg-white py-10 sm:py-14">
        <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
          {groups.length === 0 ? (
            <div className="border border-ink/10 bg-white p-8">
              <h2 className="font-display text-2xl font-bold text-ink">Best sellers are refreshing</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-ink/60">Check back shortly — the marketplace rankings repopulate on the next refresh.</p>
            </div>
          ) : (
            <div className="space-y-12">
              {groups.map((group) => (
                <section key={group.key} id={`best-sellers-${group.key}`} aria-labelledby={`best-sellers-heading-${group.key}`} className="scroll-mt-24">
                  <div className="flex flex-wrap items-end justify-between gap-4 border border-ink/10 bg-white p-5 sm:p-6">
                    <div>
                      <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-primary">{group.items.length} products ranked</p>
                      <h2 id={`best-sellers-heading-${group.key}`} className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">
                        {group.label} best sellers
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/55">{group.description}</p>
                    </div>
                    <Link
                      href={`/best-sellers/${group.key}`}
                      className="inline-flex shrink-0 bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary-emphasis"
                    >
                      View all {group.label} →
                    </Link>
                  </div>

                  <div className="mt-5 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
                    {group.items.slice(0, PREVIEW_COUNT).map((item) => (
                      <BestSellerCard key={`${group.key}-${item.asin || item.id || item.rank}`} item={item} />
                    ))}
                  </div>

                  {group.items.length > PREVIEW_COUNT ? (
                    <div className="mt-5">
                      <Link href={`/best-sellers/${group.key}`} className="inline-flex border border-ink/15 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-ink/70 transition hover:border-primary hover:text-primary">
                        See all {group.items.length} {group.label} best sellers →
                      </Link>
                    </div>
                  ) : null}
                </section>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Explainer content */}
      <section className="border-t border-ink/10 bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">How it works</p>
          <h2 className="mt-3 max-w-3xl font-display text-2xl font-bold text-ink sm:text-3xl">
            Real rankings, refreshed daily — not a static list.
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              { t: 'Pulled from each marketplace', s: 'We read the live best-seller and top-product lists from Amazon and other major retailers, so the rankings reflect what people are actually buying now.' },
              { t: 'Ranked with the details that matter', s: 'Every product shows its rank position, star rating, review count, and any Prime, coupon, or deal badges — so you can judge it at a glance.' },
              { t: 'Updated every day', s: 'A daily refresh keeps the lists current as products rise and fall, so you are never looking at last month’s winners.' },
            ].map((card) => (
              <div key={card.t} className="border border-ink/10 bg-[#f8f9fb] p-6">
                <h3 className="font-display text-lg font-bold text-ink">{card.t}</h3>
                <p className="mt-3 text-sm leading-6 text-ink/60">{card.s}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-3xl text-sm leading-7 text-ink/55">
            Prices and availability change quickly — always confirm the final price on the retailer&apos;s site before you
            buy. As an affiliate, NXT.Bargains may earn a commission on qualifying purchases, at no extra cost to you.
          </p>
        </div>
      </section>
    </main>
  );
}
