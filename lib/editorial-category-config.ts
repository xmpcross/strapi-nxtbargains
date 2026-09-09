import type { SectionKey } from '@/lib/site';
import { BEST_SELLER_MARKETPLACES } from '@/lib/best-sellers';

export type EditorialCategoryConfig = {
  slug: string;
  breadcrumbLabel: string;
  eyebrow: string;
  heroGradient: string;
  accentColor: string;
  bullets: string[];
  primaryCta: { href: string; label: string };
  secondaryCta: { href: string; label: string };
  glanceDescription: string;
  focusLabel: string;
  topicChips: string[];
  featuredLabel: string;
  spotlightEyebrow: string;
  spotlightTitle: string;
  gridArchiveTitle: string;
  cardLabel: string;
  searchPlaceholder: string;
  emptySearchMessage: string;
  emptyDefaultMessage: string;
  hidePostType?: boolean;
  /** Optional hero pill links (e.g. marketplaces or product categories). */
  quickLinks?: Array<{ href: string; label: string }>;
  quickLinksLabel?: string;
  /** @deprecated Use quickLinks */
  marketplaceLinks?: Array<{ href: string; label: string }>;
};

const EDITORIAL_CATEGORY_CONFIG: Record<SectionKey, EditorialCategoryConfig> = {
  'product-comparisons': {
    slug: 'product-comparisons',
    breadcrumbLabel: 'Product comparisons',
    eyebrow: 'Editorial · Comparisons',
    heroGradient:
      'linear-gradient(135deg, #eef5ff 0%, #e0ecff 50%, #f4f8ff 100%)',
    accentColor: '#0046be',
    bullets: [],
    primaryCta: { href: '/all-products', label: 'Compare products' },
    secondaryCta: { href: '/product-reviews', label: 'Read reviews' },
    glanceDescription:
      'Explore side-by-side product comparisons from the NXT.Bargains editorial team, featuring detailed spec breakdowns, key performance trade-offs, price history tracking, and clear verdicts to help you choose the best device before shopping live marketplace deals.',
    focusLabel: 'Comparisons',
    topicChips: ['Specs', 'Value', 'Features', 'Use cases', 'Winner picks'],
    featuredLabel: 'Featured comparison',
    spotlightEyebrow: 'Latest comparisons',
    spotlightTitle: 'Fresh side-by-side breakdowns',
    gridArchiveTitle: 'Browse every product comparison',
    cardLabel: 'Comparison',
    searchPlaceholder: 'Search comparisons...',
    emptySearchMessage: 'No comparisons match your search.',
    emptyDefaultMessage: 'No product comparisons here yet.',
    hidePostType: true,
  },
  'product-reviews': {
    slug: 'product-reviews',
    breadcrumbLabel: 'Product reviews',
    eyebrow: 'Editorial · Reviews',
    heroGradient:
      'linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fffdf0 100%)',
    accentColor: '#d97706',
    bullets: [],
    primaryCta: { href: '/all-products', label: 'Shop compared' },
    secondaryCta: { href: '/product-comparisons', label: 'See comparisons' },
    glanceDescription:
      'Read comprehensive hands-on product reviews from NXT.Bargains, focusing on real-world usability, long-term build quality, value for money, and honest recommendations across smartphones, laptops, audio gear, and smart home tech.',
    focusLabel: 'Reviews',
    topicChips: ['Hands-on', 'Pros & cons', 'Value', 'Verdict', 'Long-term use'],
    featuredLabel: 'Featured review',
    spotlightEyebrow: 'Latest reviews',
    spotlightTitle: 'New hands-on takes from the desk',
    gridArchiveTitle: 'Browse the full review archive',
    cardLabel: 'Review',
    searchPlaceholder: 'Search reviews...',
    emptySearchMessage: 'No reviews match your search.',
    emptyDefaultMessage: 'No product reviews here yet.',
    hidePostType: true,
  },
  'product-roundups': {
    slug: 'product-roundups',
    breadcrumbLabel: 'Product roundups',
    eyebrow: 'Editorial · Roundups',
    heroGradient:
      'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #f0fdf4 100%)',
    accentColor: '#059669',
    bullets: [],
    primaryCta: { href: '/best-deals', label: 'Best deals' },
    secondaryCta: { href: '/product-reviews', label: 'Read reviews' },
    glanceDescription:
      'Discover curated product roundups and best-of lists on NXT.Bargains, designed to help you quickly identify editor favorites, top budget picks, and standout category leaders across major electronics brands.',
    focusLabel: 'Roundups',
    topicChips: ['Best overall', 'Budget picks', 'Premium', 'Editor picks', 'Category leaders'],
    featuredLabel: 'Featured roundup',
    spotlightEyebrow: 'Latest roundups',
    spotlightTitle: 'Fresh best-of lists to shop from',
    gridArchiveTitle: 'Browse every product roundup',
    cardLabel: 'Roundup',
    searchPlaceholder: 'Search roundups...',
    emptySearchMessage: 'No roundups match your search.',
    emptyDefaultMessage: 'No product roundups here yet.',
    hidePostType: true,
  },
  'how-to-guides': {
    slug: 'how-to-guides',
    breadcrumbLabel: 'How-to guides',
    eyebrow: 'Editorial · How-to',
    heroGradient:
      'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #faf5ff 100%)',
    accentColor: '#7c3aed',
    bullets: [],
    primaryCta: { href: '/all-products', label: 'Find products' },
    secondaryCta: { href: '/nxt-bargains-informative-articles', label: 'Read explainers' },
    glanceDescription:
      'Save time with step-by-step how-to guides from NXT.Bargains, packed with actionable setup instructions, tech optimization tips, and troubleshooting solutions for the devices you rely on every day.',
    focusLabel: 'How-to',
    topicChips: ['Setup', 'Fixes', 'Tips', 'Optimization', 'Walkthroughs'],
    featuredLabel: 'Featured guide',
    spotlightEyebrow: 'Latest guides',
    spotlightTitle: 'New step-by-step help articles',
    gridArchiveTitle: 'Browse the full how-to archive',
    cardLabel: 'Guide',
    searchPlaceholder: 'Search how-to guides...',
    emptySearchMessage: 'No guides match your search.',
    emptyDefaultMessage: 'No how-to guides here yet.',
    hidePostType: true,
  },
  'top-rated-smart-electronics-devices': {
    slug: 'top-rated-smart-electronics-devices',
    breadcrumbLabel: 'Top-rated products',
    eyebrow: 'Editorial · Top rated',
    heroGradient:
      'linear-gradient(135deg, #fefce8 0%, #fef08a 50%, #fffdf0 100%)',
    accentColor: '#b45309',
    bullets: [],
    primaryCta: { href: '/best-sellers', label: 'Best sellers' },
    secondaryCta: { href: '/product-reviews', label: 'Read reviews' },
    glanceDescription:
      'Browse the highest-scoring smart electronics and tech devices on NXT.Bargains, vetted by our editorial team for exceptional performance, high customer satisfaction, and outstanding overall value.',
    focusLabel: 'Top rated',
    topicChips: ['Editors choice', 'Top score', 'Standouts', 'Category leaders', 'Best rated'],
    featuredLabel: 'Featured pick',
    spotlightEyebrow: 'Latest top-rated picks',
    spotlightTitle: 'Fresh high-scoring recommendations',
    gridArchiveTitle: 'Browse every top-rated article',
    cardLabel: 'Top rated',
    searchPlaceholder: 'Search top-rated products...',
    emptySearchMessage: 'No top-rated articles match your search.',
    emptyDefaultMessage: 'No top-rated product articles here yet.',
    hidePostType: true,
  },
  'nxt-bargains-informative-articles': {
    slug: 'nxt-bargains-informative-articles',
    breadcrumbLabel: 'Informative articles',
    eyebrow: 'Editorial · Explainers',
    heroGradient:
      'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f0f7ff 100%)',
    accentColor: '#0284c7',
    bullets: [],
    primaryCta: { href: '/product-reviews', label: 'Product reviews' },
    secondaryCta: { href: '/how-to-guides', label: 'How-to guides' },
    glanceDescription:
      'Gain deeper tech insights with NXT.Bargains explainers and informative articles, breaking down complex specs, industry trends, and smart shopping strategy to give you full context before checkout.',
    focusLabel: 'Explainers',
    topicChips: ['Trends', 'Primers', 'Industry news', 'Tech explainers', 'Buying context'],
    featuredLabel: 'Featured explainer',
    spotlightEyebrow: 'Latest explainers',
    spotlightTitle: 'Fresh reads from the editorial desk',
    gridArchiveTitle: 'Browse the full informative archive',
    cardLabel: 'Informative',
    searchPlaceholder: 'Search explainers...',
    emptySearchMessage: 'No explainers match your search.',
    emptyDefaultMessage: 'No informative articles here yet.',
    hidePostType: true,
  },
};

const EXTENDED_EDITORIAL_CATEGORY_CONFIG: Record<string, EditorialCategoryConfig> = {
  'best-sellers-articles': {
    slug: 'best-sellers-articles',
    breadcrumbLabel: 'Best Sellers',
    eyebrow: 'Editorial · Marketplace picks',
    heroGradient:
      'linear-gradient(135deg, #fffdf0 0%, #fef08a 50%, #fffbeb 100%)',
    accentColor: '#b45309',
    bullets: [],
    primaryCta: { href: '/best-sellers', label: 'Live best-seller lists' },
    secondaryCta: { href: '/best-deals', label: 'Best deals today' },
    glanceDescription:
      'Stay informed on top-trending best sellers across Amazon, eBay, Walmart, Best Buy, and Target with NXT.Bargains guides detailing why products rank, who they suit best, and where to score the best deals.',
    focusLabel: 'Trending',
    topicChips: ['Amazon', 'eBay', 'Walmart', 'Target', 'Best Buy', 'Newegg'],
    quickLinks: BEST_SELLER_MARKETPLACES.map((marketplace) => ({
      href: `/best-sellers/${marketplace.key}`,
      label: marketplace.label,
    })),
    quickLinksLabel: 'Shop by marketplace',
    featuredLabel: 'Featured pick',
    spotlightEyebrow: 'Latest reads',
    spotlightTitle: 'Fresh takes on trending best sellers',
    gridArchiveTitle: 'Browse every best-sellers article',
    cardLabel: 'Best Seller',
    searchPlaceholder: 'Search best-sellers articles...',
    emptySearchMessage: 'No best-sellers articles match your search.',
    emptyDefaultMessage: 'No best-sellers articles here yet.',
    hidePostType: true,
  },
  'buying-guides': {
    slug: 'buying-guides',
    breadcrumbLabel: 'Buying guides',
    eyebrow: 'Editorial · Buy smarter',
    heroGradient:
      'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 50%, #f0fdf9 100%)',
    accentColor: '#0d9488',
    bullets: [],
    primaryCta: { href: '/product-comparisons', label: 'Compare products' },
    secondaryCta: { href: '/top-rated-smart-electronics-devices', label: 'Top-rated picks' },
    glanceDescription:
      'Shorten your tech research phase with practical buying guides from NXT.Bargains, offering budget frameworks, key spec checklists, and clear decision guidance for your next major electronics purchase.',
    focusLabel: 'Buy smarter',
    topicChips: ['Budget tiers', 'Key specs', 'Use cases', 'Trade-offs', 'Checklists'],
    quickLinks: [
      { href: '/category/smart-phones', label: 'Smart phones' },
      { href: '/category/laptops', label: 'Laptops' },
      { href: '/category/tablets', label: 'Tablets' },
      { href: '/category/headphones', label: 'Headphones' },
      { href: '/category/smartwatches', label: 'Smartwatches' },
      { href: '/smart-home', label: 'Smart home' },
    ],
    quickLinksLabel: 'Shop popular categories',
    featuredLabel: 'Featured guide',
    spotlightEyebrow: 'Latest guides',
    spotlightTitle: 'Fresh buying advice from the desk',
    gridArchiveTitle: 'Browse every buying guide',
    cardLabel: 'Buying guide',
    searchPlaceholder: 'Search buying guides...',
    emptySearchMessage: 'No buying guides match your search.',
    emptyDefaultMessage: 'No buying guides here yet.',
    hidePostType: true,
  },
};

export function getEditorialCategoryConfig(slug: string): EditorialCategoryConfig | null {
  return EXTENDED_EDITORIAL_CATEGORY_CONFIG[slug] ?? EDITORIAL_CATEGORY_CONFIG[slug as SectionKey] ?? null;
}

export function buildDefaultCategoryConfig(
  slug: string,
  name: string,
  description?: string | null,
): EditorialCategoryConfig {
  const existing = getEditorialCategoryConfig(slug);
  if (existing) return existing;

  return {
    slug,
    breadcrumbLabel: name,
    eyebrow: `Editorial · ${name}`,
    heroGradient:
      'linear-gradient(135deg, #eef5ff 0%, #e0ecff 50%, #f4f8ff 100%)',
    accentColor: '#0046be',
    bullets: [],
    primaryCta: { href: '/best-deals', label: 'Best deals' },
    secondaryCta: { href: '/all-products', label: 'Compare products' },
    glanceDescription:
      (description ? description.replace(/\s+/g, ' ').trim() : null) ||
      `Discover in-depth article coverage, expert buying advice, and price tracking for ${name} from the NXT.Bargains editorial team.`,
    focusLabel: name,
    topicChips: ['Guides', 'Reviews', 'Comparisons', 'Top Picks', 'Deals'],
    featuredLabel: 'Featured article',
    spotlightEyebrow: `Latest ${name} articles`,
    spotlightTitle: `Fresh coverage in ${name}`,
    gridArchiveTitle: `Browse all ${name} articles`,
    cardLabel: name,
    searchPlaceholder: `Search ${name.toLowerCase()}...`,
    emptySearchMessage: `No ${name.toLowerCase()} articles match your search.`,
    emptyDefaultMessage: `No articles in ${name} yet.`,
    hidePostType: false,
  };
}

export function isEditorialCategory(slug: string): slug is SectionKey {
  return slug in EDITORIAL_CATEGORY_CONFIG || slug in EXTENDED_EDITORIAL_CATEGORY_CONFIG;
}


