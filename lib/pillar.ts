import { type PillarPageContent } from '@/components/pillar/PillarPageTemplate';
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
 * Content for the pillar template.
 *
 * The article body is no longer a parameter: the template renders a hub, not
 * an article, and there is no section left to put it in. Removing it from the
 * signature rather than ignoring it means the caller stops fetching and
 * enriching HTML that nothing displays.
 */
export function buildPillarContent(
  post: NxtPost,
  category: string,
  supportingArticles: PillarPageContent['supportingArticles'] = [],
): PillarPageContent {
  const intro = post.excerpt || clampDescription(stripHtml(post.content), 260);

  return {
    eyebrow: categoryName(category) || 'Buying guide',
    title: post.title,
    deck:
      intro ||
      'A practical NXT.Bargains guide for finding real discounts, comparing sellers, and avoiding weak offers before checkout.',
    updated: recentPostDate(post.updatedAt || post.publishedAt),
    primaryCta: { href: '/best-deals', label: 'Browse current deals' },
    secondaryCta: { href: '/all-products', label: 'Compare products' },
    metrics: [
      {
        label: 'Use this for',
        value: 'Deal checks',
        detail: 'Quickly decide whether a discount is worth acting on.',
      },
      {
        label: 'Compare across',
        value: '6+ stores',
        detail: 'Amazon, eBay, Walmart, Best Buy, Target, Newegg and more.',
      },
      {
        label: 'Best moment',
        value: 'Before checkout',
        detail: 'Check price, shipping, coupons, seller quality, and return terms.',
      },
      {
        label: 'Reader goal',
        value: 'Pay less',
        detail: 'Find the lowest trustworthy offer without chasing fake markdowns.',
      },
    ],
    signals: [
      { label: 'Price check', value: 'Compare first', tone: 'neutral' },
      { label: 'Best tactic', value: 'Stack savings', tone: 'good' },
      { label: 'Avoid', value: 'Fake sales', tone: 'hot' },
    ],
    paths: [
      {
        label: 'Path A',
        title: 'Find the strongest deal now',
        body: 'Start with current offers and sort by real savings instead of loud sale labels.',
        href: '/best-deals',
      },
      {
        label: 'Path B',
        title: 'Compare the product price',
        body: 'Open product pages to check merchant pricing, availability, and offer history.',
        href: '/all-products',
      },
      {
        label: 'Path C',
        title: 'Use a coupon or promo',
        body: 'Check whether a code, store offer, or cashback route beats the visible sale price.',
        href: '/coupons',
      },
      {
        label: 'Path D',
        title: 'Watch recent price drops',
        body: 'Use tracked price movement to separate a normal discount from a rare low.',
        href: '/price-drops',
      },
    ],
    supportingArticles,
    guides: [
      {
        meta: 'Deal strategy',
        title: 'Check the real checkout price',
        body: 'Shipping, coupons, taxes, and seller terms decide whether the bargain survives checkout.',
        href: '/best-deals',
      },
      {
        meta: 'Product route',
        title: 'Compare similar products',
        body: 'Use product comparisons when the cheapest offer is not necessarily the best buy.',
        href: '/all-products',
      },
      {
        meta: 'Store route',
        title: 'Shop by marketplace or retailer',
        body: 'Move from the guide into stores when the buying intent is retailer-specific.',
        href: '/stores',
      },
    ],
    matrix: [
      {
        need: 'Lowest price now',
        watch: 'Shipping, seller reputation, coupon exclusions',
        bestRoute: 'Best deals plus product comparison',
      },
      {
        need: 'Reliable electronics deal',
        watch: 'Warranty, condition, return window',
        bestRoute: 'Category guide plus merchant check',
      },
      {
        need: 'Coupon-led saving',
        watch: 'Minimum spend and expiry date',
        bestRoute: 'Coupons plus store page',
      },
      {
        need: 'Price-drop timing',
        watch: 'Whether the sale price has been lower recently',
        bestRoute: 'Price drops plus product page',
      },
    ],
    steps: [
      {
        title: 'Check the visible price',
        body: 'Start with the current offer, then add shipping and required fees before judging the discount.',
      },
      {
        title: 'Compare a second seller',
        body: 'A real bargain should still look strong against another major marketplace or retailer.',
      },
      {
        title: 'Stack the saving',
        body: 'Look for coupons, cashback, open-box offers, or loyalty pricing that can improve the final price.',
      },
      {
        title: 'Buy when the trade-off is clear',
        body: 'Only act when the page explains why this deal is worth choosing now.',
      },
    ],
    faqs: [
      {
        question: 'What makes a deal real?',
        answer:
          'A real deal beats comparable current offers after shipping, coupon limits, seller quality, and return terms are considered.',
      },
      {
        question: 'Should I trust the listed discount percentage?',
        answer:
          'Treat it as a clue, not proof. Some discounts use inflated list prices, so compare the actual checkout price.',
      },
      {
        question: 'Where should I check first?',
        answer: 'Start with the current best deals, then open product comparison pages for offers across major merchants.',
      },
      {
        question: 'Can coupons beat sale prices?',
        answer:
          'Yes. Store codes, cashback, loyalty pricing, and open-box deals can produce a better final price than a headline sale.',
      },
    ],
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
