import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE } from '@/lib/site';
import { listPopularBrands } from '@/lib/coupon-stores';
import { collectionPageJsonLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Most Popular Brands — Top Coupon Brands',
  description:
    'The most popular brands on NXT.Bargains, ranked by the number of active coupons — jump straight to each brand’s promo codes and deals.',
  alternates: { canonical: '/coupons/popular-brands' },
};

export default function PopularBrandsPage() {
  const brands = listPopularBrands(50);

  const jsonLd = collectionPageJsonLd({
    name: 'Most Popular Brands',
    url: `${SITE.url}/coupons/popular-brands`,
    description: metadata.description,
    numberOfItems: brands.length,
  });

  return (
    <main data-testid="popular-brands-page">
      <JsonLd graph={[jsonLd]} />

      {/* Hero */}
      <section className="bg-paper">
        <div className="mx-auto max-w-[1366px] px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-ink/45">
            <Link href="/coupons" className="hover:text-primary">Coupons</Link>
            <span>/</span>
            <span className="text-primary">Popular Brands</span>
          </div>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-bold leading-[1.04] text-ink sm:text-5xl">
            Most popular brands.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-ink/65 sm:text-lg">
            The brands shoppers save with most — ranked by the number of live coupons. Tap any brand to see its current promo codes and deals.
          </p>
        </div>
      </section>

      {/* Brand grid */}
      <section className="bg-white py-10 sm:py-14">
        <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
          {brands.length === 0 ? (
            <div className="border border-ink/10 bg-white p-8">
              <h2 className="font-display text-2xl font-bold text-ink">No brands yet</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-ink/60">This page populates after the next coupon refresh.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              {brands.map((brand, index) => (
                <Link
                  key={brand.slug}
                  href={`/coupons/${brand.slug}`}
                  className="group relative flex min-h-[112px] flex-col items-center justify-center gap-3 border border-ink/10 bg-white p-5 text-center transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_16px_32px_-22px_rgba(13,27,42,0.4)]"
                  data-testid={`popular-brand-${brand.slug}`}
                >
                  <span className="absolute left-2.5 top-2.5 text-[0.7rem] font-bold text-ink/25">#{index + 1}</span>
                  <BrandLogo name={brand.name} logo={brand.logo} />
                  <span className="min-w-0">
                    <span className="store-card-title block truncate font-display font-bold text-ink transition group-hover:text-primary">{brand.name}</span>
                    <span className="mt-0.5 block text-[0.72rem] font-semibold text-primary/75">{brand.count} coupons</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function BrandLogo({ name, logo }: { name: string; logo?: string | null }) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={name}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="h-10 w-16 object-contain"
      />
    );
  }
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
  return (
    <span className="grid h-10 w-16 place-items-center border border-ink/10 bg-paper font-display text-sm font-bold text-ink/55">
      {initials}
    </span>
  );
}
