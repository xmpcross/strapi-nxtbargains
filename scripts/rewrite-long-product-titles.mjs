#!/usr/bin/env node
/**
 * Long Product Title Rewriter (>15 words) for nxt.bargains
 *
 * Location: /opt/projects/nxt.bargains/scripts/rewrite-long-product-titles.mjs
 *
 * Features:
 * - Scans Strapi commerce products specifically targeting titles containing 15 or more words.
 * - Rewrites oversized product titles into clean, concise titles strictly under 15 words (< 15 words).
 * - Generates high-converting, SEO-optimized Meta Titles (for search engines).
 * - Generates clean, lowercased, hyphenated URL slugs.
 * - Supports AI optimization via Anthropic Claude API (with intelligent rule-based fallback).
 * - Offers CLI flags: --dry-run, --limit, --slugs, --category, --force/--overwrite.
 *
 * Usage:
 *   node scripts/rewrite-long-product-titles.mjs                             # Interactive category selection
 *   node scripts/rewrite-long-product-titles.mjs --category headphones        # Target specific category
 *   node scripts/rewrite-long-product-titles.mjs --dry-run --limit 10        # Preview mode
 *   node scripts/rewrite-long-product-titles.mjs --slugs google-pixel-10-... # Target specific product
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

// 1. Load environment variables
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function loadEnvFile(filepath) {
  if (!existsSync(filepath)) return;
  const content = readFileSync(filepath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

loadEnvFile(join(ROOT, '.env.local'));
loadEnvFile('/opt/strapi-cms-git/backend/ai-writer-cli/.env');

const STRAPI_BASE = (process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.fxnstudio.com').replace(/\/$/, '');
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

// 2. Parse CLI Arguments
const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const getArgVal = (name) => {
  const idx = args.indexOf(name);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  const prefix = `${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
};

const DRY_RUN = hasFlag('--dry-run');
const FORCE = hasFlag('--force') || hasFlag('--overwrite');
const LIMIT = parseInt(getArgVal('--limit') || '50', 10);
const TARGET_SLUGS = getArgVal('--slugs') ? getArgVal('--slugs').split(',').map((s) => s.trim()).filter(Boolean) : null;
let TARGET_CATEGORY = getArgVal('--category');

console.log('---------------------------------------------------------');
console.log('  NXT.Bargains — Long Product Title Rewriter (>=15 Words)');
console.log('---------------------------------------------------------');
console.log(` Mode:           ${DRY_RUN ? 'DRY-RUN (no updates will be saved)' : 'LIVE WRITE'}`);
console.log(` Target Filter:  Titles containing 15 or more words`);
console.log(` Limit:          ${LIMIT} matching products`);
if (TARGET_SLUGS) console.log(` Target Slugs:   ${TARGET_SLUGS.join(', ')}`);
console.log('---------------------------------------------------------\n');

// 3. Strapi API Helper
async function strapiApi(endpoint, options = {}) {
  const url = `${STRAPI_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(STRAPI_TOKEN ? { Authorization: `Bearer ${STRAPI_TOKEN}` } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Strapi ${res.status} on ${endpoint}: ${errText.slice(0, 200)}`);
  }
  return res.json();
}

// 4. Interactive Category Prompt
async function promptForCategory() {
  if (TARGET_CATEGORY || TARGET_SLUGS) {
    return TARGET_CATEGORY;
  }

  if (!process.stdin.isTTY) {
    return null;
  }

  let categories = [];
  try {
    const res = await strapiApi('/api/commerce-categories?pagination[pageSize]=100&sort[0]=name:asc');
    categories = (res.data || []).map((c) => ({
      name: c.name,
      slug: c.slug,
    }));
  } catch (err) {
    console.warn(' (Could not fetch categories automatically, using manual input)');
  }

  console.log('📋 Available Product Categories:');
  console.log('  [0] All Categories (No Filter)');
  categories.forEach((cat, idx) => {
    console.log(`  [${idx + 1}] ${cat.name} (${cat.slug})`);
  });
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolve) => {
    rl.question(`👉 Select category number (0-${categories.length}) or enter category slug [default: 0]: `, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });

  if (!answer || answer === '0') {
    console.log(' Selected: All Categories\n');
    return null;
  }

  const num = parseInt(answer, 10);
  if (!isNaN(num) && num >= 1 && num <= categories.length) {
    const selected = categories[num - 1];
    console.log(` Selected Category: ${selected.name} (${selected.slug})\n`);
    return selected.slug;
  }

  console.log(` Selected Custom Category: "${answer}"\n`);
  return answer;
}

// 5. Helper to enforce word count limit (< 12 words)
function enforceMaxWords(text, maxWords = 11) {
  if (!text || typeof text !== 'string') return '';
  let words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length > maxWords) {
    words = words.slice(0, maxWords);
    let title = words.join(' ').replace(/[,;\-—|:\/&\s]+$/, '');
    // Trim trailing prepositions/conjunctions that get cut off mid-phrase
    title = title.replace(/\b(?:and|with|or|for|the|a|an|of|in|on|at|by|to|&)\b$/gi, '').trim();
    title = title.replace(/[,;\-—|:\/&\s]+$/, '');
    return title;
  }
  return text.trim();
}

// 6. Algorithmic Fallback & Slugifier
function slugify(text) {
  return String(text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanTitleAlgorithmic(rawName, brand) {
  let clean = rawName
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\|.*$/g, '')
    .replace(/(?:UPC|ASIN|SKU|MPN)[\s:]*[A-Z0-9]+/gi, '')
    .replace(/\b(?:Unlocked Cell Phone|Unlocked Smartphone|Unlocked|Global Version)\b/gi, '')
    .replace(/\b(?:Free Shipping|Official Store|Fast Delivery|Best Price)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  clean = clean.replace(/[,-\s]+$/, '');

  if (brand && !clean.toLowerCase().includes(brand.toLowerCase())) {
    clean = `${brand} ${clean}`;
  }

  clean = enforceMaxWords(clean, 11);

  const metaTitle = `${clean} - Best Deals & Price Comparison`;
  const slug = slugify(clean);

  return { name: clean, metaTitle, slug };
}

// 7. AI Rewriter via Anthropic API
async function rewriteTitleWithAI(product) {
  const brand = product.brand || product.brandRef?.name || '';
  const category = product.category || product.categories?.[0]?.name || '';
  const rawName = product.name || '';
  const specs = product.specs || {};

  if (!ANTHROPIC_KEY) {
    return cleanTitleAlgorithmic(rawName, brand);
  }

  const prompt = `You are an expert e-commerce SEO copywriter. Rewrite the following product title for a price comparison site.

Raw Product Title: "${rawName}"
Brand: "${brand}"
Category: "${category}"
Product Specs: ${JSON.stringify(specs).slice(0, 300)}

Requirements:
1. "name": Clean, concise, human-readable product title (MUST be strictly less than 12 words, max 11 words, 30-60 chars). Include Brand, Model Name, and key distinction (e.g. storage size, color, or primary spec). Remove ALL merchant clutter, seller codes, ASINs, UPCs, "Free Shipping", "Unlocked", or duplicate keywords. Title Case.
2. "metaTitle": High-converting SEO meta title suitable for Google Search (50-60 chars max). Format: "[Clean Product Name] - Best Deals & Price Comparison".
3. "slug": Clean, URL-friendly slug based on the new product title (lowercased, hyphenated, alphanumeric only, max 70 chars).

Return ONLY strict valid JSON with no markdown formatting:
{
  "name": "...",
  "metaTitle": "...",
  "slug": "..."
}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      console.warn(` [AI Warning] Anthropic API HTTP ${res.status}, using algorithmic fallback.`);
      return cleanTitleAlgorithmic(rawName, brand);
    }

    const data = await res.json();
    const textContent = data.content?.[0]?.text || '';
    const cleanedJsonText = textContent.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleanedJsonText);

    if (parsed.name && parsed.metaTitle && parsed.slug) {
      const finalName = enforceMaxWords(parsed.name, 11);
      return {
        name: finalName,
        metaTitle: parsed.metaTitle.trim(),
        slug: slugify(parsed.slug || finalName),
      };
    }
  } catch (err) {
    console.warn(` [AI Exception] ${err.message}, using algorithmic fallback.`);
  }

  return cleanTitleAlgorithmic(rawName, brand);
}

// 8. Fetch Products from Strapi (Targeting titles >= 12 words)
async function getProductsToProcess() {
  const base = '/api/commerce-products';
  const out = [];

  if (TARGET_SLUGS) {
    for (const slug of TARGET_SLUGS) {
      const q = `?filters[slug][$eq]=${encodeURIComponent(slug)}&populate[categories][fields][0]=name&populate[brandRef][fields][0]=name&pagination[pageSize]=1`;
      const res = await strapiApi(`${base}${q}`);
      if (res.data?.[0]) {
        const p = res.data[0];
        const wordCount = (p.name || '').trim().split(/\s+/).filter(Boolean).length;
        if (wordCount >= 12) {
          out.push(p);
        } else {
          console.log(`ℹ️  Target product "${slug}" has ${wordCount} words (< 12 words). Skipping.`);
        }
      } else {
        console.warn(`⚠️  No product found for target slug "${slug}"`);
      }
    }
    return out;
  }

  let page = 1;
  const pageSize = 50;
  let scannedTotal = 0;

  while (out.length < LIMIT) {
    const catFilter = (TARGET_CATEGORY && TARGET_CATEGORY !== 'all') ? `filters[categories][slug][$eq]=${encodeURIComponent(TARGET_CATEGORY)}&` : '';
    const q = `?${catFilter}populate[categories][fields][0]=name&populate[brandRef][fields][0]=name&pagination[page]=${page}&pagination[pageSize]=${pageSize}&sort[0]=updatedAt:desc`;
    const res = await strapiApi(`${base}${q}`);
    const rows = res.data || [];
    scannedTotal += rows.length;

    for (const p of rows) {
      const wordCount = (p.name || '').trim().split(/\s+/).filter(Boolean).length;
      if (wordCount >= 12) {
        out.push(p);
        if (out.length >= LIMIT) break;
      }
    }

    const pageCount = res.meta?.pagination?.pageCount || 1;
    if (page >= pageCount || rows.length === 0) break;
    page += 1;
  }

  console.log(`Scanned ${scannedTotal} products across ${page} page(s). Found ${out.length} product(s) with titles >= 12 words.\n`);
  return out;
}

// 9. Main Execution Loop
async function main() {
  TARGET_CATEGORY = await promptForCategory();

  if (TARGET_CATEGORY) {
    console.log(`Filtering by category: "${TARGET_CATEGORY}"`);
  } else {
    console.log('Processing across ALL categories.');
  }

  console.log('Fetching products from Strapi...');
  const products = await getProductsToProcess();

  let rewrittenCount = 0;
  let errorCount = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const docId = p.documentId || p.id;
    const currentName = p.name || '';
    const currentSlug = p.slug || '';
    const wordCount = currentName.trim().split(/\s+/).filter(Boolean).length;

    console.log(`[${i + 1}/${products.length}] Product ID: ${docId} ("${currentSlug}")`);
    console.log(`  ➔ ✏️  Long Title (${wordCount} words): "${currentName}"`);

    try {
      const rewritten = await rewriteTitleWithAI(p);
      const newWordCount = rewritten.name.trim().split(/\s+/).filter(Boolean).length;

      console.log(`  ➔ ✨ New Title (${newWordCount} words): "${rewritten.name}"`);
      console.log(`  ➔ 🔍 Meta Title: "${rewritten.metaTitle}"`);
      console.log(`  ➔ 🔗 New Slug:   "${rewritten.slug}"`);

      if (DRY_RUN) {
        console.log('  ➔ 🧪 [DRY-RUN] Skipped saving to Strapi.');
        rewrittenCount++;
      } else {
        const existingSpecs = p.specs && typeof p.specs === 'object' ? p.specs : {};
        const updatedSpecs = {
          ...existingSpecs,
          metaTitle: rewritten.metaTitle,
          titleRewritten: true,
          titleRewrittenAt: new Date().toISOString(),
          originalName: currentName,
          originalSlug: currentSlug,
        };

        const payload = {
          data: {
            name: rewritten.name,
            slug: rewritten.slug,
            specs: updatedSpecs,
          },
        };

        await strapiApi(`/api/commerce-products/${docId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });

        console.log('  ➔ ✅ Saved to Strapi successfully!');
        rewrittenCount++;
      }
    } catch (err) {
      console.error(`  ➔ ❌ Failed to rewrite product ${docId}:`, err.message);
      errorCount++;
    }

    console.log('');
  }

  console.log('---------------------------------------------------------');
  console.log(' Execution Summary:');
  console.log(`   Rewritten: ${rewrittenCount}`);
  console.log(`   Errors:    ${errorCount}`);
  console.log('---------------------------------------------------------');
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
