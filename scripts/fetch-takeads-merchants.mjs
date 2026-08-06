#!/usr/bin/env node
// List the merchants in the Takeads catalogue, optionally filtered to a country,
// and cache them in data/takeads-merchants.json.
//
//   node scripts/fetch-takeads-merchants.mjs --probe        # dump page 1 raw
//   node scripts/fetch-takeads-merchants.mjs --country AU   # Australian merchants
//   node scripts/fetch-takeads-merchants.mjs                # everything
//
// Env (.env.local): TAKEADS_PUBLIC_KEY
//
//   GET https://api.takeads.com/v1/product/monetize-api/v2/merchant
//   Authorization: Bearer <public key>
//
// Useful before wiring links: it tells you which of the merchants you already
// link to are actually in the Takeads catalogue, so you can see what the
// integration would earn on before converting a single URL.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
for (const line of (existsSync(join(ROOT, '.env.local')) ? readFileSync(join(ROOT, '.env.local'), 'utf8') : '').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const ENDPOINT = 'https://api.takeads.com/v1/product/monetize-api/v2/merchant';
const OUT = join(ROOT, 'data', 'takeads-merchants.json');

const args = process.argv.slice(2);
const probe = args.includes('--probe');
const countryIdx = args.indexOf('--country');
const country = countryIdx !== -1 ? String(args[countryIdx + 1]).toUpperCase() : null;

const KEY = process.env.TAKEADS_PUBLIC_KEY;
if (!KEY) {
  console.error('TAKEADS_PUBLIC_KEY missing from .env.local — Platforms → Configure integration.');
  process.exit(1);
}

async function page(offset, limit) {
  const url = new URL(ENDPOINT);
  url.searchParams.set('limit', String(limit));
  if (offset) url.searchParams.set('offset', String(offset));
  // Server-side country filter if the API supports it; results are filtered
  // locally afterwards regardless, so an ignored parameter is harmless.
  if (country) url.searchParams.set('countryCode', country);

  const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` } });
  const text = await res.text();
  if (probe) console.log(`\nGET ${url}\n  HTTP ${res.status}: ${text.slice(0, 1500)}\n`);
  if (res.status === 401) {
    throw new Error(
      'Unauthorized. This is the Public Key from Platforms → Configure integration, ' +
        'not the Reporting Public Key — they are different and only one works here.',
    );
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

/** Pull the country out of whichever field the payload uses. */
function countriesOf(m) {
  const raw =
    m.countryCodes ?? m.countries ?? m.countryCode ?? m.country ?? m.regions ?? m.geo ?? null;
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map((c) => (typeof c === 'string' ? c : c?.code ?? c?.countryCode ?? c?.name))
    .filter(Boolean)
    .map((c) => String(c).toUpperCase());
}

async function main() {
  if (probe) {
    await page(0, 5);
    return;
  }

  const merchants = [];
  const LIMIT = 500;
  for (let offset = 0; ; offset += LIMIT) {
    const json = await page(offset, LIMIT);
    const rows = json.data ?? json.items ?? json.results ?? (Array.isArray(json) ? json : []);
    if (!rows.length) break;
    merchants.push(...rows);
    console.log(`  fetched ${merchants.length}…`);
    if (rows.length < LIMIT) break;
    if (merchants.length > 50_000) break; // runaway guard
  }

  const filtered = country
    ? merchants.filter((m) => {
        const cs = countriesOf(m);
        // Keep merchants with no country data rather than dropping them
        // silently — better to over-report than hide a live AU advertiser.
        return !cs.length || cs.includes(country);
      })
    : merchants;

  writeFileSync(
    OUT,
    JSON.stringify(
      { country: country ?? 'all', count: filtered.length, checkedAt: new Date().toISOString(), merchants: filtered },
      null,
      2,
    ),
  );

  console.log(`\n✅ ${filtered.length} merchants${country ? ` for ${country}` : ''} → data/takeads-merchants.json`);
  for (const m of filtered.slice(0, 25)) {
    const name = m.name ?? m.title ?? m.merchantName ?? '(unnamed)';
    const site = m.siteUrl ?? m.url ?? m.domain ?? '';
    console.log(`   ${String(name).slice(0, 44).padEnd(44)} ${String(site).slice(0, 40)}`);
  }
  if (filtered.length > 25) console.log(`   … and ${filtered.length - 25} more`);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
