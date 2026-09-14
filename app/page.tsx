import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE } from '@/lib/site';
import {
  listCommerceProducts,
  listCommerceProductsForDeals,
  listPosts,
  listStores,
  mediaUrl,
  type CommerceProduct,
  type NxtPost,
  type Store,
} from '@/lib/strapi';
import { firstImageUrl, postPath } from '@/lib/format';
import {
  bestOffer,
  collectOfferRows,
  formatMoney,
  merchantDealUrl,
  merchantName,
  numericValue,
  offerPrice,
  productImageUrl,
} from '@/lib/commerce';
import AutoCarousel from '@/components/AutoCarousel';
import Hero from '@/components/Hero';
import { listCouponPageData, monetizeUrl } from '@/lib/coupon-data';
import HomepageCouponsSection from '@/components/HomepageCouponsSection';
import { listAmazonDailyDeals, type DailyDeal, listBestDealsRealtime } from '@/lib/best-sellers';
import { productHref } from '@/lib/product-url';

export const revalidate = 60;

function pickRandomPosts<T>(items: T[], count: number): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/** One product per category in turn, so a mixed row rather than ten of one kind. */
function pickAcrossCategories(items: CommerceProduct[], count: number): CommerceProduct[] {
  const byCategory = new Map<string, CommerceProduct[]>();
  for (const product of items) {
    const key = product.categories?.[0]?.slug ?? product.category ?? 'other';
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(product);
  }
  // Shuffle within each category, and shuffle the category order too, so a
  // category is not permanently first.
  const buckets = pickRandomPosts([...byCategory.values()], byCategory.size)
    .map((bucket) => pickRandomPosts(bucket, bucket.length));

  const out: CommerceProduct[] = [];
  for (let round = 0; out.length < count; round += 1) {
    let placed = false;
    for (const bucket of buckets) {
      if (out.length >= count) break;
      if (bucket[round]) { out.push(bucket[round]); placed = true; }
    }
    if (!placed) break;   // every bucket exhausted
  }
  return out;
}

const STRIP_MARKETPLACES = [
  { name: 'Amazon', domain: 'amazon.com' },
  { name: 'eBay', domain: 'ebay.com' },
  { name: 'Walmart', domain: 'walmart.com' },
  { name: 'Newegg', domain: 'newegg.com' },
  { name: 'Best Buy', domain: 'bestbuy.com' },
  { name: 'Target', domain: 'target.com' },
  { name: 'US Mobile', domain: 'usmobile.com' },
  { name: 'Back Market', domain: 'backmarket.com' },
];

type Deal = {
  product: CommerceProduct;
  name: string;
  image: string | null;
  href: string;
  merchant: string;
  price: number | null;
  original: number | null;
  pct: number;
  currency: string;
};

function toDeal(product: CommerceProduct): Deal | null {
  const offers = (product.offers ?? []).filter((o) => !o.status || o.status === 'active');
  if (offers.length === 0) return null;

  // Choose the offer with the biggest discount (price vs original) to headline.
  let chosen = offers[0];
  let chosenPct = 0;
  let chosenPrice = numericValue(offers[0].price);
  let chosenOriginal = numericValue(offers[0].originalPrice);
  for (const o of offers) {
    const price = numericValue(o.price);
    const original = numericValue(o.originalPrice);
    const pct = price !== null && original !== null && original > price
      ? Math.round((1 - price / original) * 100)
      : 0;
    const cheaper = price !== null && (chosenPrice === null || price < chosenPrice);
    if (pct > chosenPct || (pct === chosenPct && cheaper)) {
      chosen = o; chosenPct = pct; chosenPrice = price; chosenOriginal = original;
    }
  }

  return {
    product,
    name: product.name,
    image: productImageUrl(product),
    href: productHref(product),
    merchant: merchantName(chosen),
    price: chosenPrice,
    original: chosenOriginal,
    pct: chosenPct,
    currency: chosen.currency ?? 'USD',
  };
}

// Homepage relies on the root layout for title/description/OG image, but must
// emit its own canonical explicitly (layout inheritance doesn't render one).
export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: {
    url: SITE.url,
    images: [{ url: `${SITE.url}${SITE.ogImage}`, width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: { images: [`${SITE.url}${SITE.ogImage}`] },
};

export default async function HomePage() {
  // Pull live data; never let a Strapi hiccup break the page.
  const [productsRes, dealProducts, posts, stores, couponPageData] = await Promise.all([
    /* 300, not 48. The list comes back sorted by updatedAt, so 48 was the 48
       most recently imported products -- which after a category-by-category
       import meant three categories, and Trending cycled the same three. The
       catalogue is ~270 products, so this covers all of them and lets the
       category spread below actually spread. */
    listCommerceProducts({ pageSize: 300 }).catch(() => null),
    listCommerceProductsForDeals(120).catch(() => [] as CommerceProduct[]),
    listPosts({ pageSize: 24 }).then((r) => r.data).catch(() => [] as NxtPost[]),
    listStores().catch(() => [] as Store[]),
    listCouponPageData().catch(() => ({ coupons: [], retailers: [], brandGroups: [] })),
  ]);

  const products = productsRes?.data ?? [];

  // Match each marketplace-strip name to a store logo, then fall back to a favicon.
  const normStore = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const stripItems = STRIP_MARKETPLACES.map(({ name, domain }) => {
    const n = normStore(name);
    const match =
      stores.find((s) => normStore(s.name) === n) ||
      stores.find((s) => { const sn = normStore(s.name); return sn.includes(n) || n.includes(sn); });
    return { name, logo: match?.logo ?? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` };
  });
  const deals = dealProducts.map(toDeal).filter((d): d is Deal => d !== null);
  /* The steepest real discounts we hold, from the scraped retailer feed.
     This was previously computed from Strapi offers, but every one of those
     carries discountPercent 0 with no originalPrice, so the filter matched
     nothing and the fallback put ten undiscounted products under a heading
     promising the biggest drop of the week — the section rendered without a
     single discount badge on it. */
  const rawPriceDrops = listBestDealsRealtime(11);
  const priceDrops = await Promise.all(
    rawPriceDrops.map(async (deal) => {
      const merchantUrl = merchantDealUrl(deal.merchant || '', deal.title, deal.url);
      const url = await monetizeUrl(merchantUrl);
      return { ...deal, url };
    })
  );
  /* Ten trending products, spread across categories.
     `products` arrives sorted by updatedAt, so slicing the first ten returned
     ten of whatever category was imported last -- the section was showing
     nothing but Raspberry Pi kits. This takes one product from each category
     in turn before taking a second from any, so ten cards mean roughly ten
     categories, and shuffles within each so the same ones do not lead every
     render. */
  const trending = pickAcrossCategories(products, 10);

  /* Grouped by retailer for the tabs, in the order the deals file lists them.
     
     A tab has to be able to fill the layout to earn a place. The panel is a
     spotlight plus a row of five, so six is the threshold: below that the tab
     renders a spotlight and a half-empty row, which reads as broken rather
     than sparse. This bites now that the feed is filtered to the site's own
     categories — a general deals page yields only a handful of electronics, so
     Amazon and Walmart routinely come back with one or two. */
  const DEALS_PER_TAB = 6;
  const rawDailyDeals = listAmazonDailyDeals();
  const dailyDeals = await Promise.all(
    rawDailyDeals.map(async (deal) => {
      const merchantUrl = merchantDealUrl(deal.merchant || 'Amazon', deal.title, deal.url);
      const url = await monetizeUrl(merchantUrl);
      return { ...deal, url };
    })
  );
  const dealTabs = ['Amazon', 'eBay', 'Walmart']
    .map((merchant) => ({ merchant, deals: dailyDeals.filter((d) => (d.merchant ?? 'Amazon') === merchant) }))
    .filter((tab) => tab.deals.length >= DEALS_PER_TAB);

  /* "Amazon, eBay and Walmart" — or whichever of them actually qualified. */
  const dealRetailerLabel = dealTabs.length === 0
    ? 'top retailers'
    : dealTabs.length === 1
      ? dealTabs[0].merchant
      : `${dealTabs.slice(0, -1).map((t) => t.merchant).join(', ')} and ${dealTabs[dealTabs.length - 1].merchant}`;

  const guideFeature = posts[0];
  const guideSidebarPosts = pickRandomPosts(posts.slice(1), 6);

  return (
    <div data-testid="home-page">
      <Hero />

      {/* ---------- MARKETPLACE STRIP ---------- */}
      <div className="border-y border-ink/10 bg-muted" data-testid="home-strip">
        <div className="mx-auto flex max-w-[1366px] flex-wrap items-center justify-center gap-x-9 gap-y-3.5 px-6 py-5">
          <span className="text-[0.78rem] font-semibold text-ink/55">Comparing prices across</span>
          {stripItems.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={m.name}
              src={m.logo}
              alt={`${m.name} logo`}
              title={m.name}
              referrerPolicy="no-referrer"
              loading="lazy"
              className="h-7 w-7 object-contain opacity-75 transition hover:opacity-100"
            />
          ))}
        </div>
      </div>

      {/* ---------- TODAY'S BIGGEST PRICE DROPS ---------- */}
      {priceDrops.length >= 3 && (
        <section className="py-14 sm:py-[72px]" data-testid="home-price-drops">
          <div className="mx-auto max-w-[1366px] px-6">
            <SectionHead eyebrow="● Live now" title="This week's biggest price drops" intro="The steepest discounts we're tracking across Amazon, eBay, Walmart and Newegg right now." cta={{ href: '/best-deals', label: 'All deals' }} />

            {/* Equal-weight ranking, replacing the hero-plus-column split.
                The question this section answers is "how far has it fallen",
                so the discount is the largest thing on each card and the rank
                bar underneath shows each drop against the steepest one — the
                comparison the eye was otherwise being asked to do across two
                different card sizes. Five across matches the Trending grid
                directly below it, so the two sections now share a rhythm. */}
            <div className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {priceDrops.slice(0, 10).map((deal, index) => (
                <PriceDropTile
                  key={`drop-${deal.asin}`}
                  deal={deal}
                  rank={index + 1}
                  topPercent={priceDrops[0].percentOff || 1}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- POPULAR DEALS ---------- */}
      {dealTabs.length > 0 && (
        <section className="pb-14 sm:pb-[72px]" data-testid="home-popular-deals">
          <div className="mx-auto max-w-[1366px] px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b border-ink/10 pb-6 mb-8">
              <div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[0.72rem] font-extrabold uppercase tracking-wider text-emerald-700">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Live Price Feeds
                  </span>
                  <span className="text-[0.75rem] font-semibold text-ink/45">Updated daily</span>
                </div>
                <h2 className="mt-2 font-display text-[clamp(1.75rem,3vw,2.4rem)] font-extrabold leading-tight text-ink">
                  {dealTabs.length > 1 ? 'Popular Deals Across Top Retailers' : `Popular Deals at ${dealTabs[0]?.merchant ?? 'Top Retailers'}`}
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-ink/70">
                  {/* Names the retailers actually on the page. The copy used to
                      promise "Amazon, eBay, and Walmart" unconditionally, which
                      stopped being true once the feed was filtered to this
                      site's categories — a general deals page yields only a
                      handful of electronics, so on most days one or two of
                      those three have too few to show. */}
                  Verified discounts and handpicked price drops from {dealRetailerLabel}.
                </p>
              </div>
              <div className="shrink-0">
                <Link
                  href="/best-deals"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink/15 bg-white px-5 py-2.5 font-display text-sm font-bold text-ink shadow-sm transition hover:border-primary hover:text-primary hover:shadow"
                >
                  Explore All Deals
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </div>
            </div>

            {/*
              Radio inputs and CSS tab switcher: pure CSS SSR compatibility
              Nav element matches CSS .deal-tab-list and prevents nth-of-type offset issues.
            */}
            <div className="deal-tabs mt-6">
              {dealTabs.map((tab, index) => (
                <input
                  key={`dt-input-${tab.merchant}`}
                  type="radio"
                  name="popular-deals-tab"
                  id={`deal-tab-${tab.merchant.toLowerCase()}`}
                  className="deal-tab-input sr-only"
                  defaultChecked={index === 0}
                />
              ))}
              <nav className="deal-tab-list" role="tablist" aria-label="Deals by retailer">
                {dealTabs.map((tab) => (
                  <label
                    key={`dt-label-${tab.merchant}`}
                    htmlFor={`deal-tab-${tab.merchant.toLowerCase()}`}
                    className="deal-tab-label"
                  >
                    <span className="flex items-center gap-2">
                      <span className="capitalize">{tab.merchant}</span>
                      <span className="deal-tab-count">{tab.deals.length}</span>
                    </span>
                  </label>
                ))}
              </nav>

              {dealTabs.map((tab) => {
                const spotlightDeal = tab.deals[0];
                // Six per tab: the spotlight plus a single row of five. The
                // second row of five is dropped — five is the exact fill for
                // one row, so nothing renders as a partial row.
                const gridDeals = tab.deals.slice(1, 6);

                return (
                  <div key={`dt-panel-${tab.merchant}`} className="deal-tab-panel">
                    <div className="space-y-6">
                      {spotlightDeal && (
                        <FeaturedDailyDealCard deal={spotlightDeal} />
                      )}
                      {gridDeals.length > 0 && (
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                          {gridDeals.map((deal) => (
                            <DailyDealCard key={`home-dd-${deal.merchant}-${deal.asin}`} deal={deal} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ---------- TRENDING ---------- */}
      {trending.length > 0 && (
        <section className="pb-14 sm:pb-[72px]" data-testid="home-trending">
          <div className="mx-auto max-w-[1366px] px-6">
            <SectionHead eyebrow="Most compared" title="Trending products" intro="Popular picks shoppers are comparing across Amazon, eBay and more." cta={{ href: '/all-products', label: 'Browse all' }} />
            {/* Five across on desktop. The card carries a title, a price range
                and three merchant tiles, so at six per row the tiles were too
                narrow for a merchant name to read. */}
            <div className="mt-9 grid grid-cols-2 gap-[18px] sm:grid-cols-3 lg:grid-cols-5">
              {trending.map((p) => <TrendingCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      {/* ---------- BUYING GUIDES & REVIEWS ----------- */}
      {guideFeature && (
        <section className="border-y border-ink/10 bg-white py-14 sm:py-[76px]" data-testid="home-guides">
          <div className="guide-shell mx-auto max-w-[1366px] px-6">
            <SectionHead
              eyebrow="Read first"
              title="Buying guides & reviews"
              intro="Shortlists, spec checks, and plain-English reviews before you compare live prices."
              cta={{ href: '/buying-guides', label: 'Browse guides' }}
            />
            <GuidesEditorialSection feature={guideFeature} sidebarPosts={guideSidebarPosts} />
          </div>
        </section>
      )}

      <HomepageTrustContent />

      <HomepageCouponsSection
        coupons={couponPageData.coupons}
        retailers={couponPageData.retailers}
        brandGroups={couponPageData.brandGroups}
      />

    </div>
  );
}

/* ----------------------------------------------------------- Section header */
function SectionHead({
  eyebrow,
  title,
  intro,
  introClassName = '',
  cta,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  introClassName?: string;
  /* 'outline' draws the button in the primary colour with a matching border,
     for sections that should pull more attention than the default quiet
     grey-bordered link. Kept as a variant rather than restyling SectionHead
     itself, which four sections share. */
  cta?: { href: string; label: string; variant?: 'default' | 'outline' };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div className="max-w-[52ch]">
        <p className="text-[0.74rem] font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        <h2 className="mt-2 font-display !text-[clamp(1.35rem,2.4vw,1.65rem)] font-extrabold leading-[1.12] tracking-[-0.02em] text-ink">{title}</h2>
        {intro && <p className={`mt-2 text-[0.98rem] leading-relaxed text-ink/55 ${introClassName}`}>{intro}</p>}
      </div>
      {cta && (
        <Link
          href={cta.href}
          className={
            cta.variant === 'outline'
              ? 'inline-flex shrink-0 items-center gap-[7px] rounded-[10px] border border-primary bg-transparent px-4 py-2.5 font-display text-[0.9rem] font-semibold text-primary transition hover:-translate-y-px hover:bg-primary hover:text-white'
              : 'inline-flex shrink-0 items-center gap-[7px] rounded-[10px] border border-ink/10 bg-white px-4 py-2.5 font-display text-[0.9rem] font-semibold text-ink transition hover:-translate-y-px hover:border-primary hover:text-primary'
          }
        >
          {cta.label} →
        </Link>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Deal card */
/* A merchant label that fits the tile.

   Names arrive in two shapes: curated ones like "Micro Center", and bare
   domains like "canakit.com" from Google Shopping. Shown raw in a 68px tile
   both truncated to "MICRO..." and "CENTRAL...", which identifies nothing.
   Dropping the protocol, www. and the TLD gets most of them under the limit,
   and the tile now allows two lines rather than clipping at one. */
function merchantLabel(name: string): string {
  const trimmed = name.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  const domainish = /^[a-z0-9-]+(\.[a-z]{2,}){1,3}$/i.test(trimmed);
  if (!domainish) return trimmed;
  /* Take the registrable label, not the first one: splitting on the first dot
     turns store.google.com into "store", which names nothing. Trailing
     suffixes are dropped instead, so it yields "google", and tmbud.com.pl
     yields "tmbud". */
  const labels = trimmed.toLowerCase().split('.');
  while (labels.length > 1 && /^[a-z]{2,3}$/.test(labels[labels.length - 1])) labels.pop();
  return (labels[labels.length - 1] || trimmed).replace(/[-_]+/g, ' ');
}

/* Multi-merchant price comparison block (price range → merchant price+logo tiles
   → "Compare N prices"), shown on the price-drop and trending cards. */
function OfferComparison({ product }: { product: CommerceProduct }) {
  const priced = collectOfferRows(product)
    .map((row) => ({
      price: offerPrice(row.offer),
      name: merchantName(row.offer),
      logo: mediaUrl(row.offer.merchant?.logo ?? null),
      currency: row.offer.currency ?? 'USD',
    }))
    .filter((o): o is { price: number; name: string; logo: string | null; currency: string } => o.price !== null);

  if (priced.length === 0) {
    return (
      <span className="mt-3 block rounded-[10px] bg-[#2ba24b] px-4 py-2.5 text-center font-display text-[0.85rem] font-bold text-white transition group-hover:bg-[#238a3f]">
        Compare prices
      </span>
    );
  }

  // Cheapest offer per merchant, for the tiles.
  const byMerchant = new Map<string, { price: number; name: string; logo: string | null; currency: string }>();
  for (const o of priced) {
    const key = o.name.toLowerCase();
    const cur = byMerchant.get(key);
    if (!cur || o.price < cur.price) byMerchant.set(key, o);
  }
  const merchants = [...byMerchant.values()].sort((a, b) => a.price - b.price);
  const currency = merchants[0].currency;
  const min = merchants[0].price;
  const max = merchants[merchants.length - 1].price;
  const tiles = merchants.slice(0, 3);
  const count = priced.length;

  return (
    <div className="mt-3">
      <div className="text-center font-display text-[1.05rem] font-extrabold text-ink">
        {min === max ? formatMoney(min, currency) : `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`}
      </div>
      <p className="mt-1 text-[0.58rem] font-bold uppercase tracking-[0.16em] text-ink/40">Promoted</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {tiles.map((o) => (
          <div
            key={o.name}
            className="flex min-h-[82px] flex-col items-center rounded-[9px] border border-ink/10 bg-white px-1 py-2 text-center"
          >
            <span className="font-display text-[0.78rem] font-bold leading-none text-ink">{formatMoney(o.price, currency)}</span>
            {/* The logo row is always present, with or without a logo, so a tile
                that has one lines up with a tile that does not — only 53 of 400
                merchants carry a logo, so mixed rows were the normal case and
                the prices sat at different heights across a card. */}
            <span className="mt-1.5 flex h-[18px] w-full items-center justify-center">
              {o.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.logo} alt="" aria-hidden="true" loading="lazy" referrerPolicy="no-referrer" className="max-h-[18px] max-w-[60px] object-contain" />
              ) : null}
            </span>
            {/* Always named, not just pictured: a price with no seller beside it
                is not a comparison. Two lines rather than one, because a single
                clipped line rendered "Micro Center" as "MICRO...". */}
            <span className="mt-1 line-clamp-2 text-[0.58rem] font-semibold uppercase leading-[1.25] tracking-tight text-ink/55">
              {merchantLabel(o.name)}
            </span>
          </div>
        ))}
      </div>
      <span className="mt-2.5 block rounded-[10px] bg-[#2ba24b] px-4 py-2.5 text-center font-display text-[0.85rem] font-bold text-white transition group-hover:bg-[#238a3f]">
        Compare {count} price{count === 1 ? '' : 's'}
      </span>
    </div>
  );
}

function DealCard({ deal }: { deal: Deal }) {
  return (
    <Link href={deal.href} className="group flex h-full flex-col overflow-hidden rounded-[8px] border border-ink/10 bg-white transition hover:-translate-y-1.5 hover:shadow-[0_26px_46px_-26px_rgba(13,27,42,0.42)]" data-testid={`pricedrop-${deal.product.slug}`}>
      <div className="price-drop-image-box uniform-product-image-box relative grid aspect-square w-full place-items-center overflow-hidden bg-white p-4 sm:p-5">
        {deal.pct > 0 && (
          <span className="absolute left-2.5 top-2.5 z-10 rounded-[7px] bg-primary px-[9px] py-1 font-display text-[0.74rem] font-bold text-white">-{deal.pct}%</span>
        )}
        {deal.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={deal.image} alt={deal.name} loading="lazy" className="price-drop-image uniform-product-image block h-full w-full object-contain mix-blend-multiply transition duration-500 group-hover:scale-[1.04]" />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-display text-xl font-bold text-ink/25">NXT</span>
        )}
      </div>
      <div className="px-[15px] pb-4 pt-3.5">
        <h3 className="product-card-title line-clamp-2 h-[2.6em] leading-[1.3] text-ink transition group-hover:text-primary">{deal.name}</h3>
        <OfferComparison product={deal.product} />
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------- Daily deal */
function FeaturedDailyDealCard({ deal }: { deal: DailyDeal }) {
  const savings = deal.wasPrice && deal.wasPrice > deal.price ? deal.wasPrice - deal.price : null;

  return (
    <a
      href={deal.url}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      className="group relative block overflow-hidden rounded-2xl border-2 border-primary/25 bg-gradient-to-br from-[#f8faf4] via-white to-primary/5 p-5 sm:p-7 shadow-sm transition-all duration-300 hover:border-primary/60 hover:shadow-xl"
      data-testid={`spotlight-deal-${deal.asin}`}
    >
      <div className="absolute right-4 top-4 z-10 hidden sm:flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-display text-[0.72rem] font-bold text-primary border border-primary/20">
          ⚡ Featured Deal
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)] items-center">
        <div className="relative aspect-square w-full max-w-[280px] mx-auto overflow-hidden rounded-xl bg-white p-6 shadow-inner border border-ink/5 flex items-center justify-center">
          <span className="absolute left-3 top-3 z-10 rounded-lg bg-gradient-to-r from-amber-500 to-rose-500 px-3 py-1 font-display text-xs font-black uppercase text-white shadow-md">
            🔥 -{deal.percentOff}% OFF
          </span>
          {deal.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={deal.image}
              alt={deal.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-contain mix-blend-multiply transition duration-500 group-hover:scale-105"
            />
          ) : (
            <span className="font-display text-2xl font-bold text-ink/25">NXT</span>
          )}
        </div>

        <div className="flex flex-col justify-between space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="rounded-md bg-ink/5 px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wider text-ink/70">
                {deal.merchant ?? 'Amazon'}
              </span>
              {deal.badge && (
                <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-[0.7rem] font-bold text-emerald-700 border border-emerald-500/20">
                  {deal.badge}
                </span>
              )}
            </div>
            <h3 className="font-display text-lg sm:text-xl lg:text-2xl font-extrabold leading-snug text-ink group-hover:text-primary transition line-clamp-2">
              {deal.title}
            </h3>
          </div>

          <div className="flex flex-wrap items-baseline gap-3 pt-2">
            <span className="font-display text-2xl sm:text-3xl font-black text-ink">
              {formatMoney(deal.price, deal.currency)}
            </span>
            {deal.wasPrice && (
              <span className="text-base font-semibold text-ink/40 line-through">
                {formatMoney(deal.wasPrice, deal.currency)}
              </span>
            )}
            {savings !== null && (
              <span className="inline-flex items-center rounded-lg bg-emerald-600 px-2.5 py-1 font-display text-xs font-bold text-white shadow-sm">
                Save {formatMoney(savings, deal.currency)}
              </span>
            )}
          </div>

          <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <span className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-display text-sm font-bold text-white shadow-md transition group-hover:bg-primary/90 group-hover:shadow-lg">
              Claim Spotlight Deal
              <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </span>
            <span className="text-center sm:text-left text-xs font-semibold text-ink/50">
              Direct checkout link on {deal.merchant ?? 'Amazon'}
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}

/**
 * Money for the deal feed.
 *
 * The feed stopped being USD-only when the UK, Australian and European
 * marketplaces were added, and these prices are not converted — so the symbol
 * has to follow the number. Rendering a GBP 5.00 deal as $5.00 does not just
 * look wrong, it understates the price by about a quarter.
 */
const DEAL_SYMBOLS: Record<string, string> = { USD: '$', GBP: '\u00a3', EUR: '\u20ac', AUD: 'A$' };

function dealMoney(value: number, currency = 'USD') {
  const symbol = DEAL_SYMBOLS[currency] ?? '';
  return `${symbol}${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/**
 * One price drop, led by the size of the discount.
 *
 * The percentage is the largest element because it is the only figure that is
 * comparable across the card set — these come from four retailers in four
 * currencies, so ranking by the price itself would be meaningless. The bar
 * beneath it is that same percentage measured against the steepest drop in the
 * row, which turns ten independent numbers into one ordered picture.
 *
 * Rank is shown only for the top three. Numbering all ten implies a precision
 * the data does not have — the gap between ninth and tenth is often a point.
 */
function PriceDropTile({ deal, rank, topPercent }: { deal: DailyDeal; rank: number; topPercent: number }) {
  const depth = Math.max(6, Math.round((deal.percentOff / topPercent) * 100));

  return (
    <a
      href={deal.url}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className="group flex h-full flex-col border border-ink/10 bg-white transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_18px_32px_-24px_rgba(3,3,3,0.4)]"
      data-testid="price-drop-tile"
    >
      <span className="price-drop-image-box uniform-product-image-box relative grid aspect-square w-full place-items-center overflow-hidden border-b border-ink/10 bg-white p-4">
        {deal.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={deal.image}
            alt={deal.title}
            referrerPolicy="no-referrer"
            className="price-drop-image uniform-product-image block h-full w-full object-contain mix-blend-multiply transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="font-display text-lg font-bold text-ink/20">{deal.merchant ?? 'Deal'}</span>
        )}
        {rank <= 3 ? (
          <span className="absolute left-0 top-0 bg-ink px-2 py-1 font-display text-[11px] font-bold text-white">
            #{rank}
          </span>
        ) : null}
      </span>

      <span className="flex flex-1 flex-col p-4">
        <span className="flex items-baseline gap-1.5">
          <span className="font-display text-[2rem] font-bold leading-none tracking-tight text-primary">
            {deal.percentOff}
          </span>
          <span className="font-display text-sm font-bold text-primary/70">% off</span>
        </span>

        <span className="mt-2.5 block h-[3px] w-full bg-[#e4eaf3]">
          <span className="block h-full bg-primary/70" style={{ width: `${depth}%` }} />
        </span>

        <span className="mt-3 line-clamp-2 text-[0.8rem] font-semibold leading-snug text-ink transition group-hover:text-primary">
          {deal.title}
        </span>

        <span className="mt-auto flex items-end justify-between gap-2 pt-3">
          <span>
            <span className="block font-display text-base font-bold text-ink">
              {dealMoney(deal.price, deal.currency)}
            </span>
            {deal.wasPrice ? (
              <span className="block text-[11px] font-semibold text-ink/35 line-through">
                {dealMoney(deal.wasPrice, deal.currency)}
              </span>
            ) : null}
          </span>
          {deal.merchant ? (
            <span className="max-w-[52%] truncate text-right text-[10px] font-bold uppercase tracking-[0.08em] text-ink/40">
              {deal.merchant}
            </span>
          ) : null}
        </span>
      </span>
    </a>
  );
}

function DailyDealCard({ deal }: { deal: DailyDeal }) {
  const savings = deal.wasPrice && deal.wasPrice > deal.price ? deal.wasPrice - deal.price : null;

  return (
    <a
      href={deal.url}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-ink/10 bg-white transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-[0_20px_40px_-20px_rgba(13,27,42,0.3)]"
      data-testid={`dailydeal-${deal.asin}`}
    >
      <div className="uniform-product-image-box relative grid aspect-square w-full place-items-center overflow-hidden bg-white p-4">
        <span className="absolute left-2.5 top-2.5 z-10 rounded-lg bg-primary px-2.5 py-1 font-display text-[0.72rem] font-bold text-white shadow-sm">
          -{deal.percentOff}%
        </span>
        {savings !== null && (
          <span className="absolute right-2.5 top-2.5 z-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 font-display text-[0.68rem] font-extrabold text-emerald-700">
            Save {formatMoney(savings, deal.currency)}
          </span>
        )}
        {deal.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={deal.image}
            alt={deal.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="uniform-product-image block h-full w-full object-contain mix-blend-multiply transition duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="font-display text-lg font-bold text-ink/25">NXT</span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[0.65rem] font-extrabold uppercase tracking-wider text-ink/50">
            {deal.merchant ?? 'Amazon'}
          </span>
          {deal.badge && (
            <>
              <span className="text-[0.65rem] text-ink/30">•</span>
              <span className="text-[0.65rem] font-bold text-emerald-600 truncate">{deal.badge}</span>
            </>
          )}
        </div>

        <h3 className="product-card-title line-clamp-2 h-[2.6em] font-display text-xs sm:text-sm font-semibold leading-[1.3] text-ink transition group-hover:text-primary">
          {deal.title}
        </h3>

        <div className="mt-auto pt-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-display text-base sm:text-lg font-extrabold text-ink">
              {formatMoney(deal.price, deal.currency)}
            </span>
            {deal.wasPrice && (
              <span className="text-xs font-semibold text-ink/40 line-through">
                {formatMoney(deal.wasPrice, deal.currency)}
              </span>
            )}
          </div>

          <span className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink/5 px-3 py-2 text-center font-display text-xs font-bold text-ink transition duration-300 group-hover:bg-primary group-hover:text-white">
            View deal
            <svg className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </a>
  );
}

/* -------------------------------------------------------- Guide / editorial */
function guideImage(post: NxtPost) {
  return mediaUrl(post.coverImage ?? null) ?? firstImageUrl(post.content);
}

function guideCategories(post: NxtPost) {
  return (post.categories ?? []).filter((cat) => cat.slug !== 'uncategorized').slice(0, 3);
}

function GuideCategoryLabel({ post, compact = false }: { post: NxtPost; compact?: boolean }) {
  const categories = guideCategories(post);
  const chips = categories.length > 0 ? categories.map((cat) => cat.name) : ['Buying guide'];
  const visible = compact ? chips.slice(0, 1) : chips;

  return (
    <div className={`guide-category-label flex flex-wrap items-center gap-x-3 gap-y-1 ${compact ? 'guide-category-label--compact' : ''}`}>
      {visible.map((name) => (
        <span
          key={name}
          className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
          {name}
        </span>
      ))}
    </div>
  );
}

function GuideArticleMeta({ post, compact = false }: { post: NxtPost; compact?: boolean }) {
  const readMins = post.readingTimeMinutes ?? 5;

  return (
    <div className={`guide-article-meta flex flex-wrap items-center gap-2 text-sm text-ink/75 ${compact ? 'mt-3' : 'mt-4'}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent font-display text-sm font-bold text-ink">
        N
      </span>
      <span>NXT.Bargains Editorial</span>
      <span className="text-ink/35">|</span>
      <span>{readMins} min read</span>
    </div>
  );
}

function GuidesEditorialSection({
  feature,
  sidebarPosts,
}: {
  feature: NxtPost;
  sidebarPosts: NxtPost[];
}) {
  return (
    <div
      className="guide-editorial-grid mt-9 grid gap-4 rounded-[8px] border border-ink/10 bg-[#fbfcf7] p-3 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] lg:items-stretch lg:p-4"
      data-testid="home-guides-editorial"
    >
      <GuideFeatureArticle post={feature} />
      {sidebarPosts.length > 0 ? (
        <div
          className="guide-list-panel flex h-full min-h-0 flex-col overflow-hidden rounded-[8px] border border-ink/10 bg-white"
          data-testid="home-guides-list"
        >
          <div className="guide-list-header border-b border-ink/10 px-4 py-3 sm:px-5">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-primary">More research</p>
            <p className="mt-1 text-sm leading-5 text-ink/60">Fresh reads for comparing features, trade-offs, and real buying value.</p>
          </div>
          {sidebarPosts.map((post) => (
            <GuideCompactRow key={post.id} post={post} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GuideFeatureArticle({ post }: { post: NxtPost }) {
  const img = guideImage(post);
  const href = postPath(post);

  return (
    <article className="guide-feature-card group flex h-full flex-col overflow-hidden rounded-[8px] border border-ink/10 bg-white" data-testid={`guide-feature-${post.slug}`}>
      <Link href={href} className="guide-feature-image-box relative block overflow-hidden bg-[#edf3e4]">
        <span className="guide-feature-badge absolute left-4 top-4 z-10 rounded-[7px] bg-ink px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.13em] text-white">
          Editor pick
        </span>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={post.coverImage?.alternativeText || post.title}
              loading="lazy"
            className="guide-feature-image aspect-[16/11] w-full mix-blend-multiply transition duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="grid aspect-[16/11] w-full place-items-center bg-[#f7f7f7] font-display text-2xl font-bold text-ink/20">
            NXT
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <GuideCategoryLabel post={post} />
        <Link href={href}>
          <h3 className="guide-feature-title mt-3 font-display text-xl font-bold leading-tight text-ink transition group-hover:text-primary sm:text-2xl">
            {post.title}
          </h3>
        </Link>
        {post.excerpt ? (
          <p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-6 text-ink/75 sm:text-base">
            {post.excerpt}
          </p>
        ) : null}
        <div className="mt-auto pt-5">
          <GuideArticleMeta post={post} />
        </div>
      </div>
    </article>
  );
}

function GuideCompactRow({ post }: { post: NxtPost }) {
  const img = guideImage(post);
  const href = postPath(post);

  return (
    <article className="guide-compact-row group min-h-0 flex-1" data-testid={`guide-compact-${post.slug}`}>
      <Link
        href={href}
        className="guide-compact-row-link grid h-full min-h-0 w-full grid-cols-[64px_minmax(0,1fr)] items-center gap-3 px-4 py-3.5 transition hover:bg-[#f4f7ee] sm:grid-cols-[72px_minmax(0,1fr)] sm:px-5 lg:grid-cols-[minmax(0,5rem)_minmax(0,1fr)] lg:gap-4"
      >
        <div className="guide-compact-thumb h-full max-h-[64px] overflow-hidden rounded-[8px] border border-ink/10 bg-[#f7f9f2] sm:max-h-[72px] lg:aspect-square lg:h-[76%] lg:w-auto lg:max-h-none">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt={post.coverImage?.alternativeText || post.title}
              loading="lazy"
              className="guide-compact-image h-full w-full max-h-full max-w-full object-contain mix-blend-multiply transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-[#f7f7f7] font-display text-xs font-bold text-ink/20">
              NXT
            </div>
          )}
        </div>
        <div className="flex min-h-0 min-w-0 flex-col justify-center gap-1">
          <GuideCategoryLabel post={post} compact />
          <h3 className="guide-compact-title line-clamp-2 font-display font-bold leading-snug text-ink transition group-hover:text-primary">
            {post.title}
          </h3>
        </div>
      </Link>
    </article>
  );
}

/* ------------------------------------------------------------- Trending card */
function TrendingCard({ product }: { product: CommerceProduct }) {
  const image = productImageUrl(product);
  const category = product.categories?.[0]?.name ?? product.category ?? 'Product';
  const href = productHref(product);
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-[8px] border border-ink/10 bg-white p-[18px] transition hover:-translate-y-1.5 hover:shadow-[0_26px_46px_-26px_rgba(13,27,42,0.42)]"
      data-testid={`trending-${product.slug}`}
    >
      <div className="trending-image-box mb-3.5 grid aspect-square place-items-center overflow-hidden rounded-[11px] bg-white">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={product.name} loading="lazy" className="trending-image h-full w-full object-contain p-3 mix-blend-multiply transition duration-500 group-hover:scale-[1.04]" />
        ) : (
          <span className="font-display text-lg font-bold text-ink/25">NXT</span>
        )}
      </div>
      <span className="text-[0.7rem] font-bold uppercase tracking-[0.05em] text-primary">{category}</span>
      <h3 className="product-card-title mt-1.5 line-clamp-2 h-[2.6em] overflow-hidden leading-[1.3] text-ink transition group-hover:text-primary">{product.name}</h3>
      <div className="mt-auto">
        <OfferComparison product={product} />
      </div>
    </Link>
  );
}

/* --------------------------------------------------------------- How it works */
function HowItWorks() {
  const steps = [
    { n: '01', t: 'Search any product', d: 'Find it once — we pull matching listings from across the major marketplaces.' },
    { n: '02', t: 'Compare every price', d: 'See offers from Amazon, eBay and more side by side, with condition and availability.' },
    { n: '03', t: 'Track & buy at the low', d: 'Watch the price history and buy when it hits its lowest — never overpay again.' },
  ];
  return (
    <section className="py-14 sm:py-[72px]" data-testid="home-how">
      <div className="mx-auto max-w-[1366px] px-6">
        <div className="relative overflow-hidden rounded-[28px] bg-ink px-8 py-14 text-white sm:px-14 sm:py-16">
          <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-32 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(0,70,190,0.3),transparent_64%)]" />
          <p className="relative text-[0.74rem] font-bold uppercase tracking-[0.16em] text-primary">How NXT.Bargains works</p>
          <h2 className="relative mt-2.5 max-w-[20ch] font-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-extrabold leading-tight tracking-[-0.02em]">
            From “is this a good price?” to “bought it for less.”
          </h2>
          <div className="relative z-[2] mt-[46px] grid gap-[30px] sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n}>
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 font-display text-[1.05rem] font-extrabold text-primary">{s.n}</div>
                <h3 className="mt-4 font-display text-[1.2rem] font-semibold">{s.t}</h3>
                <p className="mt-2 text-[0.92rem] leading-[1.55] text-white/70">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HomepageTrustContent() {
  const services = [
    {
      title: 'Product price comparison',
      body: 'NXT.Bargains brings product listings, seller offers and marketplace prices into one place so shoppers can compare options without opening a dozen tabs.',
    },
    {
      title: 'Deals, coupons and price drops',
      body: 'The site highlights current discounts, coupon opportunities and notable price drops across popular electronics categories, including phones, laptops, tablets, smartwatches and smart home products.',
    },
    {
      title: 'Buying guides and product reviews',
      body: 'Editorial guides explain important specifications, common trade-offs and practical buying tips, helping visitors understand what matters before they choose a product.',
    },
  ];

  return (
    <section className="border-y border-ink/10 bg-white py-14 sm:py-[76px]" data-testid="home-about-service">
      <div className="mx-auto grid max-w-[1366px] gap-10 px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
        <div className="max-w-[58ch]">
          <p className="text-[0.74rem] font-bold uppercase tracking-[0.16em] text-primary">About NXT.Bargains</p>
          <h2 className="mt-2 font-display text-[clamp(1.5rem,2.6vw,2rem)] font-extrabold leading-tight text-ink">
            Independent shopping research for comparing tech prices before you buy.
          </h2>
          <div className="mt-5 space-y-4 text-[0.98rem] leading-7 text-ink/70">
            <p>
              NXT.Bargains is a product discovery and price-comparison website built for shoppers who want clearer buying decisions. We organise marketplace offers, product details, buying guides, reviews, coupons and deal pages so visitors can compare real options from one starting point.
            </p>
            <p>
              Our service focuses on consumer technology and everyday electronics, including smartphones, laptops, tablets, headphones, smartwatches, security cameras, smart home devices and related accessories. Product pages are designed to show useful information first: current offers, key specifications, short summaries, product images, seller details and links to relevant research.
            </p>
            <p>
              NXT.Bargains is free to use and does not require an account. Some outbound store links may be affiliate links, which means we may earn a commission if a visitor buys through those links, at no extra cost to the shopper.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/about" className="rounded-[8px] border border-ink/10 bg-ink px-4 py-2.5 font-display text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-primary">
              Learn about us
            </Link>
            <Link href="/contact" className="rounded-[8px] border border-ink/10 bg-white px-4 py-2.5 font-display text-sm font-semibold text-ink transition hover:-translate-y-px hover:border-primary hover:text-primary">
              Contact NXT.Bargains
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {services.map((service) => (
            <article key={service.title} className="rounded-[8px] border border-ink/10 bg-[#f7f9f2] p-5">
              <h3 className="font-display text-[1.05rem] font-bold text-ink">{service.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink/68">{service.body}</p>
            </article>
          ))}
          <div className="rounded-[8px] border border-primary/25 bg-primary/5 p-5">
            <h3 className="font-display text-[1.05rem] font-bold text-ink">Why this helps shoppers</h3>
            <p className="mt-2 text-sm leading-6 text-ink/68">
              Prices, availability and seller promotions can change quickly. NXT.Bargains gives visitors a structured place to check product details, compare stores and read practical buying advice before making a purchase decision.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
