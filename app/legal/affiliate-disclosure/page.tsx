import type { Metadata } from 'next';
import Link from 'next/link';
import LegalArticle from '@/components/LegalArticle';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Affiliate Disclosure',
  description: `How ${SITE.name} earns from the links on this site, which programs we belong to, and how our prices are gathered.`,
  alternates: { canonical: '/legal/affiliate-disclosure' },
};

const MODIFIED = '2026-09-10';

export default function Page() {
  return (
    <LegalArticle pageKey="affiliate-disclosure" title="Affiliate Disclosure" modified={MODIFIED}>
      <p>
        <strong>{SITE.name} is an affiliate site.</strong> When you follow a link from this site to a
        retailer and make a purchase, we may earn a commission. You pay the same price either way —
        the commission comes out of the retailer&apos;s margin, not your total.
      </p>
      <p>
        This page explains exactly how that works, which programs we participate in, and where the
        prices you see come from. It is published in line with the U.S. Federal Trade Commission&apos;s
        <em> Guides Concerning the Use of Endorsements and Testimonials in Advertising</em> (16 CFR
        Part 255) and the Australian Competition and Consumer Commission&apos;s guidance on disclosure.
        It should be read alongside our <Link href="/legal/terms">Terms and Conditions</Link>,{' '}
        <Link href="/legal/privacy">Privacy Policy</Link> and{' '}
        <Link href="/legal/cookies">Cookie Policy</Link>.
      </p>

      <h3>1. Website operator</h3>
      <p>
        This website is operated by FXN Holdings. Enquiries can be sent through our{' '}
        <Link href="/contact">contact page</Link>.
      </p>
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
        <strong>Operator action required:</strong> our records do not yet contain a complete
        Australian Business Number or full geographic business address. FXN Holdings must add those
        verified particulars here before this page can be relied on for EU or UK service-provider
        identification requirements.
      </div>

      <h3>2. How we earn</h3>
      <p>
        Most outbound links to retailers on this site are affiliate links. That includes the
        &ldquo;Buy&rdquo; and price buttons on product pages, the retailer names in our price
        comparison tables, links inside our deal and coupon listings, and some links inside
        editorial articles.
      </p>
      <p>
        We are paid on a per-sale or per-action basis. We are <strong>not</strong> paid to write a
        positive review, and no retailer or manufacturer is given approval over our editorial
        content before it is published.
      </p>

      <h3>3. Programs we participate in</h3>
      <ul>
        <li>
          <strong>Amazon Associates.</strong> As an Amazon Associate we earn from qualifying
          purchases. This applies to Amazon.com and its international storefronts.
        </li>
        <li>
          <strong>eBay Partner Network.</strong> Links to eBay listings, including eBay UK, eBay
          Australia and eBay Germany, carry our partner tracking.
        </li>
        <li>
          <strong>Impact.</strong> Used for direct advertiser relationships, including Walmart.
        </li>
        <li>
          <strong>Geniuslink.</strong> A link-management service that routes a click to the correct
          regional storefront for the visitor&apos;s country and applies the relevant affiliate
          tracking. It is how a single link can send a UK reader to a UK retailer.
        </li>
        <li>
          <strong>Takeads.</strong> Provides affiliate coverage for retailers not served by the
          programs above.
        </li>
      </ul>

      <h3>4. What commission does and does not affect</h3>
      <p>
        Commission rates differ between retailers and between product categories. To keep that from
        influencing what you see, our price comparison tables are ordered by <strong>price</strong>,
        not by what we earn. A retailer paying a higher rate does not get a higher position, and no
        retailer can pay to be added to a product page.
      </p>
      <p>
        Products are selected for the catalogue on the basis of category coverage and availability
        across multiple merchants. A product carried by only one retailer has no price comparison to
        offer, and we do not present it as though it does.
      </p>

      <h3>5. Where prices come from</h3>
      <p>
        Prices, availability and discount figures on this site are gathered automatically from
        retailers and third-party pricing data providers, and are refreshed on a schedule rather
        than at the moment you load the page. We also store historical price snapshots so you can
        see how a price has moved.
      </p>
      <p>
        <strong>Prices change constantly.</strong> The figure shown here may differ from the figure
        at the retailer by the time you arrive, and we cannot guarantee that any price, discount or
        coupon shown is still current. Always confirm the final price at the retailer&apos;s own
        checkout before you buy. We are not the seller: your purchase contract, payment, delivery,
        warranty and returns are all with the retailer.
      </p>

      <h3>6. Advertising</h3>
      <p>
        In addition to affiliate links, this site may display third-party advertising. Advertising
        is kept visually distinct from editorial content and from our price comparison data.
        Information about the cookies used for advertising and how to control them is in our{' '}
        <Link href="/legal/cookies">Cookie Policy</Link>.
      </p>

      <h3>7. How disclosure appears on the site</h3>
      <p>
        Alongside this page, an affiliate disclosure is shown directly on pages carrying affiliate
        links, so you are told before you click rather than having to seek this page out. Outbound
        affiliate links are marked with the <code>rel=&quot;sponsored&quot;</code> attribute, which is
        the mechanism search engines use to identify paid links.
      </p>

      <h3>8. Questions</h3>
      <p>
        If anything on this page is unclear, or you believe a link or price is not properly
        disclosed, please tell us through the <Link href="/contact">contact page</Link> and we will
        correct it.
      </p>
    </LegalArticle>
  );
}
