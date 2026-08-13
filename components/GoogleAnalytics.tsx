'use client';

import { useEffect } from 'react';
import { useCookieConsent } from '@/components/CookieConsentProvider';

/**
 * Relays the visitor's cookie choice to GA4 as a Consent Mode update.
 *
 * The gtag loader and its denied defaults are emitted server-side in
 * app/layout.tsx, not here. They were originally in this component using
 * next/script, but `afterInteractive` scripts are injected by the client runtime
 * after hydration, so they never appeared in the initial HTML — which is all
 * Google's tag detection reads. Hence "Your Google tag wasn't detected on your
 * website" despite the tag working for real visitors.
 *
 * Consent Mode keeps the banner honest: every storage type starts denied, so
 * gtag sets no cookies and stores no identifiers until this component promotes
 * them. Until then it sends only cookieless pings.
 *
 * Category mapping:
 *   analytics    -> analytics_storage
 *   advertising  -> ad_storage, ad_user_data, ad_personalization
 *   functional   -> functionality_storage, personalization_storage
 *
 * `affiliate` is deliberately unmapped — it governs our own outbound link
 * wrapping, not anything Google stores.
 */
type ConsentState = 'granted' | 'denied';
const state = (allowed: boolean | undefined): ConsentState => (allowed ? 'granted' : 'denied');

export default function GoogleAnalytics() {
  const { consent, ready } = useCookieConsent();

  useEffect(() => {
    if (!ready) return;
    const categories = consent?.categories;
    if (!categories) return;

    /*
     * Pushed straight onto dataLayer rather than through a gtag() wrapper: gtag
     * queues on the same array, so this applies correctly even if it runs before
     * the library has finished loading.
     */
    const w = window as unknown as { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push(['consent', 'update', {
      analytics_storage: state(categories.analytics),
      ad_storage: state(categories.advertising),
      ad_user_data: state(categories.advertising),
      ad_personalization: state(categories.advertising),
      functionality_storage: state(categories.functional),
      personalization_storage: state(categories.functional),
    }]);
  }, [consent, ready]);

  return null;
}
