import { SITE } from '@/lib/site';

// robots.txt is a constant policy document — prerender it as a static asset.
export const dynamic = 'force-static';

/**
 * robots.txt — the single, version-controlled source of truth for crawl policy.
 *
 * ── AI CRAWLER POLICY (intentional — see README "AI crawler policy") ──────────
 * We split AI crawlers into two classes and treat them differently:
 *
 *   • TRAINING crawlers  → DISALLOWED. We do not permit our original review /
 *     comparison content to be scraped for training or fine-tuning AI models.
 *
 *   • ANSWER / SEARCH crawlers → ALLOWED. These power citations and referral
 *     traffic in ChatGPT Search, Perplexity, Apple/Google search, etc. Blocking
 *     them would cost visibility with no content-protection upside, so we allow
 *     them EXPLICITLY (not just implicitly via the `*` group).
 *
 * The `Content-Signal` line expresses the same stance as a reservation of rights
 * (Cloudflare content-signals / EU DSM Directive Art. 4): search=yes, ai-train=no.
 *
 * ── IMPORTANT: Cloudflare Managed robots.txt must stay OFF ────────────────────
 * Cloudflare's "AI Audit → Block AI bots / Managed robots.txt" feature PREPENDS
 * its own block to whatever the origin serves. If it is enabled, the served file
 * ends up with duplicate/conflicting groups and this file is no longer the source
 * of truth. Keep that feature disabled so this file governs. (See README.)
 */

// Answer / search engines — surface citations & drive referral traffic. ALLOWED.
const ANSWER_BOTS: { ua: string; note: string }[] = [
  { ua: 'OAI-SearchBot', note: 'OpenAI — ChatGPT Search index & citations' },
  { ua: 'ChatGPT-User', note: 'OpenAI — user-triggered fetch inside ChatGPT' },
  { ua: 'PerplexityBot', note: 'Perplexity — answer-engine index & citations' },
  { ua: 'Perplexity-User', note: 'Perplexity — user-triggered fetch' },
  { ua: 'Claude-SearchBot', note: 'Anthropic — Claude search citations' },
  { ua: 'Claude-User', note: 'Anthropic — user-triggered fetch inside Claude' },
  { ua: 'Applebot', note: 'Apple — Siri / Spotlight search (NOT training)' },
];

// AI training / dataset crawlers — no model-training use permitted. DISALLOWED.
const TRAINING_BOTS: { ua: string; note: string }[] = [
  { ua: 'GPTBot', note: 'OpenAI — model training' },
  { ua: 'Google-Extended', note: 'Google — Gemini/Vertex training signal (not Search)' },
  { ua: 'Applebot-Extended', note: 'Apple — AI-training opt-out signal' },
  { ua: 'ClaudeBot', note: 'Anthropic — general/training crawler' },
  { ua: 'CCBot', note: 'Common Crawl — feeds many training datasets' },
  { ua: 'Bytespider', note: 'ByteDance — training' },
  { ua: 'Amazonbot', note: 'Amazon — Alexa / AI' },
  { ua: 'meta-externalagent', note: 'Meta — AI training' },
  { ua: 'cohere-ai', note: 'Cohere — training' },
  { ua: 'Diffbot', note: 'Diffbot — dataset harvesting' },
  { ua: 'Omgilibot', note: 'Webis/omgili — training datasets' },
  { ua: 'Timpibot', note: 'Timpi — training' },
];

// Applied to every ALLOWED group so answer bots get the same base treatment as `*`.
const BASE_DISALLOW = ['Disallow: /search', 'Disallow: /api/'];

function robotsTxt(): string {
  const lines: string[] = [
    '# nxt.bargains crawl policy — version-controlled in app/robots.txt/route.ts.',
    '# See the README ("AI crawler policy") for the rationale behind these choices.',
    '#',
    '# Content-Signal (reservation of rights — Cloudflare content-signals / EU DSM Art. 4):',
    '#   search=yes     indexing for search results is permitted',
    '#   ai-train=no    training / fine-tuning AI models is NOT permitted',
    '#   use=reference  AI systems may reference (cite) content, not ingest it wholesale',
    '',
    '# Default policy: open to conventional search + answer engines; noise routes blocked.',
    'User-agent: *',
    'Content-Signal: search=yes,ai-train=no,use=reference',
    'Allow: /',
    ...BASE_DISALLOW,
    '',
    '# ── Answer / search engines: EXPLICITLY ALLOWED (citations + referral traffic) ──',
  ];

  for (const { ua, note } of ANSWER_BOTS) {
    lines.push('', `# ${note}`, `User-agent: ${ua}`, 'Allow: /', ...BASE_DISALLOW);
  }

  lines.push('', '# ── AI training / dataset crawlers: DISALLOWED (no AI model training) ──');
  for (const { ua, note } of TRAINING_BOTS) {
    lines.push('', `# ${note}`, `User-agent: ${ua}`, 'Disallow: /');
  }

  lines.push('', `Host: ${SITE.url}`, `Sitemap: ${SITE.url}/sitemap.xml`, '');
  return lines.join('\n');
}

export function GET() {
  return new Response(robotsTxt(), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
