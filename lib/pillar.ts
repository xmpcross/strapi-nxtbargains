import { type PillarPageContent, type PillarSections } from '@/components/pillar/PillarPageTemplate';
import { type NxtPost } from '@/lib/strapi';
import { SECTIONS } from '@/lib/site';
import { clampDescription, postPath, stripHtml } from '@/lib/format';

/**
 * The pillar pages, and how each one selects its supporting cluster.
 *
 * Cluster membership is deliberately NOT the post's category. Category answers
 * "what shelf does this sit on" — it put five buying-guides under this pillar
 * whether or not they were about finding deals, and excluded a how-to guide on
 * spotting fake reviews that belongs here on subject. A pillar's cluster is an
 * editorial claim about topic, so it is stated as one.
 *
 * Two mechanisms, in priority order:
 *
 *   supportingSlugs   — hand-picked, always first and in the order given. Use
 *                       this when a specific article must appear.
 *   supportingKeywords — matched against the post's seoKeywords field, which
 *                       is the only tag-like field the CMS has (set on 44 of
 *                       90 posts) and is editable per post in Strapi. Title
 *                       and excerpt are searched too, so a post with no
 *                       keywords set can still qualify on subject.
 *
 * Adding a post to a cluster is therefore a CMS edit (add the keyword) rather
 * than a deploy, which is the point.
 */
type PillarConfig = {
  path: string;
  supportingSlugs?: string[];
  supportingKeywords?: string[];
  /* Section headings and copy written for this pillar's topic. Anything left
     unset falls back to the defaults further down. */
  copy?: PillarCopy;
};

const PILLAR_PAGES: Record<string, PillarConfig> = {
  'best-deals-and-bargains-guide': {
    path: '/best-deals-and-bargains',
    /* One tag, and nothing else.
       
       No hand-picked slugs: membership is entirely editorial and lives in the
       CMS. To put an article in this cluster, add "best deals and bargains" to
       its SEO Keywords field in Strapi; remove it to take the article out. The
       cluster updates on the next revalidate, with no deploy.
       
       The cluster is empty until posts carry the tag, which is the intended
       behaviour — an untagged cluster showing nothing is honest, and better
       than one padded with articles that were never chosen for it. */
    supportingKeywords: ['best deals and bargains'],

    /* Headings written for this topic. The rest of the page — metrics, paths,
       table, playbook, answers — is the shared default, because the defaults
       were written for exactly this subject and restating them here would
       only create two copies to keep in step. */
    copy: {
      sections: {
        startHere: {
          eyebrow: 'Start here',
          title: 'Four ways into a bargain, depending on what you already know',
          body: 'A deal is easy to find and hard to judge. Pick the route that matches how far you have narrowed the decision: a category and a budget, one specific model, a retailer you are already tied to, or a price you are waiting out.',
        },
        supporting: {
          eyebrow: 'Supporting articles',
          title: 'Go deeper on one part of deal hunting',
          body: 'Longer guides on the individual skills this page only summarises — reading reviews honestly, using deal communities, and timing a purchase around a sale.',
        },
        decision: {
          eyebrow: 'Decision table',
          title: 'What counts as a real bargain?',
          body: 'Every listing claims a saving. These rows are what separates a discount that holds up from one that only looks like it does.',
        },
        guides: {
          eyebrow: 'Core routes',
          title: 'Where to go once you know what you are buying',
          body: 'Deals, product comparisons, and store pages answer different questions. This is which one to open, and when.',
        },
        playbook: {
          eyebrow: 'Buying playbook',
          title: 'Four checks before you pay',
        },
        faqs: {
          eyebrow: 'Answers',
          title: 'Questions worth settling before you buy',
          body: 'The recurring ones: whether the discount is honest, whether the seller is, and whether waiting would pay.',
        },
      },
    },
  },

  'coupon-codes-101-best-deals-and-bargains': {
    path: '/coupon-codes',
    /* This post carries no category at all, which is why its own URL was
       /uncategorized/coupon-codes-101-... — a pillar cannot sit there. */
    supportingSlugs: [
      'best-deals-and-bargains-guide',
      'how-deal-hunting-communities-work',
      'ultimate-guide-reading-product-reviews-spot-fake-reviews',
    ],
    supportingKeywords: [
      'coupon codes', 'promo code', 'cashback', 'discount code', 'voucher',
      'price tracking', 'when to buy', 'black friday', 'prime day',
    ],
  },
};

const PILLAR_PATHS_BY_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(PILLAR_PAGES).map(([slug, config]) => [slug, config.path]),
);

export function categoryName(slug?: string): string {
  if (!slug) return '';
  return SECTIONS.find((s) => s.slug === slug)?.title ?? slug.replace(/-/g, ' ');
}

export function recentPostDate(iso?: string): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

export function isPillarPost(post: Pick<NxtPost, 'slug'>): boolean {
  return Boolean(PILLAR_PATHS_BY_SLUG[post.slug]);
}

export function pillarPathForPost(post: Pick<NxtPost, 'slug'>): string | null {
  return PILLAR_PATHS_BY_SLUG[post.slug] ?? null;
}

/**
 * Copy a pillar can override.
 *
 * Everything here has a default below. A pillar sets only the parts where its
 * topic actually differs, so adding a third pillar does not mean restating the
 * whole page — and so the parts a pillar has NOT written are visibly the
 * defaults rather than silently wrong topic copy.
 */
type PillarCopy = Partial<
  Pick<
    PillarPageContent,
    | 'sections'
    | 'metrics'
    | 'signals'
    | 'paths'
    | 'guides'
    | 'matrix'
    | 'steps'
    | 'faqs'
    | 'primaryCta'
    | 'secondaryCta'
  >
>;

/**
 * Defaults: true of any buying guide on this site, and of no topic in
 * particular.
 *
 * They describe the routes the site actually has rather than the page they
 * sit on. The previous defaults described the template to the reader — "the
 * default pillar template includes one scannable table", "FAQ blocks stay
 * compact and specific" — which was design-brief text shipped as content.
 */
const DEFAULT_SECTIONS: PillarSections = {
  startHere: {
    eyebrow: 'Start here',
    title: 'Pick the route that matches what you already know',
    body: 'Four ways into the same question. Choose by how far you have already narrowed it down — a category, a specific model, a retailer, or a price you are waiting on.',
  },
  supporting: {
    eyebrow: 'Supporting articles',
    title: 'Guides that go deeper on one part of this',
    body: 'Longer reads on the individual skills this page only summarises.',
  },
  decision: {
    eyebrow: 'Decision table',
    title: 'What counts as a real bargain?',
    body: 'A discount is a claim about a price, not a fact about value. These are the checks that decide whether the claim holds.',
  },
  guides: {
    eyebrow: 'Core routes',
    title: 'Where to go once you know what you are buying',
    body: 'Deals, product comparisons, and store pages answer different questions. This is which one to open.',
  },
  playbook: {
    eyebrow: 'Buying playbook',
    title: 'Four checks before you pay',
  },
  faqs: {
    eyebrow: 'Answers',
    title: 'Common questions about deal hunting',
    body: 'Short answers to the questions that decide whether a discount is worth acting on.',
  },
};

const DEFAULT_METRICS: PillarPageContent['metrics'] = [
  {
    label: 'Compare across',
    value: '6 retailers',
    detail: 'Amazon, eBay, Walmart, Best Buy, Target and Newegg — the stores whose offers appear on product pages here.',
  },
  {
    label: 'Best moment',
    value: 'Before checkout',
    detail: 'Shipping, coupons, and return terms all move the final number after the headline price.',
  },
  {
    label: 'Biggest trap',
    value: 'The "was" price',
    detail: 'A percentage off is only as honest as the list price it is measured against.',
  },
  {
    label: 'Use this for',
    value: 'One decision',
    detail: 'Whether the offer in front of you is worth taking now, or worth waiting on.',
  },
];

const DEFAULT_SIGNALS: PillarPageContent['signals'] = [
  { label: 'First move', value: 'Compare', tone: 'neutral' },
  { label: 'Best tactic', value: 'Stack savings', tone: 'good' },
  { label: 'Watch for', value: 'Inflated list price', tone: 'hot' },
];

const DEFAULT_PATHS: PillarPageContent['paths'] = [
  {
    label: 'Path A',
    title: 'Browse what is discounted now',
    body: 'Current offers from retailer deal feeds, filtered to the categories this site covers.',
    href: '/best-deals',
  },
  {
    label: 'Path B',
    title: 'Compare one product across sellers',
    body: 'Open a product page to see the offers held for it from each retailer, side by side.',
    href: '/all-products',
  },
  {
    label: 'Path C',
    title: 'Find a code or cashback route',
    body: 'Store codes and offers that can beat the visible sale price, listed by retailer.',
    href: '/coupons',
  },
  {
    label: 'Path D',
    title: 'See what has actually fallen',
    body: 'Recent price movement, so a routine markdown can be told apart from a genuine low.',
    href: '/price-drops',
  },
];

const DEFAULT_GUIDES: PillarPageContent['guides'] = [
  {
    meta: 'Start from the discount',
    title: 'Current deals',
    body: 'Best when you have a budget and a category in mind but not a specific model.',
    href: '/best-deals',
  },
  {
    meta: 'Start from the product',
    title: 'Product comparisons',
    body: 'Best when you know the model and need the cheapest seller you would actually buy from.',
    href: '/all-products',
  },
  {
    meta: 'Start from the retailer',
    title: 'Stores and marketplaces',
    body: 'Best when a gift card, membership, or return policy already ties you to one store.',
    href: '/stores',
  },
];

const DEFAULT_MATRIX: PillarPageContent['matrix'] = [
  {
    need: 'The lowest price today',
    watch: 'Shipping, taxes, and seller reputation on marketplace listings',
    bestRoute: 'Current deals, then the product page',
  },
  {
    need: 'One specific model',
    watch: 'Condition — new, open-box, or refurbished — and who honours the warranty',
    bestRoute: 'Product page, then the store page',
  },
  {
    need: 'A coupon-led saving',
    watch: 'Minimum spend, category exclusions, and the expiry date',
    bestRoute: 'Coupons, then the store page',
  },
  {
    need: 'To know whether to wait',
    watch: 'Whether this price has been seen before, and how recently',
    bestRoute: 'Price drops, then the product page',
  },
];

const DEFAULT_STEPS: PillarPageContent['steps'] = [
  {
    title: 'Price the whole order',
    body: 'Add shipping, taxes, and any required fees before judging the discount. An offer that arrives with paid delivery can lose to a higher price that ships free.',
  },
  {
    title: 'Check what the discount is measured against',
    body: 'The percentage is calculated from a list price the seller chose. Compare it against what other retailers charge today, not against the strikethrough.',
  },
  {
    title: 'Check the seller, not just the store',
    body: 'On Amazon, eBay, and Walmart the listing may belong to a third-party seller. Returns, warranty, and delivery are theirs rather than the marketplace’s.',
  },
  {
    title: 'Stack whatever is left',
    body: 'A store code, cashback route, open-box listing, or loyalty price can still improve the final number after the sale price is fixed.',
  },
];

const DEFAULT_FAQS: PillarPageContent['faqs'] = [
  {
    question: 'What makes a discount a real bargain?',
    answer:
      'That it survives comparison. A real bargain beats what other retailers charge today once shipping, fees, and return terms are counted — not merely the seller’s own "was" price.',
  },
  {
    question: 'Should I trust the discount percentage?',
    answer:
      'Treat it as a clue rather than proof. The percentage is measured against a list price the seller sets, which may not be a price anyone recently paid. The checkout total is the number that matters.',
  },
  {
    question: 'Is the cheapest listing always the best buy?',
    answer:
      'No. On marketplaces the cheapest listing is often a third-party seller with a shorter return window and no manufacturer warranty. Price that risk alongside the saving.',
  },
  {
    question: 'Can a coupon beat a sale price?',
    answer:
      'Often, and sometimes both apply. Store codes, cashback, open-box stock, and loyalty pricing are separate from the headline sale, so they are worth checking after you have found the best sale price.',
  },
  {
    question: 'How do I know whether the price will fall further?',
    answer:
      'You cannot know, but you can check whether this price is unusual. Where enough price movement has been recorded for a product, its page shows it; a price matched several times recently is a routine discount rather than a low.',
  },
  {
    question: 'Are sale events like Black Friday or Prime Day actually the lowest prices?',
    answer:
      'Sometimes, and not reliably. A large event produces genuine lows on some products and routine discounts dressed as lows on others. The test does not change: compare the checkout total against what other retailers charge, and against what the product has recently sold for.',
  },
  {
    question: 'Is an open-box or refurbished unit worth the saving?',
    answer:
      'Often, when the seller states the grade and the warranty in writing. Manufacturer-refurbished stock carrying a full warranty is a different proposition from an unlabelled "open box" from a marketplace seller, even at the same price.',
  },
];

/**
 * Content for the pillar template.
 *
 * The article body is no longer a parameter: the template renders a hub, not
 * an article, and there is no section left to put it in. Removing it from the
 * signature rather than ignoring it means the caller stops fetching and
 * enriching HTML that nothing displays.
 *
 * Everything except the title, deck, and updated date is editorial copy rather
 * than CMS data. A pillar overrides what its topic needs through `copy` on its
 * entry in PILLAR_PAGES and inherits the rest.
 */
export function buildPillarContent(
  post: NxtPost,
  category: string,
  supportingArticles: PillarPageContent['supportingArticles'] = [],
): PillarPageContent {
  const intro = post.excerpt || clampDescription(stripHtml(post.content), 260);
  const copy = PILLAR_PAGES[post.slug]?.copy ?? {};

  return {
    eyebrow: categoryName(category) || 'Buying guide',
    title: post.title,
    deck:
      intro ||
      'A practical NXT.Bargains guide for finding real discounts, comparing sellers, and avoiding weak offers before checkout.',
    updated: recentPostDate(post.updatedAt || post.publishedAt),
    primaryCta: copy.primaryCta ?? { href: '/best-deals', label: 'Browse current deals' },
    secondaryCta: copy.secondaryCta ?? { href: '/all-products', label: 'Compare products' },
    sections: copy.sections ?? DEFAULT_SECTIONS,
    metrics: copy.metrics ?? DEFAULT_METRICS,
    signals: copy.signals ?? DEFAULT_SIGNALS,
    paths: copy.paths ?? DEFAULT_PATHS,
    supportingArticles,
    guides: copy.guides ?? DEFAULT_GUIDES,
    matrix: copy.matrix ?? DEFAULT_MATRIX,
    steps: copy.steps ?? DEFAULT_STEPS,
    faqs: copy.faqs ?? DEFAULT_FAQS,
  };
}

/**
 * The post's own keyword field, lowercased.
 *
 * Only seoKeywords — not the title or excerpt. Searching the body text pulled
 * in every best-seller write-up that happens to use the word "deal" in a
 * sentence: a JBL speaker listing and a USB-C charger both scored against this
 * pillar. The keyword field is the deliberate signal; prose is incidental.
 *
 * The consequence is intentional: a post joins a cluster when someone tags it
 * in the CMS, not when it happens to use the right vocabulary.
 */
function searchableText(post: NxtPost): string {
  return String(post.seoKeywords ?? '').toLowerCase();
}

/**
 * How well a candidate matches the pillar's keywords.
 *
 * A count rather than a boolean so the closest articles lead: a post whose
 * keywords name three of the pillar's terms is a better cluster member than
 * one that mentions "sale" once. Word-boundary matching, because "deal" would
 * otherwise match "dealer" and "idealised".
 */
function keywordScore(post: NxtPost, keywords: string[]): number {
  const text = searchableText(post);
  return keywords.reduce((score, keyword) => {
    const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return pattern.test(text) ? score + 1 : score;
  }, 0);
}

export function buildSupportingArticles(post: NxtPost, posts: NxtPost[]): PillarPageContent['supportingArticles'] {
  const config = PILLAR_PAGES[post.slug];
  const candidates = posts.filter((candidate) => candidate.id !== post.id && candidate.slug !== post.slug);
  const selected: NxtPost[] = [];
  const take = (candidate: NxtPost) => {
    if (selected.length >= 6) return;
    if (selected.some((item) => item.id === candidate.id || item.slug === candidate.slug)) return;
    selected.push(candidate);
  };

  // 1. Hand-picked, in the order given.
  for (const slug of config?.supportingSlugs ?? []) {
    const match = candidates.find((candidate) => candidate.slug === slug);
    if (match) take(match);
  }

  // 2. Keyword matches, strongest first.
  const keywords = config?.supportingKeywords ?? [];
  if (keywords.length) {
    candidates
      .map((candidate) => ({ candidate, score: keywordScore(candidate, keywords) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .forEach((entry) => take(entry.candidate));
  }

  /* Deliberately no category fallback. An unrelated article padding the
     cluster out to six is worse than a shorter, honest one — the section is a
     claim that these pieces belong with this pillar. */

  return selected.map((article) => ({
    meta: categoryName(article.categories?.[0]?.slug) || 'Article',
    title: article.title,
    body: clampDescription(stripHtml(article.excerpt || article.content || article.title), 150),
    /* A pillar in someone else's cluster links to its pillar path. postPath()
       would return the underlying post URL, which 308s to the same place — an
       extra hop, and an internal link pointing at a redirect. */
    href: pillarPathForPost(article) ?? postPath(article),
  }));
}
