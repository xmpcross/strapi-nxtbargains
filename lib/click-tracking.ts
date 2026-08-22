import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Outbound click tracking.
 *
 * Affiliate links are rewritten to /go/<token>, where the token carries the
 * real destination and is signed. The signature is the whole point: an endpoint
 * that redirects to whatever URL it is handed is an open redirect, and ours
 * would sit on a domain with affiliate trust attached. Only URLs this build
 * produced can be redirected to.
 *
 * The destination travels inside the token rather than behind a lookup, so the
 * redirect needs no database and keeps working when Strapi is down or slow.
 * Logging is fire-and-forget for the same reason — a click is worth recording,
 * never worth making a visitor wait for.
 *
 * With no CLICK_TRACKING_SECRET set, trackedUrl returns the destination
 * untouched. An unconfigured environment loses the statistics, not the links.
 */

export type ClickMeta = {
  merchant?: string | null;
  network?: string | null;
  offerDocumentId?: string | null;
  productDocumentId?: string | null;
};

type ClickPayload = ClickMeta & { u: string };

const SECRET = process.env.CLICK_TRACKING_SECRET || '';
const SIG_LENGTH = 22;

const b64url = (buf: Buffer) => buf.toString('base64url');

function sign(payloadPart: string): string {
  return b64url(createHmac('sha256', SECRET).update(payloadPart).digest()).slice(0, SIG_LENGTH);
}

/** Only ever redirect to a real http(s) URL, signature or not. */
function isRedirectable(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function signClickToken(destination: string, meta: ClickMeta = {}): string | null {
  if (!SECRET || !isRedirectable(destination)) return null;

  const payload: ClickPayload = { u: destination };
  if (meta.merchant) payload.merchant = meta.merchant;
  if (meta.network) payload.network = meta.network;
  if (meta.offerDocumentId) payload.offerDocumentId = meta.offerDocumentId;
  if (meta.productDocumentId) payload.productDocumentId = meta.productDocumentId;

  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  return `${body}.${sign(body)}`;
}

export function verifyClickToken(token: string): ClickPayload | null {
  if (!SECRET || !token) return null;

  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const provided = token.slice(dot + 1);
  const expected = sign(body);

  // Same length before comparing: timingSafeEqual throws on a mismatch, and
  // that throw would itself leak length.
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ClickPayload;
    if (!payload?.u || !isRedirectable(payload.u)) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * The destination, rewritten to go through /go. Falls back to the destination
 * itself whenever tracking cannot apply, so a link is never lost to it.
 */
export function trackedUrl(destination: string | null | undefined, meta: ClickMeta = {}): string {
  if (!destination) return '#';
  const token = signClickToken(destination, meta);
  return token ? `/go/${token}` : destination;
}
