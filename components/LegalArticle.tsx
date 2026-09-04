import Link from 'next/link';
import { format, parseISO } from 'date-fns';

const NAV: { key: 'notice' | 'terms' | 'privacy' | 'cookies'; label: string; href: string }[] = [
  { key: 'notice',  label: 'Legal Notice',         href: '/legal/notice' },
  { key: 'terms',   label: 'Terms and Conditions', href: '/legal/terms' },
  { key: 'privacy', label: 'Privacy Policy',       href: '/legal/privacy' },
  { key: 'cookies', label: 'Cookie Policy',        href: '/legal/cookies' },
];

export type LegalKey = (typeof NAV)[number]['key'];

export default function LegalArticle({
  pageKey,
  title,
  modified,
  children,
}: {
  pageKey: LegalKey;
  title: string;
  /** ISO date, e.g. "2026-05-02" */
  modified: string;
  children: React.ReactNode;
}) {
  let modifiedLabel = '';
  try { modifiedLabel = format(parseISO(modified), 'MMM d, yyyy'); } catch { /* ignore */ }

  return (
    <div data-testid={`legal-${pageKey}`}>
      <section className="bg-paper">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Legal</p>
          <h1 className="mt-4 font-display font-bold leading-tight tracking-tight text-ink">
            {title}
          </h1>
          {modifiedLabel && (
            <p className="mt-3 text-sm text-ink/55">Last updated {modifiedLabel}</p>
          )}

          {/* Operator attribution — present on every legal page */}
          <p className="mt-5 max-w-3xl text-sm leading-6 text-ink/70" data-testid="operator-attribution">
            This website, <a href="https://www.nxt.bargains" className="font-medium text-ink hover:text-primary">www.nxt.bargains</a>, is owned and operated by{' '}
            <strong className="text-ink">FXN Holdings</strong>, a registered business in Australia.
          </p>

          <nav className="mt-6 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wider" aria-label="Legal pages">
            {NAV.map((n) => {
              const active = n.key === pageKey;
              return (
                <Link
                  key={n.key}
                  href={n.href}
                  className={
                    active
                      ? 'rounded-full bg-primary px-4 py-2 text-white'
                      : 'rounded-full border border-ink/15 px-4 py-2 text-ink transition hover:border-primary hover:text-primary'
                  }
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </section>

      <section className="bg-white py-12">
        <article className="mx-auto max-w-7xl px-6">
          <div
            className="legal-content space-y-5 text-base leading-7 text-ink/80
                       [&_h3]:mt-10 [&_h3]:mb-3 [&_h3]:font-display [&_h3]:font-bold [&_h3]:text-ink
                       [&_h4]:mt-6  [&_h4]:mb-2 [&_h4]:font-display [&_h4]:font-bold [&_h4]:text-ink
                       [&_p]:my-3
                       [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1
                       [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1
                       [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline
                       [&_strong]:text-ink"
          >
            {children}
          </div>
        </article>
      </section>
    </div>
  );
}
