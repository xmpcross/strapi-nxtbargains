'use client';

import { useState } from 'react';

const CONTACT_EMAIL = 'hello@nxt.bargains';

/**
 * Contact form. Posts to /api/contact, which sends through Brevo.
 *
 * It used to build a `mailto:` URL and set window.location. That silently does
 * nothing wherever no mail client is registered — most phones, and any desktop
 * where the handler is unset — so the visitor pressed send and the message was
 * simply lost, with the UI claiming success.
 */
export default function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  /* Filled only by bots; the field is hidden from people and assistive tech. */
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    setError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message, company }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || 'We could not send that. Please try again shortly.');
        setStatus('error');
        return;
      }
      setStatus('sent');
      setName(''); setEmail(''); setSubject(''); setMessage('');
    } catch {
      setError('We could not reach the server. Please check your connection and try again.');
      setStatus('error');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative space-y-5"
      data-testid="contact-form"
      aria-label="Contact form"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" id="contact-name" required>
          <input
            id="contact-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className={inputClass}
          />
        </Field>
        <Field label="Email" id="contact-email" required>
          <input
            id="contact-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Subject" id="contact-subject">
        <input
          id="contact-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="What’s this about?"
          className={inputClass}
        />
      </Field>
      <Field label="Message" id="contact-message" required>
        <textarea
          id="contact-message"
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us a bit more…"
          className={`${inputClass} resize-y`}
        />
      </Field>

      {/* Honeypot: off-screen rather than display:none, which some bots skip. */}
      <div aria-hidden className="absolute left-[-9999px] h-px w-px overflow-hidden">
        <label htmlFor="contact-company">Company</label>
        <input
          id="contact-company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          className="inline-flex items-center rounded-full bg-primary px-6 py-3 font-display text-sm font-bold uppercase tracking-wider text-white transition hover:bg-primary-emphasis disabled:opacity-50"
          disabled={!name || !email || !message || status === 'sending'}
        >
          {status === 'sending' ? 'Sending…' : 'Send message'}
        </button>
        {status === 'sent' && (
          <p className="text-sm font-semibold text-emerald-700" role="status">
            Thanks — your message is on its way. We usually reply within a couple of days.
          </p>
        )}
        {status === 'error' && (
          <p className="text-sm text-red-700" role="alert">
            {error}{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-primary hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        )}
      </div>
      <p className="text-xs leading-5 text-ink/45">
        Your message is sent straight to our inbox. Your address is only used to reply to you.
      </p>
    </form>
  );
}

const inputClass =
  'block w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-base text-ink placeholder:text-ink/40 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

function Field({
  label,
  id,
  required,
  children,
}: {
  label: string;
  id: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 block text-sm font-medium text-ink/80">
        {label}
        {required && <span aria-hidden className="ml-1 text-primary">*</span>}
      </span>
      {children}
    </label>
  );
}
