import Link from 'next/link';

/**
 * Best Buy promotional card for the right-hand rail.
 *
 * Replaces the "Follow the Price Trail" card, which pointed at /category — an
 * internal index that earns nothing and that a reader already deep in a product
 * page has no reason to visit. This sends them to a retailer instead.
 *
 * The destination is a Takeads link (tatrck.com). That host is listed in
 * ALREADY_AFFILIATED in lib/takeads-links.ts, so nothing downstream will try to
 * re-wrap it and break the attribution — and it is deliberately not passed
 * through /go/[token] either, because that route resolves through Geniuslink,
 * which would hand the click to a second network.
 *
 * Colour comes from the site tokens rather than the purple gradient it
 * replaces: --colorBgPrimaryHighlight is #0046be, which is Best Buy's own blue,
 * and the yellow accent is the same #ffe000 the pillar palette uses. A card
 * advertising a retailer should look like that retailer, and here that happens
 * to also be the house palette.
 */
export default function BestBuyPromoCard({
  href = 'https://tatrck.com/h/0Hu30_OZ0PNF?model=cpa',
}: {
  href?: string;
}) {
  return (
    <aside className="bbcard" data-testid="sidebar-bestbuy-promo">
      <p className="bbcard-badge">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 6h18l-1.6 9.2a2 2 0 0 1-2 1.8H6.6a2 2 0 0 1-2-1.8L3 6Zm0 0-.6-3H1"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="20" r="1.4" fill="currentColor" />
          <circle cx="17" cy="20" r="1.4" fill="currentColor" />
        </svg>
        Best Buy Deals
      </p>

      <div className="bbcard-body">
        <h2 className="bbcard-title">Today&rsquo;s Best Buy offers</h2>
        <p className="bbcard-text">
          Open-box discounts, weekly doorbusters and member pricing — checked against the
          same catalogue you&rsquo;re browsing here.
        </p>
        <Link
          href={href}
          className="bbcard-cta"
          target="_blank"
          rel="sponsored noopener noreferrer"
        >
          Shop Best Buy
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h13m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <p className="bbcard-disclosure">Affiliate link — we may earn a commission.</p>
      </div>
    </aside>
  );
}
