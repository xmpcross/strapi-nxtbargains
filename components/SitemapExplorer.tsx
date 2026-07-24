'use client';

import { useState } from 'react';
import Link from 'next/link';

export type SitemapLink = { href: string; label: string };
export type SitemapGroup = { title: string; links: SitemapLink[] };
export type SitemapCatItem = { href: string; label: string; date: string };
export type SitemapCategory = { slug: string; name: string; href: string; items: SitemapCatItem[] };
export type SitemapStore = { href: string; name: string };

type FilterKey = 'main' | 'products' | 'articles' | 'coupons';
type CouponSub = 'all' | 'stores' | 'brands';

export default function SitemapExplorer({
  mainGroups,
  productCats,
  articleCats,
  couponStores,
  couponBrands,
}: {
  mainGroups: SitemapGroup[];
  productCats: SitemapCategory[];
  articleCats: SitemapCategory[];
  couponStores: SitemapStore[];
  couponBrands: SitemapStore[];
}) {
  const [section, setSection] = useState<FilterKey>('main');
  const [productSub, setProductSub] = useState<string | null>(null);
  const [articleSub, setArticleSub] = useState<string | null>(null);
  const [couponSub, setCouponSub] = useState<CouponSub>('all');

  const mainCount = mainGroups.reduce((sum, g) => sum + g.links.length, 0);
  const productCount = productCats.reduce((sum, c) => sum + c.items.length, 0);
  const articleCount = articleCats.reduce((sum, c) => sum + c.items.length, 0);

  // All coupon links = store coupon pages + brand coupon pages (deduped by href).
  const allCoupons = dedupeByHref([...couponStores, ...couponBrands]).sort((a, b) =>
    a.name.localeCompare(b.name, 'en'),
  );

  const shownProducts = productSub ? productCats.filter((c) => c.slug === productSub) : productCats;
  const shownArticles = articleSub ? articleCats.filter((c) => c.slug === articleSub) : articleCats;

  return (
    <section className="bg-[#f0f2f4] py-10 sm:py-14" id="sitemap-explorer" data-testid="sitemap-explorer">
      <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(240px,1fr)_3fr] lg:items-start lg:gap-12">
          {/* Left sidebar filter */}
          <aside className="lg:sticky lg:top-24" aria-label="Sitemap sections">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-primary">Browse</p>
            <ul className="mt-4 space-y-1.5">
              <li>
                <FilterButton
                  label="Main pages"
                  count={mainCount}
                  active={section === 'main'}
                  onClick={() => setSection('main')}
                />
              </li>

              <li>
                <FilterButton
                  label="Products by category"
                  count={productCount}
                  active={section === 'products'}
                  onClick={() => {
                    setSection('products');
                    setProductSub(null);
                  }}
                />
                {section === 'products' ? (
                  <SubList>
                    <SubButton label="All products" active={productSub === null} onClick={() => setProductSub(null)} />
                    {productCats.map((c) => (
                      <SubButton
                        key={c.slug}
                        label={c.name}
                        count={c.items.length}
                        active={productSub === c.slug}
                        onClick={() => setProductSub(c.slug)}
                      />
                    ))}
                  </SubList>
                ) : null}
              </li>

              <li>
                <FilterButton
                  label="Categories & posts"
                  count={articleCount}
                  active={section === 'articles'}
                  onClick={() => {
                    setSection('articles');
                    setArticleSub(null);
                  }}
                />
                {section === 'articles' ? (
                  <SubList>
                    <SubButton label="All posts" active={articleSub === null} onClick={() => setArticleSub(null)} />
                    {articleCats.map((c) => (
                      <SubButton
                        key={c.slug}
                        label={c.name}
                        count={c.items.length}
                        active={articleSub === c.slug}
                        onClick={() => setArticleSub(c.slug)}
                      />
                    ))}
                  </SubList>
                ) : null}
              </li>

              <li>
                <FilterButton
                  label="Coupons"
                  count={allCoupons.length}
                  active={section === 'coupons'}
                  onClick={() => {
                    setSection('coupons');
                    setCouponSub('all');
                  }}
                />
                {section === 'coupons' ? (
                  <SubList>
                    <SubButton
                      label="All coupons"
                      count={allCoupons.length}
                      active={couponSub === 'all'}
                      onClick={() => setCouponSub('all')}
                    />
                    <SubButton
                      label="Stores"
                      count={couponStores.length}
                      active={couponSub === 'stores'}
                      onClick={() => setCouponSub('stores')}
                    />
                    <SubButton
                      label="Brands"
                      count={couponBrands.length}
                      active={couponSub === 'brands'}
                      onClick={() => setCouponSub('brands')}
                    />
                  </SubList>
                ) : null}
              </li>
            </ul>
          </aside>

          {/* Right content — only the selected section */}
          <div>
            {section === 'main' ? <MainPages groups={mainGroups} /> : null}
            {section === 'products' ? (
              <CategoryList
                eyebrow="Catalog"
                title={productSub ? shownProducts[0]?.name ?? 'Products' : 'Products by category'}
                summary={summarize(shownProducts, 'product', 'category', 'categories')}
                categories={shownProducts}
                cardBg="bg-white"
              />
            ) : null}
            {section === 'articles' ? (
              <CategoryList
                eyebrow="Articles"
                title={articleSub ? shownArticles[0]?.name ?? 'Posts' : 'Categories & posts'}
                summary={summarize(shownArticles, 'article', 'category', 'categories')}
                categories={shownArticles}
                cardBg="bg-[#f0f2f4]"
              />
            ) : null}
            {section === 'coupons' ? (
              <CouponList
                couponSub={couponSub}
                onSelect={setCouponSub}
                all={allCoupons}
                stores={couponStores}
                brands={couponBrands}
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function summarize(cats: SitemapCategory[], noun: string, one: string, many: string) {
  const items = cats.reduce((sum, c) => sum + c.items.length, 0);
  return `${items} ${noun}${items === 1 ? '' : 's'} across ${cats.length} ${cats.length === 1 ? one : many}.`;
}

function FilterButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 border px-4 py-2.5 text-left text-sm font-bold transition ${
        active
          ? 'border-primary bg-primary text-white'
          : 'border-ink/10 bg-white text-ink/70 hover:border-primary hover:text-primary'
      }`}
    >
      <span>{label}</span>
      <span className={`shrink-0 text-xs font-semibold ${active ? 'text-white/80' : 'text-ink/40'}`}>{count}</span>
    </button>
  );
}

function SubList({ children }: { children: React.ReactNode }) {
  return <ul className="mb-1 mt-1 space-y-0.5 border-l border-ink/15 pl-2">{children}</ul>;
}

function SubButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition ${
          active ? 'font-bold text-primary' : 'font-semibold text-ink/60 hover:pl-4 hover:text-primary'
        }`}
      >
        <span className="truncate">{label}</span>
        {typeof count === 'number' ? (
          <span className={`shrink-0 text-[11px] ${active ? 'text-primary/70' : 'text-ink/35'}`}>{count}</span>
        ) : null}
      </button>
    </li>
  );
}

function SectionHeading({ eyebrow, title, summary }: { eyebrow: string; title: string; summary: string }) {
  return (
    <div className="mb-8">
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
      <h2 className="mt-2 font-display !text-[1.2rem] font-bold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-ink/55">{summary}</p>
    </div>
  );
}

function MainPages({ groups }: { groups: SitemapGroup[] }) {
  return (
    <div>
      <SectionHeading
        eyebrow="Explore"
        title="Main pages"
        summary={`${groups.reduce((s, g) => s + g.links.length, 0)} top-level pages across ${groups.length} groups.`}
      />
      {/* 1 column: groups stacked, links listed one per row */}
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.title} className="border border-ink/10 bg-white p-5">
            <h3 className="font-display !text-[1rem] font-bold uppercase tracking-[0.1em] text-ink/50">
              {group.title}
            </h3>
            <ul className="mt-4 space-y-1">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block py-1.5 text-sm font-semibold text-ink/75 transition hover:pl-1 hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryList({
  eyebrow,
  title,
  summary,
  categories,
  cardBg,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  categories: SitemapCategory[];
  cardBg: string;
}) {
  return (
    <div>
      <SectionHeading eyebrow={eyebrow} title={title} summary={summary} />
      <div className="space-y-4">
        {categories.map((cat) => (
          <div key={cat.slug} className={`border border-ink/10 p-5 sm:p-6 ${cardBg}`}>
            <Link
              href={cat.href}
              className="group inline-flex items-baseline gap-3 font-display text-lg font-bold text-ink transition hover:text-primary"
            >
              {cat.name}
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-primary/80">
                {cat.items.length} item{cat.items.length === 1 ? '' : 's'}
              </span>
            </Link>
            <ul className="mt-4 grid gap-1 sm:grid-cols-2">
              {cat.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group flex items-baseline justify-between gap-4 border-b border-ink/5 px-1 py-2 transition hover:border-primary/30"
                  >
                    <span className="truncate text-sm text-ink/75 transition group-hover:text-primary">
                      {item.label}
                    </span>
                    {item.date ? <span className="shrink-0 text-[11px] text-ink/40">{item.date}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function dedupeByHref(items: SitemapStore[]): SitemapStore[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}

const COUPON_TABS: Array<{ key: CouponSub; label: string }> = [
  { key: 'all', label: 'All coupons' },
  { key: 'stores', label: 'Stores' },
  { key: 'brands', label: 'Brands' },
];

function CouponList({
  couponSub,
  onSelect,
  all,
  stores,
  brands,
}: {
  couponSub: CouponSub;
  onSelect: (sub: CouponSub) => void;
  all: SitemapStore[];
  stores: SitemapStore[];
  brands: SitemapStore[];
}) {
  const list = couponSub === 'stores' ? stores : couponSub === 'brands' ? brands : all;
  const noun = couponSub === 'brands' ? 'brand' : couponSub === 'stores' ? 'store' : 'coupon page';
  const title = couponSub === 'brands' ? 'Brand coupons' : couponSub === 'stores' ? 'Store coupons' : 'All coupons';

  return (
    <div>
      <SectionHeading
        eyebrow="Coupons"
        title={title}
        summary={`${list.length} ${noun}${list.length === 1 ? '' : 's'} with current coupon codes.`}
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {COUPON_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-pressed={couponSub === tab.key}
            onClick={() => onSelect(tab.key)}
            className={`inline-flex border px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] transition ${
              couponSub === tab.key
                ? 'border-primary bg-primary text-white'
                : 'border-ink/15 bg-white text-ink/60 hover:border-primary hover:text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {list.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="group flex items-baseline gap-2 border-b border-ink/5 px-1 py-2 transition hover:border-primary/30"
            >
              <span className="truncate text-sm text-ink/75 transition group-hover:text-primary">{item.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
