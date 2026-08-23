import Link from 'next/link';
import { mediaUrl, type NxtPost } from '@/lib/strapi';
import { firstImageUrl, postPath } from '@/lib/format';
import CopyLinkButton from '@/components/CopyLinkButton';

/**
 * Post footer: "Next Up" chips, a meta row, share controls, and previous/next
 * navigation.
 *
 * Two things in the reference are deliberately not reproduced. The view counter
 * ("3.0K") has no source here — nothing on this site records post views, and a
 * made-up number presented as a statistic is worse than no number. The
 * "AI-generated" badge would likewise be a false claim about how these chips
 * are chosen; they are simply the most recent posts from other categories.
 */
export default function PostFooterNav({
  nextUp,
  category,
  categoryName,
  commentCount,
  updatedAt,
  shareUrl,
  shareTitle,
  prev,
  next,
}: {
  nextUp: NxtPost[];
  category: string;
  categoryName: string;
  commentCount: number;
  updatedAt?: string;
  shareUrl: string;
  shareTitle: string;
  prev?: NxtPost | null;
  next?: NxtPost | null;
}) {
  return (
    <section className="post-footer-nav" data-testid="post-footer-nav">
      {nextUp.length > 0 ? (
        <div className="nextup">
          <h2 className="nextup-heading">Next Up</h2>
          <ul className="nextup-list">
            {nextUp.map((post) => {
              const image = mediaUrl(post.coverImage ?? null) ?? firstImageUrl(post.content);
              return (
                <li key={post.id}>
                  <Link href={postPath(post)} className="nextup-chip">
                    <span className="nextup-thumb">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt="" loading="lazy" />
                      ) : null}
                    </span>
                    <span className="nextup-title">{post.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="post-footer-meta">
        <p className="post-footer-cat">
          <Link href={`/${category}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 8l9-4 9 4-9 4-9-4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="M7 11v4c0 1.1 2.24 2 5 2s5-.9 5-2v-4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            {categoryName}
          </Link>
        </p>

        <div className="post-footer-stats">
          <a className="post-footer-comments" href="#post-comments">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-5.5A8 8 0 1 1 21 12z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            {commentCount}
          </a>
          {updatedAt ? (
            <span className="post-footer-updated">
              Updated on{' '}
              <time dateTime={updatedAt}>
                {new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(
                  new Date(updatedAt),
                )}
              </time>
            </span>
          ) : null}
        </div>
      </div>

      <div className="post-footer-share recap-share">
        <span className="recap-share-label">Share</span>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on Facebook"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z" />
          </svg>
        </a>
        <a
          href={`https://x.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on X"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.53 3H20.5l-6.49 7.42L21.64 21h-5.97l-4.68-6.11L5.6 21H2.63l6.94-7.93L2.36 3h6.12l4.23 5.59L17.53 3z" />
          </svg>
        </a>
        <CopyLinkButton url={shareUrl} />
      </div>

      {prev || next ? (
        <div className="post-prevnext">
          <div className="post-prevnext-side">
            {prev ? (
              <>
                <Link href={postPath(prev)} className="post-prevnext-thumb" tabIndex={-1} aria-hidden>
                  {mediaUrl(prev.coverImage ?? null) ?? firstImageUrl(prev.content) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={(mediaUrl(prev.coverImage ?? null) ?? firstImageUrl(prev.content)) as string} alt="" loading="lazy" />
                  ) : null}
                </Link>
                <Link href={postPath(prev)} className="post-prevnext-title">{prev.title}</Link>
                <Link href={postPath(prev)} className="post-prevnext-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Prev
                </Link>
              </>
            ) : null}
          </div>

          <div className="post-prevnext-side">
            {next ? (
              <>
                <Link href={postPath(next)} className="post-prevnext-thumb" tabIndex={-1} aria-hidden>
                  {mediaUrl(next.coverImage ?? null) ?? firstImageUrl(next.content) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={(mediaUrl(next.coverImage ?? null) ?? firstImageUrl(next.content)) as string} alt="" loading="lazy" />
                  ) : null}
                </Link>
                <Link href={postPath(next)} className="post-prevnext-title">{next.title}</Link>
                <Link href={postPath(next)} className="post-prevnext-btn">
                  Next
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
