import Link from 'next/link';
import PostContent from '@/components/PostContent';
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

export type PillarPageContent = {
  eyebrow: string;
  title: string;
  deck: string;
  updated: string;
  primaryCta: { href: string; label: string };
  secondaryCta: { href: string; label: string };
  metrics: PillarMetric[];
  signals: PillarSignal[];
  paths: PillarPath[];
  guides: PillarGuide[];
  supportingArticles?: PillarGuide[];
  matrix: PillarMatrixRow[];
  steps: PillarStep[];
  faqs: PillarFaq[];
  bodyHtml?: string;
};

const merchantLogos = [
  { name: 'Amazon', domain: 'amazon.com' },
  { name: 'eBay', domain: 'ebay.com' },
  { name: 'Walmart', domain: 'walmart.com' },
  { name: 'Best Buy', domain: 'bestbuy.com' },
  { name: 'Target', domain: 'target.com' },
  { name: 'Newegg', domain: 'newegg.com' },
];

export default function PillarPageTemplate({ content }: { content: PillarPageContent }) {
  const tocItems = [
    { href: '#start-here', label: 'Start here' },
    { href: '#decision-table', label: 'Decision table' },
    { href: '#core-guides', label: 'Core guides' },
    ...(content.supportingArticles?.length ? [{ href: '#supporting-articles', label: 'Supporting articles' }] : []),
    ...(content.bodyHtml ? [{ href: '#full-guide', label: 'Full guide' }] : []),
    { href: '#buying-playbook', label: 'Buying playbook' },
    { href: '#answers', label: 'Answers' },
  ];

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

      <div className={styles.bodyFrame}>
        <aside className={styles.tocRail} aria-label="Table of contents">
          <nav className={styles.tocCard}>
            <span>Contents</span>
            {tocItems.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className={styles.bodyStack}>
          <section className={styles.section} id="start-here">
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Start here"
            title="Choose the bargain path that matches the job"
            body="A pillar page should route shoppers fast. These paths become the reusable landing blocks for every future NXT Bargains guide."
          />
          <div className={styles.pathGrid}>
            {content.paths.map((path) => (
              <Link className={styles.pathCard} href={path.href} key={path.title}>
                <span>{path.label}</span>
                <h2>{path.title}</h2>
                <p>{path.body}</p>
                <b>Open path</b>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.sectionAlt} id="decision-table">
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Decision table"
            title="What counts as a real bargain?"
            body="The default pillar template includes one scannable table so the page feels like a buying tool, not a long article wall."
          />
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
          <SectionHeader
            eyebrow="Core guides"
            title="Pillar pages should pull readers into the buying system"
            body="These feature cards are reusable slots for child guides, category pages, and high-value comparisons."
          />
          <div className={styles.guideGrid}>
            {content.guides.map((guide) => (
              <Link className={styles.guideCard} href={guide.href} key={guide.title}>
                <span>{guide.meta}</span>
                <h2>{guide.title}</h2>
                <p>{guide.body}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {content.supportingArticles?.length ? (
        <section className={styles.sectionAlt} id="supporting-articles">
          <div className={styles.shell}>
            <SectionHeader
              eyebrow="Supporting articles"
              title="Keep reading around this topic"
              body="These articles are selected automatically from related NXT Bargains posts, with same-category articles shown first."
            />
            <div className={styles.supportingGrid}>
              {content.supportingArticles.map((article) => (
                <Link className={styles.supportingCard} href={article.href} key={article.href}>
                  <ArticleThumb label={article.meta} />
                  <span>{article.meta}</span>
                  <h2>{article.title}</h2>
                  <p>{article.body}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {content.bodyHtml ? (
        <section className={styles.articleSection} id="full-guide">
          <div className={styles.shell}>
            <SectionHeader
              eyebrow="Full guide"
              title="Read the complete pillar guide"
              body="The reusable pillar layout keeps the original article content in a focused reading section below the decision tools."
            />
            <div className={styles.articleBody}>
              <PostContent html={content.bodyHtml} />
            </div>
          </div>
        </section>
      ) : null}

      <section className={styles.playbookSection} id="buying-playbook">
        <div className={styles.shell}>
          <div className={styles.playbookGrid}>
            <div>
              <p className={styles.eyebrow}>Buying playbook</p>
              <h2 className={styles.sectionTitle}>The default method every pillar page can teach</h2>
            </div>
            <div className={styles.steps}>
              {content.steps.map((step, index) => (
                <article className={styles.step} key={step.title}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{step.title}</h3>
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
          <SectionHeader
            eyebrow="Answers"
            title="Questions this pillar should settle"
            body="FAQ blocks stay compact and specific, giving future pillar pages a consistent finish without feeling padded."
          />
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
        </div>
      </div>
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
