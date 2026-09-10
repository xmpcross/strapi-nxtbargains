#!/usr/bin/env node
/**
 * Amazon Today's Deals + eBay Daily Deals + Walmart Flash Deals
 * -> data/amazon-daily-deals.json
 *
 * Feeds the homepage "Popular Deals" section. Written as a JSON cache rather than
 * Strapi records because these are not catalogue products: they are whatever
 * Amazon is discounting today, they turn over daily, and none of them are
 * price-compared against other merchants. That is the same shape as
 * amazon-new-releases.json, which the "New on Amazon" section reads.
 *
 * ZenRows, not DataForSEO: DataForSEO answers a keyword or an id, and has no
 * endpoint for "what is discounted today", so the goldbox page is the only
 * route. It needs js_render and a premium proxy — without them Amazon returns a
 * bot wall — which is its most expensive tier, hence once a day from cron
 * rather than per request.
 *
 *   node scripts/fetch-amazon-daily-deals.mjs
 *   node scripts/fetch-amazon-daily-deals.mjs --dry-run
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DRY = process.argv.includes('--dry-run');
const OUT = join(ROOT, 'data', 'amazon-daily-deals.json');
const SOURCES = [
  { merchant: 'Amazon', url: 'https://www.amazon.com/gp/goldbox?ref_=nav_cs_gb', parse: parseAmazonDeals },
  { merchant: 'eBay', url: 'https://www.ebay.com/deals', parse: parseEbayDeals },
  { merchant: 'Walmart', url: 'https://www.walmart.com/shop/deals/flash-deals-shopall', parse: parseWalmartDeals },
];

function envFrom(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, 'utf8').split(/\r?\n/)
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
}

const env = {
  ...envFrom('/opt/projects/zenrows-strapi-scraper/.env'),
  ...envFrom(join(ROOT, '.env.local')),
};
const KEY = process.env.ZENROWS_API_KEY || env.ZENROWS_API_KEY;
if (!KEY) {
  console.error('ZENROWS_API_KEY not set');
  process.exit(2);
}

/* Cards are found by their link element. `dcl-product` also appears ~330 times
   inside the page's <style> block, so matching on the container class finds CSS
   rather than markup. A card runs from one link to the next, read one at a time
   so a price cannot be taken from the neighbouring card. */
const CARD_ANCHOR = /<a[^>]*class="[^"]*dcl-product-link[^"]*"[^>]*>/g;
const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const money = (v) => (v ? Number(v.replace(/,/g, '')) : null);

function parseAmazonDeals(html) {
  const anchors = [...html.matchAll(CARD_ANCHOR)].map((m) => m.index);
  const out = [];
  const seen = new Set();

  for (let i = 0; i < anchors.length; i += 1) {
    const block = html.slice(anchors[i], anchors[i + 1] ?? html.length);
    const asin = block.match(/href="[^"]*?\/dp\/([A-Z0-9]{10})/)?.[1];
    if (!asin || seen.has(asin)) continue;

    const title = strip(block.slice(0, block.indexOf('</a>') + 1));
    if (title.length < 8) continue;

    const price = money(block.match(/dcl-product-price-new[^"]*"[\s\S]*?<span class="a-offscreen">\s*\$?([\d,]+(?:\.\d{2})?)/)?.[1]);
    const was = money(block.match(/dcl-product-price-old[^"]*"[\s\S]*?<span class="a-offscreen">\s*\$?([\d,]+(?:\.\d{2})?)/)?.[1]);
    let pct = Number(strip(block).match(/(\d{1,2})%\s*off/i)?.[1]) || null;
    if (price === null) continue;
    // A card with no discount is a recommendation, not a deal: the page carries
    // ordinary carousels using the same markup.
    if (!pct && was && was > price) pct = Math.round((1 - price / was) * 100);
    if (!pct) continue;

    // src precedes class on these tags, so the img is located first and its src
    // read out of it rather than matching the two in a fixed order.
    const imgTag = block.match(/<img[^>]*dcl-dynamic-image[^>]*>/)?.[0];
    seen.add(asin);
    out.push({
      asin,
      title,
      price,
      wasPrice: was,
      percentOff: pct,
      currency: 'USD',
      image: imgTag?.match(/src="([^"]+)"/)?.[1] ?? null,
      badge: block.match(/>(Limited time deal|Deal of the Day|Prime Exclusive Deal|Lightning Deal)</i)?.[1] ?? null,
      url: `https://www.amazon.com/dp/${asin}`,
    });
  }
  return out;
}


/* eBay's deals page shares no markup with Amazon's.

   Tiles are located by their /itm/ link: the container class `dne-itemtile`
   cannot be used, because `\b` also matches before the hyphen in
   `dne-itemtile-title` and `dne-itemtile-price`, which returned 772 "tiles" for
   101 products. The link appears 206 times for those 101 — each product is
   linked twice, from its image and its title — so ids are deduplicated.

   Unlike its search pages, which answer 422 through ZenRows on every attempt,
   this page returns normally. */
function parseEbayDeals(html) {
  const links = [...html.matchAll(/href="https:\/\/www\.ebay\.com\/itm\/(\d+)[^"]*"/g)];
  const out = [];
  const seen = new Set();

  for (const link of links) {
    const id = link[1];
    if (seen.has(id)) continue;
    const block = html.slice(link.index, link.index + 3000);

    const title = block.match(/title="([^"]{8,180})"/)?.[1];
    if (!title) continue;

    /* The amount is not the price node's own text: it sits inside a nested
       <span itemprop="price">, behind a <meta> tag. Matching ">$" directly
       after the class found nothing at all. */
    const price = money(block.match(/dne-itemtile-price[\s\S]{0,240}?\$([\d,]+\.?\d{0,2})/)?.[1]);
    if (price === null) continue;

    // "Previous price: $74.99 17% off" — the was-price and the discount are
    // stated together, so the page's own percentage is preferred to a derived
    // one wherever it is present.
    const was = money(block.match(/Previous price:\s*\$?([\d,]+\.?\d{0,2})/)?.[1]);
    let pct = Number(block.match(/(\d{1,2})%\s*off/i)?.[1]) || null;
    if (!pct && was && was > price) pct = Math.round((1 - price / was) * 100);
    if (!pct) continue;   // a listing, not a deal

    seen.add(id);
    out.push({
      asin: id,
      title: title.replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
      price,
      wasPrice: was,
      percentOff: pct,
      currency: 'USD',
      image: block.match(/<img[^>]*src="(https:\/\/i\.ebayimg[^"]+)"/)?.[1] ?? null,
      badge: block.match(/>(Almost gone|Free shipping|Trending)</i)?.[1] ?? null,
      url: `https://www.ebay.com/itm/${id}`,
    });
  }
  return out;
}


/* Walmart ships its data as JSON, so this reads __NEXT_DATA__ rather than the
   markup. That is the difference between a parser that survives a redesign and
   one that does not — the two above key on class names that have already
   changed under us once each.

   The page also mentions "captcha" three times in bundle filenames while
   serving perfectly good content, so presence of that word is not a block
   signal here; the real ones (px-captcha, "robot or human") are absent. */
function parseWalmartDeals(html) {
  const raw = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!raw) return [];

  let stacks;
  try {
    stacks = JSON.parse(raw)?.props?.pageProps?.initialData?.searchResult?.itemStacks ?? [];
  } catch {
    return [];
  }

  const out = [];
  const seen = new Set();
  for (const stack of stacks) {
    for (const item of stack.items ?? []) {
      const id = item.usItemId;
      if (!id || seen.has(id) || !item.name) continue;

      const info = item.priceInfo ?? {};
      const price = money(String(info.linePrice ?? info.currentPrice ?? '').replace(/[^\d.,]/g, ''));
      const was = money(String(info.wasPrice ?? '').replace(/[^\d.,]/g, ''));
      if (price === null) continue;
      // Flash-deals pages carry filler rows with no saving; without a was-price
      // above the current one there is no deal to show.
      if (!was || was <= price) continue;

      seen.add(id);
      out.push({
        asin: String(id),
        title: item.name,
        price,
        wasPrice: was,
        percentOff: Math.round((1 - price / was) * 100),
        currency: 'USD',
        image: item.imageInfo?.thumbnailUrl ?? null,
        badge: item.badges?.flags?.[0]?.text ?? null,
        url: item.canonicalUrl ? `https://www.walmart.com${item.canonicalUrl.split('?')[0]}` : null,
      });
    }
  }
  return out.filter((d) => d.url);
}

async function fetchThrough(url) {
  const params = new URLSearchParams({
    apikey: KEY, url,
    js_render: 'true', premium_proxy: 'true', proxy_country: 'us',
  });
  const res = await fetch(`https://api.zenrows.com/v1/?${params}`, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) {
    console.error(`  ZenRows ${res.status} on ${url}: ${(await res.text()).slice(0, 120)}`);
    return null;
  }
  return res.text();
}

const deals = [];
for (const source of SOURCES) {
  const html = await fetchThrough(source.url);
  if (!html) continue;
  const found = source.parse(html).map((d) => ({ ...d, merchant: source.merchant }));
  console.log(`${source.merchant}: ${found.length} deals (${found.filter((d) => d.image).length} with an image)`);
  for (const d of found.slice(0, 3)) {
    console.log(`  -${d.percentOff}%  $${d.price.toFixed(2)}  ${d.title.slice(0, 46)}`);
  }
  deals.push(...found);
}

// Interleave the sources so one merchant does not fill the whole row.
const byMerchant = SOURCES.map((s) => deals.filter((d) => d.merchant === s.merchant));
const mixed = [];
for (let i = 0; mixed.length < deals.length; i += 1) {
  for (const list of byMerchant) if (list[i]) mixed.push(list[i]);
}

if (!deals.length) {
  // Never overwrite a good cache with nothing: Amazon changing its markup
  // would otherwise empty the homepage section silently.
  console.error('no deals parsed — leaving the existing cache in place');
  process.exit(1);
}

if (DRY) {
  console.log('\n[dry-run] nothing written');
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ fetchedAt: new Date().toISOString(), deals: mixed }, null, 1));
  console.log(`\nwrote ${OUT}`);
}
