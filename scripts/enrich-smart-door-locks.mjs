#!/usr/bin/env node
/**
 * Smart Door Locks Description Rewriter & Enricher for nxt.bargains
 *
 * Location: /opt/projects/nxt.bargains/scripts/enrich-smart-door-locks.mjs
 *
 * Purpose:
 *   Generates extended, comprehensive, multi-section product descriptions and
 *   refined short descriptions for products in the "Smart Door Locks" category.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const STRAPI_BASE = (process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL || 'http://127.0.0.1:8888').replace(/\/$/, '');
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force') || args.includes('--overwrite');

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

function formatTitleCase(str) {
  if (!str) return '';
  // If string is ALL CAPS, convert to Title Case
  if (str === str.toUpperCase() && str.length > 4) {
    return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return str;
}

function getCleanModelTitle(brand, modelName, rawName) {
  const b = brand.trim();
  let m = (modelName || rawName || '').trim();
  m = formatTitleCase(m);

  // Remove duplicate brand prefix in model name
  if (m.toLowerCase().startsWith(b.toLowerCase() + ' ')) {
    m = m.slice(b.length + 1).trim();
  }
  return { brand: b, model: m, fullName: `${b} ${m}` };
}

/**
 * Builds extended, comprehensive Smart Door Lock descriptions based on product specs.
 */
export function buildExtendedSmartLockDescription(product) {
  const specs = product.specs || {};
  const rawName = product.name || 'Smart Door Lock';
  const rawBrand = product.brand || product.brandRef?.name || specs['Brand Name'] || 'Smart Lock';
  const rawModelName = specs['Model Name'] || specs['Model Number'] || rawName;

  const { brand, model, fullName } = getCleanModelTitle(rawBrand, rawModelName, rawName);
  const displayTitle = formatTitleCase(rawName);

  const color = specs.Color || specs['Finish Types'] || 'Modern Finish';
  const lockType = specs['Lock Type'] || 'Keyless Electronic Lock';
  const styleName = specs['Style Name'] ? formatTitleCase(specs['Style Name']) : '';
  const controlMethod = specs['Control Method'] || 'Keypad / Touchscreen';
  const controllerType = specs['Controller Type'] || 'Smart Home Systems';
  const connectivity = specs['Connectivity Protocol'] || 'Wi-Fi / Bluetooth';
  const material = specs['Material Type'] || 'Durable Alloy';
  const dimensions = specs['Item Dimensions'] || '';
  const itemHighlight = specs['Item Highlight'] || specs['Additional Features'] || '';
  const warranty = specs['Manufacturer Warranty Description'] || 'Standard manufacturer warranty';
  const recommendedUses = specs['Recommended Uses For Product'] || 'Front doors, entryway, residential or rental properties';
  const components = specs['Included Components'] || 'Mounting hardware and user documentation';
  const rating = product.rating ? `${product.rating} out of 5 stars` : specs['Customer Reviews'] || 'Highly rated by users';

  // Feature detection
  const isBiometric = /fingerprint|biometric/i.test(displayTitle + lockType + itemHighlight);
  const isWifi = /wifi|wi-fi|matter/i.test(displayTitle + connectivity + itemHighlight);
  const isAppleHome = /apple|homekit|tap to unlock/i.test(displayTitle + controllerType + itemHighlight);
  const isFlexLock = /flex lock|auto-lock|auto lock/i.test(displayTitle + itemHighlight + specs['Item Type Name']);

  // 1. SHORT DESCRIPTION (2-3 sentences, 40-60 words)
  const shortDescription = `The ${fullName} delivers keyless entry convenience and robust door security for modern homes. Featuring ${controlMethod.toLowerCase()} access, integrated ${connectivity} connectivity, and a weather-resistant ${color} finish, it offers flexible PIN codes, quick unlocking, and emergency physical key backup.`;

  // 2. EXTENDED DESCRIPTION (5 Markdown sections, ~450-600 words)

  // Section 1: Product Overview
  const overviewP1 = `The **${displayTitle}** brings advanced keyless entry and dependable deadbolt security to your front door or office entry. Designed by **${brand}**, this smart door lock features a refined ${color} finish${styleName ? ` with iconic ${styleName} trim design` : ''} that elevates your entryway aesthetics while delivering high-level physical protection. Built from premium ${material}, the heavy-duty housing is crafted to withstand daily residential use, environmental weather exposure, and unauthorized entry attempts.`;

  const overviewP2 = `Eliminate the hassle of lost keys, locked-out family members, and hidden spare keys. The ${brand} lock supports versatile access methods—including ${isBiometric ? 'rapid biometric fingerprint scanning, ' : ''}illuminated PIN code entry, mobile app access, and physical emergency key overrides. Whether you are letting in family members, creating temporary guest passcodes for Airbnb visitors, or monitoring access logs, the ${fullName} offers total control and keyless convenience right at your fingertips.`;

  // Section 2: Key Features & Access Modes
  const bulletList = [];
  bulletList.push(`- **Multiple Unlocking Options**: Access your door quickly using ${isBiometric ? 'high-precision 3D fingerprint recognition, ' : ''}customizable PIN codes, smartphone app controls, or traditional backup keys.`);
  if (isWifi) {
    bulletList.push(`- **Integrated ${connectivity} Connectivity**: Connects directly to your home network without requiring external bridge hardware or additional hub setup.`);
  }
  bulletList.push(`- **Automatic Locking & Security**: ${isFlexLock ? 'Equipped with customizable flex-lock modes, allowing auto-locking timers or standard keyless passage mode.' : 'Automatically re-locks after a preset duration, giving you total peace of mind whenever you enter or exit.'}`);
  bulletList.push(`- **Custom PIN Code Management**: Program distinct user codes for family members and generate scheduled or temporary guest passcodes ideal for rental hosts, contractors, and visitors.`);
  bulletList.push(`- **Weatherproof & Heavy-Duty Build**: Constructed from durable ${material} with a protective ${color} finish engineered to resist corrosion, scratches, and rain.`);
  if (isAppleHome || controllerType.toLowerCase().includes('alexa') || controllerType.toLowerCase().includes('google')) {
    bulletList.push(`- **Smart Ecosystem & Voice Control**: Works with ${controllerType} for seamless hands-free voice commands, door state checking, and smart home automation.`);
  }
  bulletList.push(`- **Emergency Power & Physical Key Overrides**: Features physical keyways and emergency external battery jump points so you are never stranded during low-battery conditions.`);
  if (warranty && warranty.length > 5) {
    bulletList.push(`- **Manufacturer Warranty Coverage**: ${warranty}`);
  }

  // Section 3: Smart Home Integration & Connectivity
  const smartHomeP1 = `Featuring advanced ${connectivity} connectivity, the ${displayTitle} seamlessly integrates into your existing smart home network. Through your preferred app and ${controllerType}, you can monitor real-time lock status, lock or unlock remotely, and receive instant activity notifications whenever your door is accessed.`;

  const smartHomeP2 = `Integrate entry triggers with connected home automation routines. Program your entrance to automatically disarm home security, adjust thermostat temperatures, and turn on hallway lights the moment your master PIN code or fingerprint unlocks the door.`;

  // Section 4: Installation, Fit & Hardware Prep
  const installP1 = `Designed for simple DIY installation, the ${brand} smart door lock installs easily on standard exterior and interior residential doors using a basic screwdriver—no custom drilling or professional wiring required.`;

  const installP2 = `Fits standard door cutouts with universal backset options (2-3/8" or 2-3/4") and standard door thickness ranges (1-3/8" to 1-3/4"). Included in the box: ${components}${dimensions ? `, with exterior dimensions measuring ${dimensions}` : ''}.`;

  // Section 5: Ideal For & Purchasing Verdict
  const verdictP1 = `The **${displayTitle}** is an ideal security upgrade for homeowners, property managers, Airbnb hosts, and apartment renters looking to combine modern keyless entry with stylish architectural hardware. With a customer review score of **${rating}**, it is widely recognized for its build quality and daily reliability.`;

  const verdictP2 = `Backed by **${brand}**'s trusted manufacturing standard and durable ${material} construction, the ${fullName} offers superior protection, smart convenience, and excellent long-term value for your entryways.`;

  const description = `### Product Overview
${overviewP1}

${overviewP2}

### Key Features & Access Modes
${bulletList.join('\n')}

### Smart Home Integration & Connectivity
${smartHomeP1}

${smartHomeP2}

### Installation, Fit & Hardware Prep
${installP1}

${installP2}

### Ideal For & Purchasing Verdict
${verdictP1}

${verdictP2}`;

  return { shortDescription, description };
}

async function main() {
  console.log('---------------------------------------------------------');
  console.log(' NXT.Bargains — Smart Door Locks Description Rewriter');
  console.log('---------------------------------------------------------');
  console.log(` Mode: ${DRY_RUN ? 'DRY-RUN (no changes saved)' : 'LIVE WRITE'}`);
  console.log(` Force: ${FORCE ? 'YES' : 'NO'}`);
  console.log('---------------------------------------------------------\n');

  console.log('Fetching products in category "Smart Door Locks" (smart-door-locks)...');
  const res = await strapiApi('/api/commerce-products?filters[categories][slug][$eq]=smart-door-locks&pagination[pageSize]=100&populate[categories][fields][0]=name&populate[brandRef][fields][0]=name');
  const products = res.data || [];
  console.log(`Found ${products.length} Smart Door Lock products.\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const docId = p.documentId || p.id;
    const name = p.name || '';
    const slug = p.slug || '';

    console.log(`[${i + 1}/${products.length}] Processing product ID: ${docId} ("${slug}")`);
    console.log(`  Name: "${name}"`);

    // Check if already enriched with extended format unless --force
    const currentDesc = p.description || '';
    if (!FORCE && currentDesc.includes('### Product Overview') && currentDesc.includes('### Installation, Fit & Hardware Prep') && currentDesc.length > 1500) {
      console.log('  ➔ ⏭️  [SKIP] Extended description already present (>1500 chars).\n');
      skipped++;
      continue;
    }

    try {
      const generated = buildExtendedSmartLockDescription(p);

      console.log(`  ➔ 📝 Short Description (${generated.shortDescription.length} chars):`);
      console.log(`     "${generated.shortDescription}"`);
      console.log(`  ➔ 📄 Main Description (${generated.description.length} chars, 5 sections):`);
      console.log(generated.description.split('\n').slice(0, 12).map(l => '     ' + l).join('\n') + '\n     ...');

      if (DRY_RUN) {
        console.log('  ➔ 🧪 [DRY-RUN] Skipped saving to Strapi.\n');
        updated++;
      } else {
        const existingSpecs = p.specs && typeof p.specs === 'object' ? p.specs : {};
        const updatedSpecs = {
          ...existingSpecs,
          descriptionEnriched: true,
          descriptionRewritten: true,
          descriptionEnrichedAt: new Date().toISOString(),
          extendedDescriptionGenerated: true,
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

        console.log('  ➔ ✅ Saved extended description to Strapi successfully!\n');
        updated++;
      }
    } catch (err) {
      console.error(`  ➔ ❌ Error updating product ${docId}:`, err.message, '\n');
      errors++;
    }
  }

  console.log('---------------------------------------------------------');
  console.log(' Execution Summary:');
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors:  ${errors}`);
  console.log('---------------------------------------------------------');
}

if (process.argv[1] && process.argv[1].endsWith('enrich-smart-door-locks.mjs')) {
  main().catch(err => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });
}
