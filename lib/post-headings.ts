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
export function isMarkdownContent(value: string): boolean {
  return isMarkdown(value);
}

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

/**
 * Assign anchor ids to the headings in an HTML body and return the list.
 *
 * This has to happen on the server, and the returned list has to be what the
 * rail is built from. Deriving the two independently does not work: an imported
 * heading may already carry a WordPress id, in which case the body keeps it
 * while a text-derived slug would point somewhere that does not exist, and the
 * de-duplication counters drift apart the moment one side skips a heading the
 * other counted. Both problems showed up as rails full of dead anchors.
 *
 * Existing ids are preserved — hand-written in-page links depend on them.
 */
export function applyHtmlHeadingIds(html: string): { html: string; headings: PostHeading[] } {
  const found: { id: string; text: string; depth: number }[] = [];
  const used = new Set<string>();

  // First pass: reserve every id already present, so a generated slug cannot
  // collide with one further down the document.
  for (const m of String(html || '').matchAll(/<h[1-6]\b[^>]*\bid=["']([^"']+)["'][^>]*>/gi)) {
    used.add(m[1]);
  }

  const out = String(html || '').replace(
    /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (full, lvl, attrs, inner) => {
      const text = plainText(inner);
      if (!text) return full;

      const existing = /\bid=["']([^"']+)["']/i.exec(attrs);
      if (existing) {
        found.push({ id: existing[1], text, depth: Number(lvl) });
        return full;
      }

      const id = headingSlug(text, used);
      found.push({ id, text, depth: Number(lvl) });
      return `<h${lvl}${attrs} id="${id}">${inner}</h${lvl}>`;
    },
  );

  if (!found.length) return { html: out, headings: [] };

  const shallowest = Math.min(...found.map((h) => h.depth));
  return {
    html: out,
    headings: found.map((h) => ({
      id: h.id,
      text: h.text,
      level: (h.depth === shallowest ? 2 : 3) as 2 | 3,
    })),
  };
}

/**
 * Split an HTML body in two at a section break, for inserting a block midway.
 *
 * Splits before the second top-level heading, so the insert lands between
 * sections rather than inside a paragraph run. "Top-level" is checked by
 * counting div/section/aside tags before the candidate: if any are still open
 * there, the heading is nested inside a card or wrapper and cutting at that
 * point would produce two fragments of broken markup, so the split is refused.
 *
 * Returns null when there is no safe point — callers should fall back to
 * appending rather than forcing an insert.
 */
export function splitHtmlAtSection(html: string): [string, string] | null {
  const text = String(html || '');
  if (!text.trim()) return null;

  const headings = [...text.matchAll(/<h[23]\b[^>]*>/gi)].map((m) => m.index ?? -1).filter((i) => i >= 0);
  if (headings.length < 3) return null;

  const balanced = (upTo: number) => {
    const chunk = text.slice(0, upTo);
    for (const tag of ['div', 'section', 'aside', 'ul', 'ol', 'table']) {
      const open = (chunk.match(new RegExp(`<${tag}\\b`, 'gi')) ?? []).length;
      const close = (chunk.match(new RegExp(`</${tag}>`, 'gi')) ?? []).length;
      if (open !== close) return false;
    }
    return true;
  };

  // Prefer the second heading; walk forward if it is nested.
  for (const at of headings.slice(1, -1)) {
    if (balanced(at)) return [text.slice(0, at), text.slice(at)];
  }
  return null;
}
