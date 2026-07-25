import Link from 'next/link';
import type { Metadata } from 'next';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SITE } from '@/lib/site';
import { collectionPageJsonLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'All Coupons & Promo Codes — Every Store',
  description:
    'Browse every coupon and promo code from our live CouponAPI feed — Target, Walmart, Best Buy, Samsung, OnePlus, iHerb, eBay and more, grouped by store.',
  alternates: { canonical: '/coupons/all' },
};

type FeedCoupon = {
  store?: string;
  storeSlug?: string;
  title?: string;
  discount?: string;
  category?: string;
  couponType?: string;
  code?: string | null;
  affiliateUrl?: string;
  destinationUrl?: string;
  verifiedLabel?: string | null;
  featured?: boolean;
};

const CACHE_FILE = join(process.cwd(), 'data', 'coupons-couponapi.json');

const slugify = (value: string) =>
  value.toLowerCase().normalize('NFKD').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

type StoreGroup = { store: string; slug: string; coupons: FeedCoupon[] };

function loadStoreGroups(): { groups: StoreGroup[]; total: number } {
  if (!existsSync(CACHE_FILE)) return { groups: [], total: 0 };
  let items: FeedCoupon[] = [];
  try {
    const parsed = JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as { items?: FeedCoupon[] };
    items = Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return { groups: [], total: 0 };
  }

  const byStore = new Map<string, StoreGroup>();
  for (const coupon of items) {
    const store = (coupon.store ?? '').trim();
    const title = (coupon.title ?? '').trim();
    if (!store || !title) continue;
    const slug = coupon.storeSlug?.trim() || slugify(store);
    if (!byStore.has(store)) byStore.set(store, { store, slug, coupons: [] });
    byStore.get(store)!.coupons.push(coupon);
  }

  // Featured first within each store, then sort stores by coupon count (desc).
  const groups = [...byStore.values()]
    .map((group) => ({
      ...group,
      coupons: group.coupons.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured))),
    }))
    .sort((a, b) => b.coupons.length - a.coupons.length);

  return { groups, total: items.length };
}

function couponHref(coupon: FeedCoupon): string {
  return coupon.affiliateUrl?.trim() || coupon.destinationUrl?.trim() || '#';
}

export default function AllCouponsPage() {
  const { groups, total } = loadStoreGroups();

  const pageJsonLd = collectionPageJsonLd({
    name: 'All Coupons & Promo Codes',
    url: `${SITE.url}/coupons/all`,
    description: metadata.description ?? undefined,
    numberOfItems: total,
  });

  return (
    <main data-testid="all-coupons-page">
      <JsonLd graph={[pageJsonLd]} />

      {/* Hero */}
      <section className="bg-paper">
        <div className="mx-auto max-w-[1366px] px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-ink/45">
            <Link href="/coupons" className="hover:text-primary">Coupons</Link>
            <span>/</span>
            <span className="text-primary">All Coupons</span>
          </div>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-bold leading-[1.04] text-ink sm:text-5xl">
            All coupons &amp; promo codes.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-ink/65 sm:text-lg">
            Every live coupon from our retailer feed, grouped by store —{' '}
            <span className="font-semibold text-ink">{total.toLocaleString()} offers</span> across{' '}
            <span className="font-semibold text-ink">{groups.length} stores</span>. Codes and deals update daily.
          </p>
        </div>
      </section>

      {/* Store jump nav */}
      {groups.length > 0 && (
        <section className="sticky top-0 z-20 border-y border-ink/10 bg-white/95 backdrop-blur">
          <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
            <nav
              className="flex gap-2 overflow-x-auto py-4"
              aria-label="Jump to store"
            >
              <span className="mr-1 shrink-0 self-center text-xs font-bold uppercase tracking-[0.14em] text-ink/45">Stores:</span>
              {groups.map((group) => (
                <a
                  key={group.slug}
                  href={`#store-${group.slug}`}
                  className="inline-flex shrink-0 items-center gap-1.5 border border-ink/10 bg-[#f0f2f4] px-3 py-1.5 text-xs font-bold text-ink/70 transition hover:border-primary hover:text-primary"
                >
                  {group.store}
                  <span className="text-ink/35">{group.coupons.length}</span>
                </a>
              ))}
            </nav>
          </div>
        </section>
      )}

      {/* Store sections */}
      <section className="bg-[#f0f2f4] py-10 sm:py-12">
        <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
          {groups.length === 0 ? (
            <div className="border border-ink/10 bg-white p-8">
              <h2 className="font-display text-2xl font-bold text-ink">No coupons cached yet</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-ink/60">
                This page populates after the next CouponAPI refresh writes the coupon cache.
              </p>
            </div>
          ) : (
            <div className="space-y-10">
              {groups.map((group) => (
                <section
                  key={group.slug}
                  id={`store-${group.slug}`}
                  aria-labelledby={`store-heading-${group.slug}`}
                  className="scroll-mt-24"
                >
                  <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink/10 pb-4">
                    <div>
                      <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-primary">
                        {group.coupons.length} offer{group.coupons.length === 1 ? '' : 's'}
                      </p>
                      <h2 id={`store-heading-${group.slug}`} className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">
                        {group.store} coupons
                      </h2>
                    </div>
                    <Link
                      href={`/coupons/${group.slug}`}
                      className="inline-flex border border-ink/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-ink/60 transition hover:border-primary hover:text-primary"
                    >
                      {group.store} page →
                    </Link>
                  </div>

                  <div className="mt-6 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
                    {group.coupons.map((coupon, index) => (
                      <CouponTile key={`${group.slug}-${index}`} coupon={coupon} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function CouponTile({ coupon }: { coupon: FeedCoupon }) {
  const code = coupon.code?.trim();
  const isCode = Boolean(code);
  return (
    <article className="flex min-h-[188px] flex-col gap-3 border border-ink/10 bg-white p-4 transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_14px_28px_-20px_rgba(13,27,42,0.35)]">
      <div className="flex items-center gap-3">
        <StoreBadge name={coupon.store ?? ''} />
        <div className="min-w-0">
          <p className="truncate text-[0.72rem] font-bold uppercase tracking-[0.12em] text-primary">{coupon.store}</p>
          <p className="mt-0.5 truncate text-[0.72rem] font-semibold text-ink/45">
            {coupon.couponType || (isCode ? 'Promo code' : 'Deal')}
            {coupon.verifiedLabel ? ` · ${coupon.verifiedLabel}` : ''}
          </p>
        </div>
      </div>

      <div>
        {coupon.discount ? (
          <h3 className="line-clamp-2 font-display text-lg font-bold leading-5 text-ink">{coupon.discount}</h3>
        ) : null}
        <p className="mt-2 line-clamp-3 text-sm leading-5 text-ink/60">{coupon.title}</p>
      </div>

      <div className="mt-auto grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <span
          className={`truncate border px-3 py-2 text-center text-xs font-bold uppercase ${
            isCode ? 'border-dashed border-ink/25 bg-paper text-ink' : 'border-ink/10 bg-paper text-ink/45'
          }`}
        >
          {isCode ? code : 'No code'}
        </span>
        <a
          href={couponHref(coupon)}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          className="bg-primary px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.08em] text-white transition hover:bg-primary-emphasis"
        >
          Get deal
        </a>
      </div>
    </article>
  );
}

function StoreBadge({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || '?';
  return (
    <span className="grid h-12 w-14 shrink-0 place-items-center border border-ink/10 bg-paper font-display text-sm font-bold text-ink/55">
      {initials}
    </span>
  );
}
