import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import CookieSettingsButton from '@/components/CookieSettingsButton';
import { FOOTER_ARTICLE_NAV_LINKS, SITE } from '@/lib/site';

type FooterLink = { href: string; label: string };
type FooterItem = FooterLink | { heading: string; children: FooterLink[] };

// Mirrors the top-nav "All Products" menu, incl. the nested "Smart Home" group.
const shopLinks: FooterItem[] = [
  { href: '/all-products', label: 'All Products' },
  { href: '/category/smart-phones', label: 'Smart Phones' },
  { href: '/category/smartwatches', label: 'Smartwatches' },
  { href: '/category/tablets', label: 'Tablets' },
  { href: '/category/laptops', label: 'Laptops' },
  { href: '/category/smart-tvs', label: 'Smart TVs' },
  { href: '/category/smart-cameras', label: 'Smart Cameras' },
  { href: '/category/smart-speakers', label: 'Smart Speakers' },
  {
    heading: 'Smart Home',
    children: [
      { href: '/category/smart-light-bulbs', label: 'Smart Light Bulbs' },
      { href: '/category/smart-door-locks', label: 'Smart Door Locks' },
      { href: '/category/smart-plugs', label: 'Smart Plugs' },
      { href: '/category/video-doorbells', label: 'Smart Doorbells' },
    ],
  },
  { href: '/category/headphones', label: 'Headphones' },
  { href: '/category/raspberry-pi', label: 'Raspberry PI' },
];

const aboutLinks = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About Us' },
  { href: '/coupons', label: 'Coupons' },
  { href: '/coupons/popular-brands', label: 'Popular Brands' },
  { href: '/price-drops', label: 'Price Drops' },
  { href: '/best-deals', label: 'Best Deals' },
  { href: '/sitemap', label: 'Site Map' },
  { href: '/feed.xml', label: 'RSS feed' },
  { href: '/contact', label: 'Contact Us' },
];

const MARKETPLACES = ['Amazon', 'eBay', 'Walmart', 'AliExpress', 'Best Buy', 'Target', 'Newegg'];

const legalLinks = [
  { href: '/legal/terms', label: 'Terms & Conditions' },
  { href: '/legal/privacy', label: 'Privacy Policy' },
  { href: '/legal/cookies', label: 'Cookie Policy' },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer pt-[50px] text-sm" data-testid="site-footer">
      <div className="mx-auto max-w-7xl px-6">
        {/* top: brand + columns */}
        <div className="footer-top-grid gap-8 border-b border-ink/[0.12] pb-8 sm:grid-cols-2">
          {/* brand */}
          <div className="footer-brand-column sm:col-span-2">
            {/* The "_light" file is a white wordmark, drawn for the old dark
                footer; on the light background it was invisible. */}
            <Link href="/" className="mb-4 inline-block" aria-label={`${SITE.name} home`}>
              <Image
                src="/nxt_bargains_logo_dark.svg"
                alt={SITE.name}
                width={450}
                height={218}
                className="h-10 w-auto"
              />
            </Link>
            <p className="mb-5 max-w-sm text-[16px] leading-6 text-ink/65">
              Compare one product across the major marketplaces, track its price history,
              and buy at the lowest price. Never pay full price again.
            </p>

            <div className="mt-6 mb-6 flex gap-2" data-testid="social-links">
              <SocialLink href={SITE.social?.facebook ?? 'https://www.facebook.com/nxtbargains'} label="Facebook">
                <path d="M14 9h3V6h-3c-1.7 0-3 1.3-3 3v2H9v3h2v6h3v-6h2.5l.5-3H14V9.5c0-.3.2-.5.5-.5z" />
              </SocialLink>
              <SocialLink href={SITE.social?.twitter ?? 'https://x.com/nxtbargains'} label="X">
                <path d="M17.5 4h2.7l-5.9 6.7L21 20h-5.4l-4.2-5.5L6.5 20H3.8l6.3-7.2L3 4h5.5l3.8 5L17.5 4zm-1 14.4h1.5L7.5 5.5H5.9l10.6 12.9z" />
              </SocialLink>
              <SocialLink href="/feed.xml" label="RSS feed">
                <circle cx="6.2" cy="17.8" r="2.2" />
                <path d="M4 4v3c7.2 0 13 5.8 13 13h3C20 11.2 12.8 4 4 4zm0 6v3c3.9 0 7 3.1 7 7h3c0-5.5-4.5-10-10-10z" />
              </SocialLink>
            </div>

            <div className="mt-6">
              <div className="mb-5 text-xs font-bold uppercase tracking-wide text-primary">Tips &amp; partnerships</div>
              <Link href="/contact" className="border-b border-primary/50 pb-px text-[20px] font-medium text-ink transition hover:text-primary">
                hello@nxt.bargains
              </Link>
            </div>
          </div>

          <FooterColumn title="About" links={aboutLinks} className="footer-about-column" />
          <FooterColumn title="All Articles" links={FOOTER_ARTICLE_NAV_LINKS} className="footer-articles-column" />
          <FooterColumn title="Products" links={shopLinks} className="footer-shop-column" />
        </div>

        {/* comparing prices across */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ink/[0.12] py-6">
          <span className="text-sm font-semibold text-ink/60">Comparing prices across</span>
          {MARKETPLACES.map((m) => (
            <b key={m} className="font-display text-sm font-bold text-ink/80">{m}</b>
          ))}
          <span className="text-sm font-semibold text-primary">+ more</span>
        </div>

      </div>

      {/* bottom */}
      <div className="site-footer-bottom mt-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-ink/70 sm:text-sm">
          <span>© {year} {SITE.name}. Independent price comparison — we may earn a commission on some links.</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {legalLinks.map((l) => (
              <Link key={l.href} href={l.href} className="transition hover:text-ink">{l.label}</Link>
            ))}
            <CookieSettingsButton className="transition hover:text-ink" />
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
  className,
}: {
  title: string;
  links: FooterItem[];
  className?: string;
}) {
  return (
    <div className={className}>
      <h5 className="mb-4 font-display text-[14px] font-semibold uppercase tracking-wide text-ink">{title}</h5>
      {links.map((item) =>
        'heading' in item ? (
          <div key={item.heading} className="group/sub mb-2.5">
            <p className="mb-1.5 flex cursor-default items-center gap-1.5 text-sm text-ink/65 transition hover:text-ink">
              {item.heading}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5 text-ink/45 transition-transform duration-200 group-hover/sub:rotate-180"
                aria-hidden
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </p>
            <div className="grid grid-rows-[0fr] opacity-0 transition-all duration-200 group-hover/sub:grid-rows-[1fr] group-hover/sub:opacity-100">
              <div className="overflow-hidden">
                {item.children.map((l) => (
                  <Link
                    key={l.href + l.label}
                    href={l.href}
                    className="mb-2.5 block pl-3 text-sm text-ink/65 transition hover:pl-4 hover:text-ink"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <Link
            key={item.href + item.label}
            href={item.href}
            className="mb-2.5 block text-sm text-ink/65 transition hover:pl-1 hover:text-ink"
          >
            {item.label}
          </Link>
        ),
      )}
    </div>
  );
}

function SocialLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  const external = href.startsWith('http');
  return (
    <a
      href={href}
      aria-label={label}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="grid h-9 w-9 place-items-center rounded bg-ink/[0.06] text-ink/70 transition hover:-translate-y-0.5 hover:bg-primary hover:text-ink"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
        {children}
      </svg>
    </a>
  );
}
