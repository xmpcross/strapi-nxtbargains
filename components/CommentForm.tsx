'use client';

import { useEffect, useState } from 'react';

const REMEMBER_KEY = 'nxt-comment-author';

type Status = 'idle' | 'submitting' | 'ok' | 'error';

export default function CommentForm({
  postDocumentId,
  collapsible = false,
}: {
  postDocumentId: string;
  /**
   * Render the form behind an "Add a comment" toggle, collapsed by default.
   * Used by the editorial post layout; the original template shows it open.
   */
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(!collapsible);
  const [authorName, setAuthorName] = useState('');
  const [email, setEmail] = useState('');
  const [body, setBody] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [remember, setRemember] = useState(false);

  // Restore a previously saved name/e-mail. Wrapped because storage throws
  // outright in some privacy modes rather than just returning null.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(REMEMBER_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { name?: string; email?: string };
      if (parsed.name) setAuthorName(parsed.name);
      if (parsed.email) setEmail(parsed.email);
      setRemember(true);
    } catch {
      /* no stored details, or storage unavailable */
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');
    setMessage('');

    try {
      const res = await fetch('/api/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postDocumentId, authorName, email, body, website }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        try {
          if (remember) window.localStorage.setItem(REMEMBER_KEY, JSON.stringify({ name: authorName, email }));
          else window.localStorage.removeItem(REMEMBER_KEY);
        } catch {
          /* storage unavailable — the comment still went through */
        }
        setStatus('ok');
        setMessage(data.message || 'Thanks for your comment. It will appear once approved.');
        setAuthorName('');
        setEmail('');
        setBody('');
        setWebsite('');
      } else {
        setStatus('error');
        setMessage(data.message || 'Could not save your comment. Please try again.');
      }
    } catch {
      setStatus('error');
      setMessage('Could not save your comment. Please try again.');
    }
  }

  const form = (
    <form onSubmit={onSubmit} className="comment-form" data-testid="comment-form">
      <h4 className="comment-form-heading">Leave a Reply</h4>
      <p className="comment-form-note">
        Your email address will not be published. Required fields are marked{' '}
        <span aria-hidden>*</span>
      </p>

      <div className="comment-form-row">
        <div className="comment-field">
          <label htmlFor="comment-name">
            Name <span className="comment-req" aria-hidden>*</span>
          </label>
          <input
            id="comment-name"
            required
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Enter Your Name"
            maxLength={80}
          />
        </div>

        <div className="comment-field">
          <label htmlFor="comment-email">
            E-mail <span className="comment-req" aria-hidden>*</span>
          </label>
          <input
            id="comment-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter Your E-mail"
            maxLength={180}
          />
        </div>
      </div>

      {/* Honeypot — a real visitor never sees it, a bot fills it in. */}
      <input
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
        aria-hidden="true"
      />

      <div className="comment-field comment-field-full">
        <label htmlFor="comment-body">
          Message <span className="comment-req" aria-hidden>*</span>
        </label>
        <textarea
          id="comment-body"
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Your Message"
          rows={5}
          minLength={5}
          maxLength={4000}
        />
      </div>

      {/* Presentational only. Nothing here persists the name or e-mail, and a
          checkbox that silently does nothing would be a lie to the reader, so
          it is wired to a real localStorage write below. */}
      <label className="comment-remember">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />
        <span>Save my name and e-mail in this browser for the next time I comment.</span>
      </label>

      {message && (
        <p
          className={`comment-message ${status === 'ok' ? 'is-ok' : 'is-error'}`}
          data-testid={status === 'ok' ? 'comment-success' : 'comment-error'}
        >
          {message}
        </p>
      )}

      <button type="submit" disabled={status === 'submitting' || !postDocumentId} className="comment-submit">
        {status === 'submitting' ? 'Submitting…' : 'Submit Comment'}
      </button>
      <p className="comment-form-footnote">Comments are checked before they appear.</p>
    </form>
  );

  if (!collapsible) return form;

  return (
    <div className="comment-collapse" data-testid="comment-collapse">
      <button
        type="button"
        className="comment-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="comment-form-panel"
      >
        Add a comment
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" data-open={open ? 'true' : undefined}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div id="comment-form-panel" className="comment-panel">
          {form}
        </div>
      ) : null}
    </div>
  );
}
