import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'NXT.Bargains is an independent price-comparison platform — compare smart-electronics prices across 8+ marketplaces, track price history, and read honest reviews and guides. Free, no signup.',
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

const SHELL = 'mx-auto max-w-[1366px] px-6';
const EYEBROW = 'text-[0.74rem] font-bold uppercase tracking-[0.16em] text-primary';
const H2 = 'font-display font-extrabold tracking-[-0.02em] text-ink !text-[clamp(1.7rem,3.2vw,2rem)] leading-[1.12]';
const BODY = 'text-[1.02rem] leading-[1.7] text-ink/60';

export default function AboutPage() {
  return (
    <div data-testid="about-page" className="bg-white">
      {/* hero / title section */}
      <section className="bg-[#f0f2f4] py-16 sm:py-20">
        <div className={SHELL}>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className={EYEBROW}>About {SITE.name}</span>
              <h1 className="mt-4 font-display font-extrabold tracking-[-0.03em] text-ink !text-[clamp(2.2rem,5vw,3.25rem)] leading-[1.04]">
                Never pay full price again.
              </h1>
              <p className="mt-6 text-[1.12rem] leading-[1.6] text-ink/60">
                {SITE.name} is an independent price-comparison platform built on a single, simple idea: you
                shouldn&apos;t have to open a dozen tabs to find out where a gadget is actually cheapest. We do the
                comparing so you can skip straight to the buying.
              </p>
              <p className={`mt-4 ${BODY}`}>
                We track smart electronics across the major marketplaces &mdash; Amazon, eBay, Walmart, Newegg, Best
                Buy, Target, AliExpress and more &mdash; and put every price for a product in one place.
              </p>
              <div className="mt-8 flex flex-wrap gap-3.5">
                <Link href="/best-deals" className="rounded-[11px] bg-primary px-6 py-3.5 font-display text-[0.9rem] font-bold text-white transition hover:-translate-y-0.5 hover:bg-primary-emphasis">
                  See today&apos;s best deals
                </Link>
                <Link href="/products" className="rounded-[11px] border border-ink/15 px-6 py-3.5 font-display text-[0.9rem] font-bold text-ink transition hover:border-primary hover:text-primary">
                  Browse products
                </Link>
              </div>
            </div>
            <ImagePlaceholder label="Hero image" ratio="aspect-[4/3]" />
          </div>
        </div>
      </section>

      {/* what we do */}
      <section className="border-t border-ink/10 py-16 sm:py-20">
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
      <section className="py-16 sm:py-20">
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

      {/* how we're different — split */}
      <section className="border-t border-ink/10 py-16 sm:py-20">
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

      {/* why it matters — split reversed */}
      <section className="border-t border-ink/10 py-16 sm:py-20">
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

      {/* get in touch CTA */}
      <section className="py-16 sm:py-20">
        <div className={SHELL}>
          <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-16 text-center text-white sm:px-14">
            <div aria-hidden className="pointer-events-none absolute left-1/2 -top-[100px] h-[300px] w-[420px] -translate-x-1/2 bg-[radial-gradient(circle,rgba(0,70,190,0.28),transparent_60%)]" />
            <span className="relative text-[0.74rem] font-bold uppercase tracking-[0.16em] text-primary">Get in touch</span>
            <h2 className="relative mt-2.5 font-display font-extrabold tracking-[-0.02em] !text-[clamp(1.8rem,3vw,2.2rem)]">
              Never pay full price again.
            </h2>
            <p className="relative mx-auto mt-4 max-w-[52ch] text-[1rem] leading-[1.6] text-white/65">
              Questions, feedback, or a product you&apos;d like us to track? We&apos;d love to hear from you.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3.5">
              <Link href="/best-deals" className="rounded-[11px] bg-primary px-7 py-3.5 font-display text-[0.95rem] font-bold text-white transition hover:-translate-y-0.5 hover:bg-primary-emphasis">
                See today&apos;s best deals
              </Link>
              <Link href="/contact" className="rounded-[11px] border border-white/[0.18] bg-white/[0.08] px-7 py-3.5 font-display text-[0.95rem] font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.16]">
                Contact us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
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
