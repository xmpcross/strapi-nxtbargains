#!/usr/bin/env node
/**
 * Attach the commerce-category relation to migrated nxt.bargains products.
 *
 * The Supabase migration copied the free-text `category` string and left the
 * `categories` relation empty, on the reasoning that productCanonicalPath falls
 * back to slugifying that string so URLs would not move. That was wrong in two
 * ways once the site actually read from Strapi:
 *
 *   1. Category listings filter on `categories: { slug: { $eqi } }`
 *      (lib/strapi.ts), which matched nothing — every category page showed
 *      zero products.
 *
 *   2. The fallback slugify is naive. Supabase's CATEGORY_SLUG_MAP rewrites
 *      "Smartphones" to `smart-phones`, but slugifying gives `smartphones`, so
 *      canonicals moved to /smartphones/… — exactly what the migration set out
 *      to avoid.
 *
 * Attaching the relation fixes both: primaryCategorySlug prefers
 * categories[0].slug, so canonicals return to their original form, and the
 * listing filter starts matching.
 *
 * Usage:
 *   node ops/attach-product-categories.mjs --dry-run
 *   node ops/attach-product-categories.mjs
 */
const DRY = process.argv.includes('--dry-run');
const SITE_TAG = 'nxt-bargains';

const B = (process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL || '').replace(/\/$/, '');
const T = process.env.STRAPI_API_TOKEN || '';
if (!B || !T) { console.error('Missing STRAPI_INTERNAL_URL / STRAPI_API_TOKEN'); process.exit(1); }

/** Mirrors CATEGORY_SLUG_MAP in lib/supabase-commerce.ts — the slugs the live
 *  URLs were built from. Anything absent falls through to slugify(). */
const SLUG_MAP = {
  smartphones: 'smart-phones', smartphone: 'smart-phones', 'smart phones': 'smart-phones',
  smartwatches: 'smartwatches', smartwatch: 'smartwatches',
  tablets: 'tablets', tablet: 'tablets', laptops: 'laptops', laptop: 'laptops',
  'smart light bulbs': 'smart-light-bulbs', 'smart tvs': 'smart-tvs',
  'smart cameras': 'smart-cameras', 'smart speakers': 'smart-speakers',
  'smart door locks': 'smart-door-locks', 'smart plugs': 'smart-plugs',
  'video doorbells': 'video-doorbells', headphones: 'headphones',
  'raspberry pi': 'raspberry-pi', 'smart home': 'smart-home',
};
const slugify = (v) => (v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const targetSlug = (raw) => SLUG_MAP[(raw || '').trim().toLowerCase()] || slugify(raw);

async function api(path, init) {
  const res = await fetch(`${B}/api/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`strapi ${res.status} ${path}: ${body.slice(0, 200)}`);
  return body ? JSON.parse(body) : null;
}

async function allPages(path, onRow) {
  for (let page = 1; ; page += 1) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await api(`${path}${sep}pagination[page]=${page}&pagination[pageSize]=200`);
    for (const row of r.data ?? []) onRow(row);
    if (page >= r.meta.pagination.pageCount) return;
  }
}

// --- categories --------------------------------------------------------------
const catBySlug = new Map();
await allPages('commerce-categories?fields[0]=slug&fields[1]=name', (row) => {
  const a = row.attributes ?? row;
  catBySlug.set(a.slug, row.documentId ?? a.documentId);
});
console.log(`  categories in strapi : ${catBySlug.size}`);

// --- products ----------------------------------------------------------------
const products = [];
await allPages(
  `commerce-products?filters[tags][$containsi]=${SITE_TAG}&fields[0]=category&fields[1]=slug&populate[categories][fields][0]=slug`,
  (row) => {
    const a = row.attributes ?? row;
    products.push({ doc: row.documentId ?? a.documentId, slug: a.slug, category: a.category, has: (a.categories ?? []).length > 0 });
  },
);
console.log(`  products             : ${products.length}`);

const todo = products.filter((p) => !p.has && (p.category || '').trim());
console.log(`  already related      : ${products.length - todo.length}`);
console.log(`  to relate            : ${todo.length}`);

const wanted = new Map();
for (const p of todo) {
  const s = targetSlug(p.category);
  wanted.set(s, (wanted.get(s) ?? 0) + 1);
}
console.log('\n  target slug -> products (missing = will be created):');
for (const [s, n] of [...wanted].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${s.padEnd(24)} ${String(n).padStart(4)}  ${catBySlug.has(s) ? '' : '<- MISSING'}`);
}

if (DRY) { console.log('\n  [dry-run] nothing written'); process.exit(0); }

// create any category the products need but Strapi lacks
for (const s of wanted.keys()) {
  if (catBySlug.has(s)) continue;
  const name = s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  const created = await api('commerce-categories', { method: 'POST', body: JSON.stringify({ data: { name, slug: s } }) });
  catBySlug.set(s, created.data.documentId);
  console.log(`  created category     : ${s} ("${name}")`);
}

// Attach, with a small concurrency cap.
// `idx` must be initialised BEFORE the workers are created. It was previously
// declared with `var` after this block: hoisting made it `undefined` when the
// workers started, `undefined++` is NaN, `NaN < todo.length` is false, so every
// worker exited immediately. The run then reported success, because the count
// printed was `todo.length - errors.length` and no error had been recorded.
let idx = 0;
let done = 0;
const errors = [];
const attached = [];
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let i = idx++; i < todo.length; i = idx++) {
    const p = todo[i];
    const cat = catBySlug.get(targetSlug(p.category));
    if (!cat) { errors.push(`${p.slug}: no category for "${p.category}"`); continue; }
    try {
      await api(`commerce-products/${p.doc}`, { method: 'PUT', body: JSON.stringify({ data: { categories: [cat] } }) });
      attached.push(p.doc);
    } catch (e) { errors.push(`${p.slug}: ${String(e).slice(0, 120)}`); }
    if (++done % 100 === 0) console.log(`    …${done}/${todo.length}`);
  }
}));

// Count what the API actually reports, not what we think we sent — the bug
// above was invisible precisely because the script trusted its own arithmetic.
let verified = 0;
for (let page = 1; ; page += 1) {
  const r = await api(`commerce-products?filters[tags][$containsi]=${SITE_TAG}&pagination[page]=${page}&pagination[pageSize]=200&fields[0]=slug&populate[categories][fields][0]=slug`);
  for (const row of r.data ?? []) {
    const a = row.attributes ?? row;
    if ((a.categories ?? []).length > 0) verified += 1;
  }
  if (page >= r.meta.pagination.pageCount) break;
}

console.log(`\n  PUTs accepted        : ${attached.length}`);
console.log(`  failed               : ${errors.length}`);
console.log(`  VERIFIED with relation: ${verified} / ${products.length}`);
for (const e of errors.slice(0, 5)) console.log(`     ${e}`);
