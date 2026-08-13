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
      'radial-gradient(at 82% 18%, rgba(71,120,230,0.3) 0%, transparent 52%), radial-gradient(at 12% 88%, rgba(16,185,129,0.16) 0%, transparent 48%)',
    accentColor: '#8ec5ff',
    bullets: [
      'Side-by-side specs, pricing, and trade-offs across the products you are actually considering.',
      'Clear winner signals without wading through long spec sheets on your own.',
      'Built to help you decide faster before checking live marketplace prices.',
    ],
    primaryCta: { href: '/all-products', label: 'Compare products' },
    secondaryCta: { href: '/product-reviews', label: 'Read reviews' },
    glanceDescription:
      'Head-to-head comparison articles from the NXT.Bargains editorial team — built for shoppers who want the differences spelled out plainly.',
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
      'radial-gradient(at 78% 20%, rgba(245,158,11,0.24) 0%, transparent 52%), radial-gradient(at 14% 86%, rgba(71,120,230,0.18) 0%, transparent 48%)',
    accentColor: '#f5c26b',
    bullets: [
      'Hands-on takes on what works, what does not, and what is worth paying for.',
      'Practical verdicts with the caveats that matter before you buy.',
      'Updated editorial coverage across phones, laptops, audio, and smart home gear.',
    ],
    primaryCta: { href: '/all-products', label: 'Shop compared' },
    secondaryCta: { href: '/product-comparisons', label: 'See comparisons' },
    glanceDescription:
      'Honest product reviews from NXT.Bargains — focused on real-world use, value, and whether the product earns a recommendation.',
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
      'radial-gradient(at 80% 18%, rgba(16,185,129,0.26) 0%, transparent 52%), radial-gradient(at 16% 84%, rgba(71,120,230,0.16) 0%, transparent 48%)',
    accentColor: '#6ee7b7',
    bullets: [
      'Best-of lists for the categories you are actively shopping in right now.',
      'Editor favorites, budget picks, and premium standouts in one place.',
      'A fast starting point before you compare live prices across stores.',
    ],
    primaryCta: { href: '/best-deals', label: 'Best deals' },
    secondaryCta: { href: '/product-reviews', label: 'Read reviews' },
    glanceDescription:
      'Curated roundup articles that narrow crowded categories down to the products worth your attention.',
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
      'radial-gradient(at 82% 16%, rgba(139,92,246,0.26) 0%, transparent 52%), radial-gradient(at 10% 88%, rgba(71,120,230,0.14) 0%, transparent 48%)',
    accentColor: '#c4b5fd',
    bullets: [
      'Step-by-step setup, troubleshooting, and optimization walkthroughs.',
      'Practical instructions for getting more from the gear you already own.',
      'Written to save time when manuals and forums leave you guessing.',
    ],
    primaryCta: { href: '/all-products', label: 'Find products' },
    secondaryCta: { href: '/nxt-bargains-informative-articles', label: 'Read explainers' },
    glanceDescription:
      'Actionable how-to guides from NXT.Bargains — setup help, fixes, and smarter ways to use your tech.',
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
      'radial-gradient(at 84% 18%, rgba(234,179,8,0.24) 0%, transparent 52%), radial-gradient(at 12% 86%, rgba(71,120,230,0.16) 0%, transparent 48%)',
    accentColor: '#fcd34d',
    bullets: [
      'Highest-scoring standouts across the smart electronics categories we cover.',
      'Editor-backed picks with the performance and value signals that matter most.',
      'A shortcut to the products that consistently rise to the top.',
    ],
    primaryCta: { href: '/best-sellers', label: 'Best sellers' },
    secondaryCta: { href: '/product-reviews', label: 'Read reviews' },
    glanceDescription:
      'Top-rated product coverage from NXT.Bargains — the standouts, category leaders, and highest-scoring picks worth checking first.',
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
      'radial-gradient(at 82% 18%, rgba(71,120,230,0.28) 0%, transparent 52%), radial-gradient(at 12% 88%, rgba(16,185,129,0.14) 0%, transparent 48%)',
    accentColor: '#8ec5ff',
    bullets: [
      'Clear explainers on how products, platforms, and pricing actually work.',
      'Context before you compare — so deals and specs make more sense.',
      'Updated editorial picks from the NXT.Bargains team.',
    ],
    primaryCta: { href: '/product-reviews', label: 'Product reviews' },
    secondaryCta: { href: '/how-to-guides', label: 'How-to guides' },
    glanceDescription:
      'Long-form context articles that sit alongside comparisons, reviews, and deal coverage on NXT.Bargains.',
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
      'radial-gradient(at 82% 16%, rgba(251,191,36,0.32) 0%, transparent 52%), radial-gradient(at 10% 88%, rgba(71,120,230,0.18) 0%, transparent 48%)',
    accentColor: '#fbbf24',
    bullets: [
      'Coverage tied to live best-seller lists from Amazon, eBay, Newegg, Walmart, Target, and Best Buy.',
      'Quick reads on why a product is ranking, who it suits, and what to check before you buy.',
      'Every article links back to compare prices so you can shop the trend without overpaying.',
    ],
    primaryCta: { href: '/best-sellers', label: 'Live best-seller lists' },
    secondaryCta: { href: '/best-deals', label: 'Best deals today' },
    glanceDescription:
      'Shopping guides built around the products shoppers are buying most on major US marketplaces — updated as rankings shift.',
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
      'radial-gradient(at 84% 14%, rgba(45,212,191,0.3) 0%, transparent 52%), radial-gradient(at 8% 88%, rgba(71,120,230,0.2) 0%, transparent 48%)',
    accentColor: '#5eead4',
    bullets: [
      'What to look for, what to skip, and how to match a product to how you actually shop and use it.',
      'Budget tiers, must-have features, and trade-offs worth understanding before checkout.',
      'Built to shorten the research phase — then compare live prices across major stores.',
    ],
    primaryCta: { href: '/product-comparisons', label: 'Compare products' },
    secondaryCta: { href: '/top-rated-smart-electronics-devices', label: 'Top-rated picks' },
    glanceDescription:
      'Practical buying guides from NXT.Bargains — budget advice, spec checklists, and decision frameworks for phones, laptops, audio, smart home, and more.',
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

export function isEditorialCategory(slug: string): slug is SectionKey {
  return slug in EDITORIAL_CATEGORY_CONFIG || slug in EXTENDED_EDITORIAL_CATEGORY_CONFIG;
}
