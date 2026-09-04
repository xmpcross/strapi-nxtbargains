'use client';

import { useState } from 'react';

/**
 * Renders the "Buy For Best Price" + "Set Price Alert" button pair (equal size,
 * side by side) below the product price. Clicking "Set Price Alert" expands a
 * full-width form underneath; on submit we POST to /api/price-alert which stores
 * the alert in Strapi. The daily price-refresh cron emails the visitor (via
 * Brevo) when the live price reaches their target.
 */
export default function PriceAlertForm({
  productDocumentId,
  currency = 'USD',
  currentPrice,
  buyHref,
  buyLabel,
}: {
  productDocumentId?: string;
  currency?: string;
  currentPrice?: number;
  buyHref?: string;
  /** e.g. "Buy at Garmin". Falls back to the generic wording. */
  buyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [target, setTarget] = useState(
    currentPrice ? String(Math.max(0, Math.floor(currentPrice * 0.9 * 100) / 100)) : '',
  );
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const symbol = currency === 'USD' ? '$' : '';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!productDocumentId) return;
    setState('sending');
    setMessage('');
    try {
      const res = await fetch('/api/price-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          productDocumentId,
          targetPrice: target,
          currency,
          currentPrice,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setState('done');
        setMessage(data.message || "Alert set — we'll email you when the price drops.");
      } else {
        setState('error');
        setMessage(data.message || 'Could not set the alert. Please try again.');
      }
    } catch {
      setState('error');
      setMessage('Could not set the alert. Please try again.');
    }
  }

  // Shared sizing so the two buttons are identical in width + height.
  /* h-10 rather than vertical padding: both buttons are then exactly 40px
     whatever their label wraps to, so the pair stays level. */
  const btnBase =
    'inline-flex h-10 flex-1 basis-0 min-w-[130px] items-center justify-center gap-1.5 rounded-md px-3 font-display text-[11px] font-bold uppercase tracking-wider transition';

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {productDocumentId && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={
              `${btnBase} border ` +
              (open
                ? 'border-primary text-primary'
                : 'border-ink/20 text-ink/80 hover:border-primary hover:text-primary')
            }
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            Set Price Alert
          </button>
        )}
        {buyHref && (
          <a
            href={buyHref}
            target="_blank"
            rel="noopener noreferrer sponsored"
            /* Same yellow as the price sidebar's buy button, so the two
               primary buy actions on the page look like one thing. */
            className={`${btnBase} bg-[#ffe000] text-ink hover:brightness-95`}
          >
            {buyLabel ?? 'Buy For Best Price'}
          </a>
        )}
      </div>

      {state === 'done' ? (
        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      ) : (
        open && productDocumentId && (
          <form onSubmit={submit} className="mt-3 rounded-lg border border-ink/15 bg-paper/50 p-4">
            <p className="text-sm font-medium text-ink">Get notified when the price drops</p>
            <p className="mt-1 text-xs text-ink/60">
              We&rsquo;ll email you once when this product reaches your target price.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="min-w-0 flex-1 rounded-md border border-ink/20 px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <div className="flex items-center rounded-md border border-ink/20 px-3 py-2 focus-within:border-primary">
                {symbol && <span className="text-sm text-ink/50">{symbol}</span>}
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="Target"
                  className="w-24 min-w-0 bg-transparent text-sm outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={state === 'sending'}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {state === 'sending' ? 'Saving…' : 'Notify me'}
              </button>
            </div>
            {state === 'error' && <p className="mt-2 text-xs text-red-600">{message}</p>}
          </form>
        )
      )}
    </div>
  );
}
