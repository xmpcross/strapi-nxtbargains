#!/usr/bin/env node
/**
 * Check every nxt.bargains offer link and record whether it reaches a product.
 *
 * Writes the verdict back onto the offer so the site can stop trusting links it
 * has never followed — the schema already has the fields for this:
 *   linkStatusCode  the HTTP status, or 0 when the host does not resolve
 *   lastLinkCheckAt when it was checked
 *   linkFailures    consecutive failures
 *   status          'active' | 'inactive'  (the site filters on this)
 *
 * Nothing is deleted. An offer that fails is marked inactive and keeps its row,
 * so a later fix can revive it and so the failure is auditable.
 *
 * Usage:
 *   node ops/validate-offer-links.mjs --dry-run
 *   node ops/validate-offer-links.mjs            # check + write verdicts
 *   node ops/validate-offer-links.mjs --limit=200
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import dns from 'node:dns/promises';

const ARGS = process.argv.slice(2);
const DRY = ARGS.includes('--dry-run');
const LIMIT = Number((ARGS.find((a) => a.startsWith('--limit=')) || '--limit=0').split('=')[1]);
const SITE_TAG = 'nxt-bargains';

const B = (process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL || '').replace(/\/$/, '');
const T = process.env.STRAPI_API_TOKEN || '';
if (!B || !T) { console.error('Missing STRAPI_INTERNAL_URL / STRAPI_API_TOKEN'); process.exit(1); }

async function api(path, init, attempt = 0) {
  const res = await fetch(`${B}/api/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const body = await res.text();
  if (!res.ok) {
    if (res.status >= 500 && attempt < 4) {
      await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
      return api(path, init, attempt + 1);
    }
    throw new Error(`strapi ${res.status} ${path}: ${body.slice(0, 140)}`);
  }
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

const offers = [];
await allPages('commerce-offers?fields[0]=productUrl&fields[1]=title&fields[2]=status&populate[product][fields][0]=slug', (row) => {
  const a = row.attributes ?? row;
  const pr = a.product?.data ?? a.product;
  if (!pr) return;                       // orphans are handled elsewhere
  offers.push({ doc: row.documentId ?? a.documentId, url: a.productUrl || '', slug: pr.slug, title: a.title });
});
const work = LIMIT ? offers.slice(0, LIMIT) : offers;
console.log(`  offers to check : ${work.length}`);

// One DNS lookup per host, not per URL.
const hosts = [...new Set(work.map((o) => { try { return new URL(o.url).hostname; } catch { return ''; } }))].filter(Boolean);
const hostOk = new Map();
await Promise.all(hosts.map(async (h) => {
  try { await dns.lookup(h); hostOk.set(h, true); } catch { hostOk.set(h, false); }
}));
console.log(`  hosts           : ${hosts.length} (${[...hostOk.values()].filter(Boolean).length} resolve)`);

/** A search page is reachable but is not the product it claims to price. */
const isSearchPage = (u) => /google\.[a-z.]+\/search|ibp=oshop|[?&](q|st|searchTerm)=|\/s\?k=|searchpage/i.test(u);

async function check(o) {
  let host = '';
  try { host = new URL(o.url).hostname; } catch { return { ...o, code: 0, why: 'malformed URL' }; }
  if (!hostOk.get(host)) return { ...o, code: 0, why: 'host does not resolve' };
  if (isSearchPage(o.url)) return { ...o, code: 900, why: 'search page, not a product' };
  const ctl = AbortSignal.timeout(20000);
  try {
    const res = await fetch(o.url, { redirect: 'follow', signal: ctl, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; nxtbargains-linkcheck/1.0)' } });
    return { ...o, code: res.status, why: res.ok ? 'ok' : `HTTP ${res.status}` };
  } catch (e) {
    return { ...o, code: 0, why: String(e.name || e).slice(0, 40) };
  }
}

let idx = 0, done = 0;
const results = [];
await Promise.all(Array.from({ length: 8 }, async () => {
  for (let i = idx++; i < work.length; i = idx++) {
    results.push(await check(work[i]));
    if (++done % 250 === 0) console.log(`    …${done}/${work.length}`);
  }
}));

const good = results.filter((r) => r.code >= 200 && r.code < 400);
const search = results.filter((r) => r.code === 900);
const bad = results.filter((r) => !(r.code >= 200 && r.code < 400) && r.code !== 900);
console.log(`\n  reaches a product : ${good.length}`);
console.log(`  search page       : ${search.length}`);
console.log(`  broken            : ${bad.length}`);

mkdirSync('/opt/backups/nxt-bargains', { recursive: true });
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
const file = `/opt/backups/nxt-bargains/offer-link-check-${stamp}.json`;
writeFileSync(file, JSON.stringify(results, null, 1));
console.log(`  results: ${file}`);

if (DRY) { console.log('\n  [dry-run] no verdicts written'); process.exit(0); }

// Write the verdict back. Anything that is not a live product page goes
// inactive: a search page priced as a merchant offer is as misleading as a 404.
const now = new Date().toISOString();
idx = 0; done = 0;
const errors = [];
await Promise.all(Array.from({ length: 3 }, async () => {
  for (let i = idx++; i < results.length; i = idx++) {
    const r = results[i];
    const live = r.code >= 200 && r.code < 400;
    try {
      await api(`commerce-offers/${r.doc}`, {
        method: 'PUT',
        body: JSON.stringify({ data: {
          linkStatusCode: r.code,
          lastLinkCheckAt: now,
          linkFailures: live ? 0 : 1,
          status: live ? 'active' : 'inactive',
        } }),
      });
    } catch (e) { errors.push(String(e).slice(0, 120)); }
    if (++done % 500 === 0) console.log(`    wrote …${done}/${results.length}`);
  }
}));
console.log(`\n  verdicts written  : ${results.length - errors.length}`);
console.log(`  failed            : ${errors.length}`);
