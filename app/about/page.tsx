import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'NXT.Bargains is an independent price-comparison platform — compare smart-electronics prices across 8+ marketplaces, track price history, and read honest reviews and guides. Free, no signup.',
  alternates: { canonical: '/about' },
};

const H1 = 'font-display font-bold tracking-tight text-ink !text-[clamp(2rem,4vw,2.6rem)] leading-[1.1]';
const H2 = 'mt-12 font-display font-bold tracking-tight text-ink !text-[1.5rem]';
const P = 'mt-4 text-[1.02rem] leading-[1.75] text-ink/70';

export default function AboutPage() {
  return (
    <div data-testid="about-page" className="mx-auto max-w-[760px] px-6 py-16 sm:py-20">
      <h1 className={H1}>About Us</h1>

      <h2 className={H2}>Never pay full price again</h2>
      <p className={P}>
        {SITE.name} is an independent price-comparison platform built on a single, simple idea: you shouldn&apos;t
        have to open a dozen tabs to find out where a gadget is actually cheapest. We do the comparing so you can skip
        straight to the buying.
      </p>
      <p className={P}>
        We track smart electronics and gadgets across the major online marketplaces &mdash; Amazon, eBay, Walmart,
        Newegg, Best Buy, Target, AliExpress, and more &mdash; and put every price for a product in one place. Compare
        it side by side, look back at its price history, and buy at the lowest price with confidence.
      </p>

      <h2 className={H2}>What we do</h2>
      <p className={P}>We bring three things together so you don&apos;t have to hunt for them separately.</p>
      <p className={P}>
        <strong className="font-semibold text-ink">Compare in one place.</strong> Pull up a product and see what it
        costs across 8+ marketplaces at once, side by side. No tab-juggling, no guesswork about who has the better
        deal today.
      </p>
      <p className={P}>
        <strong className="font-semibold text-ink">Track the price over time.</strong> Every product has a price
        history, so you can tell the difference between a real drop and a &ldquo;sale&rdquo; that isn&apos;t. Set an
        alert and we&apos;ll watch it for you, checking daily and letting you know the moment the price falls.
      </p>
      <p className={P}>
        <strong className="font-semibold text-ink">Cut through the clutter.</strong> Alongside the prices, we publish
        buying guides, honest reviews, roundups, and how-to articles &mdash; the editorial layer that helps you pick
        the right gadget without wading through marketplace noise.
      </p>

      <h2 className={H2}>What we cover</h2>
      <p className={P}>
        We focus on the tech people actually shop around for: smartphones, smartwatches, tablets, laptops, and smart
        TVs; cameras, speakers, and headphones; and the growing world of smart-home devices &mdash; lights, locks,
        doorbells, and plugs &mdash; right through to Raspberry Pi and the maker gear built around it.
      </p>

      <h2 className={H2}>How we&apos;re different</h2>
      <p className={P}>
        We&apos;re an <strong className="font-semibold text-ink">independent</strong> price-comparison platform, not a
        storefront. We don&apos;t sell the products; we help you find the best place to buy them. That independence is
        the whole point &mdash; our job is to be on your side of the transaction.
      </p>
      <p className={P}>
        We also keep it genuinely low-friction. Comparing prices, checking a product&apos;s history, and browsing our
        guides is <strong className="font-semibold text-ink">free and requires no signup</strong>. You get the
        information you came for without handing over an account first.
      </p>

      <h2 className={H2}>Why it matters</h2>
      <p className={P}>
        Prices on the same gadget can swing widely from one marketplace to the next, and from one week to the next.
        Without a way to see all of it at once, &ldquo;getting a good deal&rdquo; comes down to luck and timing.{' '}
        {SITE.name} replaces the guesswork with transparency: real prices, real history, and honest, side-by-side
        comparisons &mdash; so the deal you get is the best one available, not just the first one you found.
      </p>
      <p className={P}>
        That&apos;s the promise behind everything we build:{' '}
        <strong className="font-semibold text-ink">never pay full price again.</strong>
      </p>

      <h2 className={H2}>Get in touch</h2>
      <p className={P}>
        Questions, feedback, or a product you&apos;d like us to track? Reach us through our{' '}
        <Link href="/contact" className="font-semibold text-primary underline-offset-2 hover:underline">
          contact page
        </Link>
        .
      </p>

      <p className="mt-12 border-t border-ink/10 pt-6 text-sm italic text-ink/45">
        &copy; 2026 {SITE.name} &mdash; Independent price comparison.
      </p>
    </div>
  );
}
