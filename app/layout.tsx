import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ClientErrorReporter from '@/components/ClientErrorReporter';
import { CookieConsentProvider } from '@/components/CookieConsentProvider';
import GeniuslinkScripts from '@/components/GeniuslinkScripts';
import { SITE } from '@/lib/site';
import { cmsOrigin, siteGraphJsonLd } from '@/lib/seo';
import { clampDescription } from '@/lib/format';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — Compare Prices, Deals & Honest Reviews`,
    template: `%s · ${SITE.name}`,
  },
  description: clampDescription(SITE.description),
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteGraphJsonLd()) }}
        />
      </head>
      <body className="min-h-screen flex flex-col font-sans font-normal" data-testid="app-shell">
        <CookieConsentProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <ClientErrorReporter />
          <GeniuslinkScripts />
        </CookieConsentProvider>
      </body>
    </html>
  );
}
