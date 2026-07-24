import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE } from '@/lib/site';
import ValueStrip from '@/components/ValueStrip';
import ContactForm from '@/components/ContactForm';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: `Get in touch with the ${SITE.name} team — story tips, partnership questions, corrections, or a product you'd like us to track.`,
  alternates: { canonical: '/contact' },
};

const channels = [
  { ic: '✉', t: 'Email', s: 'hello@nxt.bargains', href: 'mailto:hello@nxt.bargains' },
  { ic: '𝕏', t: 'On X', s: '@nxtbargains', href: SITE.social.twitter },
  { ic: 'f', t: 'On Facebook', s: '/nxtbargains', href: SITE.social.facebook },
];

const checklist = [
  'Suggest a product you’d like us to track.',
  'Report a broken link, wrong price, or correction.',
  'Story tips and partnership questions welcome.',
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
      {/* Hero — dark "At a glance" layout (matches /sitemap) */}
      <section className="relative overflow-hidden border-b border-ink/10 bg-[#1d252c] text-white" data-testid="contact-page-header">
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
            <span className="text-[#ffe000]">Contact</span>
          </nav>

          <div className="mt-8 w-full">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ffe000]">Contact</p>
              <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
                Get in touch.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
                Story tips, partnership questions, corrections, or a product you&apos;d like us to track — we read
                everything that comes through. Pick the channel that fits.
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
                <a href="#contact-form" className="inline-flex bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary-emphasis">
                  Send a message
                </a>
                <a href="mailto:hello@nxt.bargains" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white/80 transition hover:border-white/40 hover:text-white">
                  Email us
                </a>
                <Link href="/sitemap" className="inline-flex border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white/75 transition hover:border-white/40 hover:text-white">
                  Site map
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section id="contact-form" className="py-14 sm:py-16">
        <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_0.9fr]">
            {/* form card */}
            <div className="rounded-[20px] border border-ink/10 bg-white p-6 shadow-[0_30px_70px_-42px_rgba(13,27,42,0.4)] sm:p-[34px]" data-testid="contact-form-card">
              <span className="text-[0.74rem] font-bold uppercase tracking-[0.16em] text-primary">Send a message</span>
              <h2 className="mb-1.5 mt-1.5 font-display font-bold text-ink">Tell us what&apos;s on your mind.</h2>
              <p className="mb-[22px] text-[0.9rem] leading-[1.55] text-ink/55">
                Fill in the form and we&apos;ll get back to you. Submitting opens your default email client with the
                message pre-filled — no data is sent to a server. Prefer email?{' '}
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
