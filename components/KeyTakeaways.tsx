/**
 * KeyTakeaways / TL;DR callout — a short, scannable summary rendered at the very
 * top of comparisons, reviews and guides so search and AI engines (featured
 * snippets, voice, AI Overviews) can extract a direct answer immediately.
 *
 * ── EDITORIAL PATTERN (author guidance) ─────────────────────────────────────
 * 1. TL;DR FIRST. Fill the Strapi `keyTakeaways` field with either 2–5 bullet
 *    points OR a single 40–60 word summary that answers the reader's core
 *    question up front (lead with the conclusion, no "as shown below").
 *
 * 2. QUESTION HEADING + DIRECT ANSWER. Structure each major body section as a
 *    natural-language QUESTION heading, followed IMMEDIATELY by a self-contained
 *    40–60 word answer, then the deeper detail:
 *
 *      ## How does the Ring Doorbell compare to Nest?
 *      Nest wins on video quality and smart alerts, while Ring offers more models
 *      and cheaper subscriptions. For homes already on Google, Nest integrates
 *      better; Ring is the safer pick for Alexa households and tighter budgets.
 *      <…deeper comparison, specs, table…>
 *
 *    This "question + concise answer" shape is what earns featured snippets and
 *    is the unit AI engines quote. Keep answers 40–60 words and standalone.
 *
 * 3. COMPARISONS need a clean semantic <table>: a real <caption>, <th scope="col">
 *    for column headers and <th scope="row"> for the first cell of each row, so
 *    the spec grid is snippet-eligible.
 *
 * The field accepts markdown-lite (`-`/`*` bullets, `**bold**`, `[text](url)`) or
 * raw HTML; whichever it contains is rendered.
 */
export function KeyTakeaways({
  content,
  title = 'Key takeaways',
}: {
  content?: string | null;
  title?: string;
}) {
  const raw = (content ?? '').trim();
  if (!raw) return null;

  const looksLikeHtml = /<(p|ul|ol|li|h[1-6]|div|strong|em|br|a)\b/i.test(raw);
  const html = looksLikeHtml ? raw : markdownLiteToHtml(raw);

  return (
    <aside
      data-testid="key-takeaways"
      aria-label={title}
      className="key-takeaways not-prose my-6 rounded-xl p-5 sm:p-6"
    >
      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
          <path d="M12 3l2.6 5.6L21 9.4l-4.5 4.3 1.1 6.3L12 17l-5.6 3 1.1-6.3L3 9.4l6.4-.8z" fill="currentColor" />
        </svg>
        {title}
      </p>
      <div
        className="prose prose-sm max-w-none text-ink/90 [&_a]:text-primary [&_a]:underline [&_li]:my-1 [&_p]:my-1 [&_ul]:my-1"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </aside>
  );
}

/**
 * Minimal, dependency-free markdown → safe HTML for the takeaways field.
 * Escapes HTML first, then applies only bullets, bold and links.
 */
function markdownLiteToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
        '<a href="$2" rel="nofollow noopener" target="_blank">$1</a>',
      );

  const lines = md.split(/\r?\n/).map((l) => l.trim());
  const out: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  for (const line of lines) {
    if (!line) {
      closeList();
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inline(bullet[1])}</li>`);
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join('');
}
