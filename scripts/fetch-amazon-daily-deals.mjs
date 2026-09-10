#!/usr/bin/env node
/**
 * Amazon Today's Deals -> data/amazon-daily-deals.json
 *
 * Feeds the homepage "Daily Deals" section. Written as a JSON cache rather than
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
const DEALS_URL = 'https://www.amazon.com/gp/goldbox?ref_=nav_cs_gb';

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

function parseDeals(html) {
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

const params = new URLSearchParams({
  apikey: KEY, url: DEALS_URL,
  js_render: 'true', premium_proxy: 'true', proxy_country: 'us',
});

const res = await fetch(`https://api.zenrows.com/v1/?${params}`, { signal: AbortSignal.timeout(180_000) });
if (!res.ok) {
  console.error(`ZenRows ${res.status}: ${(await res.text()).slice(0, 160)}`);
  process.exit(1);
}
const html = await res.text();
const deals = parseDeals(html);

console.log(`parsed ${deals.length} deals (${deals.filter((d) => d.image).length} with an image)`);
for (const d of deals.slice(0, 5)) {
  console.log(`  ${d.asin}  -${d.percentOff}%  $${d.price.toFixed(2)}  ${d.title.slice(0, 48)}`);
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
  writeFileSync(OUT, JSON.stringify({ fetchedAt: new Date().toISOString(), deals }, null, 1));
  console.log(`\nwrote ${OUT}`);
}
