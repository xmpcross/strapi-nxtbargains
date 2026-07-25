import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SITE } from '@/lib/site';
import { listCouponsForStore, type Coupon } from '@/lib/coupon-data';
import {
  countryName,
  couponStoreCanonicalSlug,
  couponStoreIsIndexable,
  couponStorePublicSlug,
  findCouponStoreBySlug,
  relatedCouponStores,
  storeCategory,
  storeLogoUrl,
} from '@/lib/coupon-stores';
import { collectionPageJsonLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';

export const revalidate = 86400;

export async function generateMetadata({ params }: { params: Promise<{ storeSlug: string }> }): Promise<Metadata> {
  const { storeSlug } = await params;
  const store = findCouponStoreBySlug(storeSlug);
  if (!store) {
    return {
      title: 'Store Coupons',
      description: 'Current store coupon codes and deals from NXT.Bargains.',
    };
  }

  return {
    title: `${store.name} Coupons, Promo Codes & Deals`,
    description: `Find current ${store.name} coupon codes, discounts, and online deals curated by NXT.Bargains.`,
    alternates: { canonical: `/coupons/${couponStoreCanonicalSlug(store)}` },
    // Stores without curated coupon content render a thin/boilerplate page — keep
    // them out of Google's index (and the sitemap) until they have real coupons.
    ...(couponStoreIsIndexable(store) ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function StoreCouponsPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const store = findCouponStoreBySlug(storeSlug);
  if (!store) notFound();

  const [coupons, relatedStores] = await Promise.all([
    listCouponsForStore(store.id, store.name, storeSlug),
    Promise.resolve(relatedCouponStores(store, 8)),
  ]);

  const logo = storeLogoUrl(store);
  const category = storeCategory(store);
  const liveCodes = coupons.filter((coupon) => coupon.code).length;
  const liveDeals = Math.max(0, coupons.length - liveCodes);
  const topOffer = coupons[0]?.discount ?? 'Current offers';
  const storeUrl = store.url || (store.domain ? `https://${store.domain}` : '');
  const featuredCoupons = coupons.filter((c) => c.code).slice(0, 4);
  const highlightCoupons = featuredCoupons.length > 0 ? featuredCoupons : coupons.slice(0, 4);
  const canonicalSlug = couponStoreCanonicalSlug(store);

  const couponJsonLd = collectionPageJsonLd({
    name: `${store.name} Coupons`,
    url: `${SITE.url}/coupons/${canonicalSlug}`,
    description: `Current coupon codes and deals for ${store.name}.`,
    hasPart: coupons.map((coupon) => ({
      '@type': 'Offer',
      name: coupon.title,
      category: coupon.category,
      url: coupon.href.startsWith('http') ? coupon.href : `${SITE.url}${coupon.href}`,
      description: coupon.discount,
    })),
  });

  return (
    <main data-testid="store-coupons-page">
      <JsonLd graph={[couponJsonLd]} />

      <Hero
        storeName={store.name}
        category={category}
        logo={logo}
        liveCodes={liveCodes}
        liveDeals={liveDeals}
        topOffer={topOffer}
        country={countryName(store.country)}
        storeUrl={storeUrl}
        couponCount={coupons.length}
      />

      {highlightCoupons.length > 0 ? (
        <section className="border-b border-ink/10 bg-[#f0f2f4] py-10 sm:py-12" data-testid="featured-store-coupons">
          <div className="mx-auto max-w-[1366px] px-6">
            <SectionHead
              eyebrow="Top picks"
              title={`Best ${store.name} offers right now`}
              subtitle="Featured promo codes and deals from the live coupon feed."
            />
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {highlightCoupons.map((coupon, index) => (
                <CouponCard
                  key={`featured-${coupon.code ?? index}-${coupon.title}`}
                  coupon={coupon}
                  logo={logo}
                  storeName={store.name}
                  featured
                />
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
              title={`${store.name} coupon codes`}
              subtitle={
                coupons.length > 0
                  ? `${coupons.length} live offers — codes and deals updated from the coupon API.`
                  : 'No live offers returned at the moment.'
              }
            />

            {coupons.length > 0 ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {coupons.map((coupon, index) => (
                  <CouponCard
                    key={`${coupon.store}-${coupon.code ?? index}-${coupon.title}`}
                    coupon={coupon}
                    logo={logo}
                    storeName={store.name}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-6 border border-dashed border-ink/15 bg-[#f0f2f4] p-8 text-center">
                <p className="font-display text-lg font-bold text-ink">No live coupons right now</p>
                <p className="mt-2 text-sm leading-6 text-ink/60">
                  This store is in our coupon directory, but the feed has no active offers at the moment.
                  Check back after the next refresh or visit the store directly.
                </p>
                {storeUrl ? (
                  <a
                    href={storeUrl}
                    target="_blank"
                    rel="nofollow sponsored noopener noreferrer"
                    className="mt-5 inline-flex bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-emphasis"
                  >
                    Visit {store.name}
                  </a>
                ) : null}
              </div>
            )}

            <section className="mt-10 border border-ink/10 bg-[#fbfcfd] p-6">
              <h2 className="font-display text-lg font-bold text-ink">How to use {store.name} promo codes</h2>
              <ol className="mt-4 space-y-3 text-sm leading-7 text-ink/65">
                <li className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-primary/10 text-xs font-bold text-primary">1</span>
                  <span>Choose a live code or deal from this page.</span>
                </li>
                <li className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-primary/10 text-xs font-bold text-primary">2</span>
                  <span>Open the offer and copy the promo code if one is shown.</span>
                </li>
                <li className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-primary/10 text-xs font-bold text-primary">3</span>
                  <span>Add eligible items to your cart on the store website.</span>
                </li>
                <li className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-primary/10 text-xs font-bold text-primary">4</span>
                  <span>Paste the code at checkout, or follow the deal link if no code is needed.</span>
                </li>
              </ol>
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <SidebarCard title={`About ${store.name}`}>
              <p className="text-sm leading-7 text-ink/62">
                {store.name} is listed in the NXT.Bargains coupon directory under {category.toLowerCase()}.
                {store.domain ? ` Official domain: ${store.domain}.` : ''}
              </p>
              {storeUrl ? (
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="nofollow sponsored noopener noreferrer"
                  className="mt-4 inline-flex w-full justify-center border border-ink/15 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-ink transition hover:border-primary hover:text-primary"
                >
                  Visit store →
                </a>
              ) : null}
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
                <NavLink href={`/search?q=${encodeURIComponent(`${category} coupons`)}`}>
                  {category} deals
                </NavLink>
              </div>
            </SidebarCard>

            <SidebarCard title="Popular categories">
              <div className="flex flex-wrap gap-2">
                {['Electronics', 'Home and Garden', 'Fashion', 'Beauty and Health', 'Gaming'].map((name) => (
                  <Link
                    key={name}
                    href={`/search?q=${encodeURIComponent(`${name} coupons`)}`}
                    className="border border-ink/10 bg-white px-2.5 py-1.5 text-xs font-bold text-ink/65 transition hover:border-primary hover:text-primary"
                  >
                    {name}
                  </Link>
                ))}
              </div>
            </SidebarCard>
          </aside>
        </div>
      </section>

      <ValueStrip storeName={store.name} />
    </main>
  );
}

function Hero({
  storeName,
  category,
  logo,
  liveCodes,
  liveDeals,
  topOffer,
  country,
  storeUrl,
  couponCount,
}: {
  storeName: string;
  category: string;
  logo: string;
  liveCodes: number;
  liveDeals: number;
  topOffer: string;
  country: string;
  storeUrl: string;
  couponCount: number;
}) {
  return (
    <section className="relative overflow-hidden border-b border-ink/10 bg-[#1d252c] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(at 80% 20%, rgba(0,70,190,0.2) 0%, transparent 50%), radial-gradient(at 20% 80%, rgba(6,182,212,0.1) 0%, transparent 50%)',
        }}
      />
      <div className="relative mx-auto max-w-[1366px] px-6 py-10 sm:py-14">
        <div className="flex flex-col gap-[3.5rem]">
          <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/45">
            <Link href="/" className="transition hover:text-white">Home</Link>
            <span aria-hidden>/</span>
            <Link href="/coupons" className="transition hover:text-white">Coupons</Link>
            <span aria-hidden>/</span>
            <span className="text-[#ffe000]">{storeName}</span>
          </nav>

          <div className="flex flex-wrap items-start gap-5">
            <StoreLogo name={storeName} logo={logo} className="h-20 w-24" dark />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ffe000]">{category} coupons</p>
              <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
                {storeName} coupon codes &amp; deals
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">
                Browse current {storeName} promo codes, discounts, and online offers.
                Codes are pulled from the live coupon feed and refreshed daily.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 sm:gap-10">
            <Stat label="Live offers" value={String(couponCount)} />
            <Stat label="Promo codes" value={String(liveCodes)} />
            <Stat label="Deals" value={String(liveDeals)} />
            <Stat label="Top offer" value={topOffer} compact />
            <Stat label="Country" value={country} />
          </div>
        </div>

        <div className="mt-[3.5rem] flex flex-wrap gap-3">
          <a href="#all-offers" className="inline-flex bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary-emphasis">
            View all offers
          </a>
          {storeUrl ? (
            <a
              href={storeUrl}
              target="_blank"
              rel="nofollow sponsored noopener noreferrer"
              className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:border-white/40"
            >
              Visit {storeName}
            </a>
          ) : null}
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
      <p className={`font-display font-bold text-white ${compact ? 'text-lg leading-snug' : ''}`}>
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

function CouponCard({
  coupon,
  logo,
  storeName,
  featured = false,
}: {
  coupon: Coupon;
  logo: string;
  storeName: string;
  featured?: boolean;
}) {
  return (
    <article
      className={`grid gap-3 border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-20px_rgba(13,27,42,0.35)] ${
        featured ? 'border-primary/25 shadow-[0_12px_24px_-18px_rgba(0,70,190,0.25)]' : 'border-ink/10 hover:border-primary/30'
      }`}
    >
      <div className="flex items-center gap-3">
        <StoreLogo name={storeName} logo={logo} className="h-12 w-14" />
        <div className="min-w-0">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-primary">
            {coupon.code ? 'Promo code' : coupon.type}
          </p>
          <p className="mt-0.5 truncate text-xs font-semibold text-ink/45">{coupon.verified}</p>
        </div>
        {featured ? (
          <span className="ml-auto shrink-0 rounded bg-primary/10 px-2 py-1 text-[0.6rem] font-bold uppercase tracking-wider text-primary">
            Top pick
          </span>
        ) : null}
      </div>

      <div>
        <h5 className="font-display text-xl font-bold leading-snug text-ink">{coupon.discount}</h5>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink/60">{coupon.title}</p>
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
    </article>
  );
}

function ValueStrip({ storeName }: { storeName: string }) {
  const items = [
    { ic: '🏷️', t: 'Live coupon feed', s: `${storeName} offers are pulled from the coupon API and refreshed daily.` },
    { ic: '✓', t: 'Verified codes', s: 'Promo codes and deal links checked against the live retailer feed.' },
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
