/**
 * Heading extraction and id generation for post bodies.
 *
 * Shared deliberately: the contents rail is built on the server from the post
 * source, while the ids it links to are emitted by PostContent when it renders.
 * If those two used separate slug logic every anchor would break the first time
 * a heading contained punctuation, so both call `headingSlug` through here.
 *
 * Handles both content shapes in this catalogue — Markdown (`## Heading`) for
 * newer posts, and HTML (`<h2>`) for the WordPress imports.
 */

export type PostHeading = { id: string; text: string; level: 2 | 3 };

/** Stable, URL-safe id for a heading. `used` de-duplicates repeats. */
export function headingSlug(text: string, used?: Set<string>): string {
  const base =
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'section';

  if (!used) return base;

  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

/** True when the value looks like Markdown rather than HTML. Mirrors PostContent. */
function isMarkdown(value: string): boolean {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/<(?:p|div|h[1-6]|ul|ol|li|figure|table|style|section|article|br|img|a)\b/i.test(text)) return false;
  return /(^|\n)\s{0,3}#{1,6}\s+\S/.test(text);
}

/** Strip inline Markdown emphasis and links down to their text. */
function plainText(value: string): string {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]+/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/gi, ' ')
    .trim();
}

/**
 * Headings in document order, normalised to two display levels.
 *
 * Levels are normalised rather than taken literally: these posts were imported
 * from WordPress and many use a single heading level throughout, so keying the
 * rail's styling off the raw tag would render an entire post as sub-entries.
 * Whatever the shallowest heading present turns out to be becomes the top
 * level; anything deeper is a sub-entry.
 */
export function extractHeadings(source: string): PostHeading[] {
  const text = String(source || '');
  if (!text.trim()) return [];

  const found: { text: string; depth: number }[] = [];

  if (isMarkdown(text)) {
    for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
      const m = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
      if (!m) continue;
      const label = plainText(m[2]);
      if (label) found.push({ text: label, depth: m[1].length });
    }
  } else {
    for (const m of text.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
      const label = plainText(m[2]);
      if (label) found.push({ text: label, depth: Number(m[1]) });
    }
  }

  if (!found.length) return [];

  const shallowest = Math.min(...found.map((h) => h.depth));
  const used = new Set<string>();
  return found.map((h) => ({
    id: headingSlug(h.text, used),
    text: h.text,
    level: (h.depth === shallowest ? 2 : 3) as 2 | 3,
  }));
}
