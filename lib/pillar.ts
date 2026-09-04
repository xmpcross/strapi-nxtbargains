import { type PillarPageContent } from '@/components/pillar/PillarPageTemplate';
import { type NxtPost } from '@/lib/strapi';
import { SECTIONS } from '@/lib/site';
import { clampDescription, postPath, stripHtml } from '@/lib/format';

const PILLAR_PATHS_BY_SLUG: Record<string, string> = {
  'best-deals-and-bargains-guide': '/best-deals-and-bargains',
};

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

export function buildPillarContent(
  post: NxtPost,
  bodyHtml: string,
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
    bodyHtml,
  };
}

export function buildSupportingArticles(post: NxtPost, posts: NxtPost[]): PillarPageContent['supportingArticles'] {
  const currentCategorySlugs = new Set((post.categories ?? []).map((category) => category.slug));
  const candidates = posts.filter((candidate) => candidate.id !== post.id && candidate.slug !== post.slug);
  const sameCategory = candidates.filter((candidate) =>
    (candidate.categories ?? []).some((category) => currentCategorySlugs.has(category.slug)),
  );
  const selected: NxtPost[] = [];

  for (const candidate of [...sameCategory, ...candidates]) {
    if (selected.some((item) => item.id === candidate.id || item.slug === candidate.slug)) continue;
    selected.push(candidate);
    if (selected.length >= 6) break;
  }

  return selected.map((article) => ({
    meta: categoryName(article.categories?.[0]?.slug) || 'Article',
    title: article.title,
    body: clampDescription(stripHtml(article.excerpt || article.content || article.title), 150),
    href: postPath(article),
  }));
}
