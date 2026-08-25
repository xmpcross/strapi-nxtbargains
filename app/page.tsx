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
  merchantName,
  numericValue,
  offerPrice,
  productImageUrl,
} from '@/lib/commerce';
import AutoCarousel from '@/components/AutoCarousel';
import Hero from '@/components/Hero';
import MarketplaceBestSellers from '@/components/MarketplaceBestSellers';
import BestSellerCard from '@/components/BestSellerCard';
import { listCouponPageData } from '@/lib/coupon-data';
import HomepageCouponsSection from '@/components/HomepageCouponsSection';
import { listAmazonNewReleases, listBestSellerGroups } from '@/lib/best-sellers';
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
    listCommerceProducts({ pageSize: 48 }).catch(() => null),
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
  /* Ten, shown five at a time by the auto-advancing carousel below. */
const priceDrops = deals.filter((d) => d.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 10);
  const trending = products.slice(0, 6);

  // Best Sellers — one daily JSON cache per marketplace (scripts/fetch-*.mjs).
  const bestSellerGroups = listBestSellerGroups({ includeEmpty: true });
  const newReleases = listAmazonNewReleases();

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
            <SectionHead eyebrow="● Live now" title="This week's biggest price drop" intro="The steepest discount we're tracking across marketplaces this week." cta={{ href: '/all-products', label: 'All products' }} />
            <div className="mt-9">
              <AutoCarousel label="This week's biggest price drops">
                {priceDrops.map((d) => (
                  /* The slide width decides how many fit a view: five at xl,
                     stepping down so a card never gets too narrow to read. */
                  <div
                    key={d.product.id}
                    className="w-[62%] shrink-0 snap-start sm:w-[45%] md:w-[31%] lg:w-[23.5%] xl:w-[calc((100%-4*18px)/5)]"
                  >
                    <DealCard deal={d} />
                  </div>
                ))}
              </AutoCarousel>
            </div>
          </div>
        </section>
      )}

      {/* ---------- BEST SELLERS ---------- */}
      {bestSellerGroups.length > 0 && (
        <section className="pt-[30px] pb-14 sm:pb-[72px]" data-testid="home-best-sellers">
          <div className="mx-auto max-w-[1366px] px-6">
            <MarketplaceBestSellers
              groups={bestSellerGroups}
              eyebrow="Top picks"
              title="Best Sellers"
              intro="The top-ranked products across the major marketplaces, refreshed daily."
            />
          </div>
        </section>
      )}

      {/* ---------- NEW ON AMAZON ---------- */}
      {newReleases.length > 0 && (
        <section className="pb-14 sm:pb-[72px]" data-testid="home-new-releases">
          <div className="mx-auto max-w-[1366px] px-6">
            <SectionHead
              eyebrow="Just launched"
              title="New on Amazon"
              intro="The newest electronics releases on Amazon, refreshed weekly."
              cta={{ href: '/best-sellers/amazon', label: 'View all' }}
            />
            <div className="mt-6 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
              {newReleases.slice(0, 8).map((item) => (
                <BestSellerCard key={`home-nr-${item.asin || item.rank}`} item={item} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- TRENDING ---------- */}
      {trending.length > 0 && (
        <section className="pb-14 sm:pb-[72px]" data-testid="home-trending">
          <div className="mx-auto max-w-[1366px] px-6">
            <SectionHead eyebrow="Most compared" title="Trending products" intro="Popular picks shoppers are comparing across Amazon, eBay and more." cta={{ href: '/all-products', label: 'Browse all' }} />
            <div className="mt-9 grid grid-cols-2 gap-[18px] sm:grid-cols-3 lg:grid-cols-6">
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
  cta?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div className="max-w-[52ch]">
        <p className="text-[0.74rem] font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        <h2 className="mt-2 font-display !text-[clamp(1.35rem,2.4vw,1.65rem)] font-extrabold leading-[1.12] tracking-[-0.02em] text-ink">{title}</h2>
        {intro && <p className={`mt-2 text-[0.98rem] leading-relaxed text-ink/55 ${introClassName}`}>{intro}</p>}
      </div>
      {cta && (
        <Link href={cta.href} className="inline-flex shrink-0 items-center gap-[7px] rounded-[10px] border border-ink/10 bg-white px-4 py-2.5 font-display text-[0.9rem] font-semibold text-ink transition hover:-translate-y-px hover:border-primary hover:text-primary">
          {cta.label} →
        </Link>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Deal card */
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
            className="flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-[9px] border border-ink/10 bg-white px-1.5 py-2 text-center"
          >
            <span className="font-display text-[0.78rem] font-bold text-ink">{formatMoney(o.price, currency)}</span>
            {o.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              /* Was h-3.5 (14px), which rendered a wordmark like "appliances
                   online" as an illegible smear. h-6 with a wider cap lets the
                   mark read at the width the tile actually has. */
                <img src={o.logo} alt={o.name} loading="lazy" referrerPolicy="no-referrer" className="h-6 max-w-[68px] object-contain" />
            ) : (
              <span className="line-clamp-1 text-[0.62rem] font-semibold uppercase tracking-wide text-ink/55">{o.name}</span>
            )}
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
              NXT.Bargains is free to use and does not require an account. Some outbound store links may be affiliate links, which means we may earn a commission if a visitor buys through those links, at no extra cost to the shopper.{' '}
              <a
                href="https://sovrn.co/1abk4m4"
                target="_blank"
                rel="noopener noreferrer"
                className="break-all font-medium text-primary underline transition hover:text-ink"
              >
                https://sovrn.co/1abk4m4
              </a>
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
