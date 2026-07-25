import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { countryName, findCouponStore, storeLogoUrl } from '@/lib/coupon-stores';
import { listCouponsForStore, type Coupon } from '@/lib/coupon-data';

export const revalidate = 86400;

export async function generateMetadata({ params }: { params: Promise<{ storeId: string }> }): Promise<Metadata> {
  const { storeId } = await params;
  const store = findCouponStore(storeId);
  const name = store?.name ?? 'Store';
  return {
    title: `${name} Coupons`,
    description: `Current coupon feed offers for ${name}.`,
    robots: { index: false, follow: false },
  };
}

export default async function CouponStorePage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ access?: string }>;
}) {
  const { storeId } = await params;
  const query = await searchParams;
  if (!hasPrivateAccess(query.access)) notFound();

  const store = findCouponStore(storeId);
  if (!store) notFound();
  const coupons = await listCouponsForStore(store.id, store.name);
  const logo = storeLogoUrl(store);

  return (
    <main className="bg-paper" data-testid="coupon-store-page">
      <section className="border-b border-ink/10 bg-white">
        <div className="mx-auto max-w-[1366px] px-6 py-10">
          <Link href={`/coupons/stores?access=${encodeURIComponent(query.access ?? '')}`} className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Coupon stores
          </Link>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt={`${store.name} logo`}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-14 w-16 shrink-0 bg-white object-contain p-2 ring-1 ring-inset ring-ink/10"
              />
            ) : (
              <span className="grid h-14 w-16 place-items-center bg-paper font-display text-lg font-extrabold uppercase text-ink ring-1 ring-inset ring-ink/10">
                {store.name.slice(0, 3)}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="font-display !text-[2rem] font-bold text-ink">{store.name} Coupons</h1>
              <p className="mt-1 text-sm font-semibold text-ink/55">
                {store.domain || store.url} {store.country ? `- ${countryName(store.country)}` : ''}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1366px] px-6 py-8">
        {coupons.length === 0 ? (
          <div className="border border-ink/10 bg-white p-6">
            <p className="font-semibold text-ink">No coupons for this store right now.</p>
            <p className="mt-2 text-sm text-ink/60">This store is in our directory, but has no coupons cached at the moment.</p>
          </div>
        ) : (
          <div>
            <p className="mb-4 text-sm font-semibold text-ink/65">
              {coupons.length} live offer{coupons.length === 1 ? '' : 's'}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {coupons.map((coupon, index) => (
                <CouponCard key={`${coupon.store}-${coupon.code ?? index}-${coupon.title}`} coupon={coupon} />
              ))}
            </div>
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

function CouponCard({ coupon }: { coupon: Coupon }) {
  return (
    <article className="border border-ink/10 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{coupon.type}</p>
          <h2 className="mt-2 line-clamp-2 font-display !text-[1.05rem] font-bold text-ink">{coupon.title}</h2>
        </div>
        <span className="shrink-0 bg-paper px-2.5 py-1 text-xs font-bold text-ink/65 ring-1 ring-inset ring-ink/10">
          {coupon.code || 'Deal'}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold text-ink/65">{coupon.discount}</p>
      <a
        href={coupon.href}
        target="_blank"
        rel="nofollow sponsored noopener noreferrer"
        className="mt-4 inline-flex w-full justify-center bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary-emphasis"
      >
        View offer
      </a>
    </article>
  );
}
