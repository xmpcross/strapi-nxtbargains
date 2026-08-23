import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE } from '@/lib/site';
import { clampDescription } from '@/lib/format';
import ValueStrip from '@/components/ValueStrip';
import ContactForm from '@/components/ContactForm';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: clampDescription(`Get in touch with the ${SITE.name} team — story tips, partnership questions, corrections, or a product you'd like us to track.`),
  alternates: { canonical: '/contact' },
};

const channels = [
  { ic: '✉', t: 'Email', s: 'hello@nxt.bargains', href: 'mailto:hello@nxt.bargains' },
  { ic: '𝕏', t: 'On X', s: '@nxtbargains', href: SITE.social.twitter },
  { ic: 'f', t: 'On Facebook', s: '/nxtbargains', href: SITE.social.facebook },
];


const quickLinks: [string, string][] = [
  ['/', 'Home'],
  ['/sitemap', 'Site map'],
  ['/about', 'About us'],
  ['/best-deals', 'Best deals'],
];

export default function ContactPage() {
  return (
    <main data-testid="contact-page">
      {/* Hero — shared light-gradient page title block (.page-hero) */}
      <section className="page-hero" data-testid="contact-page-header">
        <div className="page-hero-inner">
          <nav className="page-hero-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <span className="page-hero-crumbs-current">Contact</span>
          </nav>

          <div className="mt-7 w-full">
            <p className="page-hero-eyebrow">Contact</p>
            <h1 className="page-hero-title">Get in touch.</h1>
            <p className="page-hero-desc">
              Story tips, partnership enquiries, corrections, or a product you would like us to start tracking
              &mdash; every message reaches a person, and we read all of them. Use the form below and we will
              reply to the address you give us. Pick whichever channel suits you.
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section id="contact-form" className="py-14 sm:py-16">
        <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_0.9fr]">
            {/* form card */}
            <div className="rounded-[20px] border border-ink/10 bg-white p-6 sm:p-[34px]" data-testid="contact-form-card">
              <span className="text-[0.74rem] font-bold uppercase tracking-[0.16em] text-primary">Send a message</span>
              <h2 className="mb-1.5 mt-1.5 font-display font-bold text-ink">Tell us what&apos;s on your mind.</h2>
              <p className="mb-[22px] text-[0.9rem] leading-[1.55] text-ink/55">
                Fill in the form and we&apos;ll get back to you by email, usually within a couple of working
                days. Prefer to write to us directly?{' '}
                <a href="mailto:hello@nxt.bargains" className="font-semibold text-primary hover:underline">hello@nxt.bargains</a>
              </p>
              <ContactForm />
            </div>

            {/* side */}
            <div>
              <div className="mb-4 rounded-2xl border border-ink/10 bg-white p-6">
                <h3 className="mb-2 font-display font-semibold text-ink">Other ways to reach us</h3>
                <p className="mb-3.5 text-[0.9rem] leading-[1.55] text-ink/55">Choose whichever suits — we keep an eye on all of them.</p>
                {channels.map((c, i) => (
                  <a key={c.t} href={c.href} className={`flex items-center gap-3.5 py-3 ${i > 0 ? 'border-t border-ink/10' : ''}`}>
                    <span className="grid h-10 w-10 flex-none place-items-center rounded-[11px] bg-primary/10 font-display text-primary" aria-hidden>{c.ic}</span>
                    <div>
                      <div className="font-display text-[0.92rem] font-semibold text-ink">{c.t}</div>
                      <div className="text-[0.82rem] text-ink/55">{c.s}</div>
                    </div>
                  </a>
                ))}
              </div>
              <div className="rounded-2xl border border-ink/10 bg-white p-6">
                <h3 className="mb-2 font-display font-semibold text-ink">Looking for something specific?</h3>
                <p className="mb-3.5 text-[0.9rem] leading-[1.55] text-ink/55">Browse the full archive or jump to a section.</p>
                <div className="flex flex-wrap gap-2.5">
                  {quickLinks.map(([href, label]) => (
                    <Link key={href} href={href} className="rounded-[9px] border border-ink/10 bg-muted px-[15px] py-2.5 text-[0.85rem] font-semibold text-ink transition hover:border-primary hover:text-primary">{label}</Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ValueStrip />
    </main>
  );
}
