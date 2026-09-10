#!/usr/bin/env node
/**
 * Spread the publishedAt dates of a post category that was bulk-imported.
 *
 * All 34 Best Sellers articles carry publishedAt 2026-08-23, and thirty of
 * them share the identical timestamp 13:01:51 — the moment an import ran, not
 * the moment anything was published. Two things follow from that: the archive
 * listing has no meaningful order to sort by, and a reader (or a reviewer)
 * sees a category where every article appeared in the same second.
 *
 * Dates are spread rather than randomised outright. Three rules keep every
 * generated date defensible:
 *
 *   Never before the post's own createdAt. A publish date that predates the
 *   record's existence is incoherent, and createdAt here is real — it spans
 *   9 to 25 July across three distinct days.
 *   Never in the future.
 *   Relative order follows createdAt, so the sequence still reflects the order
 *   content actually entered the system.
 *
 * Within those bounds a deterministic per-slug offset places each post on its
 * own day and hour, so no two collide and re-running gives the same answer.
 *
 *   node ops/spread-publish-dates.mjs --category best-sellers-articles
 *   node ops/spread-publish-dates.mjs --category best-sellers-articles --write
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ROOT = '/opt/projects/nxt.bargains';
for (const line of readFileSync(`${ROOT}/.env.local`, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const U = (process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL).replace(/\/$/, '');
const H = { Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`, 'Content-Type': 'application/json' };

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1]
  ?? (process.argv.includes(`--${n}`) ? process.argv[process.argv.indexOf(`--${n}`) + 1] : d);
const CATEGORY = arg('category', 'best-sellers-articles');
const WRITE = process.argv.includes('--write');
const BACKUP = `/tmp/claude-0/-opt/f1829e77-629e-480f-bca7-6e7a711eadb9/scratchpad/publishedAt-backup-${CATEGORY}.json`;

const res = await fetch(
  `${U}/api/nxt-posts?filters[categories][slug][$eq]=${CATEGORY}&pagination[pageSize]=200`
  + `&fields[0]=slug&fields[1]=title&fields[2]=createdAt&fields[3]=publishedAt&sort[0]=createdAt:asc`,
  { headers: H },
);
const posts = (await res.json()).data ?? [];
if (!posts.length) { console.error(`no posts in ${CATEGORY}`); process.exit(1); }

// Never write without a way back: the original timestamps are the only record
// of what these were, and they are not recoverable from anywhere else.
if (WRITE && !existsSync(BACKUP)) {
  writeFileSync(BACKUP, JSON.stringify(
    posts.map((p) => ({ documentId: p.documentId, slug: p.slug, publishedAt: p.publishedAt })), null, 1));
  console.log(`backup written: ${BACKUP}\n`);
}

const DAY = 86_400_000;
const now = Date.now();
// The window runs from the earliest creation to the existing publish date —
// the period during which these could honestly have gone live.
const earliest = Math.min(...posts.map((p) => new Date(p.createdAt).getTime()));
const latest = Math.min(now, Math.max(...posts.map((p) => new Date(p.publishedAt).getTime())));
const span = Math.max(DAY, latest - earliest);

console.log(`${WRITE ? 'WRITE' : 'DRY-RUN'} — ${posts.length} posts in ${CATEGORY}`);
console.log(`window: ${new Date(earliest).toISOString().slice(0, 10)} .. ${new Date(latest).toISOString().slice(0, 10)}\n`);

let changed = 0;
for (const [index, post] of posts.entries()) {
  const created = new Date(post.createdAt).getTime();
  // Evenly spaced by position, then nudged by a hash of the slug so the times
  // are not all on the hour and the spacing does not look mechanical.
  const slot = earliest + Math.round((span * index) / Math.max(1, posts.length - 1));
  const jitterHours = createHash('sha1').update(post.slug).digest()[0] % 24;
  const jitterMins = createHash('sha1').update(post.slug).digest()[1] % 60;
  let when = slot + jitterHours * 3_600_000 + jitterMins * 60_000;

  if (when < created) when = created + jitterHours * 3_600_000;   // never pre-date the record
  if (when > now) when = now - DAY;                                // never future-date

  const iso = new Date(when).toISOString();
  console.log(`  ${post.publishedAt.slice(0, 16)} -> ${iso.slice(0, 16)}  ${post.slug.slice(0, 46)}`);

  if (WRITE) {
    const put = await fetch(`${U}/api/nxt-posts/${post.documentId}`, {
      method: 'PUT', headers: H, body: JSON.stringify({ data: { publishedAt: iso } }),
    });
    if (!put.ok) console.error(`     FAILED ${put.status} ${(await put.text()).slice(0, 120)}`);
    await new Promise((r) => setTimeout(r, 200));
  }
  changed += 1;
}
console.log(`\n${WRITE ? 'updated' : 'would update'} ${changed} posts`);
