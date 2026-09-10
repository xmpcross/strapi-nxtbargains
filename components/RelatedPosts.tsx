import Link from 'next/link';
import AutoCarousel from '@/components/AutoCarousel';
import { mediaUrl, type NxtPost } from '@/lib/strapi';
import { firstImageUrl, postPath, stripHtml } from '@/lib/format';

/**
 * Full-width "Related Posts" strip that closes the page, above the footer.
 *
 * Previously a narrow two-item card sitting inside the post body, immediately
 * above the Next Up chips — three suggestion blocks stacked within one screen
 * of each other, all drawn from the same pool. It now runs once, at the end,
 * with room for eight.
 *
 * Four per view rather than a wrapping grid: eight cards in a static 4x2 grid
 * is a wall at the point where the reader has just finished the article. The
 * carousel shows a complete row, and advances a whole row at a time so a page
 * of four is replaced by the next four rather than shuffling by one.
 *
 * AutoCarousel handles the motion, and its rules matter here: it pauses on
 * hover and on keyboard focus, stops when the tab is hidden, and does not
 * auto-advance at all for visitors who ask for reduced motion. Without those
 * it would slide out from under someone mid-click.
 */
export default function RelatedPosts({ posts }: { posts: NxtPost[] }) {
  if (!posts.length) return null;

  // Eight is the cap: two full rows of four. More than that and the strip
  // becomes a browse page rather than a closing suggestion.
  const items = posts.slice(0, 8);

  return (
    <section className="related-strip" data-testid="related-posts-card" aria-labelledby="related-posts-heading">
      <div className="related-strip-inner">
        <h2 className="related-strip-heading" id="related-posts-heading">
          Related Posts
        </h2>

        <AutoCarousel label="Related posts" intervalMs={6000}>
          {items.map((post) => {
            const image = mediaUrl(post.coverImage ?? null) ?? firstImageUrl(post.content);
            const href = postPath(post);
            const summary = post.excerpt?.trim() || stripHtml(post.content ?? '').slice(0, 130);

            return (
              /* The slide width is what decides how many fit a view; the track
                 uses an 18px gap, so four columns are (100% - 3 gaps) / 4.
                 Stepping down on narrower screens keeps a card from becoming
                 too cramped to read rather than holding four at any width. */
              <div
                key={post.id}
                className="w-[78%] shrink-0 snap-start sm:w-[46%] lg:w-[31%] xl:w-[calc((100%-3*18px)/4)]"
              >
                <article className="related-strip-card">
                  <Link href={href} className="related-strip-media" tabIndex={-1} aria-hidden="true">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" loading="lazy" />
                    ) : null}
                  </Link>

                  <div className="related-strip-body">
                    {post.categories?.length ? (
                      <p className="related-strip-cat">
                        <Link href={`/${post.categories[0].slug}`}>{post.categories[0].name}</Link>
                      </p>
                    ) : null}

                    <h3 className="related-strip-title">
                      <Link href={href}>{post.title}</Link>
                    </h3>

                    {summary ? <p className="related-strip-excerpt">{summary}</p> : null}
                  </div>
                </article>
              </div>
            );
          })}
        </AutoCarousel>
      </div>
    </section>
  );
}
