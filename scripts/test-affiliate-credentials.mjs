#!/usr/bin/env node
/**
 * Credential smoke test for the two affiliate integrations that are configured
 * but not yet live: eBay Developer (Browse API) and Walmart via Impact Radius.
 *
 * Answers one question per check — does this key work, right now, against the
 * real endpoint — and says which key is at fault when one does not. It writes
 * nothing and touches no cache, so it is safe to run against production.
 *
 * The checks go beyond "did we authenticate". Both APIs hand back a valid
 * credential response in situations that still yield no usable data:
 *
 *   eBay issues a perfectly good OAuth token for a *sandbox* keyset, and the
 *   Browse API then returns zero results forever. So the token is spent on a
 *   real search, and an empty result on production is reported as a failure
 *   rather than as an empty catalogue.
 *
 *   Impact authenticates at the account level, which says nothing about
 *   whether Walmart has approved this partner. Campaign 9383 is checked by
 *   name, because an unapproved program simply does not appear in the list.
 *
 *   node scripts/test-affiliate-credentials.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// Same loader the fetch-* scripts use: real environment wins, so a value can be
// exported for a one-off run without editing the file.
for (const line of (existsSync(join(ROOT, '.env.local')) ? readFileSync(join(ROOT, '.env.local'), 'utf8') : '').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
}

const results = [];
const ok = (name, detail) => { results.push({ name, pass: true, detail }); console.log(`  PASS  ${name}\n        ${detail}`); };
const bad = (name, detail, fix) => { results.push({ name, pass: false, detail, fix }); console.log(`  FAIL  ${name}\n        ${detail}${fix ? `\n        fix: ${fix}` : ''}`); };
const skip = (name, why) => { results.push({ name, skip: true }); console.log(`  SKIP  ${name}\n        ${why}`); };

/* ---------------------------------------------------------------- eBay ---- */
async function testEbay() {
  console.log('\neBay Developer API');
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) {
    return skip('eBay', 'EBAY_CLIENT_ID / EBAY_CLIENT_SECRET are not set in .env.local');
  }

  const sandbox = (process.env.EBAY_ENV || 'production').toLowerCase() === 'sandbox';
  const host = sandbox ? 'api.sandbox.ebay.com' : 'api.ebay.com';
  const marketplace = process.env.EBAY_MARKETPLACE_ID || 'EBAY_US';

  // A production Cert ID begins PRD-, a sandbox one SBX-. Worth saying out
  // loud: the pair authenticates either way, and only the empty search that
  // follows would otherwise reveal the mix-up.
  const secretKind = secret.startsWith('PRD-') ? 'production' : secret.startsWith('SBX-') ? 'sandbox' : 'unrecognised prefix';
  if (!sandbox && secretKind === 'sandbox') {
    bad('eBay keyset matches EBAY_ENV', `EBAY_ENV is production but the secret is a sandbox (SBX-) key`, 'use the Production keyset from developer.ebay.com > Application Keysets');
  } else {
    ok('eBay keyset matches EBAY_ENV', `EBAY_ENV=${sandbox ? 'sandbox' : 'production'}, secret looks ${secretKind}`);
  }

  let accessToken;
  try {
    const res = await fetch(`https://${host}/identity/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      },
      body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
      signal: AbortSignal.timeout(20000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return bad('eBay OAuth token', `HTTP ${res.status} ${body.error ?? ''} ${body.error_description ?? ''}`.trim(),
        body.error === 'invalid_client' ? 'App ID or Cert ID is wrong, or the keyset is disabled' : undefined);
    }
    accessToken = body.access_token;
    ok('eBay OAuth token', `client_credentials granted, expires in ${body.expires_in}s`);
  } catch (e) {
    return bad('eBay OAuth token', String(e.message ?? e));
  }

  // The token alone proves nothing about data access — spend it.
  try {
    const url = `https://${host}/buy/browse/v1/item_summary/search?q=${encodeURIComponent('wireless headphones')}&limit=3`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': marketplace,
      },
      signal: AbortSignal.timeout(25000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = body.errors?.[0];
      return bad('eBay Browse API search', `HTTP ${res.status} ${err?.message ?? ''}`.trim(),
        res.status === 403 ? 'the keyset lacks the Buy APIs; request Browse API access in the developer console' : undefined);
    }
    const items = body.itemSummaries ?? [];
    if (!items.length) {
      return bad('eBay Browse API search', `marketplace ${marketplace} returned 0 results for a generic query`,
        'this is the signature of a sandbox keyset used against production');
    }
    ok('eBay Browse API search', `${body.total?.toLocaleString() ?? '?'} hits on ${marketplace}; first: ${items[0].title?.slice(0, 52)}`);
  } catch (e) {
    return bad('eBay Browse API search', String(e.message ?? e));
  }

  // EPN is what monetises the URLs; without it the Browse results are unpaid.
  const campaign = process.env.EBAY_EPN_CAMPAIGN_ID;
  if (!campaign) {
    skip('eBay Partner Network campaign', 'EBAY_EPN_CAMPAIGN_ID not set — links will resolve but earn nothing');
  } else if (!/^\d{10}$/.test(campaign)) {
    bad('eBay Partner Network campaign', `"${campaign}" is not a 10-digit EPN campaign id`);
  } else {
    ok('eBay Partner Network campaign', `${campaign}`);
  }
}

/* -------------------------------------------------------------- Impact ---- */
async function testImpact() {
  console.log('\nWalmart via Impact Radius');
  const sid = process.env.IMPACT_ACCOUNT_SID;
  const token = process.env.IMPACT_AUTH_TOKEN;
  if (!sid || !token) {
    return skip('Impact', 'IMPACT_ACCOUNT_SID / IMPACT_AUTH_TOKEN are not set in .env.local');
  }

  const auth = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
  const base = `https://api.impact.com/Mediapartners/${sid}`;
  const get = async (path) => {
    const res = await fetch(`${base}${path}`, {
      headers: { Authorization: auth, Accept: 'application/json' },
      signal: AbortSignal.timeout(30000),
    });
    return { res, body: await res.json().catch(() => ({})) };
  };

  // The SID is the API username, not the partner id — it is expected to look
  // like IRxxxxxxxxxxxx and is what goes in the URL path above.
  if (!/^IR[A-Za-z0-9]{6,}$/.test(sid)) {
    bad('Impact Account SID shape', `"${sid.slice(0, 6)}…" does not look like an Impact Account SID (IR…)`,
      'copy the Account SID from app.impact.com > Settings > API, not the partner/affiliate id');
  } else {
    ok('Impact Account SID shape', `${sid.slice(0, 6)}… looks like an Account SID`);
  }

  let campaigns;
  try {
    const { res, body } = await get('/Campaigns?PageSize=200');
    if (!res.ok) {
      return bad('Impact authentication', `HTTP ${res.status} ${body.Message ?? ''}`.trim(),
        res.status === 401 ? 'the Auth Token is the API password from Settings > API, not the login password' : undefined);
    }
    campaigns = body.Campaigns ?? [];
    ok('Impact authentication', `${campaigns.length} campaign(s) visible to this account`);
  } catch (e) {
    return bad('Impact authentication', String(e.message ?? e));
  }

  // Authenticating says nothing about Walmart specifically: an unapproved
  // program is simply absent from the list.
  const walmart = campaigns.find((c) => /walmart/i.test(c.AdvertiserName ?? c.CampaignName ?? ''));
  if (!walmart) {
    bad('Walmart program approved', `no Walmart campaign among ${campaigns.length}`,
      'apply to the Walmart.com program in Impact and wait for approval');
  } else {
    ok('Walmart program approved', `${walmart.AdvertiserName} — campaign ${walmart.CampaignId}, status ${walmart.ContractStatus ?? 'n/a'}`);
    // The partner id lives in the tracking link, not in any env var: it is the
    // first path segment after /c/. This is the actual "affiliate id".
    const partner = String(walmart.TrackingLink ?? '').match(/goto\.walmart\.com\/c\/(\d+)/)?.[1];
    if (partner) ok('Walmart partner (affiliate) id', `${partner} — taken from the tracking link, already baked into catalog URLs`);
  }

  const configured = process.env.IMPACT_WALMART_CATALOG_ID;
  try {
    const { res, body } = await get('/Catalogs?PageSize=200');
    if (!res.ok) return bad('Impact catalogs', `HTTP ${res.status}`);
    const catalogs = body.Catalogs ?? [];
    ok('Impact catalogs', `${catalogs.length} catalog(s) available`);
    if (configured) {
      const hit = catalogs.find((c) => String(c.Id) === String(configured));
      if (hit) ok('IMPACT_WALMART_CATALOG_ID', `${configured} = ${hit.Name} (${Number(hit.NumberOfItems ?? 0).toLocaleString()} items)`);
      else bad('IMPACT_WALMART_CATALOG_ID', `${configured} is not among this account's catalogs`);
    } else {
      skip('IMPACT_WALMART_CATALOG_ID', 'not set — fetch-walmart.mjs has no catalog to page');
    }
  } catch (e) {
    bad('Impact catalogs', String(e.message ?? e));
  }
}

await testEbay();
await testImpact();

const failed = results.filter((r) => r.pass === false);
const skipped = results.filter((r) => r.skip);
console.log(`\n${results.filter((r) => r.pass).length} passed, ${failed.length} failed, ${skipped.length} skipped`);
process.exit(failed.length ? 1 : 0);
