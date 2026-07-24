export const SITE = {
  name: 'NXT.Bargains',
  tagline: 'Side-by-side product comparisons, honest reviews, smart deals.',
  description:
    'Side-by-side product comparisons, honest reviews, roundups and how-to guides — pick the right gadget without the wading.',
  url: (process.env.NEXT_PUBLIC_SITE_URL || 'https://nxtbargains.fxnstudio.com').replace(/\/$/, ''),
  amazonAffiliateTag: process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG || '',
  /** Default social share image (1200×630), path relative to SITE.url. */
  ogImage: '/og/default.png',
  /** Brand handle for Twitter/X cards. */
  twitterHandle: '@nxtbargains',
  social: {
    facebook: 'https://www.facebook.com/nxtbargains',
    twitter: 'https://x.com/nxtbargains',
  },
};

// Guardrail: never let production canonical / OG / JSON-LD URLs silently point
// at a staging (*.fxnstudio.com) domain. Warns loudly in production builds so a
// missing NEXT_PUBLIC_SITE_URL is caught immediately.
(() => {
  let host = '';
  try {
    host = new URL(SITE.url).hostname;
  } catch {
    /* ignore */
  }
  if (process.env.NODE_ENV === 'production' && /\.fxnstudio\.com$/i.test(host)) {
    console.error(
      '\n\n⚠️  [lib/site] SITE.url = "' +
        SITE.url +
        '" — a STAGING domain — in a PRODUCTION build.\n' +
        '    Set NEXT_PUBLIC_SITE_URL=https://nxt.bargains before building, or every canonical,\n' +
        '    OpenGraph, and JSON-LD URL will point at staging (serious SEO problem).\n\n',
    );
  }
})();

export const INFORMATIVE_ARTICLES_SLUG = 'nxt-bargains-informative-articles' as const;

export type SectionKey =
  | 'product-comparisons'
  | 'product-reviews'
  | 'product-roundups'
  | 'how-to-guides'
  | 'top-rated-smart-electronics-devices'
  | 'nxt-bargains-informative-articles';

export type Section = {
  slug: SectionKey;
  title: string;
  short: string;
  blurb: string;
};

// Default sections shown on the homepage. These mirror the source WP categories,
// so URLs stay 1:1 with the migrated content (good for SEO continuity).
export const SECTIONS: Section[] = [
  {
    slug: 'product-comparisons',
    title: 'Product Comparisons',
    short: 'Comparisons',
    blurb: 'Side-by-side breakdowns so you can pick the right one in minutes.',
  },
  {
    slug: 'product-reviews',
    title: 'Product Reviews',
    short: 'Product Reviews',
    blurb: 'Hands-on takes — what works, what doesn’t, what’s worth the money.',
  },
  {
    slug: 'product-roundups',
    title: 'Product Roundups',
    short: 'Product Roundups',
    blurb: 'Best-of lists for the categories you’re actually shopping in.',
  },
  {
    slug: 'how-to-guides',
    title: 'How-to Guides',
    short: 'How-to',
    blurb: 'Step-by-step walkthroughs for setup, troubleshooting, and getting more from your gear.',
  },
  {
    slug: 'top-rated-smart-electronics-devices',
    title: 'Top-Rated Products',
    short: 'Top Rated',
    blurb: 'The standouts — highest-scoring picks across categories.',
  },
  {
    slug: 'nxt-bargains-informative-articles',
    title: 'Informative Articles',
    short: 'Explainers',
    blurb: 'Background reading — trends, primers and the state of the gadget world.',
  },
];

export const BLOG_NAV_LINKS = [
  ...SECTIONS.slice(0, 3).map((section) => ({
    href: `/${section.slug}`,
    label: section.title,
  })),
  { href: '/buying-guides', label: 'Buying Guides' },
  ...SECTIONS.slice(3).map((section) => ({
    href: `/${section.slug}`,
    label: section.title,
  })),
  { href: '/smart-home', label: 'Smart Home' },
  { href: '/best-sellers-articles', label: 'Best Sellers' },
];

export type ArticleCategoryNavItem = {
  slug: string;
  title: string;
};

/** All article categories for category-page sidebars and filters. */
export const ARTICLE_SIDEBAR_CATEGORIES: ArticleCategoryNavItem[] = BLOG_NAV_LINKS.map((link) => ({
  slug: link.href.replace(/^\//, ''),
  title: link.href === '/nxt-bargains-informative-articles' ? 'Informative' : link.label,
}));

/** Hero descriptions for article categories outside SECTIONS. */
export const ARTICLE_CATEGORY_BLURBS: Record<string, string> = {
  'best-sellers-articles':
    'Follow what shoppers are buying most across Amazon, eBay, Newegg, Walmart, Target, and Best Buy. Our Best Sellers articles spotlight top-ranked products from each marketplace, explain why they are trending, and help you compare live prices before you buy.',
  'buying-guides':
    'Make confident purchase decisions with NXT.Bargains buying guides — budget tiers, spec checklists, and practical advice for phones, laptops, audio, tablets, smart home gear, and more before you compare live prices.',
};

export function resolveArticleCategoryBlurb(
  slug: string,
  cmsDescription?: string | null,
): string | undefined {
  if (ARTICLE_CATEGORY_BLURBS[slug]) return ARTICLE_CATEGORY_BLURBS[slug];
  const section = SECTIONS.find((s) => s.slug === slug);
  if (section?.blurb) return section.blurb;
  const trimmed = cmsDescription?.trim();
  return trimmed || undefined;
}

/** Footer “All Articles” column — key links pinned to the top. */
export const FOOTER_ARTICLE_NAV_LINKS = [
  { href: '/top-rated-smart-electronics-devices', label: 'Top-Rated Products' },
  { href: '/best-sellers-articles', label: 'Best Sellers' },
  { href: '/smart-home', label: 'Smart Home' },
  { href: '/buying-guides', label: 'Buying Guides' },
  ...BLOG_NAV_LINKS.filter(
    (link) =>
      link.href !== '/best-sellers-articles' &&
      link.href !== '/smart-home' &&
      link.href !== '/buying-guides' &&
      link.href !== '/top-rated-smart-electronics-devices' &&
      link.href !== '/product-reviews',
  ).map((link) =>
    link.href === '/nxt-bargains-informative-articles' ? { ...link, label: 'Informative' } : link,
  ),
  { href: '/product-reviews', label: 'Product Reviews' },
];
