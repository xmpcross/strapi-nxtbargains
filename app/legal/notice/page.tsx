import type { Metadata } from 'next';
import Link from 'next/link';
import LegalArticle from '@/components/LegalArticle';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Legal Notice',
  description: `Operator, consumer, affiliate and jurisdictional disclosures for ${SITE.name}.`,
  alternates: { canonical: '/legal/notice' },
};

const MODIFIED = '2026-08-26';

export default function Page() {
  return (
    <LegalArticle pageKey="notice" title="Legal Notice" modified={MODIFIED}>
      <p>
        This notice identifies the operator of <a href="https://www.nxt.bargains">www.nxt.bargains</a>{' '}
        (<strong>Website</strong>) and provides disclosures relevant to visitors in Australia, the
        European Economic Area, the United Kingdom and the United States. It should be read with our{' '}
        <Link href="/legal/terms">Terms and Conditions</Link>,{' '}
        <Link href="/legal/privacy">Privacy Policy</Link> and{' '}
        <Link href="/legal/cookies">Cookie Policy</Link>.
      </p>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
        <strong>Operator action required:</strong> the Website&apos;s records currently do not contain a
        complete Australian Business Number or full geographic business address. FXN Holdings must
        add those verified particulars below before relying on this notice for EU or UK
        service-provider disclosure requirements.
      </div>

      <h3>1. Website operator</h3>
      <ul>
        <li><strong>Website and trading name:</strong> NXT.Bargains</li>
        <li><strong>Operator:</strong> FXN Holdings</li>
        <li><strong>Country of establishment:</strong> Australia</li>
        <li><strong>Principal jurisdiction:</strong> Western Australia, Australia</li>
        <li><strong>Australian Business Number:</strong> To be inserted after verification</li>
        <li><strong>Geographic business address:</strong> To be inserted after verification</li>
        <li><strong>General contact:</strong> <a href="mailto:hello@nxt.bargains">hello@nxt.bargains</a></li>
        <li><strong>Legal notices:</strong> <a href="mailto:legal@nxt.bargains">legal@nxt.bargains</a></li>
        <li><strong>Privacy requests:</strong> <a href="mailto:privacy@nxt.bargains">privacy@nxt.bargains</a></li>
      </ul>
      <p>
        Electronic communications may also be submitted through our <Link href="/contact">contact page</Link>.
        We aim to acknowledge formal legal or consumer notices within a reasonable period.
      </p>

      <h3>2. Nature of the service</h3>
      <p>
        NXT.Bargains is an independent product-discovery, price-comparison and editorial website. We
        publish product information, deal listings, coupons, buying guides and links to third-party
        retailers. Unless a page expressly states otherwise, FXN Holdings is not the retailer,
        manufacturer, payment processor, delivery provider or contracting seller of products shown
        on the Website.
      </p>
      <p>
        A purchase made after following a retailer link is a transaction between you and that
        retailer. The retailer&apos;s own terms, returns policy, delivery terms, warranties and privacy
        practices apply to that transaction.
      </p>

      <h3>3. Prices, deals and coupon codes</h3>
      <p>
        Prices, availability, discounts, shipping charges, taxes, eligibility requirements and
        coupon terms can change without notice. Automated feeds and third-party sources may be
        delayed, incomplete or inaccurate. Always verify the final product, seller, price and terms
        on the retailer&apos;s checkout page before purchasing.
      </p>
      <p>
        A coupon being listed does not guarantee that it remains active or applies to your account,
        location or basket. Labels such as “verified” describe the checking process and time shown;
        they are not a warranty that a retailer will accept the code in every transaction.
      </p>

      <h3>4. Affiliate and advertising disclosure</h3>
      <p>
        Some outbound links are affiliate links. FXN Holdings may receive a commission when you
        click or purchase through those links, at no additional charge to you. Commercial
        relationships do not guarantee positive coverage or a particular ranking. Sponsored
        placements, where used, will be identified clearly.
      </p>

      <h3>5. Consumer rights</h3>
      <p>
        Nothing in this notice excludes, restricts or modifies rights or remedies that cannot
        lawfully be excluded. This includes applicable rights under the Australian Consumer Law,
        mandatory consumer protections in the EEA and UK, and applicable US federal and state law.
        Your statutory rights against the retailer or other responsible supplier remain unaffected.
      </p>

      <h3>6. Regional information</h3>
      <h4>Australia</h4>
      <p>
        The Website is operated from Australia. Australian consumers may have non-excludable rights
        under the Competition and Consumer Act 2010 (Cth), including the Australian Consumer Law.
        Consumer concerns may be raised with the retailer, the relevant state or territory consumer
        agency, or the Australian Competition and Consumer Commission where appropriate.
      </p>

      <h4>European Economic Area</h4>
      <p>
        For visitors in the EEA, this page is intended to provide the service-provider information
        relevant to Article 5 of the EU e-Commerce Directive. Data-protection rights and contact
        routes are described in our <Link href="/legal/privacy">Privacy Policy</Link>. Any mandatory
        protections under the law of your habitual residence remain unaffected.
      </p>

      <h4>United Kingdom</h4>
      <p>
        For UK visitors, this page is intended to provide the supplier information relevant to the
        Electronic Commerce (EC Directive) Regulations 2002. UK GDPR and Data Protection Act rights
        are described in our <Link href="/legal/privacy">Privacy Policy</Link>. Mandatory UK consumer
        protections are not limited by this notice.
      </p>

      <h4>United States</h4>
      <p>
        Affiliate and sponsored relationships are disclosed in accordance with applicable Federal
        Trade Commission principles. Privacy choices available to residents of California and other
        states with comprehensive privacy laws are described in our{' '}
        <Link href="/legal/privacy">Privacy Policy</Link>. Nothing here waives rights that cannot be
        waived under applicable federal or state law.
      </p>

      <h3>7. Intellectual property and retailer marks</h3>
      <p>
        Unless otherwise indicated, Website content and its compilation are owned by or licensed to
        FXN Holdings. Retailer, marketplace, manufacturer and product names, logos and trade marks
        belong to their respective owners. Their appearance identifies products or destinations and
        does not imply endorsement, sponsorship or ownership by FXN Holdings.
      </p>

      <h3>8. Reporting unlawful content or rights concerns</h3>
      <p>
        To report alleged infringement, unlawful content, an inaccurate business listing or another
        rights concern, email <a href="mailto:legal@nxt.bargains">legal@nxt.bargains</a>. Include the
        affected URL, a clear description of the issue, your contact details, the basis of your
        request and any supporting evidence. We may request additional information before acting.
      </p>

      <h3>9. Governing terms and updates</h3>
      <p>
        The Website&apos;s contractual terms and governing-law provisions appear in our{' '}
        <Link href="/legal/terms">Terms and Conditions</Link>. Mandatory laws that apply because of
        your location are not displaced where they cannot lawfully be excluded. We may update this
        notice when our operator details, services or legal obligations change.
      </p>

      <h3>10. Legal review</h3>
      <p>
        This notice is a general transparency document, not legal advice. Because the Website serves
        several jurisdictions, FXN Holdings should have the completed notice reviewed by qualified
        counsel, particularly after inserting its verified ABN and geographic business address.
      </p>
    </LegalArticle>
  );
}
