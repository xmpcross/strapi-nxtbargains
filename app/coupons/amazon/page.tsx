import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SITE } from '@/lib/site';
import {
  couponStorePublicSlug,
  findCouponStoreBySlug,
  relatedCouponStores,
  storeLogoUrl,
} from '@/lib/coupon-stores';
import { collectionPageJsonLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Amazon Coupons',
  description:
    'Browse Amazon promo codes, coupon deals, discount percentages, and verified Amazon offer links from NXT.Bargains.',
  alternates: { canonical: '/coupons/amazon' },
};

const AMAZON_LOGO = 'https://www.google.com/s2/favicons?domain=amazon.com&sz=128';
const AMAZON_URL = 'https://www.amazon.com';

type ApiRecord = Record<string, unknown>;

type AmazonCouponCache = {
  capturedAt?: string;
  data?: unknown;
};

type AmazonCoupon = {
  asin: string;
  title: string;
  category: string;
  code?: string;
  couponText?: string;
  discount: string;
  listedPrice?: string;
  promoPrice?: string;
  couponPrice?: string;
  combinedPrice?: string;
  href: string;
  image?: string;
  merchant: string;
  postedAt?: string;
};

const AMAZON_COUPONS_CACHE = join(process.cwd(), 'data', 'amazon-coupons.json');

function readAmazonCouponCache(): AmazonCouponCache {
  try {
    if (!existsSync(AMAZON_COUPONS_CACHE)) return {};
    return JSON.parse(readFileSync(AMAZON_COUPONS_CACHE, 'utf8')) as AmazonCouponCache;
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is ApiRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nestedRecord(record: ApiRecord, key: string): ApiRecord {
  const value = record[key];
  return isRecord(value) ? value : {};
}

function textField(record: ApiRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function recordsFrom(value: unknown): ApiRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  const deals = value.deals;
  return Array.isArray(deals) ? deals.filter(isRecord) : [];
}

function mapAmazonCoupon(record: ApiRecord): AmazonCoupon | null {
  const pricing = nestedRecord(record, 'pricing');
  const promo = nestedRecord(record, 'promo');
  const coupon = nestedRecord(record, 'coupon');
  const urls = nestedRecord(record, 'urls');
  const offer = nestedRecord(record, 'offer');

  const title = textField(record, ['product_name', 'productName', 'title', 'name']);
  const href = textField(urls, ['affiliate', 'product']) || textField(promo, ['promo_url', 'promoUrl']);
  if (!title || !href) return null;

  const totalDiscount = textField(record, ['total_discount_pct', 'totalDiscountPct']);
  const promoDiscount = textField(promo, ['discount_pct', 'discountPct']);
  const couponText = textField(coupon, ['raw']);

  return {
    asin: textField(record, ['asin']) || title,
    title,
    category: textField(record, ['category']) || 'Amazon',
    code: textField(promo, ['code']) || undefined,
    couponText: couponText || undefined,
    discount: totalDiscount ? `${totalDiscount}% off` : promoDiscount ? `${promoDiscount}% promo` : couponText || 'Amazon coupon',
    listedPrice: textField(pricing, ['listed_price', 'listedPrice']) || undefined,
    promoPrice: textField(pricing, ['price_after_promo_only', 'priceAfterPromoOnly']) || undefined,
    couponPrice: textField(pricing, ['price_after_coupon_only', 'priceAfterCouponOnly']) || undefined,
    combinedPrice: textField(pricing, ['estimated_combined_price', 'estimatedCombinedPrice']) || undefined,
    href,
    image: textField(urls, ['image']) || undefined,
    merchant: textField(offer, ['merchant']) || 'Amazon',
    postedAt: textField(record, ['posted_at', 'postedAt']) || undefined,
  };
}

async function listAmazonCoupons(): Promise<AmazonCoupon[]> {
  const data = readAmazonCouponCache().data;
  const seen = new Set<string>();
  return recordsFrom(data)
    .map(mapAmazonCoupon)
    .filter((coupon): coupon is AmazonCoupon => coupon !== null)
    .filter((coupon) => {
      const key = `${coupon.asin}|${coupon.code ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 24);
}

export default async function AmazonCouponsPage() {
  const cache = readAmazonCouponCache();
  const coupons = await listAmazonCoupons();
  const amazonStore = findCouponStoreBySlug('amazon');
  const relatedStores = amazonStore ? relatedCouponStores(amazonStore, 8) : [];
  const logo = amazonStore ? storeLogoUrl(amazonStore) : AMAZON_LOGO;

  const liveCodes = coupons.filter((coupon) => coupon.code).length;
  const liveDeals = Math.max(0, coupons.length - liveCodes);
  const topOffer = coupons[0]?.discount ?? 'Live offers';
  const updatedLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(cache.capturedAt ? new Date(cache.capturedAt) : new Date());

  const featuredCoupons = coupons.filter((c) => c.code).slice(0, 4);
  const highlightCoupons = featuredCoupons.length > 0 ? featuredCoupons : coupons.slice(0, 4);

  const pageJsonLd = collectionPageJsonLd({
    name: 'Amazon Coupons',
    url: `${SITE.url}/coupons/amazon`,
    description: metadata.description,
    hasPart: coupons.map((coupon) => ({
      '@type': 'Offer',
      name: `${coupon.discount}: ${coupon.title}`,
      sku: coupon.asin,
      category: coupon.category,
      url: coupon.href,
      description: coupon.couponText || coupon.code || coupon.discount,
    })),
  });

  return (
    <main data-testid="store-coupons-page">
      <JsonLd graph={[pageJsonLd]} />

      <Hero
        logo={logo}
        liveCodes={liveCodes}
        liveDeals={liveDeals}
        topOffer={topOffer}
        updatedLabel={updatedLabel}
        couponCount={coupons.length}
      />

      {highlightCoupons.length > 0 ? (
        <section className="border-b border-ink/10 bg-[#f0f2f4] py-10 sm:py-12" data-testid="featured-store-coupons">
          <div className="mx-auto max-w-[1366px] px-6">
            <SectionHead
              eyebrow="Top picks"
              title="Best Amazon offers right now"
              subtitle="Featured promo codes and product deals from the live Amazon feed."
            />
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {highlightCoupons.map((coupon) => (
                <AmazonCouponCard key={`featured-${coupon.asin}-${coupon.code ?? coupon.href}`} coupon={coupon} featured />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="bg-white py-10 sm:py-14">
        <div className="mx-auto grid max-w-[1366px] gap-10 px-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <SectionHead
              eyebrow="All offers"
              title="Amazon coupon codes"
              subtitle={
                coupons.length > 0
                  ? `${coupons.length} live Amazon offers with promo codes, product images, and price details.`
                  : 'No live Amazon offers returned at the moment.'
              }
            />

            {coupons.length > 0 ? (
              <div className="mt-6 grid gap-4">
                {coupons.map((coupon) => (
                  <AmazonCouponCard key={`${coupon.asin}-${coupon.code ?? coupon.href}`} coupon={coupon} />
                ))}
              </div>
            ) : (
              <div className="mt-6 border border-dashed border-ink/15 bg-[#f0f2f4] p-8 text-center">
                <p className="font-display text-lg font-bold text-ink">No Amazon coupons right now</p>
                <p className="mt-2 text-sm leading-6 text-ink/60">
                  No matching Amazon deals are available. The page refreshes daily on the next API update.
                </p>
                <a
                  href={AMAZON_URL}
                  target="_blank"
                  rel="nofollow sponsored noopener noreferrer"
                  className="mt-5 inline-flex bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-emphasis"
                >
                  Visit Amazon
                </a>
              </div>
            )}

            <section className="mt-10 border border-ink/10 bg-[#fbfcfd] p-6">
              <h2 className="font-display text-lg font-bold text-ink">How to use Amazon promo codes</h2>
              <ol className="mt-4 space-y-3 text-sm leading-7 text-ink/65">
                {[
                  'Choose an Amazon offer and open it with the Get code button.',
                  'Copy the promo code shown on the coupon card when one is available.',
                  'Add the eligible product to your cart and proceed to checkout.',
                  'Paste the code into Amazon’s promotional code field and apply it.',
                  'Confirm the final price before placing the order.',
                ].map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-primary/10 text-xs font-bold text-primary">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <SidebarCard title="About Amazon">
              <p className="text-sm leading-7 text-ink/62">
                Amazon is one of the world&apos;s largest shopping marketplaces — electronics, home,
                kitchen, clothing, beauty, books, toys, groceries, and everyday essentials.
              </p>
              <p className="mt-3 text-sm leading-7 text-ink/62">
                This page shows Amazon coupon and promo-code offers from the live feed. Confirm code
                eligibility and final price at Amazon checkout.
              </p>
              <a
                href={AMAZON_URL}
                target="_blank"
                rel="nofollow sponsored noopener noreferrer"
                className="mt-4 inline-flex w-full justify-center border border-ink/15 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-ink transition hover:border-primary hover:text-primary"
              >
                Visit Amazon →
              </a>
            </SidebarCard>

            <SidebarCard title="Quick tips">
              <ul className="space-y-2 text-sm leading-6 text-ink/62">
                <li>Check whether a promo code and coupon can stack before checkout.</li>
                <li>Compare listed price against promo-only and coupon-only prices.</li>
                <li>Use Prime shipping and Subscribe &amp; Save where eligible.</li>
              </ul>
            </SidebarCard>

            {relatedStores.length > 0 ? (
              <SidebarCard title="Similar stores">
                <div className="space-y-3">
                  {relatedStores.map((related) => (
                    <Link
                      key={related.id}
                      href={`/coupons/${couponStorePublicSlug(related)}`}
                      className="group flex items-center gap-3 rounded-lg border border-transparent p-1 transition hover:border-ink/10 hover:bg-[#f0f2f4]"
                    >
                      <StoreLogo name={related.name} logo={storeLogoUrl(related)} className="h-9 w-11" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink group-hover:text-primary">
                          {related.name}
                        </span>
                        <span className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-primary/70">
                          View coupons
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </SidebarCard>
            ) : null}

            <SidebarCard title="Browse more">
              <div className="grid gap-2">
                <NavLink href="/coupons">All coupons</NavLink>
                <NavLink href="/brands">Brands</NavLink>
                <NavLink href="/stores">Store directory</NavLink>
                <NavLink href="/search?q=electronics+coupons">Electronics deals</NavLink>
              </div>
            </SidebarCard>

            <SidebarCard title="FAQ">
              <ul className="space-y-3 text-sm leading-6 text-ink/62">
                <li><strong className="text-ink">Do codes always work?</strong> Codes can expire — verify at checkout.</li>
                <li><strong className="text-ink">Can discounts stack?</strong> Amazon controls final checkout rules.</li>
                <li><strong className="text-ink">How often updated?</strong> Refreshed daily from the Amazon deals API.</li>
              </ul>
            </SidebarCard>
          </aside>
        </div>
      </section>

      <ValueStrip />
    </main>
  );
}

function Hero({
  logo,
  liveCodes,
  liveDeals,
  topOffer,
  updatedLabel,
  couponCount,
}: {
  logo: string;
  liveCodes: number;
  liveDeals: number;
  topOffer: string;
  updatedLabel: string;
  couponCount: number;
}) {
  return (
    <section className="relative overflow-hidden border-b border-ink/10 bg-[#1d252c] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(at 80% 20%, rgba(0,70,190,0.2) 0%, transparent 50%), radial-gradient(at 20% 80%, rgba(255,153,0,0.08) 0%, transparent 50%)',
        }}
      />
      <div className="relative mx-auto max-w-[1366px] px-6 py-10 sm:py-14">
        <div className="flex flex-col gap-[3.5rem]">
          <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/45">
            <Link href="/" className="transition hover:text-white">Home</Link>
            <span aria-hidden>/</span>
            <Link href="/coupons" className="transition hover:text-white">Coupons</Link>
            <span aria-hidden>/</span>
            <span className="text-[#ffe000]">Amazon</span>
          </nav>

          <div className="flex flex-wrap items-start gap-5">
            <StoreLogo name="Amazon" logo={logo} className="h-20 w-24" dark />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ffe000]">Marketplace coupons</p>
              <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
                Amazon coupon codes &amp; deals
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">
                Amazon-only promo codes and coupon deals for home, kitchen, sports, apparel,
                electronics, baby products, and more. Refreshed daily from the Amazon deals API.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 sm:gap-10">
            <Stat label="Live offers" value={String(couponCount)} />
            <Stat label="Promo codes" value={String(liveCodes)} />
            <Stat label="Deals" value={String(liveDeals)} />
            <Stat label="Top offer" value={topOffer} compact />
            <Stat label="Last updated" value={updatedLabel} />
          </div>
        </div>

        <div className="mt-[3.5rem] flex flex-wrap gap-3">
          <a href="#all-offers" className="inline-flex bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary-emphasis">
            View all offers
          </a>
          <a
            href={AMAZON_URL}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:border-white/40"
          >
            Visit Amazon
          </a>
          <Link href="/stores" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white/75 transition hover:border-white/40 hover:text-white">
            More stores
          </Link>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={compact ? 'max-w-[200px]' : undefined}>
      <p className={`font-display font-bold text-white ${compact ? 'text-lg leading-snug' : 'text-3xl'}`}>
        {value}
      </p>
      <p className="mt-1 text-sm text-white/55">{label}</p>
    </div>
  );
}

function SectionHead({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="max-w-2xl" id={title.includes('coupon codes') ? 'all-offers' : undefined}>
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
      <h2 className="mt-2 font-display font-bold text-ink">{title}</h2>
      {subtitle ? <p className="mt-3 text-sm leading-7 text-ink/60 sm:text-base">{subtitle}</p> : null}
    </div>
  );
}

function SidebarCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-ink/10 bg-white p-5">
      <h4 className="font-display text-base font-bold text-ink">{title}</h4>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between border border-ink/8 bg-[#f0f2f4] px-3 py-2.5 text-sm font-semibold text-ink/75 transition hover:border-primary/30 hover:text-primary"
    >
      {children}
      <span aria-hidden className="text-primary">→</span>
    </Link>
  );
}

function StoreLogo({
  name,
  logo,
  className,
  dark = false,
}: {
  name: string;
  logo?: string;
  className: string;
  dark?: boolean;
}) {
  const fallbackBg = dark ? 'bg-white/10 text-white' : 'bg-paper text-ink';

  return logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt={`${name} logo`}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={`${className} shrink-0 rounded-xl bg-white object-contain`}
    />
  ) : (
    <span className={`${className} grid shrink-0 place-items-center rounded-xl font-display text-sm font-extrabold uppercase ${fallbackBg}`}>
      {name.slice(0, 3)}
    </span>
  );
}

function AmazonCouponCard({ coupon, featured = false }: { coupon: AmazonCoupon; featured?: boolean }) {
  const bestPrice = coupon.combinedPrice || coupon.promoPrice || coupon.couponPrice;

  return (
    <article
      className={`grid gap-4 border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-20px_rgba(13,27,42,0.35)] sm:grid-cols-[120px_minmax(0,1fr)] ${
        featured ? 'border-primary/25 shadow-[0_12px_24px_-18px_rgba(0,70,190,0.25)]' : 'border-ink/10 hover:border-primary/30'
      }`}
    >
      <a
        href={coupon.href}
        target="_blank"
        rel="nofollow sponsored noopener noreferrer"
        className="block overflow-hidden rounded-lg border border-ink/10 bg-white p-2"
      >
        {coupon.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coupon.image}
            alt={coupon.title}
            className="mx-auto h-28 w-full object-contain"
          />
        ) : (
          <div className="grid h-28 place-items-center bg-muted font-display text-sm font-bold text-primary">
            Amazon
          </div>
        )}
      </a>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-primary/10 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-primary">
            {coupon.code ? 'Promo code' : 'Deal'}
          </span>
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-ink/45">{coupon.category}</span>
          {featured ? (
            <span className="ml-auto rounded bg-primary/10 px-2 py-1 text-[0.6rem] font-bold uppercase tracking-wider text-primary">
              Top pick
            </span>
          ) : null}
        </div>

        <div>
          <h5 className="font-display text-xl font-bold leading-snug text-primary">{coupon.discount}</h5>
          <a
            href={coupon.href}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            className="mt-2 block line-clamp-2 text-sm font-semibold leading-6 text-ink transition hover:text-primary"
          >
            {coupon.title}
          </a>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <PriceChip label="Promo code" value={coupon.code || 'No code'} dashed />
          <PriceChip label="Coupon" value={coupon.couponText || 'Check Amazon'} />
          <PriceChip label="Listed" value={coupon.listedPrice || 'See Amazon'} />
          <PriceChip label="Best price" value={bestPrice || 'See Amazon'} highlight />
        </div>

        <div className="mt-auto grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <span className="truncate border border-dashed border-ink/20 bg-paper px-3 py-2.5 text-center text-xs font-bold uppercase tracking-[0.06em] text-ink">
            {coupon.code || 'No code needed'}
          </span>
          <a
            href={coupon.href}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            className="bg-primary px-4 py-2.5 text-center text-xs font-bold uppercase tracking-[0.08em] text-white transition hover:bg-primary-emphasis"
          >
            {coupon.code ? 'Get code' : 'Get deal'}
          </a>
        </div>

        {coupon.postedAt ? (
          <p className="text-[0.68rem] font-semibold text-ink/42">Posted {coupon.postedAt}</p>
        ) : null}
      </div>
    </article>
  );
}

function PriceChip({
  label,
  value,
  dashed = false,
  highlight = false,
}: {
  label: string;
  value: string;
  dashed?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`px-2.5 py-2 ${
        highlight
          ? 'border border-primary/20 bg-primary/5'
          : dashed
            ? 'border border-dashed border-ink/20 bg-paper'
            : 'border border-ink/10 bg-[#fbfcfd]'
      }`}
    >
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-ink/45">{label}</p>
      <p className="mt-0.5 truncate text-xs font-semibold text-ink">{value}</p>
    </div>
  );
}

function ValueStrip() {
  const items = [
    { ic: '🏷️', t: 'Live Amazon feed', s: 'Product deals pulled from the Amazon Promo Codes API and refreshed daily.' },
    { ic: '✓', t: 'Price details', s: 'See listed, promo, coupon, and estimated combined prices on each card.' },
    { ic: '→', t: 'More ways to save', s: 'Browse brands, compare products, and track price drops on NXT.Bargains.' },
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
