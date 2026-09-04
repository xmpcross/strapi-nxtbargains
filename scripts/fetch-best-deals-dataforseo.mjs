#!/usr/bin/env node
// Refresh /best-deals from DataForSEO Google Shopping.
// Usage: node scripts/fetch-best-deals-dataforseo.mjs [--write]

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
for (const line of (existsSync(join(ROOT, '.env.local')) ? readFileSync(join(ROOT, '.env.local'), 'utf8') : '').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const WRITE = process.argv.includes('--write');
const BASIC = process.env.DATAFORSEO_PASSWORD;
const PER_QUERY = 12;
const OUT = join(ROOT, 'data', 'best-deals-realtime.json');
const ENDPOINT = 'https://api.dataforseo.com/v3/merchant/google/products';
const QUERIES = [
  'laptop deals sale',
  'smart tv deals sale',
  'headphones deals sale',
  'smartphone deals sale',
  'tablet deals sale',
  'smartwatch deals sale',
  'amazon deals',
  'best buy deals',
  'walmart deals',
  'ebay deals',
  'target deals',
  'newegg deals',
  'dell deals',
  'hp deals',
  'lenovo deals',
  'samsung deals',
];
const LABELS = [
  'laptop',
  'smart tv',
  'headphones',
  'smartphone',
  'tablet',
  'smartwatch',
  'amazon deals',
  'best buy deals',
  'walmart deals',
  'ebay deals',
  'target deals',
  'newegg deals',
  'dell deals',
  'hp deals',
  'lenovo deals',
  'samsung deals',
];

if (!BASIC) {
  console.error('DATAFORSEO_PASSWORD is not set in .env.local');
  process.exit(1);
}

const headers = { Authorization: `Basic ${BASIC}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const number = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value && typeof value === 'object') return number(value.current ?? value.value ?? value.price);
  const match = String(value ?? '').replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};
const money = (value) => value == null ? null : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

async function request(url, options) {
  const response = await fetch(url, options);
  const json = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(json).slice(0, 240)}`);
  return json;
}

async function postTasks() {
  const payload = QUERIES.map((keyword) => ({
    keyword,
    location_code: 2840,
    language_code: 'en',
    depth: 100,
  }));
  const json = await request(`${ENDPOINT}/task_post`, { method: 'POST', headers, body: JSON.stringify(payload) });
  return (json.tasks ?? []).map((task, index) => {
    if (!task.id) throw new Error(`Task failed for ${LABELS[index]}: ${task.status_message}`);
    return { id: task.id, label: LABELS[index], cost: Number(task.cost) || 0 };
  });
}

async function collect(tasks) {
  const results = new Map();
  let pending = tasks;
  for (let round = 0; round < 30 && pending.length; round += 1) {
    await sleep(5000);
    const next = [];
    for (const taskInfo of pending) {
      const json = await request(`${ENDPOINT}/task_get/advanced/${taskInfo.id}`, { headers: { Authorization: headers.Authorization } });
      const task = json.tasks?.[0];
      if (task?.status_code === 20000 && task.result) results.set(taskInfo.label, task.result[0]?.items ?? []);
      else if (task?.status_code === 40601 || task?.status_code === 40602) next.push(taskInfo);
      else throw new Error(`Collection failed for ${taskInfo.label}: ${task?.status_code ?? 'unknown'} ${task?.status_message ?? ''}`);
    }
    pending = next;
    console.log(`Collected ${results.size}/${tasks.length} searches`);
  }
  if (pending.length) throw new Error(`Timed out waiting for: ${pending.map((task) => task.label).join(', ')}`);
  return results;
}

function mapItem(raw, query, index) {
  const current = number(raw.price ?? raw.price_from);
  const regular = number(raw.old_price ?? raw.original_price ?? raw.price?.regular ?? raw.price?.max_value);
  const original = regular !== null && current !== null && regular > current ? regular : null;
  const savings = original !== null && current !== null ? original - current : 0;
  const discount = original !== null && current !== null ? Math.round((savings / original) * 100) : 0;
  const rating = raw.rating && typeof raw.rating === 'object' ? number(raw.rating.value) : number(raw.product_rating ?? raw.rating);
  const ratingCount = raw.rating && typeof raw.rating === 'object' ? number(raw.rating.votes_count) : number(raw.reviews_count);
  return {
    id: String(raw.product_id ?? raw.data_docid ?? raw.url ?? `${query}-${index}`),
    query,
    title: raw.title ?? '',
    store: raw.seller ?? raw.source ?? raw.domain ?? 'Merchant',
    price: money(current),
    priceValue: current,
    originalPrice: money(original),
    originalPriceValue: original,
    discountPercent: discount,
    savingsValue: savings,
    image: raw.image_url ?? raw.image ?? raw.product_images?.[0] ?? '',
    rating,
    ratingCount,
    shipping: typeof raw.delivery_info === 'string' ? raw.delivery_info : raw.delivery_info?.delivery_message ?? raw.shipping_info ?? null,
    condition: raw.condition ?? null,
    favicon: null,
    url: raw.url ?? raw.product_url ?? raw.shopping_url ?? '',
    source: 'dataforseo:google-shopping',
  };
}

const tasks = await postTasks();
console.log(`Posted ${tasks.length} searches; estimated cost $${tasks.reduce((sum, task) => sum + task.cost, 0).toFixed(4)}`);
const rawByQuery = await collect(tasks);
const items = [];
for (const label of LABELS) {
  const seen = new Set();
  const rawItems = (rawByQuery.get(label) ?? []).flatMap((raw) =>
    Array.isArray(raw.items) ? raw.items : [raw]
  );
  const mapped = rawItems
    .map((raw, index) => mapItem(raw, label, index))
    .filter((item) => item.title && item.image && item.url && item.priceValue !== null)
    .filter((item) => {
      const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 100);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, PER_QUERY);
  if (!mapped.length && rawItems[0]) {
    console.log(`${label} sample: type=${rawItems[0].type}; keys=${Object.keys(rawItems[0]).join(',')}`);
  }
  console.log(`${label}: ${mapped.length}/${PER_QUERY}`);
  items.push(...mapped);
}

const thin = LABELS.filter((label) => items.filter((item) => item.query === label).length < PER_QUERY);
if (thin.length) throw new Error(`Fewer than ${PER_QUERY} usable products for: ${thin.join(', ')}; cache left untouched`);
if (!WRITE) {
  console.log(`Dry run complete: ${items.length} deals. Re-run with --write to update the cache.`);
  process.exit(0);
}
writeFileSync(OUT, `${JSON.stringify({
  source: 'dataforseo:google-shopping',
  capturedAt: new Date().toISOString(),
  queries: LABELS,
  country: 'us',
  language: 'en',
  items,
}, null, 2)}\n`);
console.log(`Wrote ${items.length} deals to ${OUT}`);
