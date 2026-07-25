#!/usr/bin/env node
// Prune the coupon-store directory down to retailers that actually have coupons,
// so we don't ship ~17k empty store pages. Non-destructive: reads the full master
// (coupon-stores-full.json) + the current coupon cache + the high-intent allowlist,
// and writes the trimmed data/coupon-stores.json the app reads.
//
//   node scripts/prune-coupon-stores.mjs [--dry]
//
// Keeps a store if EITHER:
//   • it has >=1 coupon in data/coupons-getpromo.json, OR
//   • it is in data/high-intent-coupon-stores.json (always-featured allowlist).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DRY = process.argv.includes('--dry');
const dataFile = (name) => join(ROOT, 'data', name);

function readJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}
function storeArray(doc) {
  return doc?.stores || doc?.items || (Array.isArray(doc) ? doc : []);
}

// Master directory: prefer the full snapshot, else the live file (idempotent).
const masterPath = existsSync(dataFile('coupon-stores-full.json'))
  ? dataFile('coupon-stores-full.json')
  : dataFile('coupon-stores.json');
const masterDoc = readJson(masterPath, { stores: [] });
const master = storeArray(masterDoc);
if (master.length === 0) {
  console.error(`No stores found in ${masterPath} — aborting (cache left as-is).`);
  process.exit(1);
}

// Store IDs that currently have coupons.
const coupons = storeArray(readJson(dataFile('coupons-getpromo.json'), { items: [] }));
const withCoupons = new Set();
for (const c of coupons) {
  if (c.storeId != null) withCoupons.add(Number(c.storeId));
}

// Always-keep allowlist (high-intent / featured retailers).
const allow = storeArray(readJson(dataFile('high-intent-coupon-stores.json'), { stores: [] }));
const allowIds = new Set(allow.map((s) => Number(s.storeId ?? s.id)).filter((n) => !Number.isNaN(n)));

const kept = master.filter((s) => withCoupons.has(Number(s.id)) || allowIds.has(Number(s.id)));

console.log(`Master: ${master.length} stores`);
console.log(`Stores with coupons: ${withCoupons.size} · allowlist: ${allowIds.size}`);
console.log(`Kept: ${kept.length} · removed: ${master.length - kept.length}`);

if (DRY) {
  console.log('DRY RUN — nothing written.');
  process.exit(0);
}

// Preserve the master's wrapper keys (source/capturedAt/total) but with kept stores.
const key = masterDoc.stores ? 'stores' : masterDoc.items ? 'items' : null;
const out = key
  ? { ...masterDoc, [key]: kept, total: kept.length, prunedAt: new Date().toISOString() }
  : kept;
writeFileSync(dataFile('coupon-stores.json'), JSON.stringify(out));
console.log(`Wrote ${kept.length} store(s) -> data/coupon-stores.json`);
