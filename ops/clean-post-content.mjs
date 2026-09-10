#!/usr/bin/env node
/**
 * Strip internal links and stray horizontal-rule paragraphs from post bodies.
 *
 * Two unrelated leftovers from the WordPress import, cleaned in one pass so the
 * posts are only rewritten once.
 *
 *   Internal links. 614 of them across the library, and 80% are dead — mostly
 *   /product/<slug> WooCommerce URLs from a catalogue that no longer exists,
 *   plus /infomative-articles/ (the old misspelling) and /brandstore/. The link
 *   is unwrapped rather than deleted: the anchor text stays, so a sentence
 *   reading "see our guide to smart locks" keeps its words and simply stops
 *   being a link to nothing.
 *
 *   <p>---</p>. A markdown horizontal rule that survived the HTML conversion as
 *   a literal paragraph of three dashes.
 *
 * External links are left alone — they are the affiliate and citation links.
 *
 *   node ops/clean-post-content.mjs            # dry run
 *   node ops/clean-post-content.mjs --write
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = '/opt/projects/nxt.bargains';
for (const line of readFileSync(`${ROOT}/.env.local`, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const U = (process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL).replace(/\/$/, '');
const H = { Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`, 'Content-Type': 'application/json' };
const WRITE = process.argv.includes('--write');
const BACKUP = '/tmp/claude-0/-opt/f1829e77-629e-480f-bca7-6e7a711eadb9/scratchpad/post-content-backup.json';

/** Site-relative, or an absolute URL pointing back at this site. */
function isInternal(href) {
  const u = String(href || '').trim();
  if (!u) return false;
  if (/^(https?:)?\/\//i.test(u)) return /(^|\/\/)(www\.)?nxt\.bargains/i.test(u);
  if (/^(mailto:|tel:|#)/i.test(u)) return false;
  return u.startsWith('/');
}

function clean(html) {
  let out = String(html || '');
  let unwrapped = 0;
  let rules = 0;

  /* HTML anchors. The inner text is kept and the tags dropped. Non-greedy to
     the first </a>, so adjacent links are not swallowed as one. */
  out = out.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (full, attrs, inner) => {
    const href = attrs.match(/href\s*=\s*["']([^"']*)["']/i)?.[1];
    if (!isInternal(href)) return full;
    unwrapped += 1;
    return inner;
  });

  // Markdown links. The image form ![alt](src) is excluded by the (?<!!) guard.
  out = out.replace(/(?<!!)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (full, text, href) => {
    if (!isInternal(href)) return full;
    unwrapped += 1;
    return text;
  });

  /* A markdown rule that survived conversion as a literal paragraph. Also its
     bare-line form, and the <hr> some importers produced alongside it. */
  const before = out;
  out = out
    .replace(/<p>\s*-{3,}\s*<\/p>\s*/gi, '')
    .replace(/^\s*-{3,}\s*$/gm, '');
  if (out !== before) rules += 1;

  return { out, unwrapped, rules };
}

/**
 * Posts whose internal links are deliberate and current.
 *
 * The pillar pages were written with links into /price-drops, /best-deals,
 * /all-products and the affiliate disclosure — they all resolve, and the
 * cross-linking is the point of a pillar. The 611 links being removed
 * elsewhere are dead WordPress leftovers; these are neither dead nor
 * leftovers, so they are left alone.
 *
 * Remove a slug from this list to include that post in the sweep.
 */
const KEEP_INTERNAL_LINKS = new Set([
  'best-deals-and-bargains-guide',
  'coupon-codes-101-best-deals-and-bargains',
]);

const posts = [];
for (let page = 1; ; page += 1) {
  const res = await fetch(`${U}/api/nxt-posts?pagination[pageSize]=100&pagination[page]=${page}&fields[0]=slug&fields[1]=content`, { headers: H });
  const json = await res.json();
  posts.push(...(json.data ?? []));
  if (page >= (json.meta?.pagination?.pageCount ?? 1)) break;
}

if (WRITE) {
  writeFileSync(BACKUP, JSON.stringify(posts.map((p) => ({ documentId: p.documentId, slug: p.slug, content: p.content })), null, 1));
  console.log(`backup written: ${BACKUP}\n`);
}

console.log(`${WRITE ? 'WRITE' : 'DRY-RUN'} — ${posts.length} posts\n`);
let changed = 0, totalLinks = 0, totalRules = 0;

for (const post of posts) {
  if (KEEP_INTERNAL_LINKS.has(post.slug)) {
    console.log(`  ${post.slug.slice(0, 52).padEnd(54)} skipped (pillar — links are current)`);
    continue;
  }
  const { out, unwrapped, rules } = clean(post.content);
  if (out === post.content) continue;
  changed += 1;
  totalLinks += unwrapped;
  totalRules += rules;
  console.log(`  ${post.slug.slice(0, 52).padEnd(54)} -${unwrapped} links${rules ? `, -${rules} rule block` : ''}`);

  if (WRITE) {
    const put = await fetch(`${U}/api/nxt-posts/${post.documentId}`, {
      method: 'PUT', headers: H, body: JSON.stringify({ data: { content: out } }),
    });
    if (!put.ok) console.error(`     FAILED ${put.status} ${(await put.text()).slice(0, 120)}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}

console.log(`\n${changed} posts ${WRITE ? 'updated' : 'would change'} — ${totalLinks} internal links unwrapped, ${totalRules} rule blocks removed`);
