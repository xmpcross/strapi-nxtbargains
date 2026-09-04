import Link from 'next/link';
import type { Metadata } from 'next';
import fs from 'node:fs/promises';
import path from 'node:path';
import DealProductCard from '@/components/DealProductCard';
import { SITE } from '@/lib/site';
import { bestOffer, collectOfferRows, isGeniusLinkUrl, numericValue, offerPrice, type CommerceOfferRow } from '@/lib/commerce';
import { monetizeUrl } from '@/lib/coupon-data';
import { listCommerceProductsForDeals, type CommerceProduct } from '@/lib/strapi';
import { collectionPageJsonLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';
import DealFilterCarousel from '@/components/DealFilterCarousel';

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

const POPULAR_CATEGORY_FILTERS = ['smartphone', 'headphones', 'smartwatch', 'laptop', 'smart tv', 'tablet'];
const POPULAR_RETAILER_FILTERS = [
  'amazon deals', 'best buy deals', 'walmart deals', 'ebay deals', 'target deals',
  'newegg deals', 'dell deals', 'hp deals', 'lenovo deals', 'samsung deals',
];

export default async function BestDealsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: requestedFilter } = await searchParams;
  const { items: realTimeDeals, queries } = await loadRealTimeBestDeals();
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
  const featuredRealtime = realTimeDeals.slice(0, 4);
  const featuredCatalog = catalogDeals.slice(0, 4);
  const selectedFilter = requestedFilter && queries.includes(requestedFilter) ? requestedFilter : null;
  const categoryQueries = queries.filter((query) => POPULAR_CATEGORY_FILTERS.includes(query));
  const retailerQueries = queries.filter((query) => POPULAR_RETAILER_FILTERS.includes(query));
  const selectedCategory = selectedFilter && categoryQueries.includes(selectedFilter) ? selectedFilter : null;
  const selectedRetailer = selectedFilter && retailerQueries.includes(selectedFilter) ? selectedFilter : null;
  const categoryDeals = realTimeDeals.filter((deal) =>
    selectedCategory ? deal.query === selectedCategory : categoryQueries.includes(deal.query)
  ).slice(0, 12);
  const retailerDeals = realTimeDeals.filter((deal) =>
    selectedRetailer ? deal.query === selectedRetailer : retailerQueries.includes(deal.query)
  ).slice(0, 12);

  const pageJsonLd = collectionPageJsonLd({
    name: 'Best Deals',
    url: `${SITE.url}/best-deals`,
    description: metadata.description,
    numberOfItems: dealCount,
  });

  return (
    <main data-testid="best-deals-page">
      <JsonLd graph={[pageJsonLd]} />

      <Hero />

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
                    <RealTimeDealCard key={`featured-${deal.query}-${deal.id}-${deal.url}`} deal={deal} featured />
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
            title="Deal on popular categories"
            subtitle={
              dealCount > 0
                ? `${usingRealtime ? categoryDeals.length : catalogDeals.length} offers across popular product categories. Choose a category to narrow the results.`
                : 'No discounted offers are available right now.'
            }
          />

          <DealFilterCarousel queries={categoryQueries} selected={selectedCategory} anchor="all-deals" autoSlide />

          {usingRealtime && categoryDeals.length > 0 ? (
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {categoryDeals.map((deal) => (
                <RealTimeDealCard key={`${deal.query}-${deal.id}-${deal.url}`} deal={deal} />
              ))}
            </div>
          ) : selectedCategory ? (
            <EmptyState
              title={`No ${selectedCategory} deals right now`}
              body="Try another filter or check back after the next live merchant refresh."
            />
          ) : catalogDeals.length > 0 ? (
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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

      <section className="border-t border-ink/10 bg-[#f0f2f4] py-10 sm:py-14" id="retailer-deals">
        <div className="mx-auto max-w-[1366px] px-6">
          <SectionHead
            eyebrow="Shop by store"
            title="Deals on popular retailers, marketplaces and brands"
            subtitle={`${retailerDeals.length} offers from well-known stores and technology brands. Choose a name to view its related deals.`}
          />
          <DealFilterCarousel queries={retailerQueries} selected={selectedRetailer} anchor="retailer-deals" />
          {retailerDeals.length > 0 ? (
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {retailerDeals.map((deal) => (
                <RealTimeDealCard key={`retailer-${deal.query}-${deal.id}-${deal.url}`} deal={deal} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No retailer deals right now"
              body="Try another retailer or check back after the next live merchant refresh."
            />
          )}
        </div>
      </section>

      <section className="border-t border-ink/10 bg-white py-10">
        <div className="mx-auto max-w-[1366px] px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <BrowseCard href="/price-drops" title="Price drops" subtitle="Recently tracked price movements" />
            <BrowseCard href="/all-products" title="All products" subtitle="Compare offers across merchants" />
            <BrowseCard href="/coupons" title="Coupons" subtitle="Promo codes and store deals" />
            <BrowseCard href="/deals" title="Buying guides" subtitle="Editorial deals and roundups" />
          </div>
        </div>
      </section>

      <ValueStrip usingRealtime={usingRealtime} />
    </main>
  );
}

function Hero() {
  return (
    <section className="page-hero">
      <div className="page-hero-inner">
        <nav className="page-hero-crumbs">
          <Link href="/">Home</Link>
          <span aria-hidden>/</span>
          <span className="page-hero-crumbs-current">Best deals</span>
        </nav>

        <div className="mt-8 w-full">
          <p className="page-hero-eyebrow">NXT.Bargains deals</p>
          <h1 className="page-hero-title">
            Best deals across live merchant offers
          </h1>
          <p className="page-hero-desc">
            The largest current discounts across every retailer we track, ranked by how far each price
            has actually fallen. Live pricing comes from Real-Time Product Search, with our own catalogue
            offers used as a fallback whenever live data is unavailable. Deals move quickly, so confirm the
            final price on the retailer page before you commit.
          </p>
        </div>
      </div>
    </section>
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

// The realtime feed links to Google Shopping. Turn a deal into the merchant's
// own product-search URL (store + title) so the affiliate wrapper sends users to
// the actual retailer, not a Google Shopping results page.
const MERCHANT_SEARCH: Array<[RegExp, (q: string) => string]> = [
  [/wal.?mart/i, (q) => `https://www.walmart.com/search?q=${q}`],
  [/best.?buy/i, (q) => `https://www.bestbuy.com/site/searchpage.jsp?st=${q}`],
  [/target/i, (q) => `https://www.target.com/s?searchTerm=${q}`],
  [/newegg/i, (q) => `https://www.newegg.com/p/pl?d=${q}`],
  [/\bdell\b/i, (q) => `https://www.dell.com/en-us/search/${q}`],
  [/\bhp\b/i, (q) => `https://www.hp.com/us-en/shop/SiteSearch?keyword=${q}`],
  [/lenovo/i, (q) => `https://www.lenovo.com/us/en/search?text=${q}`],
  [/samsung/i, (q) => `https://www.samsung.com/us/search/searchMain/?listType=g&searchTerm=${q}`],
  [/\bsony\b/i, (q) => `https://electronics.sony.com/search?text=${q}`],
  [/staples/i, (q) => `https://www.staples.com/search?query=${q}`],
  [/\bbj'?s\b/i, (q) => `https://www.bjs.com/search/${q}`],
  [/instacart/i, (q) => `https://www.instacart.com/store/s?k=${q}`],
  [/\bebay\b/i, (q) => `https://www.ebay.com/sch/i.html?_nkw=${q}`],
  [/amazon/i, (q) => `https://www.amazon.com/s?k=${q}`],
];

function merchantDealUrl(store: string, title: string, fallback: string): string {
  const q = encodeURIComponent(title.trim().slice(0, 150));
  const match = MERCHANT_SEARCH.find(([re]) => re.test(store));
  if (match) return match[1](q);
  // Unknown single-word merchant: guess its .com; else keep the original link.
  const slug = store.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (slug && !/\s/.test(store.trim())) return `https://www.${slug}.com/`;
  // Keeping a dead Geniuslink here would ship a 410 as the deal's only link.
  return isGeniusLinkUrl(fallback) ? '' : fallback;
}

async function loadRealTimeBestDeals() {
  try {
    const file = await fs.readFile(path.join(process.cwd(), 'data', 'best-deals-realtime.json'), 'utf8');
    const cache = JSON.parse(file) as RealTimeBestDealsCache;
    const items = (cache.items ?? [])
      .filter((item) => item.title && item.image && item.url && item.priceValue !== null)
      .sort((a, b) => b.discountPercent - a.discountPercent || b.savingsValue - a.savingsValue)
      .slice(0, 192);
    // Replace the Google Shopping link with the merchant's own search URL, then
    // affiliate-wrap it (Impact deep-link when the domain qualifies — e.g.
    // walmart.com — else a Takeads link where the map has one) so clicks land on
    // the actual retailer, not a Google Shopping results page.
    const monetized: RealTimeBestDeal[] = [];
    for (const item of items) {
      const merchantUrl = merchantDealUrl(item.store, item.title, item.url);
      // merchantDealUrl returns '' when all it had was a dead Geniuslink and
      // the store is not one we can build a search URL for.
      if (!merchantUrl) continue;
      monetized.push({ ...item, url: await monetizeUrl(merchantUrl) });
    }
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
  [/best.?buy/, '/logos/best-buy-logo.svg'],
  [/\bbj'?s\b/, '/logos/bjs-wholesale-club-logo.svg'],
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
      className={`best-deal-card group grid gap-0 border bg-white transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-20px_rgba(13,27,42,0.35)] ${
        featured ? 'sm:grid-cols-[160px_minmax(0,1fr)]' : 'sm:grid-cols-[125px_minmax(0,1fr)]'
      } ${
        featured ? 'border-primary/25 shadow-[0_12px_24px_-18px_rgba(0,70,190,0.2)]' : 'border-ink/25 hover:border-primary/50'
      }`}
    >
      <a
        href={deal.url}
        target="_blank"
        rel="nofollow sponsored noopener noreferrer"
        className={`flex items-center justify-center border-b border-ink/10 bg-white sm:border-b-0 sm:border-r ${
          featured ? 'min-h-[170px] p-4' : 'min-h-[132px] p-3'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={deal.image}
          alt={deal.title}
          referrerPolicy="no-referrer"
          className={`${featured ? 'max-h-36' : 'max-h-28'} w-full object-contain mix-blend-multiply transition duration-300 group-hover:scale-[1.03]`}
        />
      </a>

      <div className={`flex min-w-0 flex-col ${featured ? 'p-4 sm:p-5' : 'p-3.5'}`}>
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

        <a href={deal.url} target="_blank" rel="nofollow sponsored noopener noreferrer" className={featured ? 'mt-3 block' : 'mt-2.5 block'}>
          <h5 className={`line-clamp-2 font-display font-bold leading-snug text-ink transition group-hover:text-primary ${featured ? 'text-lg' : 'text-base'}`}>
            {deal.title}
          </h5>
        </a>

        <p className={`${featured ? 'mt-2 line-clamp-2 leading-6' : 'mt-1.5 line-clamp-1 leading-5'} text-sm text-ink/60`}>
          {meta || `Current offer from ${deal.store}.`}
        </p>

        <div className={`mt-auto flex flex-wrap items-end justify-between gap-3 ${featured ? 'pt-4' : 'pt-3'}`}>
          <div>
            {deal.originalPrice && deal.originalPriceValue !== null && deal.priceValue !== null && deal.originalPriceValue > deal.priceValue ? (
              <p className="text-sm text-ink/35 line-through">{deal.originalPrice}</p>
            ) : null}
            <p className={`font-display font-bold text-ink ${featured ? 'text-2xl' : 'text-xl'}`}>{deal.price ?? 'Check price'}</p>
            <p className="mt-1 text-xs text-ink/45">
              {savings ? `Est. savings ${savings}` : deal.store}
            </p>
          </div>
          <a
            href={deal.url}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            className={`inline-flex bg-primary text-xs font-bold uppercase tracking-[0.1em] text-white transition hover:bg-primary-emphasis ${
              featured ? 'px-4 py-2.5' : 'px-3 py-2'
            }`}
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
