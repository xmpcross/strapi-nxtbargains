'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/**
 * Renders post body HTML.
 *
 * Source posts come from a WordPress site that bakes a "GreenShift / GSPB" block
 * into the markup — inline <style> chunks, .gspb_* class names and a flex column
 * layout. Tailwind's `prose` class fights GSPB's layout (forces block images,
 * adds vertical margins between siblings, etc.), so we render plain HTML and
 * style only the non-GSPB elements via globals.css scoped to `.post-content`.
 *
 * Also wires GreenShift FAQ accordions: the source's vanilla JS isn't running
 * here, so on mount we collapse every `.gs-accordion-item` (add `.gsclose`)
 * and attach a click handler on its title that toggles the class. CSS in
 * globals.css hides `.gsclose > .gs-accordion-item__content`.
 *
 * Affiliate-tag rewriting happens at import time (server-side, in the importer)
 * — not here.
 */
export default function PostContent({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const body = normalizePostHeadings(html);
  const shouldRenderMarkdown = looksLikeMarkdown(body);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const items = root.querySelectorAll<HTMLElement>('.gs-accordion-item');
    const cleanups: Array<() => void> = [];

    items.forEach((item) => {
      item.classList.add('gsclose');
      const title = item.querySelector<HTMLElement>('.gs-accordion-item__title');
      if (!title) return;
      title.setAttribute('role', 'button');
      title.setAttribute('tabindex', '0');
      const onActivate = (e: Event) => {
        if (e instanceof KeyboardEvent && e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        item.classList.toggle('gsclose');
        title.setAttribute('aria-expanded', String(!item.classList.contains('gsclose')));
      };
      title.setAttribute('aria-expanded', 'false');
      title.addEventListener('click', onActivate);
      title.addEventListener('keydown', onActivate);
      cleanups.push(() => {
        title.removeEventListener('click', onActivate);
        title.removeEventListener('keydown', onActivate);
      });
    });

    const carousels = root.querySelectorAll<HTMLElement>('.nxt-product-carousel[data-autoslide="true"]');
    carousels.forEach((carousel) => {
      const track = carousel.querySelector<HTMLElement>('.nxt-product-carousel__track');
      if (!track) return;

      const slide = () => {
        const firstCard = track.querySelector<HTMLElement>('.nxt-product-carousel__item');
        if (!firstCard) return;

        const maxScroll = track.scrollWidth - track.clientWidth;
        if (maxScroll <= 0) return;

        const gap = Number.parseFloat(window.getComputedStyle(track).columnGap || '0') || 0;
        const step = firstCard.offsetWidth + gap;
        const nextLeft = track.scrollLeft + step >= maxScroll - 4 ? 0 : track.scrollLeft + step;
        track.scrollTo({ left: nextLeft, behavior: 'smooth' });
      };

      const interval = window.setInterval(slide, 4200);
      cleanups.push(() => window.clearInterval(interval));
    });

    // Make comparison/spec tables snippet-eligible + responsive: fill in missing
    // scope attributes (col on the header row, row on each row's first <th>) and
    // wrap wide tables so they scroll horizontally instead of overflowing.
    root.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
      if (table.dataset.enhanced) return;
      table.dataset.enhanced = 'true';

      const headRow = table.tHead?.rows[0] ?? table.rows[0];
      headRow?.querySelectorAll('th').forEach((th) => {
        if (!th.getAttribute('scope')) th.setAttribute('scope', 'col');
      });
      Array.from(table.tBodies).forEach((tb) => {
        Array.from(tb.rows).forEach((row) => {
          const first = row.cells[0];
          if (first && first.tagName === 'TH' && !first.getAttribute('scope')) {
            first.setAttribute('scope', 'row');
          }
        });
      });

      if (!table.closest('.post-table-wrap')) {
        const wrap = document.createElement('div');
        wrap.className = 'post-table-wrap';
        table.parentNode?.insertBefore(wrap, table);
        wrap.appendChild(table);
      }
    });

    return () => cleanups.forEach((fn) => fn());
  }, [body, shouldRenderMarkdown]);

  if (shouldRenderMarkdown) {
    return (
      <div ref={ref} className="post-content" data-testid="post-content">
        <MarkdownContent markdown={body} />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="post-content"
      data-testid="post-content"
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

function normalizePostHeadings(value: string) {
  return String(value || '')
    .replace(/<h2(\s[^>]*)?>/gi, '<h4$1>')
    .replace(/<\/h2>/gi, '</h4>')
    .replace(/<h3(\s[^>]*)?>/gi, '<h4$1>')
    .replace(/<\/h3>/gi, '</h4>');
}

function looksLikeMarkdown(value: string) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/<(?:p|div|h[1-6]|ul|ol|li|figure|table|style|section|article|br|img|a)\b/i.test(text)) return false;
  return /(^|\n)\s{0,3}#{1,6}\s+\S/.test(text)
    || /(^|\n)\s*[-*]\s+\S/.test(text)
    || /(^|\n)\s*\d+\.\s+\S/.test(text);
}

function MarkdownContent({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let key = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = Math.min(6, heading[1].length);
      const children = renderInline(heading[2]);
      if (level === 1) blocks.push(<h4 key={key++}>{children}</h4>);
      else if (level === 2) blocks.push(<h4 key={key++}>{children}</h4>);
      else if (level === 3) blocks.push(<h4 key={key++}>{children}</h4>);
      else if (level === 4) blocks.push(<h4 key={key++}>{children}</h4>);
      else blocks.push(<h5 key={key++}>{children}</h5>);
      i += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, '').trim());
        i += 1;
      }
      blocks.push(
        <ul key={key++}>
          {items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, '').trim());
        i += 1;
      }
      blocks.push(
        <ol key={key++}>
          {items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}
        </ol>,
      );
      continue;
    }

    const paragraph: string[] = [];
    while (
      i < lines.length
      && lines[i].trim()
      && !/^\s{0,3}#{1,6}\s+/.test(lines[i])
      && !/^\s*[-*]\s+/.test(lines[i])
      && !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    blocks.push(<p key={key++}>{renderInline(paragraph.join(' '))}</p>);
  }

  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];

    if (token.startsWith('**')) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*')) {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
      if (link) {
        nodes.push(
          <a key={key++} href={link[2]} target="_blank" rel="noopener noreferrer">
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }

    last = match.index + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
