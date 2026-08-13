'use client';

import { useState } from 'react';

/**
 * Review text with a "See more" toggle.
 *
 * Cards sit in a fixed grid, so one long review would otherwise stretch every
 * row it shares. The full text is always in the DOM and only visually clamped,
 * which keeps it readable to crawlers and to anyone without JavaScript — a
 * truncated review that cannot be expanded is worse than no truncation at all.
 */
const CLAMP_AT = 240;

export default function ReviewCardBody({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const needsToggle = text.length > CLAMP_AT;

  return (
    <div className="review-card-body-wrap">
      <p className={`review-card-body${needsToggle && !open ? ' is-clamped' : ''}`}>{text}</p>
      {needsToggle && (
        <button type="button" className="review-see-more" onClick={() => setOpen((v) => !v)}>
          {open ? 'See less' : 'See more'}
        </button>
      )}
    </div>
  );
}
