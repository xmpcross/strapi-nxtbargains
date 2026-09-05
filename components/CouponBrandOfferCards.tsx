import Link from 'next/link';
import type { Coupon, CouponBrandGroup, Retailer } from '@/lib/coupon-data';

const knownStoreDomains: Array<[RegExp, string]> = [
  [/amazon/, 'amazon.com'],
  [/ebay/, 'ebay.com'],
  [/walmart/, 'walmart.com'],
  [/newegg/, 'newegg.com'],
  [/bestbuy/, 'bestbuy.com'],
  [/target/, 'target.com'],
  [/dell/, 'dell.com'],
  [/lenovo/, 'lenovo.com'],
  [/samsung/, 'samsung.com'],
  [/apple/, 'apple.com'],
  [/nike/, 'nike.com'],
  [/dyson/, 'dyson.com'],
  [/hp/, 'hp.com'],
];

const sourceStoreLogos: Array<[RegExp, string]> = [
  [/amazon/, '/logos/amazon-logo.svg'],
  [/ebay/, '/logos/ebay-logo.svg'],
  [/walmart/, '/logos/walmart-logo.svg'],
  [/newegg/, '/logos/newegg-logo.svg'],
  [/hp/, '/logos/hp-logo.svg'],
  [/dell/, '/logos/dell-logo.svg'],
  [/lenovo/, '/logos/lenovo-logo.svg'],
  [/samsung/, '/logos/samsung-official.png'],
  [/apple/, '/logos/apple-logo.svg'],
  [/target/, '/logos/target-logo.svg'],
  [/nike/, '/logos/nike-logo.svg'],
  [/argos/, '/logos/argos-logo.svg'],
];

function storePageHref(name: string) {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === 'amazon' ? '/coupons/amazon' : `/coupons/${slug}`;
}

function sourceLogoForStore(name: string) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return sourceStoreLogos.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}

function knownStoreDomain(name: string) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return knownStoreDomains.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}

function domainFromHref(href: string) {
  if (!href.startsWith('http')) return null;
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function faviconUrl(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

function domainFromStoreName(name: string) {
  const trimmed = name.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  if (/\.[a-z]{2,}(?:\.[a-z]{2,})?$/i.test(trimmed.split('/')[0] || '')) {
    return (trimmed.split('/')[0] || '').toLowerCase();
  }
  return knownStoreDomain(name);
}

export function retailerLogo(retailer: Pick<Retailer, 'name' | 'logo' | 'domain' | 'href'>) {
  const sourceLogo = sourceLogoForStore(retailer.name);
  if (sourceLogo) return sourceLogo;

  const domain = retailer.domain || domainFromStoreName(retailer.name) || domainFromHref(retailer.href);
  return domain ? faviconUrl(domain) : null;
}

export function buildBrandGroupsFromCoupons(
  coupons: Coupon[],
  retailers: Retailer[],
  limit = 6,
): CouponBrandGroup[] {
  const retailerByName = new Map(retailers.map((retailer) => [retailer.name.toLowerCase(), retailer]));
  const grouped = new Map<string, Coupon[]>();

  for (const coupon of coupons) {
    const key = coupon.store.trim();
    if (!key) continue;
    const list = grouped.get(key) ?? [];
    list.push(coupon);
    grouped.set(key, list);
  }

  return [...grouped.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, limit)
    .map(([storeName, storeCoupons]) => ({
      store:
        retailerByName.get(storeName.toLowerCase()) ?? {
          name: storeName,
          label: `${storeName} coupon codes`,
          href: storePageHref(storeName),
        },
      coupons: storeCoupons.slice(0, 4),
    }));
}

function StoreLogo({ name, logo, className = 'h-9 w-12' }: { name: string; logo?: string | null; className?: string }) {
  return logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt={`${name} logo`}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={`${className} shrink-0 rounded-lg bg-white object-contain`}
    />
  ) : (
    <span className={`${className} grid shrink-0 place-items-center rounded-lg bg-paper font-display text-[0.78rem] font-extrabold uppercase text-ink`}>
      {name.slice(0, 3)}
    </span>
  );
}

function CouponMiniRow({ coupon }: { coupon: Coupon }) {
  return (
    <div className="grid min-h-[64px] grid-cols-[minmax(0,1fr)_auto] gap-3 p-3">
      <span className="min-w-0">
        <span className="block line-clamp-2 text-[0.9375rem] font-bold leading-5 text-primary">
          {coupon.title}
        </span>
        <span className="mt-1 block text-[0.72rem] font-semibold text-ink/52">{coupon.discount}</span>
      </span>
      <a
        href={coupon.href}
        target="_blank"
        rel="nofollow sponsored noopener noreferrer"
        className="self-center border border-dashed border-ink/20 bg-paper px-2.5 py-1 text-[0.68rem] font-bold uppercase text-ink transition hover:border-primary hover:text-primary"
      >
        {coupon.code || 'Deal'}
      </a>
    </div>
  );
}

export function BrandStoreCard({ group }: { group: CouponBrandGroup }) {
  const logo = retailerLogo(group.store);
  const href = group.store.href.startsWith('/coupons/') ? group.store.href : storePageHref(group.store.name);

  return (
    <article className="coupon-brand-card border border-ink/10 bg-white transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_18px_36px_-28px_rgba(13,27,42,0.45)]">
      <div className="flex items-center justify-between gap-4 border-b border-ink/10 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <StoreLogo name={group.store.name} logo={logo} className="h-11 w-14" />
          <div className="min-w-0">
            <h4 className="truncate font-display text-[14px] font-bold text-ink">{group.store.name}</h4>
            <p className="mt-0.5 text-[0.75rem] font-semibold text-ink/50">
              {group.coupons.length} live offer{group.coupons.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <Link
          href={href}
          className="shrink-0 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-primary underline underline-offset-4 transition hover:text-primary-emphasis"
        >
          All coupons
        </Link>
      </div>
      <div className="divide-y divide-ink/10">
        {group.coupons.slice(0, 4).map((coupon, index) => (
          <CouponMiniRow key={`${group.store.name}-${coupon.code ?? index}-${coupon.title}`} coupon={coupon} />
        ))}
      </div>
    </article>
  );
}

export function BrandStoreQuickLink({ group }: { group: CouponBrandGroup }) {
  const href = group.store.href.startsWith('/coupons/') ? group.store.href : storePageHref(group.store.name);
  const logo = retailerLogo(group.store);

  return (
    <Link
      href={href}
      className="coupon-brand-quick-link group flex items-center gap-3 border border-ink/8 bg-white px-3 py-2.5 transition hover:border-primary/30 hover:bg-primary/[0.03]"
    >
      <StoreLogo name={group.store.name} logo={logo} className="h-8 w-10" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.82rem] font-bold text-ink transition group-hover:text-primary">
          {group.store.name}
        </span>
        <span className="block text-[0.68rem] font-semibold text-ink/45">
          {group.coupons.length} live offer{group.coupons.length === 1 ? '' : 's'}
        </span>
      </span>
      <span aria-hidden className="text-primary opacity-0 transition group-hover:opacity-100">→</span>
    </Link>
  );
}
