#!/usr/bin/env node
/**
 * Find and fetch icons for merchants that have no curated logo.
 *
 * 55 of the 72 merchants carrying offers have no entry in sourceStoreLogos, so
 * the page falls back to Google's favicon service — a 128px bitmap of whatever
 * the site serves, next to crisp SVGs for the merchants that are mapped. On a
 * price table that reads as a broken row.
 *
 * commerce-merchant has a `websiteUrl` field but it is null for every one of
 * them, so the domain is derived from the merchant's own offers: take the host
 * that most of its productUrls point at. That also backfills websiteUrl, which
 * is worth having on its own.
 *
 * Icon preference, best first:
 *   1. apple-touch-icon        typically 180px+, usually the brand mark
 *   2. <link rel="icon"> SVG   resolution-independent
 *   3. <link rel="icon"> PNG   whatever size the site declares
 *   4. /favicon.ico            last resort
 * Nothing is invented: if none of those fetch, the merchant is reported and
 * left on the existing favicon fallback.
 *
 * Usage:
 *   node ops/fetch-merchant-logos.mjs --dry-run
 *   node ops/fetch-merchant-logos.mjs --limit=20
 *   node ops/fetch-merchant-logos.mjs --write-website-url
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';

const ARGS = process.argv.slice(2);
const DRY = ARGS.includes('--dry-run');
const WRITE_URL = ARGS.includes('--write-website-url');
const LIMIT = Number((ARGS.find((a) => a.startsWith('--limit=')) || '--limit=0').split('=')[1]);
const OUT = 'public/logos';

const B = (process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL || '').replace(/\/$/, '');
const T = process.env.STRAPI_API_TOKEN || '';
if (!B || !T) { console.error('Missing STRAPI_INTERNAL_URL / STRAPI_API_TOKEN'); process.exit(1); }

/** Mirrors sourceStoreLogos in lib/coupon-store-links.ts. */
const MAPPED = [/amazon/, /ebay/, /walmart/, /newegg/, /bestbuy/, /bjs/, /hp/, /dell/, /lenovo/,
  /samsung/, /apple/, /target/, /nike/, /argos/, /microcenter/, /oneplus/];
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const alreadyMapped = (name) => MAPPED.some((re) => re.test(norm(name)));

async function api(path) {
  const res = await fetch(`${B}/api/${path}`, { headers: { Authorization: `Bearer ${T}` } });
  if (!res.ok) throw new Error(`strapi ${res.status} ${path}`);
  return res.json();
}
async function allPages(path, onRow) {
  for (let page = 1; ; page += 1) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await api(`${path}${sep}pagination[page]=${page}&pagination[pageSize]=200`);
    for (const row of r.data ?? []) onRow(row);
    if (page >= r.meta.pagination.pageCount) return;
  }
}

// merchant -> hosts seen across its offers
const merchants = new Map();
await allPages('commerce-offers?fields[0]=productUrl&populate[merchant][fields][0]=name&populate[merchant][fields][1]=slug', (row) => {
  const a = row.attributes ?? row;
  const md = a.merchant?.data ?? a.merchant;
  if (!md) return;
  const m = md.attributes ?? md;
  const rec = merchants.get(m.slug) ?? { slug: m.slug, name: m.name, doc: md.documentId ?? m.documentId, hosts: new Map(), n: 0 };
  rec.n += 1;
  try {
    const h = new URL(a.productUrl).hostname.replace(/^www\./, '');
    if (!/google\.|amazon_us|official_store/.test(h)) rec.hosts.set(h, (rec.hosts.get(h) ?? 0) + 1);
  } catch { /* unparseable url contributes no host */ }
  merchants.set(m.slug, rec);
});

const missing = [...merchants.values()]
  .filter((m) => !alreadyMapped(m.name))
  .map((m) => ({ ...m, host: [...m.hosts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null }))
  .sort((a, b) => b.n - a.n);

console.log(`  merchants with offers   : ${merchants.size}`);
console.log(`  without a curated logo  : ${missing.length}`);
console.log(`  of those, host derivable: ${missing.filter((m) => m.host).length}`);

const work = LIMIT ? missing.slice(0, LIMIT) : missing;
if (DRY) {
  console.log('\n  would fetch:');
  for (const m of work) console.log(`    ${String(m.n).padStart(4)}  ${m.slug.padEnd(26)} ${m.host ?? '(no host — skipped)'}`);
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });

/** Real image bytes, not an HTML error page or a JSON body with a 200. */
function looksLikeImage(b) {
  if (b.length < 100) return false;
  const sig = [[0x00, 0x00, 0x01, 0x00], [0x89, 0x50, 0x4e, 0x47], [0xff, 0xd8, 0xff], [0x47, 0x49, 0x46, 0x38], [0x52, 0x49, 0x46, 0x46]];
  if (sig.some((s) => s.every((byte, i) => b[i] === byte))) return true;
  const head = b.subarray(0, 400).toString('utf8').trimStart();
  return head.startsWith('<svg') || head.startsWith('<?xml') || head.startsWith('<!--');
}

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; nxtbargains-logo-fetch/1.0)' };
const abs = (href, base) => { try { return new URL(href, base).toString(); } catch { return null; } };

async function iconCandidates(host) {
  const base = `https://${host}/`;
  const out = [];
  try {
    const res = await fetch(base, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const html = (await res.text()).slice(0, 400000);
    const links = [...html.matchAll(/<link[^>]+>/gi)].map((m) => m[0]);
    const pick = (test) => links.filter(test)
      .map((l) => (l.match(/href=["']([^"']+)["']/i) || [])[1])
      .map((h) => abs(h, res.url || base)).filter(Boolean);
    out.push(...pick((l) => /apple-touch-icon/i.test(l)));
    out.push(...pick((l) => /rel=["'][^"']*icon/i.test(l) && /\.svg/i.test(l)));
    out.push(...pick((l) => /rel=["'][^"']*icon/i.test(l)));
  } catch { /* fall through to favicon.ico */ }
  out.push(`https://${host}/favicon.ico`);
  return [...new Set(out)];
}

const results = [];
for (const m of work) {
  if (!m.host) { results.push({ ...m, saved: null, why: 'no host in any offer URL' }); continue; }
  let saved = null, why = 'no icon fetched';
  for (const url of await iconCandidates(m.host)) {
    try {
      const r = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(20000) });
      if (!r.ok) continue;
      const ct = (r.headers.get('content-type') || '').toLowerCase();
      let buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 200) continue;                       // 1px trackers, empty responses

      // Some sites serve an icon as a base64 body rather than binary — Bing Lee
      // returned an ICO that way, and saving it verbatim produced a file that
      // begins "AAABAAEAEBAA…" and renders as nothing. Decode when the payload
      // is base64 that unwraps to a real image.
      if (/^[A-Za-z0-9+/\r\n]+=*\s*$/.test(buf.subarray(0, 120).toString('ascii'))) {
        try {
          const dec = Buffer.from(buf.toString('ascii'), 'base64');
          if (looksLikeImage(dec)) buf = dec;
        } catch { /* not base64 after all; keep the original bytes */ }
      }
      if (!looksLikeImage(buf)) continue;                   // HTML error pages, JSON, junk
      const ext = ct.includes('svg') ? 'svg' : ct.includes('png') ? 'png'
        : ct.includes('jpeg') || ct.includes('jpg') ? 'jpg' : ct.includes('icon') ? 'ico' : null;
      if (!ext) continue;
      const file = `${OUT}/${m.slug}-logo.${ext}`;
      writeFileSync(file, buf);
      saved = file; why = `${ext}, ${Math.round(buf.length / 1024)}KB, from ${new URL(url).pathname}`;
      break;
    } catch { /* try the next candidate */ }
  }
  results.push({ ...m, saved, why });
  console.log(`    ${m.slug.padEnd(26)} ${saved ? 'ok  ' : 'MISS'} ${why}`);
}

const ok = results.filter((r) => r.saved);
console.log(`\n  fetched : ${ok.length}/${work.length}`);

console.log('\n  add these to sourceStoreLogos in lib/coupon-store-links.ts:');
for (const r of ok) {
  console.log(`  [/${norm(r.name)}/, '${r.saved.replace('public', '')}'],`);
}

if (WRITE_URL) {
  console.log('\n  backfilling websiteUrl…');
  let n = 0;
  for (const r of results.filter((x) => x.host)) {
    try {
      await fetch(`${B}/api/commerce-merchants/${r.doc}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { websiteUrl: `https://${r.host}` } }),
      });
      n += 1;
    } catch { /* reported by the count below */ }
  }
  console.log(`  websiteUrl written: ${n}/${results.filter((x) => x.host).length}`);
}
