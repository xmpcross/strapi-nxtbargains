#!/usr/bin/env node
/**
 * Fills /best-deals from retailer deals pages via ZenRows.
 *
 * Replaces the DataForSEO Google Shopping feed that previously wrote
 * data/best-deals-realtime.json. The shape of that file is unchanged, so the
 * page needs no edit — it reads the same keys either way.
 *
 * What changes is where the numbers come from. The Google Shopping feed
 * answered sixteen keyword queries and returned whatever was listed, which is
 * why 192 of its items carried discountPercent: 0 — they were listings, not
 * deals. These pages are the retailers' own discount pages, so every record
 * here has a was-price and a real saving behind it.
 *
 * Reachability, established by probing each one through ZenRows:
 *
 *   Amazon, eBay, Walmart, Newegg  parse cleanly.
 *   Best Buy  serves its country-selector interstitial (854 bytes) instead of
 *             the deals page, whatever proxy country is set. It needs a
 *             session cookie this script does not carry, so it is left out
 *             rather than silently contributing nothing.
 *   Target    returns the page but no prices: the tiles carry tcin ids and
 *             fetch their prices by XHR afterwards, so there is nothing to
 *             parse from the HTML.
 *
 * Those two were the largest sources in the old feed (41 and 25 of 192), so
 * this trades their breadth for the guarantee that every remaining row is a
 * genuine discount.
 *
 * Costs 25 ZenRows credits per source per run — js_render and premium_proxy
 * are both required, without them every one of these returns a bot wall.
 *
 *   node scripts/fetch-best-deals-zenrows.mjs
 *   node scripts/fetch-best-deals-zenrows.mjs --dry-run
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAmazonDeals, parseEbayDeals, parseEbayDealsIntl, parseWalmartDeals, parseNeweggDeals } from './lib/deal-parsers.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DRY = process.argv.includes('--dry-run');
const OUT = join(ROOT, 'data', 'best-deals-realtime.json');

const SOURCES = [
  // United States
  { store: 'Amazon', query: 'amazon deals', region: 'US', currency: 'USD', country: 'us', url: 'https://www.amazon.com/gp/goldbox?ref_=nav_cs_gb', parse: parseAmazonDeals, favicon: 'https://www.amazon.com/favicon.ico' },
  { store: 'eBay', query: 'ebay deals', region: 'US', currency: 'USD', country: 'us', url: 'https://www.ebay.com/deals', parse: parseEbayDeals, favicon: 'https://www.ebay.com/favicon.ico' },
  { store: 'Walmart', query: 'walmart deals', region: 'US', currency: 'USD', country: 'us', url: 'https://www.walmart.com/shop/deals/flash-deals-shopall', parse: parseWalmartDeals, favicon: 'https://www.walmart.com/favicon.ico' },
  { store: 'Newegg.com', query: 'newegg deals', region: 'US', currency: 'USD', country: 'us', url: 'https://www.newegg.com/todays-deals', parse: parseNeweggDeals, favicon: 'https://www.newegg.com/favicon.ico' },

  /* United Kingdom, Australia and Europe.

     eBay is the only one of these marketplaces that comes back parseable
     through the proxy. Amazon's UK and AU deals pages return the right title
     and a bot signal but no product markup at all — not the dcl- classes the
     US goldbox page uses, and no a-offscreen prices — on both /deals and
     /gp/goldbox. They are left out rather than added as sources that would
     quietly contribute nothing on every run.

     These use parseEbayDealsIntl, not parseEbayDeals: different domains,
     different number formats, and in Germany's case unquoted HTML attributes.
     Currency is set here rather than read from the page, because only the DE
     tiles carry a priceCurrency meta tag. */
  { store: 'eBay UK', query: 'ebay uk deals', region: 'UK', currency: 'GBP', country: 'gb', url: 'https://www.ebay.co.uk/deals', parse: parseEbayDealsIntl, favicon: 'https://www.ebay.co.uk/favicon.ico' },
  { store: 'eBay Australia', query: 'ebay au deals', region: 'AU', currency: 'AUD', country: 'au', url: 'https://www.ebay.com.au/deals', parse: parseEbayDealsIntl, favicon: 'https://www.ebay.com.au/favicon.ico' },
  { store: 'eBay Germany', query: 'ebay de deals', region: 'EU', currency: 'EUR', country: 'de', url: 'https://www.ebay.de/deals', parse: parseEbayDealsIntl, favicon: 'https://www.ebay.de/favicon.ico' },
];

function envFrom(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, 'utf8').split(/\r?\n/)
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
}

const env = { ...envFrom('/opt/projects/zenrows-strapi-scraper/.env'), ...envFrom(join(ROOT, '.env.local')) };
const KEY = process.env.ZENROWS_API_KEY || env.ZENROWS_API_KEY;
if (!KEY) {
  console.error('ZENROWS_API_KEY not set');
  process.exit(2);
}

async function fetchThrough(url, country = 'us') {
  // The proxy has to sit in the marketplace's own country: eBay UK served from
  // a US exit redirects to ebay.com and the tiles come back in dollars.
  const params = new URLSearchParams({ apikey: KEY, url, js_render: 'true', premium_proxy: 'true', proxy_country: country });
  try {
    const res = await fetch(`https://api.zenrows.com/v1/?${params}`, { signal: AbortSignal.timeout(180_000) });
    if (!res.ok) {
      console.error(`  ZenRows ${res.status}: ${(await res.text()).slice(0, 120)}`);
      return null;
    }
    return res.text();
  } catch (error) {
    console.error(`  request failed: ${error.message}`);
    return null;
  }
}

/* The page groups deals two ways: by retailer and by product category. A
   retailer deals page states the first and says nothing about the second, so
   the category is read off the title.

   Order matters. "smart tv" is tested before "tablet" because Fire TV tablets
   match both, and headphones before smartphone because "phone" is a substring
   of "headphone" — the reason an earlier pass filed every set of earbuds as a
   smartphone. Anything unmatched gets no category rather than a guessed one. */
const CATEGORY_RULES = [
  ['smart tv', /\b(smart ?tv|4k tv|oled tv|qled tv|roku tv|fire tv stick|google tv)\b/i],
  ['headphones', /\b(headphone|headset|earbud|earphone|airpod|in-ear|over-ear)\b/i],
  ['smartwatch', /\b(smart ?watch|apple watch|galaxy watch|fitness tracker|fitbit)\b/i],
  ['laptop', /\b(laptop|notebook|macbook|chromebook|ultrabook|gaming pc)\b/i],
  ['tablet', /\b(tablet|ipad|galaxy tab|fire hd)\b/i],
  ['smartphone', /\b(smart ?phone|iphone|galaxy s\\d|pixel \\d|unlocked phone|cell ?phone)\b/i],
];

function categoryOf(title) {
  return CATEGORY_RULES.find(([, pattern]) => pattern.test(title))?.[0] ?? null;
}

const SYMBOLS = { USD: '$', GBP: '\u00a3', EUR: '\u20ac', AUD: 'A$' };

/* Formatted in the marketplace's own currency, because these prices are not
   converted: a UK deal is quoted in pounds and showing it behind a dollar sign
   would misstate it by roughly a quarter. */
const formatPrice = (value, currency) => `${SYMBOLS[currency] ?? ''}${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

const items = [];
for (const source of SOURCES) {
  const html = await fetchThrough(source.url, source.country);
  if (!html) {
    console.log(`${source.store}: unreachable, skipped`);
    continue;
  }
  const found = source.parse(html);
  console.log(`${source.store}: ${found.length} deals`);

  for (const deal of found) {
    if (!deal.url || !deal.title || deal.price === null) continue;
    items.push({
      id: `${source.store.toLowerCase().replace(/[^a-z0-9]/g, '')}-${deal.id}`,
      query: source.query,
      category: categoryOf(deal.title),
      title: deal.title,
      store: source.store,
      price: formatPrice(deal.price, source.currency),
      priceValue: deal.price,
      originalPrice: deal.wasPrice ? formatPrice(deal.wasPrice, source.currency) : null,
      originalPriceValue: deal.wasPrice ?? null,
      discountPercent: deal.percentOff ?? 0,
      savingsValue: deal.wasPrice ? Number((deal.wasPrice - deal.price).toFixed(2)) : 0,
      image: deal.image ?? '',
      rating: null,
      ratingCount: null,
      shipping: null,
      condition: null,
      currency: source.currency,
      region: source.region,
      favicon: source.favicon,
      url: deal.url,
      badge: deal.badge ?? null,
      source: 'zenrows:retailer-deals',
    });
  }
}

if (!items.length) {
  // Never overwrite a good cache with nothing: a markup change at one retailer
  // would otherwise empty the page silently.
  console.error('\nno deals parsed — leaving the existing cache in place');
  process.exit(1);
}

// Interleave so one retailer cannot fill the top of the page, then rank what
// remains by discount. The page sorts by discount itself, so this only decides
// which rows survive its slice(0, 192).
const byStore = SOURCES.map((s) => items.filter((d) => d.store === s.store).sort((a, b) => b.discountPercent - a.discountPercent));
const mixed = [];
for (let i = 0; mixed.length < items.length; i += 1) {
  for (const list of byStore) if (list[i]) mixed.push(list[i]);
}

const payload = {
  source: 'zenrows:retailer-deals',
  capturedAt: new Date().toISOString(),
  queries: [...SOURCES.map((s) => s.query), ...CATEGORY_RULES.map(([name]) => name)],
  country: 'us',
  language: 'en',
  items: mixed,
};

console.log(`\ntotal ${items.length} deals from ${new Set(items.map((d) => d.store)).size} retailers`);
if (DRY) {
  console.log('[dry-run] nothing written');
  console.log(mixed.slice(0, 5).map((d) => `  -${d.discountPercent}% ${d.price} ${d.title.slice(0, 44)} [${d.store}]`).join('\n'));
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 1));
  console.log(`wrote ${OUT}`);
}
