import Link from 'next/link';
import { mediaUrl, type NxtPost } from '@/lib/strapi';
import { firstImageUrl, postPath, stripHtml } from '@/lib/format';

/**
 * "Related Posts" card closing out a post body.
 *
 * The reference design shows a "100% match" score beside each date. That number
 * comes from an AI similarity model on the source site; there is nothing behind
 * it here, and inventing one would be presenting a fabricated figure as data.
 * The slot instead carries the post's category, which is real and fills the
 * same role — telling the reader why this item is being suggested.
 */
export default function RelatedPosts({ posts }: { posts: NxtPost[] }) {
  if (!posts.length) return null;

  return (
    <section className="related-posts" data-testid="related-posts-card" aria-labelledby="related-posts-heading">
      <h2 className="related-posts-heading" id="related-posts-heading">
        Related Posts
      </h2>

      <ul className="related-posts-list">
        {posts.map((post) => {
          const image = mediaUrl(post.coverImage ?? null) ?? firstImageUrl(post.content);
          const href = postPath(post);
          const category = post.categories?.[0];
          const summary = post.excerpt?.trim() || stripHtml(post.content ?? '').slice(0, 180);

          return (
            <li key={post.id} className="related-posts-item">
              <Link href={href} className="related-posts-thumb" tabIndex={-1} aria-hidden>
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" loading="lazy" />
                ) : null}
              </Link>

              <div className="related-posts-text">
                <Link href={href} className="related-posts-title">
                  {post.title}
                </Link>

                {summary ? <p className="related-posts-excerpt">{summary}</p> : null}

                <p className="related-posts-meta">
                  {category ? (
                    <>
                      <Link href={`/${category.slug}`} className="related-posts-tag">
                        {category.name}
                      </Link>
                      <span className="related-posts-dot" aria-hidden />
                    </>
                  ) : null}
                  <time dateTime={post.publishedAt}>
                    {new Intl.DateTimeFormat('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    }).format(new Date(post.publishedAt))}
                  </time>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
