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
    d: 'Pull up a product and see what it costs across 8+ marketplaces at once, side by side. No tab-juggling, no guesswork about who has the better deal today.',
  },
  {
    t: 'Track the price over time',
    d: `Every product has a price history, so you can tell a real drop from a "sale" that isn't. Set an alert and we'll watch it for you, checking daily and flagging the moment the price falls.`,
  },
  {
    t: 'Cut through the clutter',
    d: 'Alongside the prices, we publish buying guides, honest reviews, roundups and how-to articles — the editorial layer that helps you pick the right gadget without the marketplace noise.',
  },
];

const coverage = [
  'Smartphones', 'Smartwatches', 'Tablets', 'Laptops', 'Smart TVs', 'Cameras', 'Speakers',
  'Headphones', 'Smart lights', 'Smart locks', 'Video doorbells', 'Smart plugs', 'Raspberry Pi', 'Maker gear',
];

const checklist = [
  'Compare one product across 8+ marketplaces, side by side.',
  'Track its price history and get an alert when it drops.',
  'Honest reviews and buying guides — free, and no signup.',
];

const SHELL = 'mx-auto max-w-[1366px] px-4 sm:px-6';
const EYEBROW = 'text-[0.74rem] font-bold uppercase tracking-[0.16em] text-primary';
const H2 = 'font-display font-extrabold tracking-[-0.02em] text-ink !text-[clamp(1.7rem,3.2vw,2rem)] leading-[1.12]';
const BODY = 'text-[1.02rem] leading-[1.7] text-ink/60';

export default function AboutPage() {
  return (
    <main data-testid="about-page">
      {/* Hero — dark "At a glance" layout (matches /sitemap) */}
      <section className="relative overflow-hidden border-b border-ink/10 bg-[#1d252c] text-white" data-testid="about-page-header">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              'radial-gradient(at 80% 20%, rgba(0,70,190,0.22) 0%, transparent 50%), radial-gradient(at 15% 85%, rgba(255,224,0,0.12) 0%, transparent 50%)',
          }}
        />
        <div className="relative mx-auto max-w-[1366px] px-4 py-10 sm:px-6 sm:py-14">
          <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/45" aria-label="Breadcrumb">
            <Link href="/" className="transition hover:text-white">Home</Link>
            <span aria-hidden>/</span>
            <span className="text-[#ffe000]">About</span>
          </nav>

          <div className="mt-8 w-full">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ffe000]">About {SITE.name}</p>
              <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
                Never pay full price again.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
                {SITE.name} is an independent price-comparison platform built on a single, simple idea: you
                shouldn&apos;t have to open a dozen tabs to find out where a gadget is actually cheapest. We do the
                comparing so you can skip straight to the buying.
              </p>

              <ul className="mt-6 max-w-2xl space-y-3 text-sm leading-6 text-white/75 sm:text-base">
                {checklist.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-0.5 shrink-0 text-[#ffe000]" aria-hidden>✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-wrap gap-3">
                <a href="#about-content" className="inline-flex bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary-emphasis">
                  Our story
                </a>
                <Link href="/best-deals" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white/80 transition hover:border-white/40 hover:text-white">
                  Today&apos;s best deals
                </Link>
                <Link href="/all-products" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white/75 transition hover:border-white/40 hover:text-white">
                  Browse products
                </Link>
              </div>
            </div>
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
                  <ImagePlaceholder label="Image" ratio="aspect-[16/9]" className="mb-5" />
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
              <ImagePlaceholder label="Image" ratio="aspect-[4/3]" />
            </div>
          </div>
        </section>

        {/* why it matters */}
        <section className="border-t border-ink/10 bg-white py-14 sm:py-16">
          <div className={SHELL}>
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <ImagePlaceholder label="Image" ratio="aspect-[4/3]" className="lg:order-1" />
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

/** Placeholder box standing in for a real image until artwork is added. */
function ImagePlaceholder({
  label = 'Image',
  ratio = 'aspect-[4/3]',
  className = '',
}: {
  label?: string;
  ratio?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex ${ratio} w-full items-center justify-center rounded-2xl border border-dashed border-ink/25 bg-[repeating-linear-gradient(45deg,transparent,transparent_11px,rgba(13,27,42,0.035)_11px,rgba(13,27,42,0.035)_22px)] ${className}`}
      role="img"
      aria-label={`${label} placeholder`}
    >
      <div className="flex flex-col items-center gap-2 text-ink/35">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
        <span className="text-[0.7rem] font-bold uppercase tracking-[0.14em]">{label}</span>
      </div>
    </div>
  );
}
