import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  countryName,
  couponStoreCanonicalSlug,
  highIntentStoreAliases,
  listCouponStores,
  storeCategory,
  storeLogoUrl,
  storeSearchText,
  type CouponStore,
} from '@/lib/coupon-stores';
import { SITE } from '@/lib/site';
import { collectionPageJsonLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Coupon Stores',
  description: `Browse ${SITE.name}'s coupon store directory — search, filter, and find promo codes from thousands of retailers.`,
  alternates: { canonical: '/stores' },
};

const PAGE_SIZE = 48;
const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

type StoreRow = {
  store: CouponStore;
  displayName: string;
  slug: string;
  category: string;
};

type SearchParams = {
  q?: string;
  country?: string;
  category?: string;
  letter?: string;
  page?: string;
};

function storeHref(row: StoreRow) {
  return `/coupons/${row.slug}`;
}

function enrichStore(store: CouponStore, alias?: { label?: string; slug: string }): StoreRow {
  return {
    store,
    displayName: alias?.label || store.name,
    slug: alias?.slug || couponStoreCanonicalSlug(store),
    category: storeCategory(store),
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

function pageHref(base: URLSearchParams, page: number) {
  const params = new URLSearchParams(base);
  params.set('page', String(page));
  return `/stores?${params.toString()}`;
}

function filterHref(base: URLSearchParams, key: string, value: string) {
  const params = new URLSearchParams(base);
  params.delete('page');
  if (value) params.set(key, value);
  else params.delete(key);
  return `/stores?${params.toString()}`;
}

export default async function StoresPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = (params.q ?? '').trim().toLowerCase();
  const country = (params.country ?? '').trim().toUpperCase();
  const category = (params.category ?? '').trim();
  const letter = normalizeLetter(params.letter);
  const page = Math.max(1, Number(params.page ?? '1') || 1);
  const hasFilters = Boolean(q || country || category || letter);

  const cache = listCouponStores();
  const aliases = highIntentStoreAliases();
  const storesById = new Map(cache.stores.map((store) => [store.id, store]));
  const aliasById = new Map(aliases.map((a) => [a.storeId, a]));

  const popularStores = aliases
    .map((alias) => {
      const store = storesById.get(alias.storeId);
      if (!store) return null;
      return enrichStore(store, alias);
    })
    .filter((row): row is StoreRow => Boolean(row))
    .sort((a, b) => {
      const pa = Number((aliasById.get(a.store.id) as { priority?: number })?.priority || 99);
      const pb = Number((aliasById.get(b.store.id) as { priority?: number })?.priority || 99);
      return pa - pb || a.displayName.localeCompare(b.displayName);
    });

  const countries = Array.from(new Set(cache.stores.map((s) => s.country).filter(Boolean))).sort();
  const categories = Array.from(new Set(cache.stores.map(storeCategory))).sort((a, b) => a.localeCompare(b));
  const countryCounts = countries
    .map((code) => ({ code, count: cache.stores.filter((s) => s.country === code).length }))
    .sort((a, b) => b.count - a.count);
  const categoryCounts = categories
    .map((name) => ({ name, count: cache.stores.filter((s) => storeCategory(s) === name).length }))
    .sort((a, b) => b.count - a.count);
  const letterCounts = ALPHABET.map((code) => ({
    code,
    count: cache.stores.filter((s) => letterOf(s.name) === code).length,
  }));

  const filtered = cache.stores
    .filter((store) => {
      if (q && !storeSearchText(store).includes(q)) return false;
      if (country && store.country !== country) return false;
      if (category && storeCategory(store) !== category) return false;
      if (letter && letterOf(store.name) !== letter) return false;
      return true;
    })
    .map((store) => enrichStore(store, aliasById.get(store.id)));

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageStores = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const queryBase = new URLSearchParams();
  if (q) queryBase.set('q', q);
  if (country) queryBase.set('country', country);
  if (category) queryBase.set('category', category);
  if (letter) queryBase.set('letter', letter);

  const jsonLd = collectionPageJsonLd({
    name: 'Coupon Stores',
    url: `${SITE.url}/stores`,
    description: metadata.description,
    numberOfItems: cache.stores.length,
  });

  return (
    <div data-testid="stores-page">
      <JsonLd graph={[jsonLd]} />

      <Hero totalStores={cache.stores.length} popularCount={popularStores.length} />

      {/* Popular stores — always visible */}
      <section className="border-b border-ink/10 bg-[#f0f2f4] py-10 sm:py-12" data-testid="popular-stores">
        <div className="mx-auto max-w-[1366px] px-6">
          <SectionHead
            eyebrow="Popular"
            title="Top coupon stores"
            subtitle={`${popularStores.length} hand-picked retailer pages with live promo-code feeds.`}
          />
          {popularStores.length > 0 ? (
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              {popularStores.map((row) => (
                <PopularStoreCard key={row.store.id} row={row} />
              ))}
            </div>
          ) : (
            <EmptyPopular />
          )}
        </div>
      </section>

      {/* All stores — search & filter */}
      <section className="bg-white py-10 sm:py-14" data-testid="all-stores" id="all-stores">
        <div className="mx-auto max-w-[1366px] px-6">
          <SectionHead
            eyebrow="Full directory"
            title="All coupon stores"
            subtitle={`Search and filter ${cache.total?.toLocaleString() ?? cache.stores.length.toLocaleString()} retailers in our coupon database.`}
          />

          <form action="/stores" method="get" className="mt-8 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_180px_120px_auto]" data-testid="stores-filter-form">
            <label htmlFor="store-search" className="sr-only">Search stores</label>
            <input
              id="store-search"
              name="q"
              type="search"
              defaultValue={params.q ?? ''}
              placeholder="Search store name or domain…"
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
              <Link href="/stores#all-stores" className="text-xs font-bold text-primary hover:underline">Clear all</Link>
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
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink/45">Top countries</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <FilterChip href={filterHref(queryBase, 'country', '')} active={!country}>All</FilterChip>
              {countryCounts.slice(0, 16).map((item) => (
                <FilterChip
                  key={item.code}
                  href={filterHref(queryBase, 'country', item.code)}
                  active={country === item.code}
                >
                  {countryName(item.code)} ({item.count.toLocaleString()})
                </FilterChip>
              ))}
            </div>
          </div>

          <div className="mt-4 border border-ink/10 bg-[#f0f2f4] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink/45">Categories</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <FilterChip href={filterHref(queryBase, 'category', '')} active={!category}>All</FilterChip>
              {categoryCounts.map((item) => (
                <FilterChip
                  key={item.name}
                  href={filterHref(queryBase, 'category', item.name)}
                  active={category === item.name}
                >
                  {item.name} ({item.count.toLocaleString()})
                </FilterChip>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink/65" data-testid="stores-result-count">
              Showing {pageStores.length.toLocaleString()} of {filtered.length.toLocaleString()} stores
              {hasFilters ? ' (filtered)' : ''}
            </p>
            <StorePagination base={queryBase} page={safePage} pageCount={pageCount} />
          </div>

          {pageStores.length > 0 ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {pageStores.map((row) => (
                <DirectoryStoreCard key={row.store.id} row={row} popular={aliasById.has(row.store.id)} />
              ))}
            </div>
          ) : (
            <div className="mt-8 border border-dashed border-ink/15 bg-[#f0f2f4] p-10 text-center">
              <p className="font-display text-lg font-bold text-ink">No stores match your filters</p>
              <p className="mt-2 text-sm text-ink/60">Try a different search term or clear the filters.</p>
              <Link href="/stores#all-stores" className="mt-5 inline-flex bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-emphasis">
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

function Hero({ totalStores, popularCount }: { totalStores: number; popularCount: number }) {
  return (
    <section className="relative overflow-hidden border-b border-ink/10 bg-[#1d252c] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(at 80% 20%, rgba(0,70,190,0.18) 0%, transparent 50%), radial-gradient(at 20% 80%, rgba(6,182,212,0.1) 0%, transparent 50%)',
        }}
      />
      <div className="relative mx-auto max-w-[1366px] px-6 py-14 sm:py-18">
        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#ffe000]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ffe000]" aria-hidden />
          Store directory
        </p>
        <h1 className="mt-5 font-display text-4xl font-bold leading-[1.04] tracking-tight sm:text-5xl">
          Coupon stores &amp; promo-code pages
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
          Browse popular retailers or search the full directory of {totalStores.toLocaleString()} stores.
          Filter by country, category, or letter to find the coupon page you need.
        </p>
        <div className="mt-8 flex flex-wrap gap-6">
          <Stat label="Total stores" value={totalStores.toLocaleString()} />
          <Stat label="Popular pages" value={String(popularCount)} />
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#popular-stores" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:border-white/40">
            Popular stores
          </a>
          <a href="#all-stores" className="inline-flex bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary-emphasis">
            Search all stores
          </a>
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

function PopularStoreCard({ row }: { row: StoreRow }) {
  return (
    <Link
      href={storeHref(row)}
      className="group flex min-h-[88px] items-center gap-3 border border-ink/10 bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_16px_32px_-22px_rgba(13,27,42,0.4)]"
      data-testid={`popular-store-${row.slug}`}
    >
      <StoreLogo row={row} />
      <span className="min-w-0">
        <h4 className="store-card-title truncate text-ink group-hover:text-primary">{row.displayName}</h4>
        <span className="mt-0.5 block truncate text-[0.72rem] font-semibold text-primary/80">{row.category}</span>
      </span>
    </Link>
  );
}

function DirectoryStoreCard({ row, popular }: { row: StoreRow; popular: boolean }) {
  return (
    <Link
      href={storeHref(row)}
      className="group flex items-start gap-3 border border-ink/10 bg-white p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_14px_28px_-20px_rgba(13,27,42,0.35)]"
      data-testid={`store-card-${row.slug}`}
    >
      <StoreLogo row={row} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <h4 className="store-card-title truncate text-ink group-hover:text-primary">{row.displayName}</h4>
          {popular && (
            <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-primary">Popular</span>
          )}
        </span>
        <span className="mt-1 block truncate text-xs text-ink/50">{row.store.domain || row.store.url}</span>
        <span className="mt-1 block text-[0.68rem] font-bold uppercase tracking-[0.1em] text-primary">{countryName(row.store.country)}</span>
        <span className="mt-0.5 block text-xs text-ink/45">{row.category}</span>
      </span>
    </Link>
  );
}

function StoreLogo({ row }: { row: StoreRow }) {
  const logo = storeLogoUrl(row.store);
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        className="h-11 w-12 shrink-0 rounded-lg bg-white object-contain"
      />
    );
  }
  return (
    <span className="grid h-11 w-12 shrink-0 place-items-center rounded-lg bg-muted font-display text-xs font-bold text-ink/40">
      {row.displayName.slice(0, 2)}
    </span>
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

function EmptyPopular() {
  return (
    <div className="mt-8 border border-dashed border-ink/15 bg-white p-8 text-center">
      <p className="text-sm text-ink/60">No popular stores configured yet.</p>
    </div>
  );
}

function ValueStrip() {
  const items = [
    { ic: '🏷️', t: 'Live promo feeds', s: 'Each store page pulls current coupon codes and discount leads.' },
    { ic: '🔍', t: 'Search & filter', s: 'Find any of 18,000+ stores by name, country, category, or letter.' },
    { ic: '✓', t: 'Free to use', s: 'No signup — browse, compare, and save on every purchase.' },
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

// Windowed page list: 1 … (n-2 n-1 n n+1 n+2) … last
function pageWindow(current: number, total: number, span = 2): (number | 'ellipsis')[] {
  const out: (number | 'ellipsis')[] = [];
  const start = Math.max(1, current - span);
  const end = Math.min(total, current + span);
  if (start > 1) {
    out.push(1);
    if (start > 2) out.push('ellipsis');
  }
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total) {
    if (end < total - 1) out.push('ellipsis');
    out.push(total);
  }
  return out;
}

function StorePagination({ base, page, pageCount }: { base: URLSearchParams; page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const box = 'grid h-10 min-w-[2.5rem] place-items-center rounded-md px-3 text-sm font-bold transition';
  return (
    <nav className="flex flex-wrap items-center justify-start gap-2" data-testid="stores-pagination" aria-label="Store pages">
      {page > 1 ? (
        <Link href={pageHref(base, page - 1)} aria-label="Previous page" className={`${box} border border-ink/15 bg-white text-ink hover:border-primary hover:text-primary`}>
          ‹
        </Link>
      ) : null}
      {pageWindow(page, pageCount).map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`ellipsis-${i}`} className="px-1 text-ink/40">…</span>
        ) : (
          <Link
            key={p}
            href={pageHref(base, p)}
            aria-current={p === page ? 'page' : undefined}
            className={`${box} ${p === page ? 'border-2 border-ink bg-primary text-white' : 'border border-ink/15 bg-white text-ink hover:border-primary hover:text-primary'}`}
          >
            {p}
          </Link>
        ),
      )}
      {page < pageCount ? (
        <Link href={pageHref(base, page + 1)} aria-label="Next page" className={`${box} border border-ink/15 bg-white text-ink hover:border-primary hover:text-primary`}>
          ›
        </Link>
      ) : null}
    </nav>
  );
}
