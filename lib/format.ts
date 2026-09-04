import { format, parseISO } from 'date-fns';

/**
 * Date and time, as the price box shows it: "5 Aug 2026, 5:06 pm".
 *
 * Rendered on the server only, so there is no client/server locale split to
 * reconcile — the string in the HTML is the string the reader sees.
 */
export function fmtDateTime(iso?: string): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'd MMM yyyy, h:mm aaa');
  } catch {
    return '';
  }
}

export function fmtDate(iso?: string): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return '';
  }
}

// Pick the canonical primary category for a post — the first one that's not "uncategorized".
export function primaryCategorySlug(post: { categories?: { slug: string }[] }): string {
  const cats = post.categories ?? [];
  const real = cats.find((c) => c.slug !== 'uncategorized');
  return real?.slug ?? cats[0]?.slug ?? 'uncategorized';
}

export function postPath(post: { slug: string; categories?: { slug: string }[] }): string {
  return `/${primaryCategorySlug(post)}/${post.slug}`;
}

// First inline <img src="..."> in post body HTML — used as a thumbnail fallback
// when a post has no coverImage (e.g., when the WP featured_media reference
// was orphaned, but the body still has Amazon product images).
export function firstImageUrl(html?: string): string | null {
  if (!html) return null;
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1] ?? null;
}

/**
 * Clamp a meta description to `max` characters (default 155) for SERP display.
 * Collapses whitespace, cuts at the last word boundary, and appends an ellipsis
 * only when it actually truncated — the returned string (including the ellipsis)
 * never exceeds `max`. Returns '' for empty input; short input is unchanged.
 */
export function clampDescription(input: string | undefined, max = 155): string {
  if (!input) return '';
  const text = input.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  // Reserve one char for the ellipsis so the result stays within `max`.
  const slice = text.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).replace(/[\s.,;:!?—–-]+$/, '');
  return `${cut}…`;
}

/**
 * Build-time SEO length feedback: warn (once per render) when a source
 * description exceeds 160 chars or a title exceeds 60, keyed by a slug/id so
 * editors can find the offending content. Titles are only flagged, never cut.
 */
export function warnSeoLength(
  ref: string,
  { description, title }: { description?: string | null; title?: string | null },
): void {
  const desc = (description ?? '').replace(/\s+/g, ' ').trim();
  const heading = (title ?? '').trim();
  if (desc.length > 160) {
    console.warn(`[seo] ${ref}: description is ${desc.length} chars (>160) — will be clamped to 155 for SERPs`);
  }
  if (heading.length > 60) {
    console.warn(`[seo] ${ref}: title is ${heading.length} chars (>60) — consider shortening for SERPs`);
  }
}

/** Strip HTML tags, decode common entities, and collapse whitespace — for
 *  plain-text schema fields (e.g. FAQPage answer text). */
export function stripHtml(input?: string | null): string {
  if (!input) return '';
  const entities: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ',
  };
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, e) => entities[e] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Confidently parse ordered how-to steps from post-body HTML. Only headings
 * that clearly read as steps — "Step 1…", or a leading number ("1.", "2)",
 * "3:") — followed by body text are captured. Returns [] unless at least two
 * such steps are found, so ambiguous guides safely keep Article schema.
 */
export function parseHowToSteps(html?: string | null): { name: string; text: string }[] {
  if (!html) return [];
  const steps: { name: string; text: string }[] = [];
  const re = /<h[23][^>]*>([\s\S]*?)<\/h[23]>([\s\S]*?)(?=<h[23][^>]*>|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const name = stripHtml(m[1]);
    if (!/^(step\s*\d+\b|\d+\s*[.):])/i.test(name)) continue;
    const text = stripHtml(m[2]).slice(0, 600).trim();
    if (name && text) steps.push({ name, text });
  }
  return steps.length >= 2 ? steps : [];
}
