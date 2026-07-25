import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE } from '@/lib/site';
import { listCouponPageData, type Coupon, type CouponBrandGroup, type Retailer } from '@/lib/coupon-data';
import { highIntentStoreAliases, listCouponStores, couponStoreSlug, findCouponStoreBySlug, storeLogoUrl, type CouponStore } from '@/lib/coupon-stores';
import { collectionPageJsonLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Coupons, Promo Codes & Store Deals',
  description:
    'Find Amazon coupons, eBay promo codes, Walmart deals, store coupon pages, and category discounts curated by NXT.Bargains.',
  alternates: { canonical: '/coupons' },
};

const popularCategories = [
  { label: 'Electronics', query: 'electronics coupon codes' },
  { label: 'Computing', query: 'computing discounts' },
  { label: 'Home & garden', query: 'home and garden coupons' },
  { label: 'Fashion', query: 'fashion promo codes' },
  { label: 'Beauty & health', query: 'beauty and health offers' },
  { label: 'Gaming', query: 'gaming deals' },
  { label: 'Sports & outdoors', query: 'sports and outdoors coupons' },
  { label: 'Mobile & wireless', query: 'mobile and wireless codes' },
];

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
  [/samsung/, '/logos/samsung-logo.svg'],
  [/apple/, '/logos/apple-logo.svg'],
  [/target/, '/logos/target-logo.svg'],
  [/nike/, '/logos/nike-logo.svg'],
  [/argos/, '/logos/argos-logo.svg'],
];

type StoreLink = {
  name: string;
  href: string;
  slug: string;
  domain?: string;
  logo?: string;
};

function buildCategorySections(coupons: Coupon[]) {
  const byStore = (stores: string[]) =>
    coupons.filter((coupon) => stores.some((store) => coupon.store.toLowerCase().includes(store.toLowerCase())));
  const byCategory = (terms: string[]) =>
    coupons.filter((coupon) => terms.some((term) => `${coupon.category} ${coupon.title}`.toLowerCase().includes(term)));
  const withFill = (preferred: Coupon[], offset: number) => {
    const preferredKeys = new Set(preferred.map(couponKey));
    const filler = [...coupons.slice(offset), ...coupons.slice(0, offset)].filter((coupon) => !preferredKeys.has(couponKey(coupon)));
    return dedupeCoupons([...preferred, ...filler]).slice(0, 8);
  };

  return [
    {
      title: 'Home and garden',
      intro: 'Appliances, bedding, smart home, furniture, cleaning, and everyday household coupons.',
      items: withFill([...byStore(['Walmart', 'Target', 'Amazon']), ...byCategory(['home', 'garden', 'appliance'])], 0),
    },
    {
      title: 'Electronics',
      intro: 'Laptop, TV, monitor, phone, headphone, and gaming promo codes from major retailers.',
      items: withFill([...byStore(['Amazon', 'Best Buy', 'Newegg', 'Dell']), ...byCategory(['electronics', 'computing', 'tech'])], 8),
    },
    {
      title: 'Clothing and fashion',
      intro: 'Fashion markdowns, sneaker promos, outlet sales, and storewide discount-code leads.',
      items: withFill([...byStore(['Nike', 'Target', 'eBay']), ...byCategory(['clothing', 'fashion', 'shoe', 'apparel'])], 16),
    },
  ].filter((section) => section.items.length > 0);
}

function couponKey(coupon: Coupon) {
  return `${coupon.store}|${coupon.code ?? ''}|${coupon.title}`.toLowerCase();
}

function dedupeCoupons(coupons: Coupon[]) {
  const seen = new Set<string>();
  return coupons.filter((coupon) => {
    const key = couponKey(coupon);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function offerUrl(href: string) {
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  return `${SITE.url}${href}`;
}

function storePageHref(name: string) {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === 'amazon' ? '/coupons/amazon' : `/coupons/${slug}`;
}

function brandCouponHref(slug: string) {
  return slug === 'amazon' ? '/coupons/amazon' : `/coupons/${slug}`;
}

function buildStoreLinks(retailers: Retailer[]): StoreLink[] {
  const couponStores = listCouponStores().stores;
  const storesById = new Map(couponStores.map((store) => [store.id, store]));
  const aliases = highIntentStoreAliases().map((store) => ({
    name: store.label || titleCase(store.slug),
    href: brandCouponHref(store.slug),
    slug: store.slug,
    domain: storesById.get(store.storeId)?.domain || knownStoreDomain(store.label || store.slug) || undefined,
    logo: merchantLogo(storesById.get(store.storeId)),
  }));

  const retailerLinks = retailers.map((retailer) => ({
    name: retailer.name,
    href: retailer.href.startsWith('/coupons/') ? retailer.href : storePageHref(retailer.name),
    slug: retailer.href.startsWith('/coupons/')
      ? retailer.href.split('/').filter(Boolean).pop() || ''
      : storePageHref(retailer.name).split('/').pop() || '',
    domain: retailer.domain || knownStoreDomain(retailer.name) || undefined,
    logo: retailer.logo || undefined,
  }));

  const seen = new Set<string>();
  return [...aliases, ...retailerLinks]
    .filter((store) => {
      const key = store.slug || store.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 36);
}

function merchantLogo(store?: Pick<CouponStore, 'name' | 'logo' | 'domain' | 'url'>) {
  if (!store) return undefined;
  return storeLogoUrl(store) || undefined;
}

function titleCase(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function CouponsPage() {
  const { coupons, retailers: popularRetailers, brandGroups } = await listCouponPageData();
  const focusedCoupons = dedupeCoupons([
    ...brandGroups.flatMap((group) => group.coupons),
    ...coupons,
  ]);
  const focusedRetailers = brandGroups.length > 0
    ? brandGroups.map((group) => group.store)
    : popularRetailers;
  const storeLinks = buildStoreLinks(focusedRetailers);
  const storeLogos = Object.fromEntries(
    focusedRetailers.map((retailer) => [retailer.name.toLowerCase(), retailerLogo(retailer)]),
  );
  const storeLogoLookup = buildStoreLogoLookup();
  const featured = focusedCoupons.filter((coupon) => coupon.featured);
  const topCoupons = (featured.length > 0 ? featured : focusedCoupons).slice(0, 8);
  const categorySections = buildCategorySections(focusedCoupons);
  const topStoreLinks = storeLinks.slice(0, 12);

  const couponJsonLd = collectionPageJsonLd({
    name: 'Coupons, Promo Codes & Store Deals',
    url: `${SITE.url}/coupons`,
    description: metadata.description,
    hasPart: focusedCoupons.map((coupon) => ({
      '@type': 'Offer',
      name: `${coupon.store}: ${coupon.discount}`,
      category: coupon.category,
      url: offerUrl(coupon.href),
      description: coupon.title,
    })),
  });

  return (
    <main data-testid="coupons-page">
      <JsonLd graph={[couponJsonLd]} />

      <Hero
        couponCount={focusedCoupons.length}
        storeCount={storeLinks.length}
        categoryCount={popularCategories.length}
        topStores={topStoreLinks.slice(0, 6)}
      />

      <section className="border-b border-ink/10 bg-[#f0f2f4] py-10 sm:py-12" data-testid="coupon-store-links" id="stores">
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
            <Link href="/coupons/popular-brands" className="inline-flex bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary-emphasis">
              Popular brands
            </Link>
            <Link href="/brands" className="inline-flex border border-ink/15 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-ink transition hover:border-primary hover:text-primary">
              Browse brands
            </Link>
            <Link href="/stores" className="inline-flex border border-ink/15 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-ink transition hover:border-primary hover:text-primary">
              All stores
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white py-10 sm:py-12" data-testid="featured-coupons">
        <div className="mx-auto max-w-[1366px] px-6">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <SectionHead
                eyebrow="Current offers"
                title="Today's best coupon codes"
                subtitle="Verified promo codes and discount leads from our live coupon feed."
                subtitleClassName="text-[14px] sm:text-[14px]"
              />
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {topCoupons.map((coupon, index) => (
                  <CouponTile
                    key={`top-${coupon.store}-${coupon.code ?? index}-${coupon.title}`}
                    coupon={coupon}
                    logo={couponLogo(coupon, storeLogos, storeLogoLookup)}
                    emphasizeLogo
                  />
                ))}
              </div>
            </div>

            <aside className="h-fit border border-ink/10 bg-[#fbfcfd] p-5">
              <h3 className="font-display text-lg font-bold text-ink">Shop by category</h3>
              <p className="mt-2 text-sm text-ink/55">Search coupon codes by product category.</p>
              <div className="mt-4 grid gap-2">
                {popularCategories.map((cat) => (
                  <CategoryShortcut key={cat.label} label={cat.label} query={cat.query} />
                ))}
              </div>
              <Link
                href="/brands"
                className="mt-5 flex items-center justify-between border border-ink/10 bg-white px-4 py-3 text-sm font-bold text-primary transition hover:border-primary"
              >
                Browse all brands
                <span aria-hidden>→</span>
              </Link>
            </aside>
          </div>
        </div>
      </section>

      {brandGroups.length > 0 ? (
        <section className="border-t border-ink/10 bg-[#f0f2f4] py-10 sm:py-12" data-testid="brand-feeds">
          <div className="mx-auto max-w-[1366px] px-6">
            <SectionHead
              eyebrow="Brand feeds"
              title="Live offers by brand"
              subtitle="Current promo codes from top retailers, updated from our coupon API."
              action={{ href: '/brands', label: 'All brands' }}
            />
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {brandGroups.map((group) => (
                <BrandStoreCard key={group.store.name} group={group} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-t border-ink/10 bg-white py-10 sm:py-12">
        <div className="mx-auto max-w-[1366px] px-6">
          {categorySections.map((section) => (
            <CouponGridSection
              key={section.title}
              title={section.title}
              intro={section.intro}
              coupons={section.items}
              storeLogos={storeLogos}
              storeLogoLookup={storeLogoLookup}
            />
          ))}
        </div>
      </section>

      <ValueStrip />
    </main>
  );
}

function Hero({
  couponCount,
  storeCount,
  categoryCount,
  topStores,
}: {
  couponCount: number;
  storeCount: number;
  categoryCount: number;
  topStores: StoreLink[];
}) {
  return (
    <section className="relative overflow-hidden border-b border-ink/10 bg-[#1d252c] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(at 80% 20%, rgba(0,70,190,0.22) 0%, transparent 50%), radial-gradient(at 20% 80%, rgba(6,182,212,0.12) 0%, transparent 50%)',
        }}
      />
      <div className="relative mx-auto max-w-[1366px] px-4 py-10 sm:px-6 sm:py-14">
        <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/45">
          <Link href="/" className="transition hover:text-white">Home</Link>
          <span aria-hidden>/</span>
          <span className="text-[#ffe000]">Coupons</span>
        </nav>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-start">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#ffe000]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ffe000]" aria-hidden />
              Coupons &amp; promo codes
            </p>
            <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
              Save with verified coupon codes &amp; store deals
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
              Find promo codes from {storeCount}+ retailers, compare current offers, and jump to
              dedicated store coupon pages when you know where you want to shop.
            </p>

            <form action="/search" className="mt-8 flex max-w-2xl overflow-hidden border border-white/15 bg-white/5 backdrop-blur">
              <label htmlFor="coupon-search" className="sr-only">Search coupon codes</label>
              <input
                id="coupon-search"
                name="q"
                type="search"
                placeholder="Search a store, coupon, or promo code…"
                className="h-14 min-w-0 flex-1 bg-transparent px-4 text-sm text-white outline-none placeholder:text-white/40"
              />
              <button type="submit" className="bg-primary px-6 text-xs font-bold uppercase tracking-[0.14em] text-white transition hover:bg-primary-emphasis">
                Search
              </button>
            </form>

            {topStores.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {topStores.map((store) => (
                  <Link
                    key={store.slug}
                    href={store.href}
                    className="inline-flex border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white/80 transition hover:border-white/30 hover:text-white"
                  >
                    {store.name}
                  </Link>
                ))}
              </div>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#stores" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:border-white/40">
                Popular stores
              </a>
              <Link href="/brands" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white/80 transition hover:border-white/40 hover:text-white">
                Browse brands
              </Link>
              <a href="#featured-coupons" className="inline-flex bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary-emphasis">
                Today&apos;s deals
              </a>
            </div>
          </div>

          <aside className="border border-white/15 bg-white/5 p-5 backdrop-blur sm:p-6" aria-label="Coupon statistics">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ffe000]">At a glance</p>
            <p className="mt-3 text-sm leading-6 text-white/70">
              A live snapshot of the coupon feed — {couponCount} current offers across {storeCount}+ retailer
              coupon pages, refreshed daily from verified sources.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-5">
              <Stat label="Live offers" value={String(couponCount)} />
              <Stat label="Store pages" value={`${storeCount}+`} />
              <Stat label="Categories" value={String(categoryCount)} />
              <Stat label="Updated" value="Daily" />
            </div>
            <div className="mt-5 border-t border-white/10 pt-4 text-xs text-white/55">
              Free to use — no signup required.
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

function SectionHead({
  eyebrow,
  title,
  subtitle,
  subtitleClassName = '',
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  subtitleClassName?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        <h2 className="mt-2 font-display font-bold text-ink">{title}</h2>
        {subtitle && <p className={`mt-3 text-sm leading-7 text-ink/60 sm:text-base ${subtitleClassName}`}>{subtitle}</p>}
      </div>
      {action ? (
        <Link
          href={action.href}
          className="shrink-0 border border-ink/15 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-ink transition hover:border-primary hover:text-primary"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

function retailerLogo(retailer: Pick<Retailer, 'name' | 'logo' | 'domain' | 'href'>) {
  const sourceLogo = sourceLogoForStore(retailer.name);
  if (sourceLogo) return sourceLogo;

  const domain = retailer.domain || domainFromStoreName(retailer.name) || domainFromHref(retailer.href);
  return domain ? faviconUrl(domain) : null;
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

function buildStoreLogoLookup() {
  const lookup = new Map<string, string>();
  const add = (key: string, logo: string) => {
    const normalized = key.trim().toLowerCase();
    if (normalized && logo) lookup.set(normalized, logo);
  };

  for (const store of listCouponStores().stores) {
    const logo = storeLogoUrl(store);
    if (!logo) continue;
    add(store.name, logo);
    add(couponStoreSlug(store.name), logo);
    if (store.domain) {
      add(store.domain, logo);
      add(store.domain.split('.')[0] || '', logo);
    }
  }

  const storesById = new Map(listCouponStores().stores.map((store) => [store.id, store]));
  for (const alias of highIntentStoreAliases()) {
    const store = storesById.get(alias.storeId);
    if (!store) continue;
    const logo = storeLogoUrl(store);
    if (!logo) continue;
    add(alias.slug, logo);
    if (alias.label) add(alias.label, logo);
  }

  return lookup;
}

function couponLogo(
  coupon: Coupon,
  storeLogos: Record<string, string | null>,
  storeLogoLookup: Map<string, string>,
) {
  const key = coupon.store.toLowerCase();
  const slug = couponStoreSlug(coupon.store);
  const normalized = key.replace(/[^a-z0-9]/g, '');
  const sourceLogo = sourceLogoForStore(coupon.store);
  if (sourceLogo) return sourceLogo;

  const direct =
    storeLogoLookup.get(key) ||
    storeLogoLookup.get(slug) ||
    storeLogos[key] ||
    null;
  if (direct) return direct;

  const matchedStore = findCouponStoreBySlug(slug);
  if (matchedStore) {
    const logo = storeLogoUrl(matchedStore);
    if (logo) return logo;
  }

  const domain =
    domainFromStoreName(coupon.store) ||
    domainFromHref(coupon.href) ||
    [...storeLogoLookup.entries()].find(([name]) => {
      const candidate = name.replace(/[^a-z0-9]/g, '');
      return candidate.length > 2 && (normalized.includes(candidate) || candidate.includes(normalized));
    })?.[0];
  if (domain) {
    const fromLookup = storeLogoLookup.get(domain) || storeLogoLookup.get(domain.replace(/[^a-z0-9]/g, ''));
    if (fromLookup) return fromLookup;
    const parsedDomain = domain.includes('.') ? domain : knownStoreDomain(coupon.store);
    if (parsedDomain) return faviconUrl(parsedDomain);
  }

  const fuzzy = Object.entries(storeLogos).find(([store]) => store.includes(key) || key.includes(store));
  return fuzzy?.[1] ?? null;
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

function StoreLinkTile({ store }: { store: StoreLink }) {
  const logo = sourceLogoForStore(store.name) || (store.domain
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(store.domain)}&sz=128`
    : store.logo || null);

  return (
    <Link
      href={store.href}
      className="group flex min-h-[80px] items-center gap-3 border border-ink/10 bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_16px_32px_-22px_rgba(13,27,42,0.4)]"
    >
      <StoreLogo name={store.name} logo={logo} className="h-11 w-12" />
      <span className="min-w-0">
        <span className="block truncate font-display text-sm font-bold text-ink group-hover:text-primary">{store.name}</span>
        <span className="mt-0.5 block truncate text-[0.72rem] font-semibold text-primary/80 group-hover:text-primary">
          View coupons →
        </span>
      </span>
    </Link>
  );
}

function CategoryShortcut({ label, query }: { label: string; query: string }) {
  return (
    <Link href={`/search?q=${encodeURIComponent(query)}`} className="group flex min-h-10 items-center gap-3 border border-ink/8 bg-white px-3 py-2 transition hover:border-primary/30">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-primary/8 font-display text-xs font-bold text-primary">
        {label.charAt(0)}
      </span>
      <span className="line-clamp-2 text-[0.82rem] font-semibold leading-4 text-ink/75 transition group-hover:text-primary">
        {label}
      </span>
    </Link>
  );
}

function BrandStoreCard({ group }: { group: CouponBrandGroup }) {
  const logo = retailerLogo(group.store);
  const href = group.store.href.startsWith('/coupons/') ? group.store.href : storePageHref(group.store.name);

  return (
    <article className="border border-ink/10 bg-white">
      <div className="flex items-center justify-between gap-4 border-b border-ink/10 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <StoreLogo name={group.store.name} logo={logo} className="h-11 w-14" />
          <div className="min-w-0">
            <h4 className="truncate font-display text-[14px] font-bold text-ink">{group.store.name}</h4>
            <p className="mt-0.5 text-[0.75rem] font-semibold text-ink/50">{group.coupons.length} live offers</p>
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

function CouponGridSection({
  title,
  intro,
  coupons,
  storeLogos,
  storeLogoLookup,
}: {
  title: string;
  intro?: string;
  coupons: Coupon[];
  storeLogos: Record<string, string | null>;
  storeLogoLookup: Map<string, string>;
}) {
  if (coupons.length === 0) return null;

  return (
    <section className="border-b border-ink/10 py-8 last:border-b-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-bold text-ink">{title}</h3>
          {intro ? <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/55">{intro}</p> : null}
        </div>
        <Link
          href={`/search?q=${encodeURIComponent(`${title} coupons`)}`}
          className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-primary underline underline-offset-4 transition hover:text-primary-emphasis"
        >
          Search {title.toLowerCase()}
        </Link>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {coupons.map((coupon, index) => (
          <CouponTile
            key={`${title}-${coupon.store}-${coupon.code ?? index}-${coupon.title}`}
            coupon={coupon}
            logo={couponLogo(coupon, storeLogos, storeLogoLookup)}
          />
        ))}
      </div>
    </section>
  );
}

function CouponTile({
  coupon,
  logo,
  emphasizeLogo = false,
}: {
  coupon: Coupon;
  logo?: string | null;
  emphasizeLogo?: boolean;
}) {
  const href = storePageHref(coupon.store);
  const logoSize = emphasizeLogo ? 'h-14 w-16' : 'h-12 w-14';

  return (
    <article className="grid min-h-[176px] gap-3 border border-ink/10 bg-white p-4 transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_14px_28px_-20px_rgba(13,27,42,0.35)]">
      <div className="flex items-center gap-3">
        <StoreLogo name={coupon.store} logo={logo} className={logoSize} />
        <div className="min-w-0">
          <Link href={href} className="block truncate text-[0.72rem] font-bold uppercase tracking-[0.12em] text-primary hover:text-primary-emphasis">
            {coupon.store} coupons
          </Link>
          <p className="mt-1 truncate text-[0.72rem] font-semibold text-ink/45">{coupon.type}</p>
        </div>
      </div>
      <div>
        <h5 className="line-clamp-2 font-display text-lg font-bold leading-5 text-ink">{coupon.discount}</h5>
        <p className="mt-2 line-clamp-2 text-sm leading-5 text-ink/60">{coupon.title}</p>
      </div>
      <div className="mt-auto grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <span className="truncate border border-dashed border-ink/20 bg-paper px-3 py-2 text-center text-xs font-bold uppercase text-ink">
          {coupon.code || 'No code'}
        </span>
        <a
          href={coupon.href}
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

function ValueStrip() {
  const items = [
    { ic: '🏷️', t: 'Live promo feeds', s: 'Coupon codes pulled from verified retailer feeds, updated daily.' },
    { ic: '🔍', t: 'Search by store or brand', s: 'Jump to dedicated coupon pages or browse 18,000+ stores.' },
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
