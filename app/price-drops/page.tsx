import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE } from '@/lib/site';
import { collectionPageJsonLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';
import {
  bestOffer,
  collectOfferRows,
  formatMoney,
  merchantName,
  numericValue,
  offerPrice,
  productImageUrl,
  type CommerceOfferRow,
} from '@/lib/commerce';
import {
  listCommercePriceSnapshots,
  listCommerceProductsForDeals,
  mediaUrl,
  type CommercePriceSnapshot,
  type CommerceProduct,
} from '@/lib/strapi';
import { productHref } from '@/lib/product-url';

export const revalidate = 120;

export const metadata: Metadata = {
  title: 'Price Drops',
  description: 'See recently tracked product price drops and compare current merchant offers on NXT.Bargains.',
  alternates: { canonical: '/price-drops' },
};

type PriceDrop = {
  product: CommerceProduct;
  row: CommerceOfferRow;
  dropPercent: number;
  dropAmount: number;
  currentPrice: number;
  previousPrice: number;
  checkedAt: string;
};

export default async function PriceDropsPage() {
  const products = await listCommerceProductsForDeals(120).catch(() => [] as CommerceProduct[]);
  const productIds = products.map((product) => product.documentId).filter(Boolean) as string[];
  const snapshots = await listCommercePriceSnapshots(productIds, 1200).catch(() => [] as CommercePriceSnapshot[]);
  const productsByDocumentId = new Map(products.map((product) => [product.documentId, product]));
  const snapshotsByProduct = groupSnapshotsByProduct(snapshots);
  const drops = Array.from(snapshotsByProduct.entries())
    .map(([documentId, productSnapshots]) => {
      const product = productsByDocumentId.get(documentId);
      if (!product) return null;
      return buildPriceDrop(product, productSnapshots);
    })
    .filter((drop): drop is PriceDrop => Boolean(drop))
    .sort((a, b) => b.dropPercent - a.dropPercent || b.dropAmount - a.dropAmount)
    .slice(0, 36);

  const dropCount = drops.length;
  const topDrop = drops[0]?.dropPercent ?? 0;
  const avgDrop = dropCount > 0
    ? Math.round(drops.reduce((sum, d) => sum + d.dropPercent, 0) / dropCount)
    : 0;
  const totalSavings = drops.reduce((sum, d) => sum + d.dropAmount, 0);
  const latestCheckedAt = drops.reduce((latest, d) => {
    const time = new Date(d.checkedAt).getTime();
    return time > latest ? time : latest;
  }, 0);
  const updatedLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(latestCheckedAt ? new Date(latestCheckedAt) : new Date());

  const featuredDrops = drops.slice(0, 4);

  const pageJsonLd = collectionPageJsonLd({
    name: 'Price Drops',
    url: `${SITE.url}/price-drops`,
    description: metadata.description,
    numberOfItems: dropCount,
  });

  return (
    <main data-testid="price-drops-page">
      <JsonLd graph={[pageJsonLd]} />

      <Hero
        dropCount={dropCount}
        topDrop={topDrop}
        avgDrop={avgDrop}
        productsTracked={products.length}
        snapshotsCount={snapshots.length}
        updatedLabel={updatedLabel}
        totalSavings={totalSavings > 0 ? formatPlainMoney(totalSavings, 'USD') : null}
      />

      {dropCount > 0 ? (
        <section className="border-b border-ink/10 bg-[#f0f2f4] py-10 sm:py-12" data-testid="featured-drops">
          <div className="mx-auto max-w-[1366px] px-6">
            <SectionHead
              eyebrow="Largest movement"
              title="Biggest tracked drops"
              subtitle="The sharpest recent moves from the saved price-history feed."
            />
            <div className="mt-6 grid gap-4 lg:grid-cols-4">
              {featuredDrops.map((drop) => (
                <PriceDropCard key={`featured-${drop.product.id}-${drop.row.offer.id}-${drop.checkedAt}`} drop={drop} featured />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="bg-white py-10 sm:py-14" id="all-drops">
        <div className="mx-auto max-w-[1366px] px-6">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <SectionHead
              eyebrow="Live tracker"
              title="All tracked drops"
              subtitle={
                dropCount > 0
                  ? `${dropCount} products ranked by drop percentage. Each compares the latest tracked price against the highest earlier snapshot.`
                  : 'No tracked price drops are available right now.'
              }
            />
            {dropCount > 0 ? (
              <Link href="/products" className="inline-flex border border-ink/15 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-ink transition hover:border-primary hover:text-primary">
                Compare all products
              </Link>
            ) : null}
          </div>

          {dropCount > 0 ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {drops.map((drop) => (
                <PriceDropCard key={`${drop.product.id}-${drop.row.offer.id}-${drop.checkedAt}`} drop={drop} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No price drops yet"
              body="This page will populate after products have at least two tracked price snapshots with a lower latest price."
            />
          )}
        </div>
      </section>

      <section className="border-t border-ink/10 bg-[#f0f2f4] py-10">
        <div className="mx-auto max-w-[1366px] px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <BrowseCard href="/best-deals" title="Best deals" subtitle="Highest current merchant discounts" />
            <BrowseCard href="/products" title="All products" subtitle="Compare offers across merchants" />
            <BrowseCard href="/coupons" title="Coupons" subtitle="Promo codes and store deals" />
            <BrowseCard href="/deals" title="Buying guides" subtitle="Editorial deals and roundups" />
          </div>
        </div>
      </section>

      <ValueStrip dropCount={dropCount} />
    </main>
  );
}

function Hero({
  dropCount,
  topDrop,
  avgDrop,
  productsTracked,
  snapshotsCount,
  updatedLabel,
  totalSavings,
}: {
  dropCount: number;
  topDrop: number;
  avgDrop: number;
  productsTracked: number;
  snapshotsCount: number;
  updatedLabel: string;
  totalSavings: string | null;
}) {
  return (
    <section className="relative overflow-hidden border-b border-ink/10 bg-[#1d252c] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(at 80% 20%, rgba(0,70,190,0.22) 0%, transparent 50%), radial-gradient(at 15% 85%, rgba(255,224,0,0.12) 0%, transparent 50%)',
        }}
      />
      <div className="relative mx-auto max-w-[1366px] px-4 py-10 sm:px-6 sm:py-14">
        <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/45">
          <Link href="/" className="transition hover:text-white">Home</Link>
          <span aria-hidden>/</span>
          <span className="text-[#ffe000]">Price drops</span>
        </nav>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ffe000]">Tracked price history</p>
            <h1 className="mt-3 max-w-4xl font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
              Price drops worth checking before they move again
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
              Ranked from saved price-history snapshots, with current offers pulled into
              each product card so you can compare the drop and the live marketplace price.
            </p>

            <ul className="mt-6 max-w-2xl space-y-3 text-sm leading-6 text-white/75 sm:text-base">
              <li className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-[#ffe000]" aria-hidden>✓</span>
                <span>Latest tracked price compared against its highest earlier snapshot.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-[#ffe000]" aria-hidden>✓</span>
                <span>Every card links to live merchant offers so you can compare before buying.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-[#ffe000]" aria-hidden>✓</span>
                <span>Sorted by drop size — the sharpest recent moves surface first.</span>
              </li>
            </ul>

            <div className="mt-10 flex flex-wrap gap-3">
              <a href="#all-drops" className="inline-flex bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary-emphasis">
                View all drops
              </a>
              <Link href="/best-deals" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white/80 transition hover:border-white/40 hover:text-white">
                Best deals
              </Link>
              <Link href="/coupons" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white/80 transition hover:border-white/40 hover:text-white">
                Coupons
              </Link>
            </div>
          </div>

          <aside className="border border-white/15 bg-white/5 p-5 backdrop-blur sm:p-6" aria-label="Price drop statistics">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ffe000]">At a glance</p>
            <p className="mt-3 text-sm leading-6 text-white/70">
              {dropCount > 0
                ? `Tracking ${dropCount} recent price drops across ${productsTracked} products, ranked by how far each price has fallen.`
                : 'Drops appear here once tracked products have at least two price snapshots with a lower latest price.'}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-5">
              <Stat label="Price drops" value={String(dropCount)} />
              <Stat label="Biggest drop" value={dropCount > 0 ? `${topDrop}%` : '—'} />
              <Stat label="Avg. drop" value={dropCount > 0 ? `${avgDrop}%` : '—'} />
              <Stat label="Products tracked" value={String(productsTracked)} />
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 text-xs text-white/55">
              <span>{snapshotsCount} snapshots · updated {updatedLabel}</span>
              {totalSavings ? <span className="font-semibold text-[#ffe000]">{totalSavings} tracked savings</span> : null}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-white/55">{label}</p>
    </div>
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

function PriceDropCard({ drop, featured = false }: { drop: PriceDrop; featured?: boolean }) {
  const product = drop.product;
  const offer = drop.row.offer;
  const currency = offer.currency ?? 'USD';
  const image = productImageUrl(product);
  const logo = mediaUrl(offer.merchant?.logo ?? null);
  const merchant = merchantName(offer);
  const current = formatMoney(drop.currentPrice, currency);
  const previous = formatPlainMoney(drop.previousPrice, currency);
  const savings = formatPlainMoney(drop.dropAmount, currency);
  const checked = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(drop.checkedAt));
  const progress = Math.min(100, Math.max(6, drop.dropPercent));
  const href = productHref(product);

  return (
    <article className={`group flex h-full flex-col border bg-white transition hover:-translate-y-0.5 hover:shadow-[0_18px_32px_-24px_rgba(3,3,3,0.4)] ${featured ? 'border-primary/25 shadow-[0_12px_24px_-18px_rgba(0,70,190,0.2)]' : 'border-ink/10 hover:border-primary/30'}`}>
      <Link href={href} className="grid aspect-[4/3] place-items-center border-b border-ink/10 bg-white p-5">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.primaryImage?.alternativeText || product.name}
            className="h-full max-h-44 w-full object-contain mix-blend-multiply transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="flex h-36 w-full items-center justify-center bg-muted px-4 text-center font-display text-xl font-bold text-ink/25">
            {product.brandRef?.name ?? product.brand ?? 'NXT'}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex rounded bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
            Save {drop.dropPercent}%
          </span>
          {featured ? <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Featured</span> : null}
        </div>

        <Link href={href} className="mt-4 block">
          <h4 className="line-clamp-2 font-display !text-[1rem] font-bold leading-tight text-ink transition group-hover:text-primary">
            {product.name}
          </h4>
        </Link>

        <div className="mt-4">
          <div className="h-1.5 bg-[#eef0f3]">
            <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink/40">Now</p>
              <p className="font-display text-xl font-bold text-ink">{current}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink/40">Was</p>
              <p className="font-display text-base font-bold text-ink/35 line-through">{previous}</p>
            </div>
          </div>
        </div>

        <div className="mt-auto flex items-end justify-between gap-4 pt-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink/50">Saved {savings} · checked {checked}</p>
            <div className="mt-2 flex h-5 items-center">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt={`${merchant} logo`} referrerPolicy="no-referrer" className="h-5 max-w-[96px] object-contain object-left" />
              ) : (
                <p className="line-clamp-1 text-xs font-bold uppercase tracking-[0.12em] text-primary">{merchant}</p>
              )}
            </div>
          </div>

          <Link
            href={href}
            className="shrink-0 border border-primary px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-primary transition hover:bg-primary hover:text-white"
          >
            Compare
          </Link>
        </div>
      </div>
    </article>
  );
}

function groupSnapshotsByProduct(snapshots: CommercePriceSnapshot[]) {
  const map = new Map<string, CommercePriceSnapshot[]>();
  for (const snapshot of snapshots) {
    const documentId = snapshot.product?.documentId;
    if (!documentId) continue;
    if (!map.has(documentId)) map.set(documentId, []);
    map.get(documentId)!.push(snapshot);
  }
  return map;
}

function buildPriceDrop(product: CommerceProduct, snapshots: CommercePriceSnapshot[]): PriceDrop | null {
  const priced = snapshots
    .map((snapshot) => ({
      snapshot,
      price: numericValue(snapshot.price) ?? numericValue(snapshot.originalPrice),
    }))
    .filter((entry): entry is { snapshot: CommercePriceSnapshot; price: number } => entry.price !== null)
    .sort((a, b) => new Date(a.snapshot.checkedAt).getTime() - new Date(b.snapshot.checkedAt).getTime());
  if (priced.length < 2) return null;

  const latest = priced[priced.length - 1];
  const previousHighest = priced.slice(0, -1).reduce((max, entry) => (entry.price > max.price ? entry : max), priced[0]);
  if (latest.price >= previousHighest.price) return null;

  const row = bestOffer(collectOfferRows(product));
  if (!row) return null;

  const currentOfferPrice = offerPrice(row.offer);
  const currentPrice = currentOfferPrice ?? latest.price;
  const dropAmount = previousHighest.price - currentPrice;
  if (dropAmount <= 0) return null;

  return {
    product,
    row,
    currentPrice,
    previousPrice: previousHighest.price,
    dropAmount,
    dropPercent: Math.round((dropAmount / previousHighest.price) * 100),
    checkedAt: latest.snapshot.checkedAt,
  };
}

function formatPlainMoney(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-8 border border-dashed border-ink/15 bg-[#f7f7f7] p-10 text-center">
      <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-ink/60">{body}</p>
    </div>
  );
}

function ValueStrip({ dropCount }: { dropCount: number }) {
  const items = [
    {
      ic: '01',
      t: 'Tracked price history',
      s: dropCount > 0
        ? 'Drops are calculated from saved snapshots comparing latest vs. peak tracked prices.'
        : 'Snapshots are collected as products are checked; drops appear once prices fall.',
    },
    { ic: '02', t: 'Compare before you buy', s: 'Each card links to the full product page with live merchant offers.' },
    { ic: '03', t: 'More ways to save', s: 'Browse best deals, coupons, and buying guides on NXT.Bargains.' },
  ];
  return (
    <div className="bg-white">
      <div className="mx-auto grid max-w-[1366px] gap-6 px-6 py-10 sm:grid-cols-3">
        {items.map((v) => (
          <div key={v.t} className="flex items-start gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center bg-primary/10 font-display text-xs font-bold text-primary">{v.ic}</span>
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
