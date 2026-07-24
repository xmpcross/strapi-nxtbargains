import Link from 'next/link';
import type { Coupon, CouponBrandGroup, Retailer } from '@/lib/coupon-data';
import {
  buildCouponStoreLinks,
  couponRetailersForStoreLinks,
} from '@/lib/coupon-store-links';
import StoreLinkTile from '@/components/StoreLinkTile';

type Props = {
  coupons: Coupon[];
  retailers: Retailer[];
  brandGroups: CouponBrandGroup[];
};

function SectionHead({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        <h2 className="mt-2 font-display text-[clamp(1.35rem,2.4vw,1.65rem)] font-extrabold leading-[1.12] tracking-[-0.02em] text-ink">
          {title}
        </h2>
        {subtitle && <p className="mt-3 text-sm leading-7 text-ink/60 sm:text-base">{subtitle}</p>}
      </div>
      {action ? (
        <Link
          href={action.href}
          className="inline-flex shrink-0 items-center gap-[7px] rounded-[10px] border border-ink/10 bg-white px-4 py-2.5 font-display text-[0.9rem] font-semibold text-ink transition hover:-translate-y-px hover:border-primary hover:text-primary"
        >
          {action.label} →
        </Link>
      ) : null}
    </div>
  );
}

export default function HomepageCouponsSection({ retailers, brandGroups }: Props) {
  const focusedRetailers = couponRetailersForStoreLinks(retailers, brandGroups);
  const storeLinks = buildCouponStoreLinks(focusedRetailers);

  if (storeLinks.length === 0) return null;

  return (
    <section className="border-y border-ink/10 bg-[#f0f2f4] py-14 sm:pb-[72px] sm:pt-12" data-testid="home-coupons">
      <div className="mx-auto max-w-[1366px] px-6">
        <SectionHead
          eyebrow="Shop by store"
          title="Popular coupon pages"
          subtitle="Jump straight to retailer coupon pages with live promo-code feeds."
          action={{ href: '/stores', label: 'Full store directory' }}
        />

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          {storeLinks.slice(0, 24).map((store) => (
            <StoreLinkTile key={store.slug} store={store} />
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/brands"
            className="inline-flex border border-ink/15 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-ink transition hover:border-primary hover:text-primary"
          >
            Browse brands
          </Link>
          <Link
            href="/coupons"
            className="inline-flex border border-ink/15 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-ink transition hover:border-primary hover:text-primary"
          >
            All coupons
          </Link>
          <Link
            href="/stores"
            className="inline-flex bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary-emphasis"
          >
            All stores
          </Link>
        </div>
      </div>
    </section>
  );
}
