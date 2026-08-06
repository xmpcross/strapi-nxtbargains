'use client';

import Script from 'next/script';
import { useCookieConsent } from '@/components/CookieConsentProvider';
import { hasConsent } from '@/lib/cookie-consent';

/**
 * GA4, gated on the visitor's analytics consent.
 *
 * Google's own instructions say to paste the tag into every page's <head>, but
 * this site asks for consent by category before setting anything, and analytics
 * is one of those categories. Loading gtag unconditionally would collect from
 * visitors who declined and make the banner a lie, so the script is not
 * rendered at all until consent is given — nothing is requested from
 * googletagmanager.com in the meantime.
 *
 * Withdrawing consent stops future page views from being sent, but does not
 * retroactively unload gtag from a session where it was already granted; the
 * next navigation starts clean.
 */
const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';

export default function GoogleAnalytics() {
  const { consent, ready } = useCookieConsent();

  if (!MEASUREMENT_ID || !ready || !hasConsent('analytics', consent)) return null;

  return (
    <>
      <Script
        id="ga4-src"
        src={`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}
