import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  countryName,
  listCouponStores,
  storeCategory,
  storeLogoUrl,
  storeSearchText,
} from '@/lib/coupon-stores';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Private Coupon Store Research',
  description: 'Private coupon-store research directory.',
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 120;
const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default async function CouponStoresPage({
  searchParams,
}: {
  searchParams: Promise<{ access?: string; q?: string; country?: string; category?: string; letter?: string; page?: string }>;
}) {
  const params = await searchParams;
  if (!hasPrivateAccess(params.access)) notFound();

  const q = (params.q ?? '').trim().toLowerCase();
  const country = (params.country ?? '').trim().toUpperCase();
  const category = (params.category ?? '').trim();
  const letter = normalizeLetter(params.letter);
  const page = Math.max(1, Number(params.page ?? '1') || 1);
  const cache = listCouponStores();
  const countries = Array.from(new Set(cache.stores.map((store) => store.country).filter(Boolean))).sort();
  const categories = Array.from(new Set(cache.stores.map(storeCategory))).sort((a, b) => a.localeCompare(b));
  const countryCounts = countries
    .map((code) => ({ code, count: cache.stores.filter((store) => store.country === code).length }))
    .sort((a, b) => b.count - a.count);
  const categoryCounts = categories
    .map((name) => ({ name, count: cache.stores.filter((store) => storeCategory(store) === name).length }))
    .sort((a, b) => b.count - a.count);
  const letterCounts = ALPHABET.map((code) => ({
    code,
    count: cache.stores.filter((store) => letterOf(store.name) === code).length,
  }));
  const sourceStores = cache.stores;
  const filtered = sourceStores.filter((store) => {
    if (q && !storeSearchText(store).includes(q)) return false;
    if (country && store.country !== country) return false;
    if (category && storeCategory(store) !== category) return false;
    if (letter && letterOf(store.name) !== letter) return false;
    return true;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const stores = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const queryBase = new URLSearchParams();
  if (q) queryBase.set('q', q);
  if (country) queryBase.set('country', country);
  if (category) queryBase.set('category', category);
  if (letter) queryBase.set('letter', letter);
  if (params.access) queryBase.set('access', params.access);

  return (
    <main className="bg-paper" data-testid="coupon-stores-page">
      <section className="border-b border-ink/10 bg-white">
        <div className="mx-auto max-w-[1366px] px-6 py-10">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Private research</p>
          <h1 className="mt-4 font-display !text-[2rem] font-bold text-ink">Coupon Store Directory</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">
            Search the cached store list. {cache.total ? `${cache.total.toLocaleString()} stores reported` : 'No total reported'}
            {cache.capturedAt ? `, last fetched ${new Date(cache.capturedAt).toLocaleString('en-US')}` : ''}.
          </p>

          <form action="/coupons/stores" className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_190px_150px_auto]">
            <input type="hidden" name="access" value={params.access ?? ''} />
            <label htmlFor="store-search" className="sr-only">Search coupon stores</label>
            <input
              id="store-search"
              name="q"
              type="search"
              defaultValue={params.q ?? ''}
              placeholder="Search store name or domain"
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
              <option value="">All letters</option>
              {ALPHABET.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
            <button type="submit" className="h-12 bg-primary px-6 text-xs font-bold uppercase tracking-[0.14em] text-white transition hover:bg-primary-emphasis">
              Search
            </button>
          </form>

          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink/45">Browse by letter</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <FilterChip href={`/coupons/stores?${filterHref(queryBase, 'letter', '')}`} active={!letter}>All</FilterChip>
              {letterCounts.map((item) => (
                <FilterChip
                  key={item.code}
                  href={`/coupons/stores?${filterHref(queryBase, 'letter', item.code)}`}
                  active={letter === item.code}
                  disabled={item.count === 0}
                >
                  {item.code}
                </FilterChip>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1366px] px-6 py-8">
        <div className="mb-8 border border-ink/10 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink/45">Top countries</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <FilterChip href={`/coupons/stores?${filterHref(queryBase, 'country', '')}`} active={!country}>All countries</FilterChip>
            {countryCounts.slice(0, 24).map((item) => (
              <FilterChip
                key={item.code}
                href={`/coupons/stores?${filterHref(queryBase, 'country', item.code)}`}
                active={country === item.code}
              >
                {countryName(item.code)} ({item.count.toLocaleString()})
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="mb-8 border border-ink/10 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink/45">Inferred categories</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <FilterChip href={`/coupons/stores?${filterHref(queryBase, 'category', '')}`} active={!category}>All categories</FilterChip>
            {categoryCounts.map((item) => (
              <FilterChip
                key={item.name}
                href={`/coupons/stores?${filterHref(queryBase, 'category', item.name)}`}
                active={category === item.name}
              >
                {item.name} ({item.count.toLocaleString()})
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink/65">
            Showing {stores.length.toLocaleString()} of {filtered.length.toLocaleString()} matching stores
          </p>
          {filtered.length > PAGE_SIZE ? (
            <div className="flex items-center gap-2 text-sm font-semibold">
              {safePage > 1 ? (
                <Link href={`/coupons/stores?${pageHref(queryBase, safePage - 1)}`} className="border border-ink/10 bg-white px-3 py-2 text-primary">
                  Previous
                </Link>
              ) : null}
              <span className="text-ink/50">Page {safePage} of {pageCount}</span>
              {safePage < pageCount ? (
                <Link href={`/coupons/stores?${pageHref(queryBase, safePage + 1)}`} className="border border-ink/10 bg-white px-3 py-2 text-primary">
                  Next
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        {sourceStores.length === 0 ? (
          <div className="border border-ink/10 bg-white p-6">
            <p className="font-semibold text-ink">No coupon stores in the cache yet.</p>
            <p className="mt-2 text-sm text-ink/60">
              The store directory is served from a local cache (<code>data/coupon-stores.json</code>). Adjust your search filters above, or check back later.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => (
              <StoreCard key={store.id} store={store} access={params.access ?? ''} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function hasPrivateAccess(access?: string) {
  const expected = process.env.COUPON_STORES_ADMIN_TOKEN;
  return Boolean(expected && access && access === expected);
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
  return params.toString();
}

function filterHref(base: URLSearchParams, key: string, value: string) {
  const params = new URLSearchParams(base);
  params.delete('page');
  if (value) params.set(key, value);
  else params.delete(key);
  return params.toString();
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
          : 'border-ink/10 bg-paper text-ink/65 hover:border-primary hover:text-primary'
      }`}
    >
      {children}
    </Link>
  );
}

function StoreCard({ store, access }: { store: { id: number; name: string; logo: string; domain: string; country: string; url: string }; access: string }) {
  const logo = storeLogoUrl(store);
  const category = storeCategory(store);

  return (
    <article className="border border-ink/10 bg-white p-4">
      <div className="flex items-start gap-3">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={`${store.name} logo`}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-11 w-12 shrink-0 bg-white object-contain p-1.5 ring-1 ring-inset ring-ink/10"
          />
        ) : (
          <span className="grid h-11 w-12 shrink-0 place-items-center bg-paper font-display text-sm font-extrabold uppercase text-ink ring-1 ring-inset ring-ink/10">
            {store.name.slice(0, 3)}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate font-display !text-[1rem] font-bold text-ink">{store.name}</h2>
          <p className="mt-1 truncate text-xs font-semibold text-ink/50">{store.domain || store.url}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-primary">{countryName(store.country)}</p>
          <p className="mt-1 text-xs font-semibold text-ink/45">{category}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Link href={`/coupons/stores/${store.id}?access=${encodeURIComponent(access)}`} className="flex-1 bg-primary px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.12em] text-white">
          Coupons
        </Link>
        {store.url ? (
          <a href={store.url} target="_blank" rel="nofollow noopener noreferrer" className="border border-ink/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-ink/60">
            Store
          </a>
        ) : null}
      </div>
    </article>
  );
}
