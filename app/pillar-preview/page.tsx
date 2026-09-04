import type { Metadata } from 'next';
import PillarPageTemplate, { type PillarPageContent } from '@/components/pillar/PillarPageTemplate';

export const metadata: Metadata = {
  title: 'Pillar page preview',
  description: 'Preview of the reusable NXT Bargains pillar page design system.',
  robots: { index: false, follow: false },
};

const previewContent: PillarPageContent = {
  eyebrow: 'Pillar preview',
  title: 'Best deals and bargains, sorted like a buying system',
  deck: 'A reusable pillar page design for NXT.Bargains: part guide, part deal router, part comparison hub. It gives shoppers a fast way to decide what to buy, where to compare it, and when a discount is actually worth acting on.',
  updated: 'August 2026',
  primaryCta: { href: '/best-deals', label: 'Browse current deals' },
  secondaryCta: { href: '/all-products', label: 'Compare products' },
  metrics: [
    { label: 'Best for', value: 'Deal research', detail: 'Top-level guides that need to route readers into products, retailers, and child articles.' },
    { label: 'Page shape', value: '7 blocks', detail: 'Hero, signal strip, paths, decision table, guide cards, playbook, FAQ.' },
    { label: 'Reusable slots', value: '12+', detail: 'Every content area is driven by data so future pillar pages can share the same layout.' },
    { label: 'Goal', value: 'Buy smarter', detail: 'Help shoppers separate real discounts from recycled sale pricing.' },
  ],
  signals: [
    { label: 'Price check', value: 'Live offers', tone: 'neutral' },
    { label: 'Best moment', value: 'Stack savings', tone: 'good' },
    { label: 'Avoid', value: 'Fake markdowns', tone: 'hot' },
  ],
  paths: [
    {
      label: 'Path A',
      title: 'Find the strongest deal today',
      body: 'Use this for broad sale pages where readers want current offers before deeper research.',
      href: '/best-deals',
    },
    {
      label: 'Path B',
      title: 'Compare before checkout',
      body: 'Route shoppers into product pages that compare merchants, prices, and offer history.',
      href: '/all-products',
    },
    {
      label: 'Path C',
      title: 'Shop by category',
      body: 'Send readers into evergreen category pages when they know the product type but not the model.',
      href: '/category/smart-phones',
    },
    {
      label: 'Path D',
      title: 'Use coupons and store promos',
      body: 'Keep coupon-led intent separate from product-led intent so pages stay focused.',
      href: '/coupons',
    },
  ],
  guides: [
    {
      meta: 'Evergreen guide',
      title: 'How to tell if a discount is real',
      body: 'A child guide that explains price history, inflated list prices, and how to compare the actual checkout cost.',
      href: '/best-deals',
    },
    {
      meta: 'Comparison hub',
      title: 'Marketplace deals worth checking first',
      body: 'A route into Amazon, eBay, Walmart, Best Buy, Target, and Newegg offer comparisons.',
      href: '/stores',
    },
    {
      meta: 'Buyer shortlist',
      title: 'Products that usually go on sale',
      body: 'A reusable slot for seasonal categories, buyer intent clusters, and high-conversion product roundups.',
      href: '/best-sellers',
    },
  ],
  matrix: [
    { need: 'Lowest price now', watch: 'Shipping, coupon exclusions, marketplace seller quality', bestRoute: 'Best deals plus product comparison' },
    { need: 'Big-ticket electronics', watch: 'Warranty, return window, refurbished condition', bestRoute: 'Category guide plus price history' },
    { need: 'Store-specific sale', watch: 'Member-only pricing and promo-code expiry', bestRoute: 'Coupons plus store page' },
    { need: 'Gift or impulse buy', watch: 'Delivery date, stock status, duplicate listings', bestRoute: 'Best sellers plus retailer filter' },
  ],
  steps: [
    { title: 'Start with the real price', body: 'Ignore the headline discount until the current price, shipping, and tax are visible.' },
    { title: 'Check at least two sellers', body: 'A bargain is stronger when another major store cannot match it at checkout.' },
    { title: 'Look for stackable savings', body: 'Coupon codes, cashback, open-box pricing, and loyalty offers can beat the visible sale.' },
    { title: 'Buy only when the reason is clear', body: 'The page should explain why now is a good buying moment, not just list products.' },
  ],
  faqs: [
    {
      question: 'Can this design become the default for future pillar pages?',
      answer: 'Yes. The route uses a reusable component fed by structured content, so future pillar pages can reuse the same blocks with different copy and links.',
    },
    {
      question: 'Is this preview indexed by Google?',
      answer: 'No. The preview page is marked noindex so it can be reviewed before becoming a live SEO page.',
    },
    {
      question: 'Does the design depend on live deal data?',
      answer: 'No. It works as an editorial pillar first, but it includes slots that can later be connected to live products, offers, and stores.',
    },
    {
      question: 'What makes it different from a normal blog page?',
      answer: 'It is built around decision paths, checks, and comparison actions rather than a single article column.',
    },
  ],
};

export default function PillarPreviewPage() {
  return <PillarPageTemplate content={previewContent} />;
}
