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
            <span className="text-[#ffe000]">Best sellers</span>
          </nav>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ffe000]">NXT.Bargains best sellers</p>
              <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
                The top-selling products across every marketplace.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
                See what&apos;s actually selling right now on Amazon, eBay, Walmart, Target, Best Buy and Newegg — ranked
                by popularity and refreshed daily, so you can spot the products worth buying before you shop.
              </p>

              <ul className="mt-6 max-w-2xl space-y-3 text-sm leading-6 text-white/75 sm:text-base">
                <li className="flex gap-3"><span className="mt-0.5 shrink-0 text-[#ffe000]" aria-hidden>✓</span><span>Live best-seller rankings pulled straight from each marketplace.</span></li>
                <li className="flex gap-3"><span className="mt-0.5 shrink-0 text-[#ffe000]" aria-hidden>✓</span><span>Ratings, review counts, and Prime / deal badges at a glance.</span></li>
                <li className="flex gap-3"><span className="mt-0.5 shrink-0 text-[#ffe000]" aria-hidden>✓</span><span>Amazon broken out by category — phones, laptops, smart home and more.</span></li>
                <li className="flex gap-3"><span className="mt-0.5 shrink-0 text-[#ffe000]" aria-hidden>✓</span><span>Free to browse — no signup required.</span></li>
              </ul>

              <div className="mt-10 flex flex-wrap gap-3">
                <a href="#marketplaces" className="inline-flex bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary-emphasis">
                  Browse best sellers
                </a>
                <Link href="/all-products" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white/80 transition hover:border-white/40 hover:text-white">
                  All products
                </Link>
                <Link href="/best-deals" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white/75 transition hover:border-white/40 hover:text-white">
                  Best deals
                </Link>
              </div>
            </div>

            {/* stats card */}
            <div className="rounded-none border border-white/12 bg-white/[0.04] p-6 backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">At a glance</p>
              <dl className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-white/45">Products ranked</dt>
                  <dd className="mt-1 font-display text-3xl font-bold text-white">{totalProducts.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-white/45">Marketplaces</dt>
                  <dd className="mt-1 font-display text-3xl font-bold text-white">{groups.length}</dd>
                </div>
                <div className="col-span-2 border-t border-white/12 pt-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-white/45">Refresh</dt>
                  <dd className="mt-1 text-sm font-semibold text-white/80">Rankings update daily</dd>
                </div>
              </dl>
              <nav className="mt-5 flex flex-wrap gap-2" aria-label="Jump to marketplace">
                {groups.map((group) => (
                  <a key={group.key} href={`#best-sellers-${group.key}`} className="inline-flex border border-white/15 px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-white/70 transition hover:border-[#ffe000] hover:text-[#ffe000]">
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
