import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE } from '@/lib/site';
import ValueStrip from '@/components/ValueStrip';

export const metadata: Metadata = {
  title: 'About Us',
  description: `${SITE.name} compares smart-electronics prices across top retailers, tracks price drops and coupons, and pairs it with honest reviews and buying guides — so you buy the right gadget at the right price.`,
  alternates: { canonical: '/about' },
};

const pillars = [
  { n: '01', t: 'Every price, side by side', d: 'We pull live offers from the retailers that matter and line them up, so the lowest price — and the smartest moment to buy — is obvious at a glance.' },
  { n: '02', t: 'Reviews you can trust', d: 'Hands-on comparisons, roundups and honest reviews written to help you choose the right product — not to chase a sale. No hype, no filler.' },
  { n: '03', t: 'Deals that find you', d: 'Price-drop tracking, coupons and weekly bargains surface the savings automatically, so you never overpay for the gadget you actually want.' },
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
            Smart electronics, the smart way to buy them.
          </h1>
          <p className="mt-[18px] max-w-[68ch] text-[1.12rem] leading-[1.6] text-ink/55">
            {SITE.name} brings every price, review and buying guide into one place — so you spend less time juggling
            retailer tabs and more time enjoying tech that&apos;s genuinely worth it.
          </p>
        </div>
      </section>

      {/* who we are */}
      <section className="mx-auto max-w-[1366px] px-6 py-[54px]">
        <div className="grid items-center gap-[46px] lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className={EYEBROW}>Who we are</span>
            <h2 className={`mt-2 ${H2}`}>One place to compare, decide, and save.</h2>
            <p className="mt-4 text-[1.05rem] leading-[1.7] text-ink/55">
              We&apos;re a team of tech enthusiasts and deal-hunters who got tired of juggling a dozen retailer tabs.
              So we built a single home for side-by-side price comparisons across Amazon, eBay, Walmart, Best Buy and
              more — backed by honest reviews and clear guides that cut through the spec-sheet noise.
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/about/about-1-intro.svg" alt="Marketplaces converging on one product" className="w-full rounded-[24px]" />
        </div>
      </section>

      {/* mission */}
      <section className="mx-auto max-w-[1366px] px-6 pb-[54px]">
        <span className={EYEBROW}>Our mission</span>
        <h2 className={`mt-2 ${H2}`}>Compare. Review. Save.</h2>
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

      {/* vision */}
      <section className="mx-auto max-w-[1366px] px-6 pb-[54px]">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <span className={EYEBROW}>Our vision</span>
            <h2 className={`mt-2 ${H2}`}>Shopping for tech shouldn&apos;t be a chore.</h2>
            <p className="mt-3.5 text-[1.02rem] leading-[1.7] text-ink/55">
              We picture a future where anyone can make a purchase fully informed — knowing exactly what to buy, where
              it&apos;s cheapest, and the right moment to click. We&apos;re building toward being the go-to companion
              for every smart-electronics shopper.
            </p>
          </div>
          <SplitArt src="/about/about-2-vision.svg" alt="Future vision radar and price target" />
        </div>
      </section>

      {/* community */}
      <section className="mx-auto max-w-[1366px] px-6 pb-[54px]">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <SplitArt src="/about/about-3-community.svg" alt="Connected community network" className="lg:order-1" />
          <div className="lg:order-2">
            <span className={EYEBROW}>The community</span>
            <h2 className={`mt-2 ${H2}`}>More than a tool — a community.</h2>
            <p className="mt-3.5 text-[1.02rem] leading-[1.7] text-ink/55">
              Your feedback shapes what we compare and cover next. Request a comparison, ask a question, or flag a deal
              you spotted in the wild. Whether you&apos;re a seasoned enthusiast or buying your first smart device,
              there&apos;s a place for you here.
            </p>
          </div>
        </div>
      </section>

      {/* thank you CTA */}
      <section className="mx-auto max-w-[1366px] px-6 pb-[54px]">
        <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-14 text-center text-white sm:px-14">
          <div aria-hidden className="pointer-events-none absolute left-1/2 -top-[100px] h-[300px] w-[420px] -translate-x-1/2 bg-[radial-gradient(circle,rgba(0,70,190,0.28),transparent_60%)]" />
          <span className="relative text-[0.74rem] font-bold uppercase tracking-[0.16em] text-primary">Thank you</span>
          <h2 className="relative mt-2.5 font-display font-extrabold tracking-[-0.02em]">Find your next bargain.</h2>
          <div className="relative mt-7 flex flex-wrap justify-center gap-3.5">
            <Link href="/best-deals" className="rounded-[11px] bg-primary px-7 py-3.5 font-display text-[0.95rem] font-bold text-white transition hover:-translate-y-0.5 hover:bg-primary-emphasis">See today&apos;s best deals</Link>
            <Link href="/product-comparisons" className="rounded-[11px] border border-white/[0.18] bg-white/[0.08] px-7 py-3.5 font-display text-[0.95rem] font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.16]">Compare products</Link>
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
