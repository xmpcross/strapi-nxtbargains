import CopyLinkButton from '@/components/CopyLinkButton';

/**
 * Byline and share row that closes a post's top section.
 *
 * Shared by both header shapes: the two-column editorial header, and the
 * Best Sellers product card. They differ entirely above this row and are
 * identical at it, so it lives here rather than being written twice.
 */
export default function PostInfobar({
  authorName,
  publishedAt,
  commentCount,
  shareUrl,
  shareTitle,
}: {
  authorName: string;
  publishedAt: string;
  commentCount: number;
  shareUrl: string;
  shareTitle: string;
}) {
  return (
    <div className="recap-infobar">
      <div className="recap-header-meta">
        <span className="recap-author">
          <span className="recap-avatar" aria-hidden>
            {authorName.charAt(0)}
          </span>
          <span className="recap-author-name">{authorName}</span>
        </span>
        <span className="recap-meta-line">
          <a className="recap-comments" href="#post-comments">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M21 12a8 8 0 0 1-8 8H7l-4 3v-5.5A8 8 0 1 1 21 12z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
            {commentCount}
          </a>
          <time dateTime={publishedAt}>
            {new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(
              new Date(publishedAt),
            )}
          </time>
        </span>
      </div>

      <div className="recap-share">
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
    </div>
  );
}
