'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';

export default function ProductDescription({ markdown }: { markdown: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      /* 620, not 600: the threshold has to sit just above the clamp height, or
         copy between the two gets a Read More button with nothing hidden behind
         it — max-h-[600px] would not clip a 610px block enough to notice. The
         20px of slack also stops a block that is a hair over the limit from
         showing a toggle that reveals one more line. */
      if (contentRef.current.scrollHeight > 620) {
        setIsClamped(true);
      }
    }
  }, [markdown]);

  function inline(text: string): ReactNode {
    const parts: ReactNode[] = [];
    // Match **bold**, *italic*, and [link text](url)
    const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let key = 0;

    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      const tok = m[0];
      if (tok.startsWith('**')) {
        parts.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
      } else if (tok.startsWith('*')) {
        parts.push(<em key={key++}>{tok.slice(1, -1)}</em>);
      } else if (tok.startsWith('[')) {
        const matchLink = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (matchLink) {
          const [, label, href] = matchLink;
          parts.push(
            <a
              key={key++}
              href={href}
              className="inline-flex items-center gap-1 font-semibold text-[#0046be] hover:underline"
            >
              {label}
            </a>
          );
        } else {
          parts.push(tok);
        }
      }
      last = m.index + tok.length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  }

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  let lastHeadingText = '';

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (line.startsWith('### ')) {
      lastHeadingText = line.slice(4).trim();
      const headingId = lastHeadingText.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      blocks.push(
        <h3
          key={key++}
          id={headingId}
          className="mt-6 pt-1 font-display text-base font-bold text-ink first:mt-0"
        >
          {inline(lastHeadingText)}
        </h3>
      );
      i += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      lastHeadingText = line.slice(3).trim();
      const headingId = lastHeadingText.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      blocks.push(
        <h3
          key={key++}
          id={headingId}
          className="mt-6 font-display text-lg font-bold text-ink first:mt-0"
        >
          {inline(lastHeadingText)}
        </h3>
      );
      i += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={key++} className="mt-3 list-disc space-y-1.5 pl-5">
          {items.map((it, idx) => (
            <li key={idx}>{inline(it)}</li>
          ))}
        </ul>
      );
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('### ') &&
      !lines[i].startsWith('## ') &&
      !/^\s*[-*]\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={key++} className="mt-3 first:mt-0">
        {inline(para.join(' '))}
      </p>
    );
  }

  return (
    <div className="relative">
      <div
        ref={contentRef}
        className={`transition-all duration-300 ${
          isClamped && !isExpanded
            ? 'max-h-[600px] overflow-hidden relative'
            : 'max-h-none'
        }`}
      >
        {blocks}

        {/* Gradient overlay when clamped and not expanded */}
        {isClamped && !isExpanded && (
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />
        )}
      </div>

      {/* Read More / Read Less toggle link after 600px */}
      {isClamped && (
        <div className="mt-3 pt-2 text-left">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0046be] hover:text-[#003187] hover:underline focus:outline-none"
          >
            {isExpanded ? (
              <>
                Read Less <span aria-hidden="true">↑</span>
              </>
            ) : (
              <>
                Read More <span aria-hidden="true">↓</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
