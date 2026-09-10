/** @type {import('next').NextConfig} */
const strapiHost = new URL(
  process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.fxnstudio.com'
).hostname;

const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  allowedDevOrigins: ['nxtbargains.fxnstudio.com', 'nxt.bargains'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: strapiHost },
      { protocol: 'https', hostname: 'nxt.bargains' },
      { protocol: 'https', hostname: 'i0.wp.com' },
      { protocol: 'https', hostname: 'i1.wp.com' },
      { protocol: 'https', hostname: 'i2.wp.com' },
      { protocol: 'https', hostname: 'images-na.ssl-images-amazon.com' },
      { protocol: 'https', hostname: 'm.media-amazon.com' },
    ],
  },
  async redirects() {
    return [
      {
        /*
         * The "Best Sellers" post category and its 34 articles were deleted
         * from the CMS. The category page kept returning 200 with 65 words and
         * index,follow — an empty page still inviting crawlers — and all 34
         * post URLs, which had been in the sitemap that morning, began 404ing
         * for anyone holding a link.
         *
         * 301 rather than 410: these were individual deal write-ups, and
         * /best-deals is the live equivalent, so the redirect lands somewhere
         * topically related instead of a dead end. Use 410 instead if the
         * intent ever becomes "this content should leave the index entirely".
         *
         * The :slug* pattern requires a segment after the prefix, so the
         * separate /best-sellers marketplace route and /best-sellers/:merchant
         * are untouched — different path, and matched by neither rule.
         */
        source: '/best-sellers-articles/:slug*',
        destination: '/best-deals',
        permanent: true,
      },
      {
        source: '/best-sellers-articles',
        destination: '/best-deals',
        permanent: true,
      },
      {
        /*
         * The Legal Notice page was replaced by the Affiliate Disclosure, which
         * carries the operator-identification section it held. It was linked
         * from the footer of every page, so it is indexed and cannot simply
         * 404.
         */
        source: '/legal/notice',
        destination: '/legal/affiliate-disclosure',
        permanent: true,
      },
      {
        /*
         * /deals was a listing page for Strapi posts in a "Deals" category
         * that never had any: it rendered "No Deals articles yet" over 50
         * words of content while sitting in the sitemap as a daily-changing
         * page. Sent to /buying-guides, which is the editorial hub the two
         * cards linking to /deals were already describing as "Buying guides".
         */
        source: '/deals',
        destination: '/buying-guides',
        permanent: true,
      },
      {
        /*
         * The catalogue listing moved to /all-products. Only the exact path is
         * redirected — /products/:slug is still a real route that middleware
         * rewrites category URLs onto, and must keep working.
         */
        source: '/products',
        destination: '/all-products',
        permanent: true,
      },
      {
        /*
         * "Video Doorbells" was renamed "Smart Doorbells" in the CMS, and Strapi
         * regenerated the slug from the name, so the old category URL now 404s.
         * The nav had carried the label "Smart Doorbells" against the
         * video-doorbells href for a while, so that path is what anything
         * external will have picked up.
         */
        source: '/category/video-doorbells',
        destination: '/category/smart-doorbells',
        permanent: true,
      },
      {
        /* Product URLs under the old category slug, for the same reason. */
        source: '/video-doorbells/:slug',
        destination: '/smart-doorbells/:slug',
        permanent: true,
      },
      {
        /*
         * Same move for the article index. As with /products, only the exact
         * path: posts themselves live at /:category/:slug, not under /posts.
         */
        source: '/posts',
        destination: '/all-posts',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/vendor/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/logos/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
