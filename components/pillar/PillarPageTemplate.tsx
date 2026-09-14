import Link from 'next/link';
import styles from './PillarPageTemplate.module.css';

type PillarMetric = {
  label: string;
  value: string;
  detail: string;
};

type PillarPath = {
  label: string;
  title: string;
  body: string;
  href: string;
};

type PillarSignal = {
  label: string;
  value: string;
  tone?: 'hot' | 'good' | 'neutral';
};

type PillarGuide = {
  title: string;
  body: string;
  href: string;
  meta: string;
};

type PillarMatrixRow = {
  need: string;
  watch: string;
  bestRoute: string;
};

type PillarStep = {
  title: string;
  body: string;
};

type PillarFaq = {
  question: string;
  answer: string;
};

/**
 * The heading and standfirst for one section of the page.
 *
 * These used to be string literals in the JSX, which meant every pillar
 * shared them. That was visible: /coupon-codes and /best-deals-and-bargains
 * rendered the same six headings, and the headings described the template
 * rather than the topic — readers were told that "pillar pages should pull
 * readers into the buying system". Section copy is content, so it lives with
 * the rest of the content and each pillar can write its own.
 */
type PillarSectionCopy = {
  eyebrow: string;
  title: string;
  body: string;
};

export type PillarSections = {
  startHere: PillarSectionCopy;
  supporting: PillarSectionCopy;
  decision: PillarSectionCopy;
  guides: PillarSectionCopy;
  playbook: { eyebrow: string; title: string };
  faqs: PillarSectionCopy;
};

export type PillarPageContent = {
  eyebrow: string;
  title: string;
  deck: string;
  updated: string;
  primaryCta: { href: string; label: string };
  secondaryCta: { href: string; label: string };
  sections: PillarSections;
  metrics: PillarMetric[];
  signals: PillarSignal[];
  paths: PillarPath[];
  guides: PillarGuide[];
  supportingArticles?: PillarGuide[];
  matrix: PillarMatrixRow[];
  steps: PillarStep[];
  faqs: PillarFaq[];
};

const merchantLogos = [
  { name: 'Amazon', domain: 'amazon.com' },
  { name: 'eBay', domain: 'ebay.com' },
  { name: 'Walmart', domain: 'walmart.com' },
  { name: 'Best Buy', domain: 'bestbuy.com' },
  { name: 'Target', domain: 'target.com' },
  { name: 'Newegg', domain: 'newegg.com' },
];

/**
 * The pillar page as a hub, not an article.
 *
 * These pages no longer carry a body: the prose lives in the cluster, and the
 * pillar's job is to say what the topic covers and route the reader into it.
 * Three things follow from that, and they are the whole redesign:
 *
 *   The full-guide section is gone. It rendered `bodyHtml` and there is none.
 *
 *   The contents rail is gone with it. A sticky table of contents earns its
 *     column against a long article; against six short sections it was
 *     furniture, and it cost every section a third of the page width.
 *
 *   Supporting articles move up, directly under the paths. On a hub the
 *     cluster is the destination, not an afterthought below the reading
 *     material — it was the seventh of eight blocks and is now the third.
 */
export default function PillarPageTemplate({ content }: { content: PillarPageContent }) {
  return (
    <main className={styles.pillar} data-testid="pillar-page">
      <section className={styles.hero}>
        <div className={styles.shell}>
          <nav className={styles.crumbs} aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <span>{content.eyebrow}</span>
          </nav>

          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>{content.eyebrow}</p>
              <h1 className={styles.heroTitle}>{content.title}</h1>
              <p className={styles.deck}>{content.deck}</p>
              <div className={styles.heroActions}>
                <Link className={styles.primaryButton} href={content.primaryCta.href}>
                  {content.primaryCta.label}
                </Link>
                <Link className={styles.secondaryButton} href={content.secondaryCta.href}>
                  {content.secondaryCta.label}
                </Link>
              </div>
              <p className={styles.updated}>Updated {content.updated}</p>
            </div>

            <HeroVisuals signals={content.signals} />
          </div>
        </div>
      </section>

      <section className={styles.metricBand} aria-label="Pillar summary">
        <div className={styles.metricGrid}>
          {content.metrics.map((metric) => (
            <div className={styles.metric} key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <p>{metric.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} id="start-here">
        <div className={styles.shell}>
          <SectionHeader {...content.sections.startHere} />
          <div className={styles.pathGrid}>
            {content.paths.map((path) => (
              <Link className={styles.pathCard} href={path.href} key={path.title}>
                <span>{path.label}</span>
                <h3>{path.title}</h3>
                <p>{path.body}</p>
                <b>Open path</b>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {content.supportingArticles?.length ? (
        <section className={styles.sectionAlt} id="supporting-articles">
          <div className={styles.shell}>
            <SectionHeader {...content.sections.supporting} />
            <div className={styles.supportingGrid}>
              {content.supportingArticles.map((article) => (
                <Link className={styles.supportingCard} href={article.href} key={article.href}>
                  <ArticleThumb label={article.meta} />
                  <span>{article.meta}</span>
                  <h3>{article.title}</h3>
                  <p>{article.body}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className={styles.sectionAlt} id="decision-table">
        <div className={styles.shell}>
          <SectionHeader {...content.sections.decision} />
          <SavingsMeter />
          <div className={styles.matrix}>
            <div className={styles.matrixHead}>
              <span>Shopper need</span>
              <span>Check before buying</span>
              <span>Best route</span>
            </div>
            {content.matrix.map((row) => (
              <div className={styles.matrixRow} key={row.need}>
                <strong>{row.need}</strong>
                <span>{row.watch}</span>
                <b>{row.bestRoute}</b>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} id="core-guides">
        <div className={styles.shell}>
          <SectionHeader {...content.sections.guides} />
          <div className={styles.guideGrid}>
            {content.guides.map((guide) => (
              <Link className={styles.guideCard} href={guide.href} key={guide.title}>
                <span>{guide.meta}</span>
                <h3>{guide.title}</h3>
                <p>{guide.body}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.playbookSection} id="buying-playbook">
        <div className={styles.shell}>
          <div className={styles.playbookGrid}>
            <div>
              <p className={styles.eyebrow}>{content.sections.playbook.eyebrow}</p>
              <h2 className={styles.sectionTitle}>{content.sections.playbook.title}</h2>
            </div>
            <div className={styles.steps}>
              {content.steps.map((step, index) => (
                <article className={styles.step} key={step.title}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h4>{step.title}</h4>
                    <p>{step.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="answers">
        <div className={styles.shell}>
          <SectionHeader {...content.sections.faqs} />
          <div className={styles.faqGrid}>
            {content.faqs.map((faq) => (
              <details className={styles.faq} key={faq.question}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function HeroVisuals({ signals }: { signals: PillarSignal[] }) {
  return (
    <div className={styles.heroVisuals}>
      <DealMap signals={signals} />
      <DealReceipt />
    </div>
  );
}

function DealReceipt() {
  return (
    <aside className={styles.receiptGraphic} aria-label="Deal check receipt">
      <div className={styles.receiptHeader}>
        <span>Offer check</span>
        <strong>PASS</strong>
      </div>
      <div className={styles.receiptRows}>
        <span>List price</span>
        <b>$129.00</b>
        <span>Current deal</span>
        <b>$84.99</b>
        <span>Coupon stack</span>
        <b>-$10.00</b>
      </div>
      <div className={styles.receiptTotal}>
        <span>Smart buy</span>
        <strong>$74.99</strong>
      </div>
    </aside>
  );
}

function SavingsMeter() {
  return (
    <div className={styles.savingsMeter} aria-label="Savings quality meter">
      <div>
        <span>Visual deal check</span>
        <strong>Price, proof, timing</strong>
      </div>
      <div className={styles.meterTrack} aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <p>Use the table below to check whether a deal is cheap, trustworthy, and worth buying now.</p>
    </div>
  );
}

function ArticleThumb({ label }: { label: string }) {
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('') || 'NX';

  return (
    <div className={styles.articleThumb} aria-hidden>
      <span>{initials}</span>
      <i />
      <b />
    </div>
  );
}

function DealMap({ signals }: { signals: PillarSignal[] }) {
  return (
    <aside className={styles.dealMap} aria-label="Deal map preview">
      <div className={styles.ticketTop}>
        <span>Deal map</span>
        <b>NXT.BARGAINS</b>
      </div>
      <div className={styles.signalStack}>
        {signals.map((signal) => (
          <div className={`${styles.signal} ${signal.tone ? styles[signal.tone] : ''}`} key={signal.label}>
            <span>{signal.label}</span>
            <strong>{signal.value}</strong>
          </div>
        ))}
      </div>
      <div className={styles.routeLine} aria-hidden>
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className={styles.logoStrip} aria-label="Compared marketplaces">
        {merchantLogos.map((merchant) => (
          <img
            key={merchant.name}
            src={`https://www.google.com/s2/favicons?domain=${merchant.domain}&sz=128`}
            alt={`${merchant.name} logo`}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ))}
      </div>
    </aside>
  );
}

function SectionHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className={styles.sectionHeader}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <p>{body}</p>
    </div>
  );
}
