#!/usr/bin/env node
// Convert merchant destination URLs into Takeads affiliate links and cache the
// result in data/takeads-links.json, keyed by the original URL.
//
//   node scripts/fetch-takeads-links.mjs            # convert everything uncached
//   node scripts/fetch-takeads-links.mjs --probe    # one URL, dump raw response
//   node scripts/fetch-takeads-links.mjs --limit 50 # cap a first run
//
// Env (.env.local):
//   TAKEADS_PUBLIC_KEY   required — Platforms -> Configure integration.
//                        NOT the Reporting Public Key, which 401s here.
//   TAKEADS_SUB_ID       optional — sub-tracking passed to the affiliate link.
//
// Verified contract (confirmed against the live API):
//   PUT https://api.takeads.com/v1/product/monetize-api/v2/resolve
//   Authorization: Bearer <public key>
//   { "iris": ["https://merchant.example/product"] }
// POST returns 404 and the field is `iris`, plural — both easy to get wrong.
//
// Why a cache file rather than a call at render time: Takeads monetization is a
// per-URL conversion API, unlike Impact which hands out a reusable deep-link
// template. Calling it while rendering would put a network round trip in the
// path of every product page and every ISR revalidation. Converting on a cron
// and reading a local map at render keeps the page build free and offline, the
// same shape as data/impact-links.json.
//
// Existing affiliate links are never sent. A URL that already points at Impact,
// Amazon with our tag or any other network is skipped, because
// re-affiliating someone else's link is how attribution disputes start.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
for (const line of (existsSync(join(ROOT, '.env.local')) ? readFileSync(join(ROOT, '.env.local'), 'utf8') : '').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const ENDPOINT = 'https://api.takeads.com/v1/product/monetize-api/v2/resolve';
const OUT = join(ROOT, 'data', 'takeads-links.json');
const BATCH = 20;

const args = process.argv.slice(2);
const probe = args.includes('--probe');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? Number(args[limitIdx + 1]) : null;

const KEY = process.env.TAKEADS_PUBLIC_KEY;
if (!KEY) {
  console.error('TAKEADS_PUBLIC_KEY missing from .env.local — Takeads dashboard → Platforms → Configure integration.');
  process.exit(1);
}

/**
 * Optional sub-tracking value passed through to the affiliate link, so clicks
 * can be attributed to a section or campaign in Takeads reporting. The platform
 * itself is identified by the public key, which is issued per platform — the
 * Platform ID is not part of this request.
 */
const SUB_ID = process.env.TAKEADS_SUB_ID || null;

/**
 * Hosts we already monetise. Sending these to Takeads would either double-wrap
 * an existing affiliate link or hand another network's commission away.
 */
const ALREADY_AFFILIATED = [
  'tatrck.com',                      // Takeads' own tracking domain — a link we
                                     // already converted must never be sent back
                                     // through the converter and wrapped twice
  'goto.walmart.com', 'linksynergy.com', 'go.skimresources.com',
  'prf.hn', 'imp.i',                  // Impact deep links
  'ebay.com/ulk',                     // eBay EPN
  'awin1.com', 'tradedoubler.com', 'admitad.com',
];

const isAffiliatedHost = (url) => ALREADY_AFFILIATED.some((h) => url.includes(h));

/*
 * Amazon is monetised by our own Associates tag, so it must never be handed to
 * Takeads. The header above always claimed this was skipped, but no check
 * existed: a first run converted 20 tagged amazon.com URLs, which would have
 * routed clicks on our best-earning merchant through Takeads and dropped
 * `tag=unitradeco-20` on the way.
 *
 * Any amazon host is refused, tagged or not — an untagged Amazon URL is a bug
 * to fix in the tag logic, not a URL to sell to another network.
 */
const isAmazon = (url) => /(^|\.)amazon\.[a-z.]+/i.test((() => {
  try { return new URL(url).hostname; } catch { return ''; }
})());

/*
 * Takeads monetises a merchant product page. The offer feeds also hold Google
 * Shopping *search* URLs (google.com/search?ibp=oshop&prds=catalogid:...),
 * which are not a merchant destination and are rejected with HTTP 400 — and
 * because the API is called in batches, one of them fails the whole batch.
 * That is what made batches 1 and 2 fail on every run while the rest succeeded.
 */
const isNonMerchant = (url) => {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    return h === 'google.com' || h.endsWith('.google.com');
  } catch { return true; }
};

/*
 * Domains Impact already deep-links, read from data/impact-links.json rather
 * than hard-coded so adding an advertiser there is enough. Walmart is the only
 * one today: its raw www.walmart.com offer URLs are wrapped by
 * wrapImpactAffiliate at render, so handing them to Takeads as well would put
 * two networks on the same click.
 */
function impactDomains() {
  try {
    const p = join(ROOT, 'data', 'impact-links.json');
    if (!existsSync(p)) return [];
    const advertisers = JSON.parse(readFileSync(p, 'utf8')).advertisers ?? {};
    return Object.values(advertisers)
      .filter((a) => a?.allowsDeeplinking)
      .flatMap((a) => a.deeplinkDomains ?? [])
      .map((d) => String(d).replace(/^\*\./, '').toLowerCase());
  } catch {
    return [];
  }
}

const IMPACT_DOMAINS = impactDomains();

const isImpactCovered = (url) => {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return IMPACT_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`));
  } catch {
    return false;
  }
};

const isAffiliated = (url) =>
  isAffiliatedHost(url) || isAmazon(url) || isNonMerchant(url) || isImpactCovered(url);

function readCache() {
  try {
    return existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { links: {}, checkedAt: null };
  } catch {
    return { links: {}, checkedAt: null };
  }
}

/**
 * Ask Takeads to monetize a batch of URLs.
 *
 * Request shape is confirmed. The response field names are still tolerant —
 * the docs host blocks automated fetches, so the exact key for the affiliated
 * link is matched across the plausible names rather than assumed. `--probe`
 * prints the raw body if it ever needs pinning down.
 */
async function monetize(urls) {
  const body = { iris: urls };
  if (SUB_ID) body.subId = SUB_ID;

  // PUT, not POST — the resolve endpoint rejects POST with a bare 404.
  const res = await fetch(ENDPOINT, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (probe) console.log(`\nPUT ${ENDPOINT}\n  body: ${JSON.stringify(body).slice(0,200)}\n  HTTP ${res.status}: ${text.slice(0,900)}\n`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);

  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error(`Response was not JSON: ${text.slice(0, 200)}`); }

  // Each row pairs the submitted IRI with its affiliated link.
  const rows = json.data ?? json.results ?? json.items ?? (Array.isArray(json) ? json : []);
  const out = {};
  for (const row of rows) {
    const from = row.iri ?? row.url ?? row.originalUrl;
    const to = row.trackingLink ?? row.affiliateLink ?? row.affiliateUrl ?? row.link;
    if (typeof from === 'string' && typeof to === 'string' && to.startsWith('http')) out[from] = to;
  }
  if (!Object.keys(out).length && rows.length) {
    console.warn('  ⚠️  Rows returned but no field pair matched — run --probe and fix the mapping.');
  }
  return out;
}

/**
 * Destination URLs for every offer attached to a product tagged for this site.
 *
 * The two on-disk feeds this script started with hold only Amazon best-sellers
 * and Google Shopping deals — both correctly refused above — so on their own
 * they yield nothing to convert. The offers worth monetising (Best Buy, Newegg,
 * Target, Apple and the rest of the long tail) only exist in Strapi.
 */
async function strapiOfferUrls() {
  const base = (process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL || '').replace(/\/$/, '');
  const token = process.env.STRAPI_API_TOKEN;
  if (!base || !token) {
    console.warn('STRAPI_INTERNAL_URL / STRAPI_API_TOKEN missing — skipping Strapi offers.');
    return [];
  }
  const tag = process.env.NEXT_PUBLIC_SITE_PRODUCT_TAG || 'nxt-bargains';
  const found = new Set();

  for (let page = 1; page <= 50; page += 1) {
    const q = new URLSearchParams({
      'pagination[pageSize]': '200',
      'pagination[page]': String(page),
      'populate[product][fields][0]': 'tags',
    });
    const res = await fetch(`${base}/api/commerce-offers?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.warn(`  Strapi offers page ${page}: HTTP ${res.status} — stopping.`);
      break;
    }
    const json = await res.json();
    for (const offer of json.data ?? []) {
      // Offers are a pool shared with the other storefronts; only this site's
      // links should be converted against this site's Takeads key.
      const tags = JSON.stringify(offer.product?.tags ?? []);
      if (!tags.includes(tag)) continue;
      const url = offer.productUrl || offer.url || offer.affiliateUrl;
      if (typeof url === 'string' && /^https?:\/\//.test(url)) found.add(url);
    }
    const meta = json.meta?.pagination;
    if (!meta || page >= meta.pageCount) break;
  }
  return [...found];
}

async function main() {
  if (probe) {
    const sample = args.find((a) => a.startsWith('http')) ?? 'https://www.walmart.com/ip/123';
    console.log(`Probing with: ${sample}`);
    const got = await monetize([sample]);
    console.log('Parsed mapping:', got);
    return;
  }

  // Collect distinct destination URLs from the offer feeds already on disk.
  const urls = new Set();
  for (const u of await strapiOfferUrls()) if (!isAffiliated(u)) urls.add(u);
  for (const file of ['best-deals-realtime.json', 'best-sellers.json']) {
    const p = join(ROOT, 'data', file);
    if (!existsSync(p)) continue;
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(walk);
      for (const [k, v] of Object.entries(node)) {
        if (typeof v === 'string' && /^https?:\/\//.test(v) && /url/i.test(k) && !isAffiliated(v)) {
          urls.add(v);
        } else walk(v);
      }
    };
    walk(JSON.parse(readFileSync(p, 'utf8')));
  }

  const cache = readCache();
  let pending = [...urls].filter((u) => !cache.links[u]);
  if (limit) pending = pending.slice(0, limit);

  console.log(`${urls.size} candidate URLs, ${pending.length} not yet converted`);
  if (!pending.length) return;

  let converted = 0;
  for (let i = 0; i < pending.length; i += BATCH) {
    const slice = pending.slice(i, i + BATCH);
    try {
      const got = await monetize(slice);
      Object.assign(cache.links, got);
      converted += Object.keys(got).length;
      console.log(`  batch ${i / BATCH + 1}: ${Object.keys(got).length}/${slice.length} converted`);
    } catch (e) {
      // Keep the previous good cache on failure, same as fetch-impact-links.
      console.error(`  batch ${i / BATCH + 1} failed: ${e.message}`);
    }
  }

  cache.checkedAt = new Date().toISOString();
  writeFileSync(OUT, JSON.stringify(cache, null, 2));
  console.log(`\n✅ ${converted} links converted — data/takeads-links.json now holds ${Object.keys(cache.links).length}`);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
