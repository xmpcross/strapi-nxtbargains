import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  countryName,
  highIntentStoreAliases,
  listCouponStores,
  storeCategory,
  storeLogoUrl,
  type CouponStore,
} from '@/lib/coupon-stores';
import { SITE } from '@/lib/site';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Brands — Coupon Codes & Promo Deals',
  description: `Browse top retail brands on ${SITE.name} — Amazon, Nike, Samsung, and more. Jump to live coupon pages for each brand.`,
  alternates: { canonical: '/brands' },
};

const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

type BrandRow = {
  store: CouponStore;
  displayName: string;
  slug: string;
  category: string;
  priority: number;
};

type SearchParams = {
  q?: string;
  country?: string;
  category?: string;
  letter?: string;
};

function brandCouponHref(slug: string) {
  return slug === 'amazon' ? '/coupons/amazon' : `/coupons/${slug}`;
}

function enrichBrand(
  store: CouponStore,
  alias: { label?: string; slug: string; priority?: number },
): BrandRow {
  return {
    store,
    displayName: alias.label || store.name,
    slug: alias.slug,
    category: storeCategory(store),
    priority: Number(alias.priority ?? 99),
  };
}

function letterOf(name: string) {
  const first = (name[0] || '#').toUpperCase();
  return /[A-Z]/.test(first) ? first : '#';
}

function normalizeLetter(value?: string) {
  if (!value) return '';
  const upper = value.toUpperCase();
  return ALPHABET.includes(upper) ? upper : '';
}

function filterHref(base: URLSearchParams, key: string, value: string) {
  const params = new URLSearchParams(base);
  if (value) params.set(key, value);
  else params.delete(key);
  return `/brands?${params.toString()}`;
}

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = (params.q ?? '').trim().toLowerCase();
  const country = (params.country ?? '').trim().toUpperCase();
  const category = (params.category ?? '').trim();
  const letter = normalizeLetter(params.letter);
  const hasFilters = Boolean(q || country || category || letter);

  const cache = listCouponStores();
  const aliases = highIntentStoreAliases();
  const storesById = new Map(cache.stores.map((store) => [store.id, store]));

  const allBrands = aliases
    .map((alias) => {
      const store = storesById.get(alias.storeId);
      if (!store) return null;
      return enrichBrand(store, alias);
    })
    .filter((row): row is BrandRow => Boolean(row))
    .sort((a, b) => a.priority - b.priority || a.displayName.localeCompare(b.displayName));

  const featuredBrands = allBrands.filter((row) => row.priority <= 1);

  const filtered = allBrands.filter((row) => {
    const haystack = `${row.displayName} ${row.store.domain} ${row.category}`.toLowerCase();
    if (q && !haystack.includes(q)) return false;
    if (country && row.store.country !== country) return false;
    if (category && row.category !== category) return false;
    if (letter && letterOf(row.displayName) !== letter) return false;
    return true;
  });

  const countries = Array.from(new Set(allBrands.map((b) => b.store.country).filter(Boolean))).sort();
  const categories = Array.from(new Set(allBrands.map((b) => b.category))).sort((a, b) => a.localeCompare(b));
  const countryCounts = countries
    .map((code) => ({ code, count: allBrands.filter((b) => b.store.country === code).length }))
    .sort((a, b) => b.count - a.count);
  const categoryCounts = categories
    .map((name) => ({ name, count: allBrands.filter((b) => b.category === name).length }))
    .sort((a, b) => b.count - a.count);
  const letterCounts = ALPHABET.map((code) => ({
    code,
    count: allBrands.filter((b) => letterOf(b.displayName) === code).length,
  }));

  const queryBase = new URLSearchParams();
  if (q) queryBase.set('q', params.q ?? '');
  if (country) queryBase.set('country', country);
  if (category) queryBase.set('category', category);
  if (letter) queryBase.set('letter', letter);

  const groupedByCategory = categories
    .map((name) => ({
      name,
      brands: filtered.filter((row) => row.category === name),
    }))
    .filter((group) => group.brands.length > 0);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Brands — Coupon Codes & Promo Deals',
    url: `${SITE.url}/brands`,
    description: metadata.description,
    numberOfItems: allBrands.length,
  };

  return (
    <div data-testid="brands-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Hero brandCount={allBrands.length} featuredCount={featuredBrands.length} />

      <section className="border-b border-ink/10 bg-[#f0f2f4] py-10 sm:py-12" data-testid="featured-brands" id="featured-brands">
        <div className="mx-auto max-w-[1366px] px-6">
          <SectionHead
            eyebrow="Featured"
            title="Top brands"
            subtitle={`${featuredBrands.length} hand-picked retailers with dedicated coupon pages and live promo-code feeds.`}
          />
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {featuredBrands.map((row) => (
              <BrandCard key={row.store.id} row={row} featured />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-10 sm:py-14" data-testid="all-brands" id="all-brands">
        <div className="mx-auto max-w-[1366px] px-6">
          <SectionHead
            eyebrow="Full list"
            title="All brands"
            subtitle={`Search and filter ${allBrands.length} retail brands. Each brand links to its live coupon page.`}
          />

          <form action="/brands" method="get" className="mt-8 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_180px_120px_auto]" data-testid="brands-filter-form">
            <label htmlFor="brand-search" className="sr-only">Search brands</label>
            <input
              id="brand-search"
              name="q"
              type="search"
              defaultValue={params.q ?? ''}
              placeholder="Search brand name or domain…"
              className="h-12 border border-ink/15 bg-white px-4 text-sm outline-none transition focus:border-primary"
            />
            <label htmlFor="country-filter" className="sr-only">Country</label>
            <select
              id="country-filter"
              name="country"
              defaultValue={country}
              className="h-12 border border-ink/15 bg-white px-3 text-sm font-semibold text-ink outline-none transition focus:border-primary"
            >
              <option value="">All countries</option>
              {countries.map((code) => (
                <option key={code} value={code}>{countryName(code)}</option>
              ))}
            </select>
            <label htmlFor="category-filter" className="sr-only">Category</label>
            <select
              id="category-filter"
              name="category"
              defaultValue={category}
              className="h-12 border border-ink/15 bg-white px-3 text-sm font-semibold text-ink outline-none transition focus:border-primary"
            >
              <option value="">All categories</option>
              {categories.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <label htmlFor="letter-filter" className="sr-only">Letter</label>
            <select
              id="letter-filter"
              name="letter"
              defaultValue={letter}
              className="h-12 border border-ink/15 bg-white px-3 text-sm font-semibold text-ink outline-none transition focus:border-primary"
            >
              <option value="">A–Z</option>
              {ALPHABET.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
            <button type="submit" className="h-12 bg-primary px-6 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary-emphasis">
              Filter
            </button>
          </form>

          {hasFilters && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-ink/50">Active filters:</span>
              {q && <FilterTag href={filterHref(queryBase, 'q', '')} label={`"${params.q}"`} />}
              {country && <FilterTag href={filterHref(queryBase, 'country', '')} label={countryName(country)} />}
              {category && <FilterTag href={filterHref(queryBase, 'category', '')} label={category} />}
              {letter && <FilterTag href={filterHref(queryBase, 'letter', '')} label={`Letter: ${letter}`} />}
              <Link href="/brands#all-brands" className="text-xs font-bold text-primary hover:underline">Clear all</Link>
            </div>
          )}

          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink/45">Browse by letter</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <FilterChip href={filterHref(queryBase, 'letter', '')} active={!letter}>All</FilterChip>
              {letterCounts.map((item) => (
                <FilterChip
                  key={item.code}
                  href={filterHref(queryBase, 'letter', item.code)}
                  active={letter === item.code}
                  disabled={item.count === 0}
                >
                  {item.code}
                </FilterChip>
              ))}
            </div>
          </div>

          <div className="mt-6 border border-ink/10 bg-[#f0f2f4] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink/45">Categories</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <FilterChip href={filterHref(queryBase, 'category', '')} active={!category}>All</FilterChip>
              {categoryCounts.map((item) => (
                <FilterChip
                  key={item.name}
                  href={filterHref(queryBase, 'category', item.name)}
                  active={category === item.name}
                >
                  {item.name} ({item.count})
                </FilterChip>
              ))}
            </div>
          </div>

          <div className="mt-6 border border-ink/10 bg-[#f0f2f4] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink/45">Countries</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <FilterChip href={filterHref(queryBase, 'country', '')} active={!country}>All</FilterChip>
              {countryCounts.map((item) => (
                <FilterChip
                  key={item.code}
                  href={filterHref(queryBase, 'country', item.code)}
                  active={country === item.code}
                >
                  {countryName(item.code)} ({item.count})
                </FilterChip>
              ))}
            </div>
          </div>

          <p className="mt-8 text-sm font-semibold text-ink/65" data-testid="brands-result-count">
            Showing {filtered.length.toLocaleString()} of {allBrands.length.toLocaleString()} brands
            {hasFilters ? ' (filtered)' : ''}
          </p>

          {filtered.length > 0 ? (
            hasFilters ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((row) => (
                  <BrandCard key={row.store.id} row={row} featured={row.priority <= 1} />
                ))}
              </div>
            ) : (
              <div className="mt-8 space-y-10">
                {groupedByCategory.map((group) => (
                  <div key={group.name}>
                    <h3 className="font-display text-lg font-bold text-ink">{group.name}</h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {group.brands.map((row) => (
                        <BrandCard key={row.store.id} row={row} featured={row.priority <= 1} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="mt-8 border border-dashed border-ink/15 bg-[#f0f2f4] p-10 text-center">
              <p className="font-display text-lg font-bold text-ink">No brands match your filters</p>
              <p className="mt-2 text-sm text-ink/60">Try a different search term or clear the filters.</p>
              <Link href="/brands#all-brands" className="mt-5 inline-flex bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-emphasis">
                Clear filters
              </Link>
            </div>
          )}
        </div>
      </section>

      <ValueStrip />
    </div>
  );
}

function Hero({ brandCount, featuredCount }: { brandCount: number; featuredCount: number }) {
  return (
    <section className="relative overflow-hidden border-b border-ink/10 bg-[#1d252c] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(at 75% 15%, rgba(0,70,190,0.2) 0%, transparent 50%), radial-gradient(at 25% 85%, rgba(168,85,247,0.12) 0%, transparent 50%)',
        }}
      />
      <div className="relative mx-auto max-w-[1366px] px-6 py-14 sm:py-18">
        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#ffe000]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ffe000]" aria-hidden />
          Brand directory
        </p>
        <h1 className="mt-5 font-display text-4xl font-bold leading-[1.04] tracking-tight sm:text-5xl">
          Shop by brand — coupon codes &amp; deals
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
          Browse {brandCount} top retail brands and jump straight to live promo-code pages.
          Filter by category, country, or letter to find the brand you need.
        </p>
        <div className="mt-8 flex flex-wrap gap-6">
          <Stat label="Total brands" value={String(brandCount)} />
          <Stat label="Featured" value={String(featuredCount)} />
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#featured-brands" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:border-white/40">
            Featured brands
          </a>
          <a href="#all-brands" className="inline-flex bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary-emphasis">
            Browse all brands
          </a>
          <Link href="/coupons" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white/80 transition hover:border-white/40 hover:text-white">
            All coupons
          </Link>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-3xl font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-white/55">{label}</p>
    </div>
  );
}

function SectionHead({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
      <h2 className="mt-2 font-display font-bold text-ink">{title}</h2>
      {subtitle && <p className="mt-3 text-sm leading-7 text-ink/60 sm:text-base">{subtitle}</p>}
    </div>
  );
}

function BrandCard({ row, featured }: { row: BrandRow; featured?: boolean }) {
  const logo = storeLogoUrl(row.store);
  return (
    <Link
      href={brandCouponHref(row.slug)}
      className="group flex items-start gap-3 border border-ink/10 bg-white p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_14px_28px_-20px_rgba(13,27,42,0.35)]"
      data-testid={`brand-card-${row.slug}`}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-11 w-12 shrink-0 rounded-lg bg-white object-contain p-1.5 ring-1 ring-inset ring-ink/10"
        />
      ) : (
        <span className="grid h-11 w-12 shrink-0 place-items-center rounded-lg bg-muted font-display text-xs font-bold text-ink/40 ring-1 ring-inset ring-ink/10">
          {row.displayName.slice(0, 2)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <h4 className="brand-card-title truncate text-ink group-hover:text-primary">{row.displayName}</h4>
          {featured && (
            <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-primary">Top</span>
          )}
        </span>
        <span className="mt-1 block truncate text-xs text-ink/50">{row.store.domain}</span>
        <span className="mt-1 block text-[0.68rem] font-bold uppercase tracking-[0.1em] text-primary">
          {row.store.country ? countryName(row.store.country) : 'Global'} · {row.category}
        </span>
        <span className="mt-2 inline-block text-[0.68rem] font-bold uppercase tracking-[0.1em] text-primary/80 group-hover:text-primary">
          View coupons →
        </span>
      </span>
    </Link>
  );
}

function FilterChip({
  href,
  active = false,
  disabled = false,
  children,
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  if (disabled) {
    return <span className="px-2.5 py-1 text-xs font-bold text-ink/25">{children}</span>;
  }
  return (
    <Link
      href={href}
      className={`border px-2.5 py-1 text-xs font-bold transition ${
        active
          ? 'border-primary bg-primary text-white'
          : 'border-ink/10 bg-white text-ink/65 hover:border-primary hover:text-primary'
      }`}
    >
      {children}
    </Link>
  );
}

function FilterTag({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-semibold text-ink/70 hover:border-primary hover:text-primary"
    >
      {label}
      <span aria-hidden>×</span>
    </Link>
  );
}

function ValueStrip() {
  const items = [
    { ic: '★', t: 'Curated brands', s: 'Hand-picked retailers with active coupon feeds and dedicated pages.' },
    { ic: '→', t: 'One-click access', s: 'Every brand card links directly to its live promo-code page.' },
    { ic: '✓', t: 'Always free', s: 'Browse, compare, and save — no signup required.' },
  ];
  return (
    <div className="border-t border-ink/10 bg-muted">
      <div className="mx-auto grid max-w-[1366px] gap-6 px-6 py-10 sm:grid-cols-3">
        {items.map((v) => (
          <div key={v.t} className="flex items-start gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-lg font-bold text-primary">{v.ic}</span>
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
