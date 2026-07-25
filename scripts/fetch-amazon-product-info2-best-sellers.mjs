#!/usr/bin/env node
// Refresh Amazon best sellers using RapidAPI Amazon Product Info2.
//
// The Product Info2 API exposes Amazon SERP/listing data with richer badge
// fields than the older best-seller cache provider. This script writes the same
// data/best-sellers.json shape the storefront already reads, plus optional
// badge/ranking fields used by BestSellerCard.
//
// Usage:
//   node scripts/fetch-amazon-product-info2-best-sellers.mjs
//   node scripts/fetch-amazon-product-info2-best-sellers.mjs --query="electronics best sellers" --limit=30
//   node scripts/fetch-amazon-product-info2-best-sellers.mjs --categories
//   node scripts/fetch-amazon-product-info2-best-sellers.mjs --categories --limit=8
//   node scripts/fetch-amazon-product-info2-best-sellers.mjs --details-limit=12
//
// Env (.env.local):
//   RAPIDAPI_AMAZON_KEY or RAPIDAPI_PRODUCT_SEARCH_KEY or RAPIDAPI_KEY
//   NEXT_PUBLIC_AMAZON_AFFILIATE_TAG
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
loadEnv(join(ROOT, '.env.local'));

const arg = (key, fallback = '') => process.argv.find((item) => item.startsWith(`--${key}=`))?.split('=').slice(1).join('=') ?? fallback;
const hasFlag = (key) => process.argv.includes(`--${key}`);
const KEY = process.env.RAPIDAPI_AMAZON_KEY || process.env.RAPIDAPI_PRODUCT_SEARCH_KEY || process.env.RAPIDAPI_KEY || '';
const HOST = process.env.RAPIDAPI_AMAZON_PRODUCT_INFO2_HOST || 'amazon-product-info2.p.rapidapi.com';
const SERP_PATH = normalizePath(process.env.RAPIDAPI_AMAZON_PRODUCT_INFO2_SERP_PATH || '/Amazon/serp');
const DETAILS_PATH = normalizePath(process.env.RAPIDAPI_AMAZON_PRODUCT_INFO2_DETAILS_PATH || '/Amazon/details_asin');
const QUERY = arg('query', process.env.AMAZON_PRODUCT_INFO2_BESTSELLERS_QUERY || process.env.BESTSELLERS_QUERY || 'electronics best sellers');
const CATEGORY = arg('category', process.env.BESTSELLERS_CATEGORY || 'electronics');
const USE_CATEGORIES = hasFlag('categories') || process.env.AMAZON_PRODUCT_INFO2_BESTSELLERS_BY_CATEGORY === 'true';
const LIMIT = positiveInt(arg('limit', process.env.BESTSELLERS_LIMIT || '30'), 30);
const DETAILS_LIMIT = positiveInt(arg('details-limit', process.env.AMAZON_PRODUCT_INFO2_DETAILS_LIMIT || '12'), 12);
const TAG = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG || process.env.AMAZON_AFFILIATE_TAG || '';
const OUT = join(ROOT, 'data', 'best-sellers.json');
const CATEGORY_CONFIG = [
  { key: 'smart-phones', label: 'Smart Phones', query: 'amazon best sellers unlocked smartphones' },
  { key: 'laptops', label: 'Laptops', query: 'amazon best sellers laptops' },
  { key: 'tablets', label: 'Tablets', query: 'amazon best sellers tablets' },
  { key: 'smartwatches', label: 'Smartwatches', query: 'amazon best sellers smartwatches' },
  { key: 'headphones', label: 'Headphones', query: 'amazon best sellers headphones earbuds' },
  { key: 'smart-tvs', label: 'Smart TVs', query: 'amazon best sellers smart tvs' },
  { key: 'smart-home', label: 'Smart Home', query: 'amazon best sellers smart home devices' },
  { key: 'smart-electronics', label: 'Smart Electronics', query: 'amazon best sellers smart electronics gadgets' },
];

if (!KEY) {
  console.error('Set RAPIDAPI_AMAZON_KEY, RAPIDAPI_PRODUCT_SEARCH_KEY, or RAPIDAPI_KEY in .env.local.');
  process.exit(1);
}

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

function normalizePath(value) {
  const path = String(value || '').trim();
  return path.startsWith('/') ? path : `/${path}`;
}

function positiveInt(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function numericValue(value) {
  const cleaned = String(value ?? '').replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function ratingValue(value) {
  const match = String(value ?? '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function affiliateUrl(asin, productUrl) {
  const url = asin ? `https://www.amazon.com/dp/${asin}` : productUrl;
  if (!url) return '';
  if (!TAG) return url;
  return `${url}${url.includes('?') ? '&' : '?'}tag=${encodeURIComponent(TAG)}`;
}

function request(path, params) {
  const url = new URL(`https://${HOST}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  return fetch(url, {
    headers: {
      'X-RapidAPI-Key': KEY,
      'X-RapidAPI-Host': HOST,
    },
    cache: 'no-store',
  });
}

async function fetchSerpPage(page) {
  return fetchSerpPageForQuery(QUERY, page);
}

async function fetchSerpPageForQuery(query, page) {
  const response = await request(SERP_PATH, { query, page });
  const text = await response.text();
  if (!response.ok) throw new Error(`SERP HTTP ${response.status}: ${text.slice(0, 300)}`);
  const payload = JSON.parse(text);
  return productsFromPayload(payload);
}

async function fetchDetails(asin) {
  if (!asin) return null;
  const response = await request(DETAILS_PATH, { asin });
  const text = await response.text();
  if (!response.ok) throw new Error(`details ${asin} HTTP ${response.status}: ${text.slice(0, 180)}`);
  const payload = JSON.parse(text);
  return payload.body && typeof payload.body === 'object' ? payload.body : payload;
}

function productsFromPayload(payload) {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  const containers = [payload, payload.body, payload.data].filter(isRecord);
  const products = [];
  for (const container of containers) {
    for (const key of ['products', 'results', 'items', 'search_results']) {
      if (Array.isArray(container[key])) products.push(...container[key].filter(isRecord));
    }
  }
  return products;
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function textField(record, keys) {
  if (!isRecord(record)) return '';
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function stringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => typeof item === 'string' ? item.trim() : textField(item, ['label', 'text', 'name', 'value']))
    .filter(Boolean);
}

function rankingBadgesFromDetail(detail) {
  const badges = [];
  const fields = [
    detail?.bestSellersRank,
    detail?.best_sellers_rank,
    detail?.bestSellerRank,
    detail?.salesRank,
    detail?.sales_rank,
    detail?.rank,
  ];
  for (const field of fields) {
    if (typeof field === 'string' && field.trim()) badges.push(field.trim());
    if (Array.isArray(field)) badges.push(...field.map((item) => typeof item === 'string' ? item : textField(item, ['rank', 'category', 'name', 'text'])).filter(Boolean));
    if (isRecord(field)) {
      const rank = textField(field, ['rank', 'position', 'value']);
      const category = textField(field, ['category', 'name', 'label']);
      if (rank || category) badges.push([rank, category].filter(Boolean).join(' in '));
    }
  }
  return Array.from(new Set(badges)).slice(0, 3);
}

function mapProduct(item, index, detail = null, category = null) {
  const asin = textField(item, ['asin', 'product_asin']);
  const title = textField(item, ['name', 'product_title', 'title']);
  const price = textField(item, ['price', 'product_price']);
  const image = textField(item, ['image', 'product_photo', 'product_image', 'thumbnail', 'mainImage']);
  const productUrl = textField(item, ['url', 'product_url', 'canonicalUrl']);
  const boughtInfo = textField(item, ['boughtInfo', 'bought_info']);
  const couponInfo = textField(item, ['couponInfo', 'coupon_info']);
  const dealBadge = textField(item, ['dealBadge', 'deal_badge']) || textField(detail, ['dealBadge', 'deal_badge']);
  const badges = [
    ...stringArray(item.badgesInfo),
    ...stringArray(item.badges),
    ...rankingBadgesFromDetail(detail),
  ];
  if (dealBadge) badges.unshift(dealBadge);
  if (couponInfo) badges.unshift('Coupon');
  if (boughtInfo) badges.push(boughtInfo);
  if (detail?.isPrime || item.isPrime) badges.push('Prime');

  return {
    rank: numericValue(textField(item, ['rank', 'product_rank'])) ?? index + 1,
    asin,
    marketplace: 'amazon',
    category: category?.key ?? CATEGORY,
    categoryLabel: category?.label ?? CATEGORY,
    title,
    price: price || null,
    priceValue: numericValue(item.rawPrice ?? price),
    image,
    rating: ratingValue(textField(item, ['customerReview', 'product_star_rating', 'rating'])),
    ratingCount: numericValue(textField(item, ['customerReviewCount', 'product_num_ratings', 'rating_count', 'reviews_count'])),
    url: affiliateUrl(asin, productUrl),
    badge: badges[0] || null,
    badges: Array.from(new Set(badges)).filter(Boolean).slice(0, 5),
    boughtInfo: boughtInfo || null,
    couponInfo: couponInfo || null,
    dealBadge: dealBadge || null,
    isPrime: Boolean(detail?.isPrime || item.isPrime),
    sponsored: Boolean(item.sponsoredAd),
    source: 'amazon-product-info2',
  };
}

async function fetchProductsForQuery({ query, category, limit }) {
  const raw = [];
  for (let page = 1; raw.length < limit && page <= 5; page += 1) {
    const pageItems = await fetchSerpPageForQuery(query, page);
    if (!pageItems.length) break;
    raw.push(...pageItems);
  }

  const selected = raw.slice(0, limit);
  if (!selected.length) throw new Error('Product Info2 returned 0 products; cache left untouched.');

  const details = new Map();
  for (const item of selected.slice(0, DETAILS_LIMIT)) {
    const asin = textField(item, ['asin', 'product_asin']);
    if (!asin) continue;
    try {
      details.set(asin, await fetchDetails(asin));
    } catch (error) {
      console.warn(`detail skipped for ${asin}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return selected
    .map((item, index) => mapProduct(item, index, details.get(textField(item, ['asin', 'product_asin'])) ?? null, category))
    .filter((item) => item.title && item.image && item.url);
}

async function main() {
  const batches = USE_CATEGORIES
    ? CATEGORY_CONFIG.map((category) => ({ query: category.query, category, limit: LIMIT }))
    : [{ query: QUERY, category: { key: CATEGORY, label: CATEGORY }, limit: LIMIT }];

  const items = [];
  for (const batch of batches) {
    const batchItems = await fetchProductsForQuery(batch);
    console.log(`Fetched ${batchItems.length} Amazon best sellers for ${batch.category.label}`);
    items.push(...batchItems);
  }

  if (!items.length) throw new Error('Product Info2 returned 0 usable products; cache left untouched.');

  writeFileSync(OUT, `${JSON.stringify({
    category: USE_CATEGORIES ? 'multiple' : CATEGORY,
    categories: USE_CATEGORIES ? CATEGORY_CONFIG : undefined,
    query: USE_CATEGORIES ? 'multiple category best sellers' : QUERY,
    source: 'amazon-product-info2',
    capturedAt: new Date().toISOString(),
    items,
  }, null, 2)}\n`);

  console.log(`Wrote ${items.length} Product Info2 Amazon best sellers -> ${OUT}`);
  console.log(`Badges on ${items.filter((item) => item.badges?.length).length}/${items.length} items`);
}

main().catch((error) => {
  console.error('fetch-amazon-product-info2-best-sellers failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
