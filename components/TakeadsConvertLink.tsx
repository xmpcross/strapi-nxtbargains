'use client';

import Script from 'next/script';

/**
 * Takeads ConvertLink — affiliate conversion for merchants Geniuslink does not
 * cover.
 *
 * The two run together deliberately. Geniuslink's snippet only rewrites links
 * for the merchants in its own network (Amazon and Apple are the bulk of it),
 * and leaves everything else exactly as it found it. That "everything else" is
 * most of this catalogue — Newegg, B&H, Lenovo, Dell and the long tail of
 * retailers that turn up in the deals feeds — so without a second converter
 * those clicks go out unmonetised.
 *
 * Order matters, and it is set by mount order in the layout: Geniuslink is
 * mounted first and claims the links it recognises, ConvertLink runs after and
 * takes what is left. Each script only touches hosts in its own merchant list,
 * so neither rewrites the other's output — the failure mode to watch for is a
 * geni.us or tatrck.com URL being converted twice, which breaks attribution
 * rather than the link.
 *
 * Loaded lazily (afterInteractive) for the same reason as the Geniuslink
 * snippet: neither is needed to render the page, and both are third-party
 * scripts that should not sit in front of first paint.
 */
export default function TakeadsConvertLink() {
  const src = process.env.NEXT_PUBLIC_TAKEADS_CONVERTLINK_URL;

  // No key configured is a valid state — the site simply runs Geniuslink alone,
  // which is what it did before this existed.
  if (!src) return null;

  return <Script src={src} strategy="afterInteractive" />;
}
