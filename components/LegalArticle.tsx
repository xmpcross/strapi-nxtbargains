import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';

const NAV: { key: 'affiliate-disclosure' | 'terms' | 'privacy' | 'cookies'; label: string; href: string }[] = [
  { key: 'affiliate-disclosure', label: 'Affiliate Disclosure', href: '/legal/affiliate-disclosure' },
  { key: 'terms',                label: 'Terms and Conditions', href: '/legal/terms' },
  { key: 'privacy',              label: 'Privacy Policy',       href: '/legal/privacy' },
  { key: 'cookies',              label: 'Cookie Policy',        href: '/legal/cookies' },
];

export type LegalKey = (typeof NAV)[number]['key'];

/**
 * Section headings for the contents rail, taken from the page's own <h3>s.
 *
 * These pages pass their body as JSX children, not as an HTML string, so the
 * headings are found by walking the element tree rather than parsing markup.
 * Doing it here keeps the rail server-rendered — a client-side pass over the
 * DOM would leave the contents missing from the HTML, which on a legal page is
 * the one place a crawler most wants the structure.
 *
 * Both jobs happen in one walk: the heading is recorded, and the element is
 * cloned with the id its link points at. Anything already carrying an id keeps
 * it, so a hand-written anchor elsewhere on the site keeps resolving.
 */
function slugify(text: string, used: Set<string>) {
  const base = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
  let slug = base;
  let n = 2;
  while (used.has(slug)) slug = `${base}-${n++}`;
  used.add(slug);
  return slug;
}

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}

type Section = { id: string; label: string };

function collectSections(children: ReactNode, used: Set<string>, out: Section[]): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const element = child as ReactElement<{ children?: ReactNode; id?: string }>;

    if (element.type === 'h3') {
      const label = textOf(element.props.children).trim();
      if (!label) return element;
      const id = element.props.id ?? slugify(label, used);
      out.push({ id, label });
      return cloneElement(element, { id });
    }

    if (element.props?.children) {
      return cloneElement(element, {
        children: collectSections(element.props.children, used, out),
      });
    }
    return element;
  });
}



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

  const sections: Section[] = [];
  const body = collectSections(children, new Set<string>(), sections);

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
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[minmax(0,232px)_minmax(0,1fr)]">
          {/* Contents rail. Sticky on the grid item itself with align-self:start
              — the grid stretches its items to full height by default, which
              would leave a sticky child no room to travel and it would simply
              never move. Hidden below lg, where a full-width rail above the
              text pushes the document itself off the first screen. */}
          {sections.length > 2 ? (
            <nav
              className="hidden self-start lg:block lg:sticky lg:top-28"
              aria-labelledby="legal-toc-heading"
              data-testid="legal-toc"
            >
              <p
                id="legal-toc-heading"
                className="mb-3 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ink/45"
              >
                On this page
              </p>
              <ol className="space-y-1 border-l border-ink/10">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-[0.8125rem] leading-snug text-ink/65 transition hover:border-primary hover:text-primary"
                    >
                      {section.label}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : (
            <div className="hidden lg:block" aria-hidden="true" />
          )}

          <article className="min-w-0">
          <div
            className="legal-content space-y-5 text-base leading-7 text-ink/80
                       [&_h3]:scroll-mt-28
                       [&_h3]:mt-10 [&_h3]:mb-3 [&_h3]:font-display [&_h3]:font-bold [&_h3]:text-ink
                       [&_h4]:mt-6  [&_h4]:mb-2 [&_h4]:font-display [&_h4]:font-bold [&_h4]:text-ink
                       [&_p]:my-3
                       [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1
                       [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1
                       [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline
                       [&_strong]:text-ink"
          >
            {body}
          </div>
          </article>
        </div>
      </section>
    </div>
  );
}
