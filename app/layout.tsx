import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ClientErrorReporter from '@/components/ClientErrorReporter';
import { CookieConsentProvider } from '@/components/CookieConsentProvider';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import { SITE } from '@/lib/site';
import { cmsOrigin } from '@/lib/seo';
import { organizationJsonLd, websiteJsonLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';
import { clampDescription } from '@/lib/format';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — Compare Prices, Deals & Honest Reviews`,
    template: `%s · ${SITE.name}`,
  },
  description: clampDescription(SITE.description),
  other: {
    'google-adsense-account': 'ca-pub-2867376862905050',
    // Affiliate network ownership verification. Codes are per-site — never
    // copy one between domains.
    'commission-factory-verification': '5d13ca7a84ea4df99d61ce39c158c8e5',
    'mitgo-verification': '48ad5287-a158-49d1-9ce1-184d93249a75',
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    locale: 'en_US',
    url: SITE.url,
    images: [{ url: `${SITE.url}${SITE.ogImage}`, width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: {
    card: 'summary_large_image',
    site: SITE.twitterHandle,
    creator: SITE.twitterHandle,
    images: [`${SITE.url}${SITE.ogImage}`],
  },
  alternates: {
    types: {
      'application/rss+xml': [{ url: '/feed.xml', title: `${SITE.name} RSS` }],
    },
  },
};

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cms = cmsOrigin();

  return (
    <html lang="en">
      <head>
        {/*
          GA4 emitted server-side, straight into <head>.

          It lived in <GoogleAnalytics /> using next/script, but afterInteractive
          scripts are injected by the client runtime after hydration, so they are
          absent from the initial HTML — which is all Google's tag detection
          reads. That is why it reported "Your Google tag wasn't detected".

          Consent Mode keeps this honest: the defaults below deny every storage
          type before gtag loads, so no cookies or identifiers are set for a
          visitor who has not accepted. <GoogleAnalytics /> pushes a
          `consent update` when they do.
        */}
        {GA_MEASUREMENT_ID ? (
          <>
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'denied',personalization_storage:'denied',security_storage:'granted',wait_for_update:500});`,
              }}
            />
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}');`,
              }}
            />
          </>
        ) : null}
        <link rel="preconnect" href={cms} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={cms} />
        <JsonLd graph={[organizationJsonLd(), websiteJsonLd()]} />
      </head>
      <body className="min-h-screen flex flex-col font-sans font-normal" data-testid="app-shell">
        <CookieConsentProvider>
          <GoogleAnalytics />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <ClientErrorReporter />
        </CookieConsentProvider>
      </body>
    </html>
  );
}
