import Link from 'next/link';
import { mediaUrl, type NxtPost } from '@/lib/strapi';
import { firstImageUrl, postPath } from '@/lib/format';

export type ReadAlsoItem = { post: NxtPost; commentCount: number };

/**
 * Inline "Read Also" card, dropped into the middle of a post body.
 *
 * Presentational only — the caller picks the posts and supplies the comment
 * counts, so this can be rendered from a server component without any fetching
 * of its own.
 */
export default function ReadAlso({ items }: { items: ReadAlsoItem[] }) {
  if (!items.length) return null;

  return (
    <aside className="read-also" data-testid="read-also" aria-label="Read also">
      <h2 className="read-also-heading">Read Also</h2>

      <ul className="read-also-list">
        {items.map(({ post, commentCount }) => {
          const image = mediaUrl(post.coverImage ?? null) ?? firstImageUrl(post.content);
          const href = postPath(post);

          return (
            <li key={post.id} className="read-also-item">
              <Link href={href} className="read-also-thumb" tabIndex={-1} aria-hidden>
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" loading="lazy" />
                ) : null}
              </Link>

              <div className="read-also-text">
                <Link href={href} className="read-also-title">
                  {post.title}
                </Link>
                <p className="read-also-meta">
                  <time dateTime={post.publishedAt}>
                    {new Intl.DateTimeFormat('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    }).format(new Date(post.publishedAt))}
                  </time>
                  <span className="read-also-dot" aria-hidden />
                  <span className="read-also-comments">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M21 12a8 8 0 0 1-8 8H7l-4 3v-5.5A8 8 0 1 1 21 12z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {commentCount}
                  </span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
