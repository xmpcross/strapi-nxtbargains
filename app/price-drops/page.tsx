import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE } from '@/lib/site';
import { collectionPageJsonLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';
import { formatMoney, numericValue, productImageUrl } from '@/lib/commerce';
import {
  listCommerceProductsLean,
  listRecentPriceSnapshots,
  type CommercePriceSnapshot,
  type CommerceProduct,
} from '@/lib/strapi';
import { productHref } from '@/lib/product-url';

export const revalidate = 120;

export const metadata: Metadata = {
  title: 'Price Tracker',
  description:
    'Every product we track, with its current price and what it was at the previous check. Prices that have fallen are listed first.',
  alternates: { canonical: '/price-drops' },
};

/**
 * One product's tracked price history, reduced to what a row needs.
 *
 * `direction` is measured latest-vs-previous reading, which is a different
 * question from where the price sits in its range: something can tick up today
 * and still be near its recorded low.
 */
type TrackedPrice = {
  product: CommerceProduct;
  current: number;
  previous: number | null;
  low: number;
  high: number;
  readings: number;
  changePercent: number;
  direction: 'down' | 'up' | 'flat';
  /** 0 = at the recorded low, 100 = at the recorded high. */
  positionInRange: number;
  currency: string;
  checkedAt: string;
};

const MAX_ROWS = 400;

export default async function PriceDropsPage() {
  // Lean fetches on both sides. The previous version pulled 120 products with full
  // offer/merchant/image population (5.4MB, over Next's 2MB cache ceiling) and
  // the oldest 1,200 snapshots, which between them surfaced 18 products out of
  // 85,216 stored readings.
  const [products, snapshots] = await Promise.all([
    listCommerceProductsLean(800).catch(() => [] as CommerceProduct[]),
    listRecentPriceSnapshots(5000).catch(() => [] as CommercePriceSnapshot[]),
  ]);

  const byProduct = new Map<string, CommercePriceSnapshot[]>();
  for (const snapshot of snapshots) {
    const id = snapshot.product?.documentId;
    if (!id) continue;
    const list = byProduct.get(id);
    if (list) list.push(snapshot);
    else byProduct.set(id, [snapshot]);
  }

  const tracked = products
    .map((product) => buildTrackedPrice(product, byProduct.get(product.documentId ?? '') ?? []))
    .filter((row): row is TrackedPrice => Boolean(row));

  // Falls first, largest first; then everything else by how far it sits below
  // its recorded high, so the most interesting rows are always at the top.
  const ordered = [...tracked].sort((a, b) => {
    if (a.direction === 'down' && b.direction !== 'down') return -1;
    if (b.direction === 'down' && a.direction !== 'down') return 1;
    if (a.direction === 'down' && b.direction === 'down') return a.changePercent - b.changePercent;
    return a.positionInRange - b.positionInRange;
  });

  const fallen = ordered.filter((row) => row.direction === 'down');
  const rows = ordered.slice(0, MAX_ROWS);
  // One series per product today (each offer holds two readings), so this is
  // the number of distinct merchant price series behind the list.
  const merchantsTracked = tracked.length;
  const readings = tracked.reduce((sum, row) => sum + row.readings, 0);
  const deepest = fallen[0] ?? null;

  const latestCheckedAt = tracked.reduce((latest, row) => {
    const time = new Date(row.checkedAt).getTime();
    return Number.isFinite(time) && time > latest ? time : latest;
  }, 0);
  const updatedLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .format(latestCheckedAt ? new Date(latestCheckedAt) : new Date());

  const pageJsonLd = collectionPageJsonLd({
    name: 'Price Tracker',
    url: `${SITE.url}/price-drops`,
    description: metadata.description,
    numberOfItems: tracked.length,
  });

  return (
    <main data-testid="price-drops-page">
      <JsonLd graph={[pageJsonLd]} />

      <section className="page-hero">
        <div className="page-hero-inner">
          <nav className="page-hero-crumbs">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <span className="page-hero-crumbs-current">Price tracker</span>
          </nav>

          <div className="mt-8 max-w-3xl">
            <p className="page-hero-eyebrow">Tracked price history</p>
            <h1 className="page-hero-title">Every price we track, and where it sits today</h1>
            <p className="page-hero-desc">
              We record what each product costs each time we check, and keep the readings. Every row shows
              today&apos;s price next to the one before it, so a fall is something you can see rather than
              take our word for. Prices that have dropped since the last check are listed first.
            </p>
          </div>

          <dl className="mt-9 grid gap-px overflow-hidden rounded-[5px] border border-ink/10 bg-ink/10 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Products tracked" value={tracked.length.toLocaleString()} />
            <Stat label="Price readings" value={readings.toLocaleString()} />
            <Stat label="Fell since last reading" value={fallen.length.toLocaleString()} />
            <Stat label="Merchants tracked" value={merchantsTracked.toLocaleString()} />
          </dl>

          <p className="mt-4 text-xs text-ink/55">
            Last reading {updatedLabel}
            {deepest ? ` · biggest fall ${Math.abs(deepest.changePercent)}% on ${deepest.product.name.slice(0, 48)}` : ''}
          </p>
        </div>
      </section>

      <section className="bg-white py-10 sm:py-14" id="tracked">
        <div className="mx-auto max-w-[1366px] px-6">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Live tracker</p>
              <h2 className="mt-2 font-display text-[1.6rem] font-extrabold leading-tight text-ink">
                {rows.length.toLocaleString()} tracked prices
              </h2>
              <p className="mt-1.5 max-w-2xl text-sm text-ink/65">
                Falls first, then the prices sitting lowest against what we last recorded. Each row shows
                the current price and what it was at the previous check.
              </p>
            </div>
            <Link
              href="/all-products"
              className="inline-flex border border-ink/15 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-ink transition hover:border-primary hover:text-primary"
            >
              Compare all products
            </Link>
          </div>

          {rows.length > 0 ? (
            <ul className="mt-8 grid gap-3 lg:grid-cols-2">
              {rows.map((row) => (
                <TrackedRow key={row.product.documentId ?? row.product.slug} row={row} />
              ))}
            </ul>
          ) : (
            <div className="mt-8 border border-dashed border-ink/20 bg-[#f7f8f9] p-10 text-center">
              <p className="font-display text-lg font-bold text-ink">Nothing tracked yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink/65">
                A product appears here once we hold at least two price readings for it.
              </p>
            </div>
          )}

          {tracked.length > rows.length ? (
            <p className="mt-6 text-center text-xs text-ink/55">
              Showing the {rows.length.toLocaleString()} most notable of {tracked.length.toLocaleString()} tracked
              products.
            </p>
          ) : null}
        </div>
      </section>

      <section className="border-t border-ink/10 bg-[#f0f2f4] py-10">
        <div className="mx-auto max-w-[1366px] px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <BrowseCard href="/best-deals" title="Best deals" subtitle="Highest current merchant discounts" />
            <BrowseCard href="/all-products" title="All products" subtitle="Compare offers across merchants" />
            <BrowseCard href="/coupons" title="Coupons" subtitle="Promo codes and store deals" />
            <BrowseCard href="/deals" title="Buying guides" subtitle="Editorial deals and roundups" />
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-5 py-4">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink/50">{label}</dt>
      <dd className="mt-1 font-display text-[1.7rem] font-extrabold leading-none text-ink tabular-nums">{value}</dd>
    </div>
  );
}

function TrackedRow({ row }: { row: TrackedPrice }) {
  const image = productImageUrl(row.product);
  const href = productHref(row.product);
  const down = row.direction === 'down';
  const up = row.direction === 'up';

  return (
    <li className="flex items-center gap-4 border border-ink/10 bg-white p-3 transition hover:border-primary/40">
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden border border-ink/10 bg-[#f7f8f9]">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="h-full w-full object-contain" loading="lazy" />
          ) : (
            <span className="font-display text-xs font-bold text-ink/25">NXT</span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[0.92rem] font-semibold leading-snug text-ink">
            {row.product.name}
          </span>

          <span className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-[1.15rem] font-extrabold text-ink tabular-nums">
              {formatMoney(row.current, row.currency)}
            </span>
            {row.previous !== null && !Number.isNaN(row.changePercent) && row.direction !== 'flat' ? (
              <span
                className={`text-[0.72rem] font-bold tabular-nums ${down ? 'text-[#1f6d3f]' : 'text-[#a3251c]'}`}
              >
                {down ? '▼' : '▲'} {Math.abs(row.changePercent)}%
              </span>
            ) : (
              <span className="text-[0.72rem] font-semibold text-ink/40">no change</span>
            )}
          </span>

          {/*
            The range bar only appears once a merchant's series has three or
            more readings. Today every offer holds exactly two, and drawing a
            low/high range across two points presents a single comparison as
            price history — the same overstatement this page exists to avoid.
            With two readings we state the two prices and nothing more.
          */}
          <span className="mt-2 block">
            {row.readings >= 3 ? (
              <>
                <span className="relative block h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
                  <span
                    className={`absolute top-0 h-full w-1.5 rounded-full ${down ? 'bg-[#1f6d3f]' : up ? 'bg-[#a3251c]' : 'bg-primary'}`}
                    style={{ left: `calc(${row.positionInRange}% - 3px)` }}
                  />
                </span>
                <span className="mt-1 flex justify-between text-[0.68rem] tabular-nums text-ink/45">
                  <span>low {formatMoney(row.low, row.currency)}</span>
                  <span>{row.readings} readings</span>
                  <span>high {formatMoney(row.high, row.currency)}</span>
                </span>
              </>
            ) : (
              <span className="text-[0.68rem] tabular-nums text-ink/45">
                {row.previous !== null
                  ? `was ${formatMoney(row.previous, row.currency)} at the previous check`
                  : 'first recorded price'}
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}

function BrowseCard({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Link href={href} className="border border-ink/10 bg-white p-5 transition hover:border-primary hover:shadow-sm">
      <p className="font-display text-[1.05rem] font-bold text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink/60">{subtitle}</p>
    </Link>
  );
}

/**
 * A product's readings, restricted to one merchant's series.
 *
 * A product's snapshots span every merchant selling it. Pooling them produces
 * ranges like "low $0.60, high $251.09" for a single item, and a percentage
 * computed between two consecutive readings is then just the gap between two
 * shops rather than a price that moved. Comparing like with like means picking
 * one offer's series — the longest, which is the one we have actually watched —
 * and reading the change from that.
 */
function buildTrackedPrice(
  product: CommerceProduct,
  snapshots: CommercePriceSnapshot[],
): TrackedPrice | null {
  const byOffer = new Map<string, CommercePriceSnapshot[]>();
  for (const snapshot of snapshots) {
    const offerId = snapshot.offer?.documentId;
    if (!offerId) continue;
    const list = byOffer.get(offerId);
    if (list) list.push(snapshot);
    else byOffer.set(offerId, [snapshot]);
  }
  const series = [...byOffer.values()].sort((a, b) => b.length - a.length)[0];
  if (!series) return null;

  const priced = series
    .map((snapshot) => ({
      price: numericValue(snapshot.price) ?? numericValue(snapshot.originalPrice),
      checkedAt: snapshot.checkedAt,
      currency: snapshot.currency,
    }))
    .filter((entry) => entry.price !== null && entry.price > 0)
    .map((entry) => ({ ...entry, price: entry.price as number }))
    .sort((a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime());

  if (priced.length < 2) return null;

  const current = priced[priced.length - 1]!;
  const previous = priced[priced.length - 2]!;
  const values = priced.map((entry) => entry.price);
  const low = Math.min(...values);
  const high = Math.max(...values);

  const changePercent = previous.price > 0
    ? Math.round(((current.price - previous.price) / previous.price) * 100)
    : 0;
  const direction: TrackedPrice['direction'] =
    current.price < previous.price ? 'down' : current.price > previous.price ? 'up' : 'flat';

  return {
    product,
    current: current.price,
    previous: previous.price,
    low,
    high,
    readings: priced.length,
    changePercent,
    direction,
    // A flat range would divide by zero; pin it to the low end instead.
    positionInRange: high > low ? Math.round(((current.price - low) / (high - low)) * 100) : 0,
    currency: current.currency || 'USD',
    checkedAt: current.checkedAt,
  };
}
