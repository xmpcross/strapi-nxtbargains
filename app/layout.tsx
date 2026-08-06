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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cms = cmsOrigin();

  return (
    <html lang="en">
      <head>
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
