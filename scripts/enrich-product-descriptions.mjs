#!/usr/bin/env node
/**
 * Product Description Rewriter & Enricher for nxt.bargains
 *
 * Location: /opt/projects/nxt.bargains/scripts/enrich-product-descriptions.mjs
 *
 * Requirements:
 * - Rewrites/generates `shortDescription` (1-2 sentences) and markdown `description`.
 * - Generated content MUST be based on current descriptions, specifications, brand, and category info.
 * - `description` MUST contain at least 3 sections/paragraphs:
 *     1. ### Overview (full prose intro paragraph)
 *     2. ### Key Features (MUST feature 4-7 bullet points "- ")
 *     3. ### Ideal For & Value (full prose verdict/target audience paragraph)
 * - Automatically prompts for category selection if not specified on CLI.
 * - Detects already-enriched product descriptions and skips them (unless --force / --overwrite is used).
 * - CLI flags: --dry-run, --limit, --slugs, --category, --force/--overwrite.
 *
 * Usage:
 *   node scripts/enrich-product-descriptions.mjs                        # Interactive mode
 *   node scripts/enrich-product-descriptions.mjs --category smart-phones # Filter by category
 *   node scripts/enrich-product-descriptions.mjs --dry-run --limit 5    # Preview mode
 *   node scripts/enrich-product-descriptions.mjs --slugs apple-iphone-17 # Specific product
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
console.log('  NXT.Bargains — Product Description Rewriter & Enricher');
console.log('---------------------------------------------------------');
console.log(` Mode:           ${DRY_RUN ? 'DRY-RUN (no updates saved)' : 'LIVE WRITE'}`);
console.log(` Force Overwrite:${FORCE ? ' YES (--force active)' : ' NO (skipping enriched)'}`);
console.log(` Limit:          ${LIMIT} products`);
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
    console.warn(' (Could not fetch categories automatically)');
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

// 5. Check if description is already enriched / rewritten
function isAlreadyEnriched(product) {
  if (FORCE) return false;

  const specs = product.specs || {};

  // 1. Explicit metadata flags
  if (
    specs.descriptionEnriched === true ||
    specs.descriptionRewritten === true ||
    specs.isDescriptionRewritten === true
  ) {
    return true;
  }

  const desc = (product.description || '').trim();
  const shortDesc = (product.shortDescription || '').trim();

  // 2. Already has structured Markdown description (Overview / Key Features / Headings + Bullets)
  const hasKeyFeatures = /###\s+key\s+features/i.test(desc) || /###\s+overview/i.test(desc);
  const hasBullets = /^\s*[-*]\s+/m.test(desc);

  if (hasKeyFeatures && hasBullets && desc.length > 150) {
    return true;
  }

  // 3. Has non-empty short description & long description with bullet points
  if (shortDesc.length > 20 && desc.length > 250 && hasBullets) {
    return true;
  }

  return false;
}

// 6. Algorithmic Fallback Generator
function generateFallbackContent(product) {
  const name = product.name || 'Product';
  const brand = product.brand || product.brandRef?.name || '';
  const category = product.category || product.categories?.[0]?.name || 'Electronics';
  const specs = product.specs || {};

  const shortDescription = `${brand ? brand + ' ' : ''}${name} is a high-performance ${category.toLowerCase()} designed to deliver exceptional quality, modern features, and reliable daily performance.`;

  // Build bullet points from specs
  const bulletItems = [];
  if (brand) bulletItems.push(`**Brand**: ${brand}`);
  if (specs['CPU Model'] || specs['Processor']) bulletItems.push(`**Processor**: ${specs['CPU Model'] || specs['Processor']}`);
  if (specs['RAM Memory Installed'] || specs['RAM']) bulletItems.push(`**Memory**: ${specs['RAM Memory Installed'] || specs['RAM']}`);
  if (specs['Memory Storage Capacity'] || specs['Storage']) bulletItems.push(`**Storage**: ${specs['Memory Storage Capacity'] || specs['Storage']}`);
  if (specs['Screen Size'] || specs['Display Type']) bulletItems.push(`**Display**: ${specs['Screen Size'] ? specs['Screen Size'] + ' ' : ''}${specs['Display Type'] || ''}`);
  if (specs['Color']) bulletItems.push(`**Color Finish**: ${specs['Color']}`);
  if (specs['Battery Capacity'] || specs['Battery Power']) bulletItems.push(`**Battery**: ${specs['Battery Capacity'] || specs['Battery Power']}`);
  if (specs['Operating System']) bulletItems.push(`**Operating System**: ${specs['Operating System']}`);

  if (bulletItems.length === 0) {
    bulletItems.push(`**Category**: ${category}`);
    bulletItems.push(`**Design**: Modern, durable build quality`);
    bulletItems.push(`**Performance**: Optimized for everyday tasks and multitasking`);
    bulletItems.push(`**Compatibility**: Universal standards compliant`);
  }

  const bulletsMarkdown = bulletItems.map((item) => `- ${item}`).join('\n');

  const description = `### Overview
The ${name} combines sleek craftsmanship with advanced technology to offer a seamless user experience. Engineered by ${brand || 'top manufacturers'} for efficiency and durability, it delivers crisp performance across all primary applications.

### Key Features
${bulletsMarkdown}

### Ideal For & Verdict
Whether you are upgrading your current device or looking for a dependable ${category.toLowerCase()} solution, the ${name} offers outstanding value, versatile features, and robust quality for daily use.`;

  return { shortDescription, description };
}

// 7. AI Copywriter via Anthropic API
async function generateDescriptionWithAI(product) {
  const rawName = product.name || '';
  const brand = product.brand || product.brandRef?.name || '';
  const category = product.category || product.categories?.[0]?.name || '';
  const rawShortDesc = product.shortDescription || '';
  const rawDesc = product.description || '';
  const specs = product.specs || {};

  if (!ANTHROPIC_KEY) {
    return generateFallbackContent(product);
  }

  const prompt = `You are a senior e-commerce copywriter for NXT.Bargains. Write accurate, engaging, and high-converting product descriptions based on the provided product information.

Product Name: "${rawName}"
Brand: "${brand}"
Category: "${category}"
Existing Short Description: "${rawShortDesc}"
Existing Main Description: "${rawDesc.slice(0, 500)}"
Specifications: ${JSON.stringify(specs)}

Requirements for JSON response:
1. "shortDescription": 1-2 sentences (~25-45 words) plain text summary of the product and its primary value proposition.
2. "description": Detailed Markdown text with AT LEAST 3 sections/paragraphs:
   - Section 1 ("### Overview"): A 3-5 sentence detailed introductory paragraph explaining product design, core specs, and main capabilities.
   - Section 2 ("### Key Features"): MUST contain 4 to 7 bullet points formatted as "- **Feature**: Details".
   - Section 3 ("### Ideal For & Verdict"): A 3-5 sentence paragraph explaining target audience, key use cases, and purchasing verdict.

Return ONLY strict valid JSON object (no comments, no extra text):
{
  "shortDescription": "1-2 sentence plain text summary",
  "description": "### Overview\\n...\\n\\n### Key Features\\n- **Feature 1**: ...\\n- **Feature 2**: ...\\n- **Feature 3**: ...\\n\\n### Ideal For & Verdict\\n..."
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
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.warn(` [AI Warning] HTTP ${res.status}: ${errBody.slice(0, 150)}, using algorithmic fallback.`);
      return generateFallbackContent(product);
    }

    const data = await res.json();
    const textContent = data.content?.[0]?.text || '';
    const cleanedJsonText = textContent.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleanedJsonText);

    if (parsed.shortDescription && parsed.description) {
      // Validate that bullet points exist in paragraph 2
      if (parsed.description.includes('- ') || parsed.description.includes('* ')) {
        return {
          shortDescription: parsed.shortDescription.trim(),
          description: parsed.description.trim(),
        };
      }
    }
  } catch (err) {
    console.warn(` [AI Exception] ${err.message}, using algorithmic fallback.`);
  }

  return generateFallbackContent(product);
}

// 8. Fetch Products
async function getProductsToProcess() {
  const base = '/api/commerce-products';
  const out = [];

  if (TARGET_SLUGS) {
    for (const slug of TARGET_SLUGS) {
      const q = `?filters[slug][$eq]=${encodeURIComponent(slug)}&populate[categories][fields][0]=name&populate[brandRef][fields][0]=name&pagination[pageSize]=1`;
      const res = await strapiApi(`${base}${q}`);
      if (res.data?.[0]) out.push(res.data[0]);
      else console.warn(`⚠️  No product found for slug "${slug}"`);
    }
    return out;
  }

  let page = 1;
  const pageSize = 50;
  while (out.length < LIMIT) {
    const catFilter = TARGET_CATEGORY ? `filters[categories][slug][$eq]=${encodeURIComponent(TARGET_CATEGORY)}&` : '';
    const q = `?${catFilter}populate[categories][fields][0]=name&populate[brandRef][fields][0]=name&pagination[page]=${page}&pagination[pageSize]=${pageSize}&sort[0]=updatedAt:desc`;
    const res = await strapiApi(`${base}${q}`);
    const rows = res.data || [];
    out.push(...rows);
    const pageCount = res.meta?.pagination?.pageCount || 1;
    if (page >= pageCount || rows.length === 0) break;
    page += 1;
  }

  return out.slice(0, LIMIT);
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
  console.log(`Found ${products.length} products to check.\n`);

  let skippedCount = 0;
  let enrichedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const docId = p.documentId || p.id;
    const name = p.name || '';
    const slug = p.slug || '';

    console.log(`[${i + 1}/${products.length}] Product ID: ${docId} ("${slug}") - "${name.slice(0, 50)}"`);

    if (isAlreadyEnriched(p)) {
      console.log('  ➔ ⏭️  [SKIP] Product description already enriched.\n');
      skippedCount++;
      continue;
    }

    try {
      const generated = await generateDescriptionWithAI(p);

      console.log(`  ➔ 📝 Short Description (${generated.shortDescription.length} chars):`);
      console.log(`     "${generated.shortDescription}"`);
      console.log(`  ➔ 📄 Main Description (${generated.description.length} chars, 3 sections):`);
      console.log(
        generated.description
          .split('\n')
          .slice(0, 10)
          .map((l) => '     ' + l)
          .join('\n') + '\n     ...'
      );

      if (DRY_RUN) {
        console.log('  ➔ 🧪 [DRY-RUN] Skipped saving to Strapi.\n');
        enrichedCount++;
      } else {
        const existingSpecs = p.specs && typeof p.specs === 'object' ? p.specs : {};
        const updatedSpecs = {
          ...existingSpecs,
          descriptionEnriched: true,
          descriptionEnrichedAt: new Date().toISOString(),
        };

        const payload = {
          data: {
            shortDescription: generated.shortDescription,
            description: generated.description,
            specs: updatedSpecs,
          },
        };

        await strapiApi(`/api/commerce-products/${docId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });

        console.log('  ➔ ✅ Saved enriched description to Strapi successfully!\n');
        enrichedCount++;
      }
    } catch (err) {
      console.error(`  ➔ ❌ Failed to enrich product ${docId}:`, err.message, '\n');
      errorCount++;
    }
  }

  console.log('---------------------------------------------------------');
  console.log(' Execution Summary:');
  console.log(`   Enriched: ${enrichedCount}`);
  console.log(`   Skipped:  ${skippedCount}`);
  console.log(`   Errors:   ${errorCount}`);
  console.log('---------------------------------------------------------');
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
