'use client';

import { useEffect, useRef, useState } from 'react';

export type TocEntry = { id: string; text: string; level: 2 | 3 };

/**
 * Left rail on smart-home posts: reading time with a scroll-progress bar, then
 * a contents list linking to the body headings.
 *
 * Client-side because both halves need the scroll position — the bar fills as
 * the reader moves through the article, and the current section is highlighted.
 *
 * Progress is measured against the article element passed by id rather than the
 * whole document: the page carries a footer, comments and a related-posts rail
 * below the post, and measuring the document would leave the bar short of full
 * at the end of the actual reading material.
 */
export default function PostMetabar({
  readingTimeMinutes,
  toc,
  targetId,
}: {
  readingTimeMinutes?: number | null;
  toc: TocEntry[];
  /** id of the element whose scroll range drives the progress bar. */
  targetId: string;
}) {
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const ticking = useRef(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;

    const measure = () => {
      ticking.current = false;

      const rect = target.getBoundingClientRect();
      const viewport = window.innerHeight;
      // How far through the article the viewport has travelled, clamped so the
      // bar reads 0 before it is reached and 100 once it has been passed.
      const total = rect.height - viewport;
      const done = total > 0 ? (-rect.top) / total : rect.bottom <= viewport ? 1 : 0;
      setProgress(Math.min(1, Math.max(0, done)));

      // The heading nearest the top of the viewport that has already passed it.
      let current: string | null = null;
      for (const entry of toc) {
        const el = document.getElementById(entry.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= viewport * 0.25) current = entry.id;
        else break;
      }
      setActiveId(current);
    };

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [targetId, toc]);

  return (
    <div className="metabar">
      {readingTimeMinutes ? (
        <div className="metabar-card">
          <p className="metabar-time">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
              <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {readingTimeMinutes} min read
          </p>
          <div
            className="metabar-progress"
            role="progressbar"
            aria-label="Reading progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <span style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      ) : null}

      {toc.length > 0 ? (
        <nav className="metabar-toc" aria-label="Contents">
          <p className="metabar-toc-heading">Contents</p>
          <ul>
            {toc.map((entry) => (
              <li key={entry.id} data-level={entry.level}>
                <a href={`#${entry.id}`} data-active={entry.id === activeId ? 'true' : undefined}>
                  {entry.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
