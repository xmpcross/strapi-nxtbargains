import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE } from '@/lib/site';
import { clampDescription } from '@/lib/format';

export const metadata: Metadata = {
  title: 'About Us',
  description: clampDescription(
    'NXT.Bargains is an independent price-comparison platform — compare smart-electronics prices across 8+ marketplaces, track price history, and read honest reviews and guides. Free, no signup.',
  ),
  alternates: { canonical: '/about' },
};

const pillars = [
  {
    t: 'Compare in one place',
    img: '/about/about-compare-prices-real.webp',
    alt: 'Product prices compared across marketplace offers',
    d: 'Pull up a product and see what it costs across 8+ marketplaces at once, side by side. No tab-juggling, no guesswork about who has the better deal today.',
  },
  {
    t: 'Track the price over time',
    img: '/about/about-price-alerts-real.webp',
    alt: 'Price history chart with a price drop alert',
    d: `Every product has a price history, so you can tell a real drop from a "sale" that isn't. Set an alert and we'll watch it for you, checking daily and flagging the moment the price falls.`,
  },
  {
    t: 'Cut through the clutter',
    img: '/about/about-buying-guides-real.webp',
    alt: 'Buying guides and reviews used for product research',
    d: 'Alongside the prices, we publish buying guides, honest reviews, roundups and how-to articles — the editorial layer that helps you pick the right gadget without the marketplace noise.',
  },
];

const coverage = [
  'Smartphones', 'Smartwatches', 'Tablets', 'Laptops', 'Smart TVs', 'Cameras', 'Speakers',
  'Headphones', 'Smart lights', 'Smart locks', 'Video doorbells', 'Smart plugs', 'Raspberry Pi', 'Maker gear',
];


const SHELL = 'mx-auto max-w-[1366px] px-4 sm:px-6';
const EYEBROW = 'text-[0.74rem] font-bold uppercase tracking-[0.16em] text-primary';
const H2 = 'font-display font-extrabold tracking-[-0.02em] text-ink !text-[clamp(1.7rem,3.2vw,2rem)] leading-[1.12]';
const BODY = 'text-[1.02rem] leading-[1.7] text-ink/60';

export default function AboutPage() {
  return (
    <main data-testid="about-page">
      {/* Hero — shared light-gradient page title block (.page-hero) */}
      <section className="page-hero" data-testid="about-page-header">
        <div className="page-hero-inner">
          <nav className="page-hero-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <span className="page-hero-crumbs-current">About</span>
          </nav>

          <div className="mt-7 w-full">
            <p className="page-hero-eyebrow">About {SITE.name}</p>
            <h1 className="page-hero-title">Never pay full price again.</h1>
            <p className="page-hero-desc">
              {SITE.name} is an independent price-comparison site for tech, home and everyday gadgets.
              We pull live offers from Amazon, eBay, Walmart, Best Buy and dozens of other retailers, then
              show you which one is genuinely cheapest right now. No sponsored rankings and no inflated
              &ldquo;was&rdquo; prices &mdash; just the real number from every store we can reach.
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <div id="about-content">
        {/* what we do */}
        <section className="py-14 sm:py-16">
          <div className={SHELL}>
            <span className={EYEBROW}>What we do</span>
            <h2 className={`mt-2 ${H2}`}>Compare, track, and cut through the noise.</h2>
            <p className={`mt-3 max-w-[70ch] ${BODY}`}>
              We bring three things together so you don&apos;t have to hunt for them separately.
            </p>
            <div className="mt-9 grid gap-6 md:grid-cols-3">
              {pillars.map((p) => (
                <div key={p.t} className="flex flex-col rounded-2xl border border-ink/10 bg-white p-6">
                  <AboutImage src={p.img} alt={p.alt} ratio="aspect-[16/9]" className="mb-5" />
                  <h3 className="font-display text-lg font-semibold text-ink">{p.t}</h3>
                  <p className="mt-2 text-[0.95rem] leading-[1.6] text-ink/55">{p.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* what we cover */}
        <section className="border-t border-ink/10 bg-white py-14 sm:py-16">
          <div className={SHELL}>
            <span className={EYEBROW}>What we cover</span>
            <h2 className={`mt-2 ${H2}`}>The tech people actually shop around for.</h2>
            <p className={`mt-3 max-w-[70ch] ${BODY}`}>
              From pocket devices to the living room to the smart home &mdash; and right through to the maker bench.
            </p>
            <ul className="mt-7 flex flex-wrap gap-2.5">
              {coverage.map((c) => (
                <li key={c} className="rounded-full border border-ink/12 bg-muted px-4 py-2 text-[0.9rem] font-semibold text-ink/70">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* how we're different */}
        <section className="border-t border-ink/10 py-14 sm:py-16">
          <div className={SHELL}>
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <span className={EYEBROW}>How we&apos;re different</span>
                <h2 className={`mt-2 ${H2}`}>Independent, and on your side.</h2>
                <p className={`mt-4 ${BODY}`}>
                  We&apos;re an <strong className="font-semibold text-ink">independent</strong> price-comparison
                  platform, not a storefront. We don&apos;t sell the products; we help you find the best place to buy
                  them. That independence is the whole point &mdash; our job is to be on your side of the transaction.
                </p>
                <p className={`mt-4 ${BODY}`}>
                  We also keep it genuinely low-friction. Comparing prices, checking a product&apos;s history and
                  browsing our guides is <strong className="font-semibold text-ink">free and requires no signup</strong>.
                </p>
              </div>
              <AboutImage src="/about/about-independent-real.webp" alt="Balanced scale showing independent product comparison" ratio="aspect-[4/3]" />
            </div>
          </div>
        </section>

        {/* why it matters */}
        <section className="border-t border-ink/10 bg-white py-14 sm:py-16">
          <div className={SHELL}>
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <AboutImage src="/about/about-transparent-deals-real.webp" alt="Shield and deal receipt representing transparent price comparison" ratio="aspect-[4/3]" className="lg:order-1" />
              <div className="lg:order-2">
                <span className={EYEBROW}>Why it matters</span>
                <h2 className={`mt-2 ${H2}`}>Transparency beats luck and timing.</h2>
                <p className={`mt-4 ${BODY}`}>
                  Prices on the same gadget can swing widely from one marketplace to the next, and from one week to the
                  next. Without a way to see all of it at once, &ldquo;getting a good deal&rdquo; comes down to luck and
                  timing. {SITE.name} replaces the guesswork with transparency &mdash; real prices, real history, and
                  honest, side-by-side comparisons &mdash; so the deal you get is the best one available, not just the
                  first one you found.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* get in touch — light background */}
        <section className="border-t border-ink/10 py-14 sm:py-16">
          <div className={SHELL}>
            <div className="overflow-hidden rounded-3xl border border-ink/10 bg-[#f0f2f4] px-6 py-14 text-center sm:px-14">
              <span className={EYEBROW}>Get in touch</span>
              <h2 className={`mt-2 ${H2}`}>Questions, feedback, or a product to track?</h2>
              <p className="mx-auto mt-3 max-w-[54ch] text-[1.02rem] leading-[1.6] text-ink/60">
                We&apos;d love to hear from you — suggest a product for us to track, flag a price, or just say hello.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3.5">
                <Link href="/best-deals" className="rounded-[11px] bg-primary px-7 py-3.5 font-display text-[0.95rem] font-bold text-white transition hover:-translate-y-0.5 hover:bg-primary-emphasis">
                  See today&apos;s best deals
                </Link>
                <Link href="/contact" className="rounded-[11px] border border-ink/15 bg-white px-7 py-3.5 font-display text-[0.95rem] font-bold text-ink transition hover:-translate-y-0.5 hover:border-primary hover:text-primary">
                  Contact us
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function AboutImage({
  src,
  alt,
  ratio = 'aspect-[4/3]',
  className = '',
}: {
  src: string;
  alt: string;
  ratio?: string;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-ink/10 bg-white ${ratio} ${className}`}>
      <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
    </div>
  );
}
