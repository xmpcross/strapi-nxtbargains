#!/usr/bin/env node
// Amazon "New Releases" via OpenWeb Ninja Real-Time E-commerce Data
// (/amazon/best-sellers?type=NEW_RELEASES) — the one thing amazon-product-info2
// can't do. Writes data/amazon-new-releases.json for the New Releases section on
// /best-sellers/amazon.
//
// FRUGAL: 1 request per category (default 3 → run WEEKLY ≈ 12/month). This API is
// a separate 100/month plan from Real-Time Product Search, so it has its OWN
// counter (data/openwebninja-ecom-usage.json) that hard-stops before the cap.
//
//   node scripts/fetch-openwebninja-amazon-new-releases.mjs [--limit=18] [--dry]
//
// Env (.env.local):
//   OPENWEBNINJA_API_KEY               your OpenWeb Ninja key (ak_...)   [required]
//   OPENWEBNINJA_ECOM_MONTHLY_LIMIT    monthly cap (default 100)
//   NEXT_PUBLIC_AMAZON_AFFILIATE_TAG   affiliate tag appended to /dp/ links
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
const BASE = (process.env.OPENWEBNINJA_ECOM_BASE_URL || 'https://api.openwebninja.com/realtime-ecommerce-data').replace(/\/$/, '');
const MONTHLY_LIMIT = Math.max(0, parseInt(process.env.OPENWEBNINJA_ECOM_MONTHLY_LIMIT || '100', 10) || 0);
const LIMIT = Math.max(1, parseInt(arg('limit', '18'), 10) || 18);
const TAG = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG || '';
const OUT = join(ROOT, 'data', 'amazon-new-releases.json');
const USAGE = join(ROOT, 'data', 'openwebninja-ecom-usage.json');

if (!KEY) { console.error('OPENWEBNINJA_API_KEY not set in .env.local — aborting.'); process.exit(1); }

// Amazon New Releases only populates at the top "electronics" level via this API
// (subcategories like computers/mobile return an empty list), so we pull that one
// broad, relevant list. Add more here if other categories start returning data.
const CATEGORIES = [
  { key: 'electronics', label: 'Electronics', category: 'electronics' },
];

const monthKey = () => new Date().toISOString().slice(0, 7);
function loadUsage() {
  try { const u = JSON.parse(readFileSync(USAGE, 'utf8')); if (u?.month === monthKey()) return { month: u.month, requests: Number(u.requests) || 0 }; } catch {}
  return { month: monthKey(), requests: 0 };
}
function saveUsage(u) { try { mkdirSync(dirname(USAGE), { recursive: true }); writeFileSync(USAGE, JSON.stringify(u, null, 2)); } catch {} }

const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : null; };
const enc = encodeURIComponent;

function affiliate(url, asin) {
  const base = asin ? `https://www.amazon.com/dp/${asin}` : url;
  if (!TAG || !base) return base || '';
  return base.includes('?') ? `${base}&tag=${TAG}` : `${base}?tag=${TAG}`;
}

async function fetchNewReleases(category) {
  const url = `${BASE}/amazon/best-sellers?country=US&type=NEW_RELEASES&category=${enc(category)}`;
  const res = await fetch(url, { headers: { 'x-api-key': KEY } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`);
  const body = await res.json();
  const d = body?.data || {};
  return d.best_sellers || d.new_releases || (Array.isArray(d) ? d : []);
}

function mapItem(p, i, cat) {
  const asin = p.asin || '';
  return {
    rank: p.rank ?? i + 1,
    asin,
    marketplace: 'amazon',
    category: cat.key,
    categoryLabel: cat.label,
    title: p.product_title || '',
    price: p.product_price || null,
    priceValue: num(p.product_price),
    image: p.product_photo || '',
    rating: p.product_star_rating != null ? num(p.product_star_rating) : null,
    ratingCount: p.product_num_ratings != null ? num(p.product_num_ratings) : null,
    url: affiliate(p.product_url, asin),
    rankChange: p.rank_change_label || null,
  };
}

async function main() {
  const usage = loadUsage();
  const remaining = Math.max(0, MONTHLY_LIMIT - usage.requests);
  console.log(`Amazon New Releases (E-commerce Data) · month ${usage.month}: ${usage.requests}/${MONTHLY_LIMIT} used, ${remaining} remaining`);
  if (remaining < CATEGORIES.length) {
    console.log(`Not enough monthly budget for ${CATEGORIES.length} categor(ies) (${remaining} left) — skipping this run.`);
    return;
  }

  let used = 0;
  const all = [];
  for (const cat of CATEGORIES) {
    try {
      const raw = await fetchNewReleases(cat.category);
      used += 1;
      const items = raw.slice(0, LIMIT).map((p, i) => mapItem(p, i, cat)).filter((x) => x.title && x.image && x.url);
      if (items.length) { all.push(...items); console.log(`  ${cat.label}: ${items.length}`); }
      else console.log(`  ${cat.label}: 0 usable (skipped)`);
    } catch (e) {
      used += 1;
      console.error(`  ${cat.label} failed: ${e.message}`);
    }
  }

  usage.requests += used;
  if (!DRY) saveUsage(usage);
  if (!all.length) { console.log('No new releases returned; cache left as-is.'); return; }
  if (!DRY) writeFileSync(OUT, JSON.stringify({
    source: 'openwebninja:real-time-ecommerce-data:new-releases',
    capturedAt: new Date().toISOString(),
    categories: CATEGORIES.map((c) => ({ key: c.key, label: c.label })),
    items: all,
  }, null, 2));
  console.log(`Used ${used} request(s). Month now ${usage.requests}/${MONTHLY_LIMIT}. Wrote ${all.length} item(s)${DRY ? ' [DRY]' : ` -> ${OUT}`}`);
}

main().catch((e) => { console.error('fetch-openwebninja-amazon-new-releases failed:', e.message); process.exit(1); });
