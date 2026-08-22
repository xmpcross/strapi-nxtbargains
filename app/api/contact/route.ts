import { NextResponse } from 'next/server';

/**
 * Contact form delivery via Brevo's transactional email API.
 *
 * The form previously composed a `mailto:` URL and set window.location. That
 * silently does nothing on any device without a configured mail client — most
 * phones, and any desktop browser where the handler is unset — so a visitor
 * filled the form, pressed send, and the message went nowhere with no error.
 *
 * The HTTP API is used rather than SMTP on purpose: an SMTP conversation holds
 * a socket open for the length of the exchange, which is a poor fit for a route
 * handler and tends to hit the platform timeout. This is one POST that either
 * succeeds or returns a readable error.
 */

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const API_KEY = process.env.BREVO_API_KEY || '';
/* Must be a sender Brevo has verified, or the send is rejected outright. */
const FROM = process.env.CONTACT_FROM_EMAIL || 'contact@nxt.bargains';
const TO = process.env.CONTACT_TO_EMAIL || 'contact@nxt.bargains';

const MAX = { name: 120, email: 180, subject: 200, message: 5000 };

type Payload = {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
  /* Honeypot. Real users never see it, so anything here is a bot. */
  company?: string;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/*
 * Per-IP throttle. In-memory, so it resets on deploy and is per-instance —
 * enough to stop a form being hammered, not a substitute for a real limiter.
 */
const HOURLY_LIMIT = 5;
const recent = new Map<string, number[]>();

function rateLimited(ip: string) {
  const now = Date.now();
  const hourAgo = now - 3_600_000;
  const hits = (recent.get(ip) ?? []).filter((t) => t > hourAgo);
  if (hits.length >= HOURLY_LIMIT) return true;
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 5000) for (const [k, v] of recent) if (!v.some((t) => t > hourAgo)) recent.delete(k);
  return false;
}

export async function POST(request: Request) {
  if (!API_KEY) {
    console.error('[contact] BREVO_API_KEY is not set');
    return NextResponse.json({ message: 'Email is not configured. Please email us directly.' }, { status: 503 });
  }

  let payload: Payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: 'Please submit the form again.' }, { status: 400 });
  }

  // Silently accept the bots: a 200 gives them nothing to tune against.
  if (typeof payload.company === 'string' && payload.company.trim()) {
    return NextResponse.json({ ok: true });
  }

  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const name = str(payload.name, MAX.name);
  const email = str(payload.email, MAX.email).toLowerCase();
  const subject = str(payload.subject, MAX.subject);
  const message = str(payload.message, MAX.message);

  if (!name || !email || !message) {
    return NextResponse.json({ message: 'Please fill in your name, email and message.' }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ message: 'That email address does not look right.' }, { status: 400 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json({ message: 'Too many messages. Please try again later.' }, { status: 429 });
  }

  const heading = subject || `Contact from ${name}`;
  const html = `
    <h2>${escapeHtml(heading)}</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}<br>
       <strong>Email:</strong> ${escapeHtml(email)}</p>
    <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
    <hr>
    <p style="color:#777;font-size:12px">Sent from the nxt.bargains contact form.</p>`;

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: { 'api-key': API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: FROM, name: 'NXT.Bargains' },
        to: [{ email: TO }],
        /*
         * replyTo carries the visitor, not sender: Brevo will only send from a
         * verified address, so putting the visitor in `sender` would be
         * rejected. This way a reply in the inbox goes back to them.
         */
        replyTo: { email, name },
        subject: heading,
        htmlContent: html,
        textContent: `${heading}\n\nName: ${name}\nEmail: ${email}\n\n${message}`,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`[contact] brevo HTTP ${res.status}: ${detail.slice(0, 300)}`);
      return NextResponse.json({ message: 'We could not send that. Please try again shortly.' }, { status: 502 });
    }
  } catch (e) {
    console.error(`[contact] brevo request failed: ${(e as Error).message}`);
    return NextResponse.json({ message: 'We could not send that. Please try again shortly.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
