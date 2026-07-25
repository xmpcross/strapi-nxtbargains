#!/usr/bin/env node
// Revive the Walmart / Target / Best Buy / Newegg best-seller lists using
// OpenWeb Ninja's Real-Time Product Search (the `stores=` filter returns a clean
// per-merchant list). Amazon-product-info2 is Amazon-only and the old RapidAPI
// real-time-product-search is gone, so this is their data source.
//
// FRUGAL BY DESIGN: 1 request per merchant (4/run). With the free 100/month plan,
// run WEEKLY (≈16/month). A monthly counter (data/openwebninja-usage.json) hard-
// stops before the cap so the quota is never exceeded.
//
//   node scripts/fetch-openwebninja-store-bestsellers.mjs [--limit=15] [--dry]
//
// Env (.env.local):
//   OPENWEBNINJA_API_KEY          your OpenWeb Ninja key (ak_...)    [required]
//   OPENWEBNINJA_MONTHLY_LIMIT    monthly request cap (default 100)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
for (const line of (existsSync(join(ROOT, '.env.local')) ? readFileSync(join(ROOT, '.env.local'), 'utf8') : '').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const DRY = process.argv.includes('--dry');
const KEY = process.env.OPENWEBNINJA_API_KEY;
const BASE = (process.env.OPENWEBNINJA_BASE_URL || 'https://api.openwebninja.com/realtime-product-search/v2').replace(/\/$/, '');
const MONTHLY_LIMIT = Math.max(0, parseInt(process.env.OPENWEBNINJA_MONTHLY_LIMIT || '100', 10) || 0);
const LIMIT = Math.max(1, parseInt(arg('limit', '15'), 10) || 15);
const USAGE = join(ROOT, 'data', 'openwebninja-usage.json');

if (!KEY) { console.error('OPENWEBNINJA_API_KEY not set in .env.local — aborting.'); process.exit(1); }

const enc = encodeURIComponent;
const MERCHANTS = [
  { store: 'Walmart', slug: 'walmart', query: 'electronics best sellers', out: 'best-sellers-walmart.json', searchUrl: (t) => `https://www.walmart.com/search?q=${enc(t)}` },
  { store: 'Target', slug: 'target', query: 'electronics best sellers', out: 'best-sellers-target.json', searchUrl: (t) => `https://www.target.com/s?searchTerm=${enc(t)}` },
  { store: 'Best Buy', slug: 'bestbuy', query: 'best sellers', out: 'best-sellers-bestbuy.json', searchUrl: (t) => `https://www.bestbuy.com/site/searchpage.jsp?st=${enc(t)}` },
  { store: 'Newegg', slug: 'newegg', query: 'best sellers electronics', out: 'best-sellers-newegg.json', searchUrl: (t) => `https://www.newegg.com/p/pl?d=${enc(t)}` },
];

const monthKey = () => new Date().toISOString().slice(0, 7);
function loadUsage() {
  try { const u = JSON.parse(readFileSync(USAGE, 'utf8')); if (u?.month === monthKey()) return { month: u.month, requests: Number(u.requests) || 0 }; } catch {}
  return { month: monthKey(), requests: 0 };
}
function saveUsage(u) { try { mkdirSync(dirname(USAGE), { recursive: true }); writeFileSync(USAGE, JSON.stringify(u, null, 2)); } catch {} }

function num(v) { const n = parseFloat(String(v ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : null; }

async function searchStore(store, query) {
  const url = `${BASE}/search?q=${enc(query)}&country=us&language=en&stores=${enc(store)}&limit=${LIMIT}`;
  const res = await fetch(url, { headers: { 'x-api-key': KEY } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`);
  const body = await res.json();
  const data = body?.data;
  return Array.isArray(data) ? data : (data?.products || []);
}

function mapProduct(p, i, m) {
  const title = p.product_title || '';
  return {
    rank: i + 1,
    id: p.product_id || '',
    marketplace: m.slug,
    title,
    price: p.price || null,
    priceValue: num(p.price),
    image: (Array.isArray(p.product_photos) ? p.product_photos[0] : p.product_photo) || '',
    rating: p.product_rating != null ? num(p.product_rating) : null,
    ratingCount: p.product_num_reviews != null ? num(p.product_num_reviews) : null,
    url: title ? m.searchUrl(title) : (p.product_page_url || ''),
  };
}

async function main() {
  const usage = loadUsage();
  const remaining = Math.max(0, MONTHLY_LIMIT - usage.requests);
  console.log(`OpenWeb Ninja store best-sellers · month ${usage.month}: ${usage.requests}/${MONTHLY_LIMIT} used, ${remaining} remaining`);
  if (remaining < MERCHANTS.length) {
    console.log(`Not enough monthly budget for ${MERCHANTS.length} merchant(s) (${remaining} left) — skipping this run.`);
    return;
  }

  let used = 0;
  const written = [];
  for (const m of MERCHANTS) {
    try {
      const raw = await searchStore(m.store, m.query);
      used += 1;
      const items = raw.slice(0, LIMIT).map((p, i) => mapProduct(p, i, m)).filter((x) => x.title && x.image && x.url);
      if (!items.length) { console.log(`  ${m.store}: 0 usable (kept existing cache)`); continue; }
      if (!DRY) writeFileSync(join(ROOT, 'data', m.out), JSON.stringify({ marketplace: m.slug, source: 'openwebninja:real-time-product-search', capturedAt: new Date().toISOString(), items }, null, 2));
      written.push(`${m.store}:${items.length}`);
      console.log(`  ${m.store}: ${items.length} -> data/${m.out}`);
    } catch (e) {
      used += 1; // the request was still spent even on a bad response
      console.error(`  ${m.store} failed: ${e.message}`);
    }
  }

  usage.requests += used;
  if (!DRY) saveUsage(usage);
  console.log(`Used ${used} request(s). Month now ${usage.requests}/${MONTHLY_LIMIT}. Wrote: ${written.join(', ') || '(none)'}${DRY ? ' [DRY]' : ''}`);
}

main().catch((e) => { console.error('fetch-openwebninja-store-bestsellers failed:', e.message); process.exit(1); });
