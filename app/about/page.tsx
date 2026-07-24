import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE } from '@/lib/site';
import ValueStrip from '@/components/ValueStrip';

export const metadata: Metadata = {
  title: 'About Us',
  description: `${SITE.name} is an independent price-comparison platform — compare smart-electronics prices across 8+ marketplaces, track price history, and read honest reviews and buying guides. Free, no signup.`,
  alternates: { canonical: '/about' },
};

const pillars = [
  {
    n: '01',
    t: 'Compare in one place',
    d: 'Pull up a product and see what it costs across 8+ marketplaces at once, side by side. No tab-juggling, no guesswork about who has the better deal today.',
  },
  {
    n: '02',
    t: 'Track the price over time',
    d: `Every product has a price history, so you can tell a real drop from a "sale" that isn't. Set an alert and we'll watch it for you, checking daily and flagging the moment the price falls.`,
  },
  {
    n: '03',
    t: 'Cut through the clutter',
    d: 'Buying guides, honest reviews, roundups and how-to articles — the editorial layer that helps you pick the right gadget without wading through marketplace noise.',
  },
];

const coverage = [
  'Smartphones',
  'Smartwatches',
  'Tablets',
  'Laptops',
  'Smart TVs',
  'Cameras',
  'Speakers',
  'Headphones',
  'Smart lights',
  'Smart locks',
  'Video doorbells',
  'Smart plugs',
  'Raspberry Pi',
  'Maker gear',
];

const H2 = 'font-display !text-[clamp(1.7rem,3.2vw,2rem)] font-extrabold leading-[1.1] tracking-[-0.02em] text-ink';
const EYEBROW = 'text-[0.74rem] font-bold uppercase tracking-[0.16em] text-primary';

export default function AboutPage() {
  return (
    <div data-testid="about-page">
      <section className="relative overflow-hidden pb-5 pt-16 sm:pt-[72px]">
        <div aria-hidden className="pointer-events-none absolute -top-40 -right-[150px] z-0 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(0,70,190,0.13),transparent_62%)]" />
        <div className="relative z-[2] mx-auto max-w-[1366px] px-6">
          <span className={EYEBROW}>About</span>
          <h1 className="mt-3.5 font-display font-extrabold leading-[1.04] tracking-[-0.03em] text-ink">
            Never pay full price again.
          </h1>
          <p className="mt-[18px] max-w-[68ch] text-[1.12rem] leading-[1.6] text-ink/55">
            {SITE.name} is an independent price-comparison platform built on a single, simple idea: you
            shouldn&apos;t have to open a dozen tabs to find out where a gadget is actually cheapest. We do the
            comparing so you can skip straight to the buying.
          </p>
        </div>
      </section>

      {/* one place for every price */}
      <section className="mx-auto max-w-[1366px] px-6 py-[54px]">
        <div className="grid items-center gap-[46px] lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className={EYEBROW}>One place for every price</span>
            <h2 className={`mt-2 ${H2}`}>Every marketplace, one product page.</h2>
            <p className="mt-4 text-[1.05rem] leading-[1.7] text-ink/55">
              We track smart electronics and gadgets across the major online marketplaces &mdash; Amazon, eBay,
              Walmart, Newegg, Best Buy, Target, AliExpress and more &mdash; and put every price for a product in one
              place. Compare it side by side, look back at its price history, and buy at the lowest price with
              confidence.
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/about/about-1-intro.svg" alt="Marketplaces converging on one product" className="w-full rounded-[24px]" />
        </div>
      </section>

      {/* what we do */}
      <section className="mx-auto max-w-[1366px] px-6 pb-[54px]">
        <span className={EYEBROW}>What we do</span>
        <h2 className={`mt-2 ${H2}`}>Compare, track, and cut through the noise.</h2>
        <div className="mt-3.5 grid gap-[22px] sm:grid-cols-3">
          {pillars.map((p) => (
            <div key={p.n} className="rounded-2xl border border-ink/10 bg-white p-6 transition hover:-translate-y-1.5 hover:shadow-[0_24px_44px_-26px_rgba(13,27,42,0.4)]">
              <div className="mb-4 grid h-[42px] w-[42px] place-items-center rounded-[11px] bg-primary/10 font-display font-extrabold text-primary">{p.n}</div>
              <h3 className="mb-2 font-display font-semibold text-ink">{p.t}</h3>
              <p className="text-[0.92rem] leading-[1.55] text-ink/55">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* what we cover */}
      <section className="border-y border-ink/10 bg-muted">
        <div className="mx-auto max-w-[1366px] px-6 py-[46px]">
          <span className={EYEBROW}>What we cover</span>
          <h2 className={`mt-2 ${H2}`}>The tech people actually shop around for.</h2>
          <p className="mt-3.5 max-w-[70ch] text-[1.02rem] leading-[1.7] text-ink/55">
            From pocket devices to the living room to the smart home &mdash; and right through to the maker bench.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2.5">
            {coverage.map((c) => (
              <li
                key={c}
                className="rounded-full border border-ink/12 bg-white px-4 py-2 text-[0.9rem] font-semibold text-ink/70"
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* how we're different */}
      <section className="mx-auto max-w-[1366px] px-6 py-[54px]">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <span className={EYEBROW}>How we&apos;re different</span>
            <h2 className={`mt-2 ${H2}`}>Independent, and on your side.</h2>
            <p className="mt-3.5 text-[1.02rem] leading-[1.7] text-ink/55">
              We&apos;re an independent price-comparison platform, not a storefront &mdash; we don&apos;t sell the
              products, we help you find the best place to buy them. That independence is the whole point: our job is
              to be on your side of the transaction. And we keep it genuinely low-friction &mdash; comparing prices,
              checking a product&apos;s history and browsing our guides is <strong>free and needs no signup</strong>.
            </p>
          </div>
          <SplitArt src="/about/about-2-vision.svg" alt="Independent radar comparing prices against a target" />
        </div>
      </section>

      {/* why it matters */}
      <section className="mx-auto max-w-[1366px] px-6 pb-[54px]">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <SplitArt src="/about/about-3-community.svg" alt="Prices swinging across a connected network of marketplaces" className="lg:order-1" />
          <div className="lg:order-2">
            <span className={EYEBROW}>Why it matters</span>
            <h2 className={`mt-2 ${H2}`}>Transparency beats luck and timing.</h2>
            <p className="mt-3.5 text-[1.02rem] leading-[1.7] text-ink/55">
              Prices on the same gadget can swing widely from one marketplace to the next, and from one week to the
              next. Without a way to see it all at once, getting a good deal comes down to luck and timing.{' '}
              {SITE.name} replaces the guesswork with transparency &mdash; real prices, real history, and honest,
              side-by-side comparisons &mdash; so the deal you get is the best one available, not just the first one
              you found.
            </p>
          </div>
        </div>
      </section>

      {/* get in touch CTA */}
      <section className="mx-auto max-w-[1366px] px-6 pb-[54px]">
        <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-14 text-center text-white sm:px-14">
          <div aria-hidden className="pointer-events-none absolute left-1/2 -top-[100px] h-[300px] w-[420px] -translate-x-1/2 bg-[radial-gradient(circle,rgba(0,70,190,0.28),transparent_60%)]" />
          <span className="relative text-[0.74rem] font-bold uppercase tracking-[0.16em] text-primary">Get in touch</span>
          <h2 className="relative mt-2.5 font-display font-extrabold tracking-[-0.02em]">Never pay full price again.</h2>
          <p className="relative mx-auto mt-3.5 max-w-[52ch] text-[1rem] leading-[1.6] text-white/65">
            Questions, feedback, or a product you&apos;d like us to track? We&apos;d love to hear from you.
          </p>
          <div className="relative mt-7 flex flex-wrap justify-center gap-3.5">
            <Link href="/best-deals" className="rounded-[11px] bg-primary px-7 py-3.5 font-display text-[0.95rem] font-bold text-white transition hover:-translate-y-0.5 hover:bg-primary-emphasis">See today&apos;s best deals</Link>
            <Link href="/contact" className="rounded-[11px] border border-white/[0.18] bg-white/[0.08] px-7 py-3.5 font-display text-[0.95rem] font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.16]">Contact us</Link>
          </div>
        </div>
      </section>

      <ValueStrip />
    </div>
  );
}

function SplitArt({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={`w-full rounded-[24px] ${className}`} />
  );
}
