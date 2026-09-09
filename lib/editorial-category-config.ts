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
      'Welcome to the NXT.Bargains product comparison hub, where our editorial team breaks down specs, performance metrics, and real-world value side by side. We evaluate every product across build quality, key features, pricing trends, and practical use cases to highlight clear winner picks for your specific budget. Instead of forcing you to decipher complex spec sheets on your own, our head-to-head articles simplify your shopping decision with transparent pros, cons, and historical price context. Browse our full archive of side-by-side breakdowns below to choose the right model before checking live retailer discounts.',
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
      'NXT.Bargains delivers hands-on, objective product reviews designed to give you an accurate look at what works, what falls short, and whether a device is worth your hard-earned money. Our editorial team evaluates smartphones, laptops, audio gear, and smart home appliances in real-world scenarios rather than synthetic benchmarks alone. Every review details daily usability, long-term durability, key trade-offs, and competitive alternatives across major price points. Read our comprehensive coverage below to find unbiased verdicts and editor recommendations before making your next purchase.',
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
      'Our curated product roundups consolidate the most crowded tech categories into clear, actionable recommendations tailored for every type of buyer. We analyze dozens of market options to highlight editor favorites, top budget-friendly choices, and premium category leaders in one convenient guide. Each roundup features spec highlights, price-to-performance analysis, and direct comparisons to ensure you find the right fit quickly. Browse our updated best-of collections below to discover top-rated devices before comparing live retailer offers.',
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
      'NXT.Bargains how-to guides offer clear, step-by-step instructions to help you set up, troubleshoot, and optimize the electronics you use every day. Whether you are configuring smart home automation, extending laptop battery life, or fixing common connectivity issues, our practical walkthroughs eliminate the guesswork. We test every method firsthand to provide accurate advice, helpful software tips, and hardware optimization hacks. Explore our complete guide library below to get the absolute most performance out of your technology investment.',
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
      'Discover the highest-scoring smart electronics and tech devices reviewed by the NXT.Bargains editorial desk. We highlight standout products that consistently deliver top-tier performance, exceptional build quality, and superior overall value across consumer electronics. Our team tracks user ratings, long-term reliability signals, and market pricing to curate recommendations you can trust. Explore our top-rated product guides below to quickly identify category leaders and editor-backed picks.',
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
      'Gain essential technology context with NXT.Bargains explainers and informative articles covering industry trends, hardware architecture, and smart shopping strategies. We simplify complex spec jargon, emerging standards, and pricing dynamics so you understand what features genuinely matter before you buy. Our deep-dive guides prepare you to evaluate sales, compare specs accurately, and avoid common marketing traps. Read our full archive of informative reads below to become a more informed consumer.',
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
      'Stay ahead of shopping trends with NXT.Bargains best-seller guides, tracking top-ranking consumer electronics across Amazon, Best Buy, Walmart, Target, and eBay. We analyze why products ascend marketplace charts, who they suit best, and whether their popularity reflects genuine quality or temporary hype. Each guide links back to live price tracking and deal alerts so you never pay full price for trending gear. Browse our best-seller coverage below to shop popular items with confidence.',
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
      'Shorten your tech research phase with practical buying guides from NXT.Bargains, designed to help you navigate crowded tech markets with confidence. We outline realistic budget tiers, essential feature checklists, and crucial trade-offs across laptops, phones, audio gear, and smart home devices. Our frameworks guide you toward the ideal model for your specific workflow without overspending on unnecessary extras. Explore our full library of buying guides below to make a smarter purchasing decision.',
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
      `Welcome to the NXT.Bargains editorial hub for ${name}, featuring in-depth buying advice, product breakdowns, and market price tracking. Our editorial team evaluates key features, build quality, and real-world value to help you make informed purchasing decisions. Every guide is designed to simplify your research before you check live retailer discounts across major online stores. Explore our full archive of ${name.toLowerCase()} articles below to find top-rated recommendations and buying tips.`,
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


