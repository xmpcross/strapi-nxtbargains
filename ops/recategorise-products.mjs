#!/usr/bin/env node
/**
 * Re-file nxt.bargains products into categories that match what they are.
 *
 * The ingest wrote a free-text category per product and used two buckets as
 * dumping grounds: 514 products under "Smartphones" of which most are TVs and
 * monitors, and 292 under "Smart Home" including cosmetics, food, clothing and
 * sanitary products. Categories that should hold those items — smart-tvs,
 * tablets, headphones — are empty.
 *
 * Classification is rule-based on the product name, not model-generated: every
 * decision is traceable to a matched pattern, and a product that matches
 * nothing is left where it is rather than guessed at. Order matters — the first
 * matching rule wins, so specific patterns precede general ones.
 *
 * URLS MOVE. productCanonicalPath builds /<categories[0].slug>/<slug>, so
 * re-filing a product changes its URL. Run with --dry-run first and read the
 * "URL changes" count; those old paths need redirects.
 *
 * Usage:
 *   node ops/recategorise-products.mjs --dry-run
 *   node ops/recategorise-products.mjs --dry-run --show=smart-tvs
 *   node ops/recategorise-products.mjs
 */
const ARGS = process.argv.slice(2);
const DRY = ARGS.includes('--dry-run');
const SHOW = (ARGS.find((a) => a.startsWith('--show=')) || '').split('=')[1];
const SITE_TAG = 'nxt-bargains';

const B = (process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL || '').replace(/\/$/, '');
const T = process.env.STRAPI_API_TOKEN || '';
if (!B || !T) { console.error('Missing STRAPI_INTERNAL_URL / STRAPI_API_TOKEN'); process.exit(1); }

/**
 * [category slug, /pattern/] — first match wins.
 * Anything matching none of these keeps its current category.
 */
const RULES = [
  // Specific device types before the generic buckets.
  ['raspberry-pi',     /\braspberry\s*pi\b|\bpi\s*(zero|pico|400|[45])\b|compute module/i],
  ['robot-vacuums',    /robot vacuum|robotic vacuum|\broomba\b|robot mop/i],
  // Ring and Nest name the product "<line> Doorbell <variant>" — the word
  // "video" never appears — so requiring "video doorbell" matched none of them.
  ['video-doorbells',  /\bdoorbell\b/i],
  // Yale's line is "Approach Lock with Wi-Fi", not "smart lock". A bare \block\b
  // is too greedy — scraped names carry feature lists, and "Safety lock" in an
  // air fryer's blurb filed it as a door lock. Require lock-product context.
  ['smart-door-locks', /smart lock|door lock|deadbolt|\byale\b.*\block\b|\block\b.*\b(wi-?fi|keypad)\b/i],
  ['smart-plugs',      /smart plug|smart outlet|power strip.*(smart|wifi)/i],
  // Hue names the fitting (A19/BR30) and the light mode ("White and Color
  // Ambiance") rather than saying "bulb"; Govee says "Smart Edison Bulb".
  ['smart-light-bulbs',/smart bulb|light bulb|led bulb|\bhue\b.*bulb|edison bulb|\bhue\b.*\b(a19|br30)\b|white (and color )?ambiance/i],
  ['smart-speakers',   /smart speaker|echo dot|echo show|echo pop|echo studio|echo spot|\bhome speaker\b|\bnest (mini|audio)\b|homepod/i],
  // smart-cameras before security-cameras: the latter is "Security & Cameras
  // AU", one of nxtsmarthome's categories, and listCommerceCategories' comment
  // is explicit that AU categories should not surface in this storefront.
  // Brand lines that name no generic noun ("eufyCam S4") need brand patterns.
  ['smart-cameras',    /\beufycam\b|\bnest cam\b|\bwall light cam\b|\beufy\b.*\bcam\b/i],
  ['security-cameras', /security camera|surveillance|\bcctv\b|indoor cam|outdoor cam|\bring\b.*cam|floodlight cam|wyze cam|blink (mini|outdoor)/i],
  // "Pixel Watch" / "OnePlus Watch" carry neither "smartwatch" nor a series
  // word, and `pixel \d` in the phone rule does not reach them either, so they
  // sat in smart-phones. Both must stay ahead of the smart-phones rule.
  ['smartwatches',     /smart ?watch|\bgalaxy watch\b|apple watch|\bpixel watch\b|\boneplus watch\b|\bfitbit\b|\bgarmin\b|amazfit|fitness tracker|\bband \d|\bwatch (ultra|se|series)\b/i],
  // Sony's headphone model families (WH-/WF-) and Beats/Bose/Sennheiser lines
  // carry no generic noun, so name-only rules miss them without brand patterns.
  // WH- is followed by a letter on some lines (WH-ULT900N), not only a digit.
  ['headphones',       /headphone|earbud|\bairpods\b|\bheadset\b|\bearphone|noise cancelling|\bbuds\b|linkbuds|\bsony w[hfi]-?\w|\bult wear\b|\bbose (quietcomfort|soundlink)\b|\bbeats (studio|fit|solo)\b|sennheiser|\bjabra\b|\bgalaxy buds\b/i],
  ['tablets',          /\bipad\b|\btablet\b|galaxy tab|\bfire hd\b|surface pro|\bmatepad\b/i],
  // HP and Dell drop "laptop" from the model name entirely ("HP OmniBook X
  // 14-inch", "Dell 14 Premium (2025)"). These must precede the TV rule below,
  // which also keys on a screen size.
  ['laptops',          /\blaptop\b|macbook|chromebook|notebook pc|\bthinkpad\b|\bideapad\b|\bzenbook\b|\bvivobook\b|gaming laptop|\bxps \d|\bswift go\b|\bnitro \d|\bomnibook\b|\bspectre x360\b|\bdell \d+ (plus|premium)\b/i],
  // TV model lines name the panel and the size but never the word "TV" —
  // "LG C4 OLED 55-inch", "Samsung QN90F Neo QLED 65-inch", "Sony Bravia 9 II
  // 65-inch" — which is why 67 televisions sat in smart-phones untouched.
  ['smart-tvs',        /\b(oled|qled|uhd|led)\b.*\btv\b|\btv\b.*\b(oled|qled|4k|uhd)\b|smart tv|roku tv|fire tv|\d{2}[- ]inch.*\btv\b|\bsoundbar\b|\boled \d{2}-inch\b|\bneo qled\b|\bbravia\b/i],
  // Monitors are not TVs, but the site has no monitor category; group with displays.
  ['smart-tvs',        /\bmonitor\b.*(inch|hz|qhd|fhd|ips)|gaming monitor|computer monitor/i],
  // OnePlus names its handsets Nord / Ace / N-series, not "OnePlus <number>",
  // so a bare `oneplus \d` misses most of the range.
  ['smart-phones',     /\biphone\b|galaxy s\d|galaxy a\d|galaxy z (fold|flip)|\bpixel \d|oneplus (\d|nord|ace|open|n\d)|nothing phone|\bmoto g\b|redmi|\bxiaomi\b.*\d|smartphone|\bphone\b(?!.*(case|holder|mount|charger|stand))/i],
  ['entertainment-audio', /\bsonos\b|\bsoundbar\b|\bsubwoofer\b|\bav receiver\b|bookshelf speaker/i],
  ['climate-comfort',  /air purifier|humidifier|dehumidifier|space heater|\bfan\b.*(tower|pedestal)|thermostat|air conditioner/i],
  ['energy-solar',     /solar panel|power station|portable power|\binverter\b|solar generator/i],
];

/**
 * Relation writes contend in Strapi: at concurrency 6 roughly three quarters of
 * these PUTs came back 500, and the identical request then succeeded when
 * replayed on its own. So the 500 here is a transient conflict, not bad data —
 * retry it with backoff rather than reporting a failure.
 */
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
    throw new Error(`strapi ${res.status} ${path}: ${body.slice(0, 160)}`);
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

const catBySlug = new Map();
await allPages('commerce-categories?fields[0]=slug', (row) => {
  const a = row.attributes ?? row;
  catBySlug.set(a.slug, row.documentId ?? a.documentId);
});

const products = [];
await allPages(
  `commerce-products?filters[tags][$containsi]=${SITE_TAG}&fields[0]=name&fields[1]=slug&populate[categories][fields][0]=slug`,
  (row) => {
    const a = row.attributes ?? row;
    products.push({
      doc: row.documentId ?? a.documentId,
      name: a.name || '',
      slug: a.slug,
      current: (a.categories ?? [])[0]?.slug ?? null,
    });
  },
);
console.log(`  products            : ${products.length}`);

const classify = (name) => {
  for (const [slug, re] of RULES) if (re.test(name)) return slug;
  return null;
};

const moves = [];
let unmatched = 0;
for (const p of products) {
  const want = classify(p.name);
  if (!want) { unmatched += 1; continue; }
  if (!catBySlug.has(want)) continue;
  if (want !== p.current) moves.push({ ...p, want });
}

const from = new Map(), to = new Map();
for (const m of moves) {
  from.set(m.current, (from.get(m.current) ?? 0) + 1);
  to.set(m.want, (to.get(m.want) ?? 0) + 1);
}
console.log(`  matched a rule      : ${products.length - unmatched}`);
console.log(`  no rule matched     : ${unmatched}  (left where they are)`);
console.log(`  WOULD MOVE          : ${moves.length}   <- each is a URL change`);

console.log('\n  out of:');
for (const [k, n] of [...from].sort((a, b) => b[1] - a[1])) console.log(`    ${String(k).padEnd(22)} -${n}`);
console.log('\n  into:');
for (const [k, n] of [...to].sort((a, b) => b[1] - a[1])) console.log(`    ${String(k).padEnd(22)} +${n}`);

if (SHOW) {
  console.log(`\n  sample moving into ${SHOW}:`);
  for (const m of moves.filter((x) => x.want === SHOW).slice(0, 12)) {
    console.log(`    ${(m.current || '-').padEnd(16)} -> ${m.name.slice(0, 74)}`);
  }
}

if (DRY) { console.log('\n  [dry-run] nothing written'); process.exit(0); }

// Write the old -> new path map first; redirects depend on it.
const { writeFileSync } = await import('node:fs');
writeFileSync('ops/.recategorise-url-changes.json', JSON.stringify(
  moves.map((m) => ({ from: `/${m.current}/${m.slug}`, to: `/${m.want}/${m.slug}` })), null, 1));
console.log(`\n  wrote ops/.recategorise-url-changes.json (${moves.length} path changes)`);

let idx = 0, done = 0;
const errors = [];
await Promise.all(Array.from({ length: 3 }, async () => {
  for (let i = idx++; i < moves.length; i = idx++) {
    const m = moves[i];
    try {
      await api(`commerce-products/${m.doc}`, { method: 'PUT', body: JSON.stringify({ data: { categories: [catBySlug.get(m.want)] } }) });
    } catch (e) { errors.push(`${m.slug}: ${String(e).slice(0, 100)}`); }
    if (++done % 100 === 0) console.log(`    …${done}/${moves.length}`);
  }
}));

// Verify against the API, not the loop counter.
const after = new Map();
await allPages(`commerce-products?filters[tags][$containsi]=${SITE_TAG}&fields[0]=slug&populate[categories][fields][0]=slug`, (row) => {
  const a = row.attributes ?? row;
  const s = (a.categories ?? [])[0]?.slug ?? '(none)';
  after.set(s, (after.get(s) ?? 0) + 1);
});
console.log(`\n  failed              : ${errors.length}`);
console.log('  VERIFIED distribution:');
for (const [k, n] of [...after].sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(22)} ${n}`);
for (const e of errors.slice(0, 5)) console.log(`     ${e}`);
