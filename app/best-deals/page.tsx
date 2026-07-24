import Link from 'next/link';
import type { Metadata } from 'next';
import fs from 'node:fs/promises';
import path from 'node:path';
import DealProductCard from '@/components/DealProductCard';
import { SITE } from '@/lib/site';
import { bestOffer, collectOfferRows, numericValue, offerPrice, type CommerceOfferRow } from '@/lib/commerce';
import { flushGeniusCache, monetizeUrl } from '@/lib/coupon-data';
import { listCommerceProductsForDeals, type CommerceProduct } from '@/lib/strapi';

export const revalidate = 120;

export const metadata: Metadata = {
  title: 'Best Deals',
  description: 'Shop the strongest current product discounts and merchant offers tracked by NXT.Bargains.',
  alternates: { canonical: '/best-deals' },
};

type BestDeal = {
  product: CommerceProduct;
  row: CommerceOfferRow;
  discount: number;
  savings: number;
};

type RealTimeBestDeal = {
  id: string;
  title: string;
  store: string;
  price: string | null;
  priceValue: number | null;
  originalPrice: string | null;
  originalPriceValue: number | null;
  discountPercent: number;
  savingsValue: number;
  image: string;
  rating: number | null;
  ratingCount: number | null;
  shipping: string | null;
  condition: string | null;
  favicon: string | null;
  url: string;
  query: string;
};

type RealTimeBestDealsCache = {
  source?: string;
  capturedAt?: string;
  queries?: string[];
  items?: RealTimeBestDeal[];
};

export default async function BestDealsPage() {
  const { items: realTimeDeals, capturedAt, queries } = await loadRealTimeBestDeals();
  const products = realTimeDeals.length > 0
    ? [] as CommerceProduct[]
    : await listCommerceProductsForDeals(160).catch(() => [] as CommerceProduct[]);

  const catalogDeals = products
    .map((product) => {
      const row = bestOffer(collectOfferRows(product));
      if (!row) return null;
      const stats = dealStats(row);
      if (stats.discount <= 0 && stats.savings <= 0) return null;
      return { product, row, ...stats };
    })
    .filter((deal): deal is BestDeal => Boolean(deal))
    .sort((a, b) => b.discount - a.discount || b.savings - a.savings)
    .slice(0, 36);

  const usingRealtime = realTimeDeals.length > 0;
  const dealCount = usingRealtime ? realTimeDeals.length : catalogDeals.length;
  const topDiscount = usingRealtime
    ? Math.max(0, ...realTimeDeals.map((d) => d.discountPercent))
    : catalogDeals[0]?.discount ?? 0;
  const avgDiscount = usingRealtime && realTimeDeals.length > 0
    ? Math.round(realTimeDeals.reduce((sum, d) => sum + d.discountPercent, 0) / realTimeDeals.length)
    : catalogDeals.length > 0
      ? Math.round(catalogDeals.reduce((sum, d) => sum + d.discount, 0) / catalogDeals.length)
      : 0;
  const stores = usingRealtime
    ? new Set(realTimeDeals.map((d) => d.store)).size
    : new Set(catalogDeals.map((d) => d.row.offer.merchant?.name || 'Merchant')).size;

  const featuredRealtime = realTimeDeals.slice(0, 4);
  const featuredCatalog = catalogDeals.slice(0, 4);

  const updatedLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(capturedAt ? new Date(capturedAt) : new Date());

  const pageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Best Deals',
    url: `${SITE.url}/best-deals`,
    description: metadata.description,
    numberOfItems: dealCount,
  };

  return (
    <main data-testid="best-deals-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd) }}
      />

      <Hero
        dealCount={dealCount}
        topDiscount={topDiscount}
        avgDiscount={avgDiscount}
        storeCount={stores}
        updatedLabel={updatedLabel}
        sourceLabel={usingRealtime ? 'Live merchant search' : 'Product catalog'}
      />

      {dealCount > 0 ? (
        <section className="border-b border-ink/10 bg-[#f0f2f4] py-10 sm:py-12" data-testid="featured-deals">
          <div className="mx-auto max-w-[1366px] px-6">
            <SectionHead
              eyebrow="Top picks"
              title="Highest discounts right now"
              subtitle="The strongest savings from today's tracked merchant offers."
            />
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {usingRealtime
                ? featuredRealtime.map((deal) => (
                    <RealTimeDealCard key={`featured-${deal.id}-${deal.url}`} deal={deal} featured />
                  ))
                : featuredCatalog.map((deal) => (
                    <DealProductCard
                      key={`featured-${deal.product.id}-${deal.row.offer.id}`}
                      product={deal.product}
                      row={deal.row}
                      metric={{ label: 'Save', value: `${deal.discount}%`, tone: 'green' }}
                      note={deal.savings > 0 ? `Estimated savings ${formatPlainMoney(deal.savings, deal.row.offer.currency ?? 'USD')}` : undefined}
                      titleAs="h4"
                    />
                  ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="bg-white py-10 sm:py-14" id="all-deals">
        <div className="mx-auto max-w-[1366px] px-6">
          <SectionHead
            eyebrow="All deals"
            title="Every deal on this page"
            subtitle={
              dealCount > 0
                ? `${dealCount} offers ranked by discount. Final prices can change at checkout — verify shipping, condition, and seller details on the merchant site.`
                : 'No discounted offers are available right now.'
            }
          />

          {queries.length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {queries.map((query) => (
                <span
                  key={query}
                  className="border border-ink/10 bg-[#f0f2f4] px-3 py-1.5 text-xs font-bold text-ink/60"
                >
                  {query}
                </span>
              ))}
            </div>
          ) : null}

          {usingRealtime ? (
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {realTimeDeals.map((deal) => (
                <RealTimeDealCard key={`${deal.id}-${deal.url}`} deal={deal} />
              ))}
            </div>
          ) : catalogDeals.length > 0 ? (
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {catalogDeals.map((deal) => (
                <DealProductCard
                  key={`${deal.product.id}-${deal.row.offer.id}`}
                  product={deal.product}
                  row={deal.row}
                  metric={{ label: 'Save', value: `${deal.discount}%`, tone: 'green' }}
                  note={deal.savings > 0 ? `Estimated savings ${formatPlainMoney(deal.savings, deal.row.offer.currency ?? 'USD')}` : undefined}
                  titleAs="h4"
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No discounted offers yet"
              body="Run the Real-Time Product Search best deals refresh or add merchant offers with original prices to populate this page."
            />
          )}
        </div>
      </section>

      <section className="border-t border-ink/10 bg-[#f0f2f4] py-10">
        <div className="mx-auto max-w-[1366px] px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <BrowseCard href="/price-drops" title="Price drops" subtitle="Recently tracked price movements" />
            <BrowseCard href="/products" title="All products" subtitle="Compare offers across merchants" />
            <BrowseCard href="/coupons" title="Coupons" subtitle="Promo codes and store deals" />
            <BrowseCard href="/deals" title="Buying guides" subtitle="Editorial deals and roundups" />
          </div>
        </div>
      </section>

      <ValueStrip usingRealtime={usingRealtime} />
    </main>
  );
}

function Hero({
  dealCount,
  topDiscount,
  avgDiscount,
  storeCount,
  updatedLabel,
  sourceLabel,
}: {
  dealCount: number;
  topDiscount: number;
  avgDiscount: number;
  storeCount: number;
  updatedLabel: string;
  sourceLabel: string;
}) {
  return (
    <section className="relative overflow-hidden border-b border-ink/10 bg-[#1d252c] text-white">
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
          <span className="text-[#ffe000]">Best deals</span>
        </nav>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ffe000]">NXT.Bargains deals</p>
            <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
              Best deals across live merchant offers
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
              Products ranked by current sale pricing from Real-Time Product Search,
              with catalog offers used as a fallback when live data is unavailable.
            </p>

            <ul className="mt-6 max-w-2xl space-y-3 text-sm leading-6 text-white/75 sm:text-base">
              <li className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-[#ffe000]" aria-hidden>✓</span>
                <span>Ranked by real discount — the biggest savings surface first.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-[#ffe000]" aria-hidden>✓</span>
                <span>Live offers from Amazon, eBay, Walmart, Newegg, and Best Buy.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-[#ffe000]" aria-hidden>✓</span>
                <span>Final price, shipping, and condition confirmed on the merchant site.</span>
              </li>
            </ul>

            <div className="mt-10 flex flex-wrap gap-3">
              <a href="#all-deals" className="inline-flex bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary-emphasis">
                View all deals
              </a>
              <Link href="/price-drops" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white/80 transition hover:border-white/40 hover:text-white">
                Price drops
              </Link>
              <Link href="/products" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white/75 transition hover:border-white/40 hover:text-white">
                All products
              </Link>
            </div>
          </div>

          <aside className="border border-white/15 bg-white/5 p-5 backdrop-blur sm:p-6" aria-label="Best deals statistics">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ffe000]">At a glance</p>
            <p className="mt-3 text-sm leading-6 text-white/70">
              {dealCount > 0
                ? `A live snapshot of the ${dealCount} strongest deals we're tracking right now, ranked by discount across major marketplaces.`
                : 'Deals appear here as live merchant offers with sale pricing are tracked across major marketplaces.'}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-5">
              <Stat label="Live deals" value={String(dealCount)} />
              <Stat label="Top discount" value={dealCount > 0 ? `${topDiscount}%` : '—'} />
              <Stat label="Avg. savings" value={dealCount > 0 ? `${avgDiscount}%` : '—'} />
              <Stat label="Stores" value={String(storeCount)} />
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 text-xs text-white/55">
              <span>Updated {updatedLabel}</span>
              <span className="font-semibold text-[#ffe000]">{sourceLabel}</span>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-white/55">{label}</p>
    </div>
  );
}

function SectionHead({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
      <h2 className="mt-2 font-display font-bold text-ink">{title}</h2>
      {subtitle ? <p className="mt-3 text-sm leading-7 text-ink/60 sm:text-base">{subtitle}</p> : null}
    </div>
  );
}

function BrowseCard({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Link
      href={href}
      className="group flex flex-col border border-ink/10 bg-white p-5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_14px_28px_-20px_rgba(13,27,42,0.35)]"
    >
      <h4 className="font-display text-base font-bold text-ink group-hover:text-primary">{title}</h4>
      <p className="mt-1 text-sm text-ink/55">{subtitle}</p>
      <span className="mt-3 text-xs font-bold uppercase tracking-[0.1em] text-primary">Browse →</span>
    </Link>
  );
}

async function loadRealTimeBestDeals() {
  try {
    const file = await fs.readFile(path.join(process.cwd(), 'data', 'best-deals-realtime.json'), 'utf8');
    const cache = JSON.parse(file) as RealTimeBestDealsCache;
    const items = (cache.items ?? [])
      .filter((item) => item.title && item.image && item.url && item.priceValue !== null)
      .sort((a, b) => b.discountPercent - a.discountPercent || b.savingsValue - a.savingsValue)
      .slice(0, 36);
    // The source feed links to Google Shopping. Route each outbound link through
    // the affiliate wrapper (Impact deep-link when the domain qualifies, else a
    // GeniusLink short URL) so clicks resolve to the merchant with our affiliate
    // ID embedded instead of dropping the user on a Google Shopping page.
    // Sequential (not Promise.all) to avoid the geni.us API rate-limiting bursts.
    const monetized: RealTimeBestDeal[] = [];
    for (const item of items) {
      monetized.push({ ...item, url: await monetizeUrl(item.url) });
    }
    flushGeniusCache();
    return {
      items: monetized,
      capturedAt: cache.capturedAt,
      queries: cache.queries ?? [],
    };
  } catch {
    return { items: [] as RealTimeBestDeal[], capturedAt: undefined, queries: [] as string[] };
  }
}

function dealStats(row: CommerceOfferRow) {
  const explicitDiscount = numericValue(row.offer.discountPercent);
  const price = offerPrice(row.offer);
  const original = numericValue(row.offer.originalPrice);
  const calculatedDiscount = price !== null && original !== null && original > price
    ? Math.round(((original - price) / original) * 100)
    : 0;
  const discount = Math.max(0, Math.round(explicitDiscount ?? calculatedDiscount));
  const savings = price !== null && original !== null && original > price ? original - price : 0;
  return { discount, savings };
}

function formatPlainMoney(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

// Known merchants → local brand wordmark. Anything else falls back to the
// deal's favicon, then a favicon derived from the product URL's domain.
const REALTIME_STORE_LOGOS: Array<[RegExp, string]> = [
  [/amazon/, '/logos/amazon-logo.svg'],
  [/\bebay\b/, '/logos/ebay-logo.svg'],
  [/wal-?mart/, '/logos/walmart-logo.svg'],
  [/newegg/, '/logos/newegg-logo.svg'],
  [/target/, '/logos/target-logo.svg'],
  [/\bdell\b/, '/logos/dell-logo.svg'],
  [/\bhp\b/, '/logos/hp-logo.svg'],
  [/lenovo/, '/logos/lenovo-logo.svg'],
  [/samsung/, '/logos/samsung-logo.svg'],
  [/apple/, '/logos/apple-logo.svg'],
  [/argos/, '/logos/argos-logo.svg'],
  [/nike/, '/logos/nike-logo.svg'],
];

function domainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function realtimeStoreLogo(deal: RealTimeBestDeal): string | null {
  const name = deal.store.toLowerCase();
  const local = REALTIME_STORE_LOGOS.find(([pattern]) => pattern.test(name))?.[1];
  if (local) return local;
  if (deal.favicon) return deal.favicon;
  const domain = domainFromUrl(deal.url);
  return domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128` : null;
}

function RealTimeDealCard({ deal, featured = false }: { deal: RealTimeBestDeal; featured?: boolean }) {
  const discount = Math.max(0, Math.round(deal.discountPercent || 0));
  const savings = deal.savingsValue > 0 ? formatPlainMoney(deal.savingsValue, 'USD') : null;
  const storeLogo = realtimeStoreLogo(deal);
  const meta = [deal.shipping, deal.condition, deal.rating ? `Rated ${deal.rating}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <article
      className={`group grid gap-0 border bg-white transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-20px_rgba(13,27,42,0.35)] sm:grid-cols-[160px_minmax(0,1fr)] ${
        featured ? 'border-primary/25 shadow-[0_12px_24px_-18px_rgba(0,70,190,0.2)]' : 'border-ink/10 hover:border-primary/30'
      }`}
    >
      <a
        href={deal.url}
        target="_blank"
        rel="nofollow sponsored noopener noreferrer"
        className="flex min-h-[170px] items-center justify-center border-b border-ink/10 bg-white p-4 sm:border-b-0 sm:border-r"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={deal.image}
          alt={deal.title}
          referrerPolicy="no-referrer"
          className="max-h-36 w-full object-contain mix-blend-multiply transition duration-300 group-hover:scale-[1.03]"
        />
      </a>

      <div className="flex min-w-0 flex-col p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
            Save {discount}%
          </span>
          {storeLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={storeLogo}
              alt={deal.store}
              title={deal.store}
              referrerPolicy="no-referrer"
              className="h-6 max-w-[112px] object-contain object-right"
            />
          ) : (
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{deal.store}</span>
          )}
          {featured ? (
            <span className="w-full rounded bg-primary/10 px-2 py-1 text-center text-[0.6rem] font-bold uppercase tracking-wider text-primary sm:ml-auto sm:w-auto">
              Top pick
            </span>
          ) : null}
        </div>

        <a href={deal.url} target="_blank" rel="nofollow sponsored noopener noreferrer" className="mt-3 block">
          <h5 className="line-clamp-2 font-display text-lg font-bold leading-snug text-ink transition group-hover:text-primary">
            {deal.title}
          </h5>
        </a>

        <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink/60">
          {meta || `Current offer from ${deal.store}.`}
        </p>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-4">
          <div>
            {deal.originalPrice && deal.originalPriceValue !== null && deal.priceValue !== null && deal.originalPriceValue > deal.priceValue ? (
              <p className="text-sm text-ink/35 line-through">{deal.originalPrice}</p>
            ) : null}
            <p className="font-display text-2xl font-bold text-ink">{deal.price ?? 'Check price'}</p>
            <p className="mt-1 text-xs text-ink/45">
              {savings ? `Est. savings ${savings}` : deal.store}
            </p>
          </div>
          <a
            href={deal.url}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            className="inline-flex bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-white transition hover:bg-primary-emphasis"
          >
            View deal
          </a>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-8 border border-dashed border-ink/15 bg-[#f0f2f4] p-10 text-center">
      <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-ink/60">{body}</p>
    </div>
  );
}

function ValueStrip({ usingRealtime }: { usingRealtime: boolean }) {
  const items = [
    {
      ic: '⚡',
      t: usingRealtime ? 'Live merchant search' : 'Catalog fallback',
      s: usingRealtime
        ? 'Deals ranked from Real-Time Product Search across major retailers.'
        : 'Showing catalog offers with tracked original and sale pricing.',
    },
    { ic: '✓', t: 'Verified at checkout', s: 'Final price, shipping, and eligibility are confirmed on the merchant site.' },
    { ic: '→', t: 'More ways to save', s: 'Track price drops, browse coupons, and compare products on NXT.Bargains.' },
  ];
  return (
    <div className="border-t border-ink/10 bg-muted">
      <div className="mx-auto grid max-w-[1366px] gap-6 px-6 py-10 sm:grid-cols-3">
        {items.map((v) => (
          <div key={v.t} className="flex items-start gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-lg">{v.ic}</span>
            <div>
              <div className="font-display text-[0.96rem] font-semibold text-ink">{v.t}</div>
              <div className="mt-0.5 text-[0.85rem] leading-6 text-ink/55">{v.s}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
