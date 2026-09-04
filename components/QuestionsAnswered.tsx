import type { ReactNode } from 'react';

export type QaItem = { question: string; answer: string };

/**
 * "Questions Answered" card — the post's FAQ entries in the reference layout:
 * blue bullet, bold question, answer clamped to two lines with an arrow that
 * opens the rest.
 *
 * The disclosure is a hidden checkbox plus a label rather than a client
 * component, matching the pattern already used for the category intros. That
 * keeps the whole card server-rendered, so the answers are in the HTML for
 * crawlers even while collapsed.
 *
 * The arrow in the reference is decorative next to AI-generated answers. Here
 * it does something real — a control that looks clickable and is not would be
 * worse than no control.
 */
export default function QuestionsAnswered({ items, idPrefix = 'qa' }: { items: QaItem[]; idPrefix?: string }) {
  if (!items.length) return null;

  return (
    <section className="questions-answered" data-testid="questions-answered" aria-labelledby="questions-answered-heading">
      <h2 className="questions-answered-heading" id="questions-answered-heading">
        Questions Answered
      </h2>

      <ul className="qa-list">
        {items.map((item, i) => {
          const id = `${idPrefix}-${i}`;
          return (
            <li key={id} className="qa-item">
              <input type="checkbox" id={id} className="qa-toggle" />
              <span className="qa-bullet" aria-hidden />
              <div className="qa-body">
                <p className="qa-question">{item.question}</p>
                <p className="qa-answer">{item.answer}</p>
              </div>
              <label className="qa-arrow" htmlFor={id} aria-label="Show the full answer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function QuestionsAnsweredEmpty(): ReactNode {
  return null;
}
