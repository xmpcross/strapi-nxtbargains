import Link from 'next/link';
import { mediaUrl, type NxtPost } from '@/lib/strapi';
import { firstImageUrl, postPath, stripHtml } from '@/lib/format';
import { SITE } from '@/lib/site';

/**
 * Full-width "Read Next" strip that closes the page, above the footer.
 *
 * Capped at four cards by the caller. Each card carries its category links, the
 * title, a short summary and the byline — the same shape as the reference,
 * minus its sparkle badge, which marks AI-written summaries. These summaries
 * are the posts' own excerpts, so that badge would be a false claim.
 */
export default function ReadNext({ posts }: { posts: NxtPost[] }) {
  if (!posts.length) return null;

  return (
    <section className="read-next" data-testid="read-next" aria-labelledby="read-next-heading">
      <div className="read-next-inner">
        <h2 className="read-next-heading" id="read-next-heading">
          Read Next
        </h2>

        <ul className="read-next-grid" data-count={posts.length}>
          {posts.map((post) => {
            const image = mediaUrl(post.coverImage ?? null) ?? firstImageUrl(post.content);
            const href = postPath(post);
            const summary = post.excerpt?.trim() || stripHtml(post.content ?? '').slice(0, 160);
            const author = post.author?.name ?? SITE.name;

            return (
              <li key={post.id} className="read-next-card">
                <Link href={href} className="read-next-media" tabIndex={-1} aria-hidden>
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" loading="lazy" />
                  ) : null}
                </Link>

                <div className="read-next-body">
                  {post.categories?.length ? (
                    <p className="read-next-cats">
                      {post.categories.slice(0, 2).map((c, i) => (
                        <span key={c.slug}>
                          {i > 0 ? <span className="read-next-cats-sep" aria-hidden>|</span> : null}
                          <Link href={`/${c.slug}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="M3 8l9-4 9 4-9 4-9-4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <path d="M7 11v4c0 1.1 2.24 2 5 2s5-.9 5-2v-4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                            </svg>
                            {c.name}
                          </Link>
                        </span>
                      ))}
                    </p>
                  ) : null}

                  <h3 className="read-next-title">
                    <Link href={href}>{post.title}</Link>
                  </h3>

                  {summary ? <p className="read-next-excerpt">{summary}</p> : null}

                  <div className="read-next-foot">
                    <span className="read-next-author">
                      <span className="read-next-avatar" aria-hidden>
                        {author.charAt(0)}
                      </span>
                      {author}
                    </span>
                    <time dateTime={post.publishedAt}>
                      {new Intl.DateTimeFormat('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      }).format(new Date(post.publishedAt))}
                    </time>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
