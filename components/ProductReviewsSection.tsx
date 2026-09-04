'use client';

import { useMemo, useState } from 'react';
import { mediaUrl, type CommerceReview } from '@/lib/strapi';
import ReviewForm from '@/components/ReviewForm';

/**
 * Customer reviews, using the layout from nxtsmarthome.com.au's product page:
 * aggregate score, star histogram and a provenance note across the top, then a
 * grid of review cards with a show-all toggle.
 *
 * Every figure is counted from the reviews actually on the page, so the bars
 * always add up to what a reader can scroll through.
 *
 * Blocks the data cannot support stay hidden rather than being invented. The
 * reference PDP's "Customers are saying" AI summary and its sentiment chips have
 * no source here, so they do not render.
 *
 * One deliberate difference from the source layout: nxtsmarthome prints a
 * "Verified purchase" badge on any review that carries a source label, but a
 * syndicated retailer review is not evidence of a purchase. Here the badge is
 * driven by the `verifiedPurchase` field and appears only where something
 * actually confirmed one; the source is shown separately as "via <retailer>".
 */

const REVIEW_CLAMP = 260;
/* One full row at the widest breakpoint, so the grid never opens half-empty. */
const INITIAL_CARDS = 3;
/* Thumbnails in the Customer Images strip before the "See more" tile. */
const IMAGE_STRIP = 7;

function Stars({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="text-base leading-none text-amber-500" aria-label={`${rating} out of 5 stars`}>
      {'★'.repeat(filled)}
      <span className="text-slate-300">{'★'.repeat(5 - filled)}</span>
    </span>
  );
}

function fmtWhen(iso?: string | null) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function ReviewCard({ review }: { review: CommerceReview }) {
  const [expanded, setExpanded] = useState(false);
  const text = review.body ?? '';
  /*
   * The clamp is CSS (line-clamp-5) rather than a character slice, so the cut
   * lands on a rendered line boundary at whatever width the card happens to be.
   * REVIEW_CLAMP now only decides whether "See more" is worth offering, since
   * the real overflow is not knowable server-side.
   */
  const isLong = text.length > REVIEW_CLAMP;
  const when = fmtWhen(review.createdAt);
  const photos = (review.images ?? []).map(mediaUrl).filter(Boolean) as string[];

  return (
    <article className="product-review-card flex flex-col p-4">
      <Stars rating={Number(review.rating) || 0} />

      {review.title ? (
        <h3 className="mt-2 line-clamp-1 text-base font-bold leading-snug text-[#1d252c]" title={review.title}>{review.title}</h3>
      ) : null}

      {/* `source` is deliberately not in this test any more — it moved to the
          provenance line below, and leaving it here rendered an empty badge
          list for any review that carried only a source. */}
      {(review.verifiedPurchase || review.incentivized || review.ownershipDuration) ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {review.verifiedPurchase ? (
            <li className="rounded-[0.25rem] border border-[#c5cbd5] px-2 py-0.5 text-[0.6875rem] text-[#55555a]">
              Verified purchase
            </li>
          ) : null}
          {review.incentivized ? (
            <li className="rounded-[0.25rem] border border-[#c5cbd5] px-2 py-0.5 text-[0.6875rem] text-[#55555a]">
              Incentivized
            </li>
          ) : null}
          {review.ownershipDuration ? (
            <li className="rounded-[0.25rem] border border-[#c5cbd5] px-2 py-0.5 text-[0.6875rem] text-[#55555a]">
              {review.ownershipDuration}
            </li>
          ) : null}
        </ul>
      ) : null}

      <p className={`mt-3 whitespace-pre-line text-sm leading-relaxed text-[#55555a] ${expanded ? '' : 'line-clamp-5'}`}>{text}</p>

      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 self-start text-sm text-[#0046be] hover:underline"
        >
          {expanded ? 'See less' : 'See more'}
        </button>
      ) : null}

      {photos.length ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {photos.slice(0, 3).map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <li key={src}><img src={src} alt="" loading="lazy" className="h-16 w-16 object-cover" /></li>
          ))}
        </ul>
      ) : null}

      {/* Provenance sits on its own line above the byline, as the reference
          does, rather than as another badge. It is plain text, not a link: the
          retailer is recorded but the URL of the individual review is not, and
          a link that guesses where it came from would be worse than none. */}
      <div className="mt-auto pt-3">
        {review.source ? (
          <p className="text-[0.6875rem] text-[#55555a]">
            This review is from <span className="font-semibold">{review.source}</span>
          </p>
        ) : null}
        {when || review.authorName ? (
          <p className="mt-1 text-[0.6875rem] text-[#55555a]">
            {when ? `Posted ${when}` : ''}
            {review.authorName ? `${when ? ' ' : ''}by ${review.authorName}` : ''}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export default function ProductReviewsSection({
  productName,
  productDocumentId,
  reviews,
  aggregateRating,
  aggregateCount,
  reviewSummary,
  reviewTopics,
}: {
  productName: string;
  productDocumentId: string;
  reviews: CommerceReview[];
  aggregateRating?: number | null;
  aggregateCount?: number | null;
  /** CMS-written précis of the reviews. Absent on every product today. */
  reviewSummary?: string | null;
  reviewTopics?: { label: string; count?: number; sentiment?: 'positive' | 'negative' }[] | null;
}) {
  const [showAll, setShowAll] = useState(false);

  // Counted from the imported reviews themselves, so the bars always add up to
  // the reviews actually shown on the page.
  const stats = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let rated = 0;
    for (const r of reviews) {
      const star = Math.round(Number(r.rating) || 0);
      if (star >= 1 && star <= 5) { counts[star] += 1; rated += 1; }
    }
    const positive = counts[4] + counts[5];
    return { counts, rated, positivePct: rated ? Math.round((positive / rated) * 100) : null };
  }, [reviews]);

  const rating = reviews.length
    ? reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length
    : Number(aggregateRating ?? 0) || null;
  const reviewCount = reviews.length || Number(aggregateCount ?? 0) || null;

  const summary = (reviewSummary ?? '').trim();
  const topics = reviewTopics ?? [];
  /* Photos attached to reviews, newest first, deduplicated. */
  const customerImages = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of reviews) {
      for (const img of r.images ?? []) {
        const url = mediaUrl(img);
        if (url && !seen.has(url)) { seen.add(url); out.push(url); }
      }
    }
    return out;
  }, [reviews]);

  const visible = showAll ? reviews : reviews.slice(0, INITIAL_CARDS);

  return (
    <section className="product-reviews-panel p-5 sm:p-6">
      <h2 className="text-2xl font-bold text-[#1d252c]">Reviews</h2>

      <div className="mt-5 grid gap-6 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
        {rating ? (
          <div>
            <div className="flex items-center gap-2">
              <span className="text-3xl leading-none text-amber-500" aria-hidden="true">★</span>
              <span className="text-[2.5rem] font-bold leading-none text-[#1d252c]">
                {rating.toFixed(1)}
              </span>
            </div>
            {reviewCount ? (
              <p className="mt-2 text-sm text-[#55555a]">
                {reviewCount.toLocaleString('en-US')} review{reviewCount === 1 ? '' : 's'}
              </p>
            ) : null}
            {stats.positivePct !== null && stats.rated > 0 ? (
              /* Deliberately not "would recommend to a friend" — that is a survey
                 question this data does not answer. This is simply the share of
                 imported reviews rated four stars or higher. */
              <p className="mt-4 flex items-start gap-2 text-sm text-[#1d252c]">
                <span className="text-emerald-600" aria-hidden="true">✓</span>
                <span>
                  <strong className="font-bold">{stats.positivePct}%</strong> rated this 4 stars or higher
                </span>
              </p>
            ) : null}
          </div>
        ) : null}

        {stats.rated > 0 ? (
          <div className="space-y-1.5 self-start">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = stats.counts[star];
              const pct = stats.rated ? (count / stats.rated) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-3 shrink-0 text-right text-[#1d252c]">{star}</span>
                  <span className="shrink-0 text-amber-500" aria-hidden="true">★</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-sm bg-[#d5d5d5]">
                    <span className="block h-full rounded-sm bg-[#0c5adb]" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-8 shrink-0 text-right text-[#55555a]">{count}</span>
                </div>
              );
            })}
          </div>
        ) : null}

        {reviews.length ? (
          <div className="sm:col-span-2 lg:col-span-1">
            {summary ? (
              <>
                <h3 className="text-base font-bold text-[#1d252c]">Customers are saying</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#1d252c]">{summary}</p>
                {topics.length ? (
                  <div className="review-topic-strip mt-3">
                    {topics.map((t) => (
                      <span key={t.label} className={`review-topic${t.sentiment === 'negative' ? ' is-negative' : ''}`}>
                        <span aria-hidden="true">{t.sentiment === 'negative' ? '!' : '✓'}</span>
                        {t.label}{typeof t.count === 'number' ? ` (${t.count})` : ''}
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="mt-3 text-[0.6875rem] leading-relaxed text-[#55555a]">
                  Summarised from the customer reviews on this page.
                </p>
              </>
            ) : null}
            <h3 className={`text-base font-bold text-[#1d252c]${summary ? ' mt-5' : ''}`}>About these reviews</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#55555a]">
              These are customer reviews syndicated from retailer product pages, shown with the
              retailer each one came from. We do not edit them, and we do not write our own reviews
              for this listing.
            </p>
            <p className="mt-3 text-[0.6875rem] leading-relaxed text-[#55555a]">
              Reviews may relate to a different variant, bundle or colour of this product. Check the
              retailer&apos;s page for the exact item before buying.
            </p>
          </div>
        ) : null}
      </div>

      {customerImages.length ? (
        <div className="review-images-divider mt-6 pt-5">
          <h3 className="text-base font-bold text-[#1d252c]">Customer images</h3>
          <div className="review-image-strip mt-3">
            {customerImages.slice(0, IMAGE_STRIP).map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" loading="lazy" className="review-image-thumb" />
            ))}
            {customerImages.length > IMAGE_STRIP ? (
              <span className="review-image-more">See more</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {reviews.length ? (
        <>
          {/* Three across, as the reference does, stepping down so a card never
              gets too narrow to read on a laptop or tablet. */}
          <div className="review-cards-divider mt-6 grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>

          {reviews.length > INITIAL_CARDS ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="rounded-[0.25rem] bg-[#0c5adb] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#0949ad]"
              >
                {showAll ? 'Show fewer reviews' : `See all ${reviews.length} customer reviews`}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-6 border-t border-[#dddddd] pt-5">
          <p className="text-sm text-[#55555a]">
            No customer reviews have been published for {productName} yet.
          </p>
        </div>
      )}

      {/*
        The "Write a review" form is hidden on request.

        Left in the tree rather than deleted: ReviewForm and its /api/review
        route still work, so restoring the section is uncommenting this block.
        `productDocumentId` is still accepted as a prop for the same reason.
      */}
      {/*
      <div className="mt-8 pt-6" id="write-a-review">
        <ReviewForm productDocumentId={productDocumentId} />
      </div>
      */}
    </section>
  );
}
