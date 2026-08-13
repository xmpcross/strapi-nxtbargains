'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { useCookieConsent } from '@/components/CookieConsentProvider';

/**
 * GA4 using Google Consent Mode v2.
 *
 * The earlier version rendered nothing at all until analytics consent was
 * given. That kept the banner honest, but it also meant Google's tag detection
 * — and Tag Assistant, and the GA4 setup wizard — loaded the page, never
 * clicked Accept, saw no gtag, and reported "Your Google tag wasn't detected on
 * your website."
 *
 * Consent Mode is Google's own answer to that. The tag loads for every visitor,
 * but the first thing it does is declare every storage type DENIED, before the
 * config call. In that state gtag sets no cookies and stores no identifiers; it
 * sends only cookieless pings. When the visitor accepts, `consent update`
 * promotes the relevant types and normal measurement begins.
 *
 * So the banner stays truthful — nothing is stored until consent — while the
 * tag is present in the page where Google can find it.
 *
 * Mapping to this site's categories:
 *   analytics    -> analytics_storage
 *   advertising  -> ad_storage, ad_user_data, ad_personalization
 *   functional   -> functionality_storage, personalization_storage
 * `affiliate` is deliberately not mapped: it governs our own outbound link
 * wrapping, not anything Google stores.
 */
const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';

type ConsentState = 'granted' | 'denied';
const state = (allowed: boolean | undefined): ConsentState => (allowed ? 'granted' : 'denied');

export default function GoogleAnalytics() {
  const { consent, ready } = useCookieConsent();

  /*
   * Push a consent update whenever the visitor's choice changes. gtag queues
   * calls on dataLayer, so this is safe even if it runs before the script has
   * finished loading — the queued update is applied on init.
   */
  useEffect(() => {
    if (!MEASUREMENT_ID || !ready) return;
    const categories = consent?.categories;
    if (!categories) return;

    const w = window as unknown as { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    // Push the raw arguments object shape gtag expects, without redeclaring gtag.
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(['consent', 'update', {
      analytics_storage: state(categories.analytics),
      ad_storage: state(categories.advertising),
      ad_user_data: state(categories.advertising),
      ad_personalization: state(categories.advertising),
      functionality_storage: state(categories.functional),
      personalization_storage: state(categories.functional),
    }]);
  }, [consent, ready]);

  if (!MEASUREMENT_ID) return null;

  return (
    <>
      {/*
        Runs before the gtag library so the denied defaults are in place from the
        very first call. Order matters: a config call ahead of the defaults would
        set cookies for a visitor who has not consented.
      */}
      <Script id="ga4-consent-default" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('consent', 'default', {
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'denied',
            functionality_storage: 'denied',
            personalization_storage: 'denied',
            security_storage: 'granted',
            wait_for_update: 500
          });
        `}
      </Script>

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
