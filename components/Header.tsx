import Link from 'next/link';
import Image from 'next/image';
import { BLOG_NAV_LINKS, SITE } from '@/lib/site';
import { listCategories, listPosts, mediaUrl } from '@/lib/strapi';
import { postPath, fmtDate } from '@/lib/format';
import SearchDialog from './SearchDialog';
import MobileNav from './MobileNav';
import StickyHeaderShadow from './StickyHeaderShadow';

export type NavChild = {
  href?: string;
  label: string;
  children?: Array<{ href: string; label: string }>;
};

export type NavItem = {
  href: string;
  label: string;
  children?: NavChild[];
};

function buildNav(blogCategories: Array<{ slug: string; name: string }>): NavItem[] {
  const blogLinks = blogCategories.length > 0
    ? blogCategories.map((category) => ({ href: `/${category.slug}`, label: category.name }))
    : BLOG_NAV_LINKS;

  return [
  {
    href: '/all-products',
    label: 'All Products',
    children: [
      { href: '/category/smart-phones', label: 'Smart Phones' },
      { href: '/category/smartwatches', label: 'Smartwatches' },
      { href: '/category/tablets', label: 'Tablets' },
      { href: '/category/laptops', label: 'Laptops' },
      { href: '/category/smart-tvs', label: 'Smart TVs' },
      { href: '/category/smart-cameras', label: 'Smart Cameras' },
      { href: '/category/smart-speakers', label: 'Smart Speakers' },
      {
        label: 'Smart Home',
        children: [
          { href: '/category/smart-light-bulbs', label: 'Smart Light Bulbs' },
          { href: '/category/smart-door-locks', label: 'Smart Door Locks' },
          { href: '/category/smart-plugs', label: 'Smart Plugs' },
          { href: '/category/video-doorbells', label: 'Smart Doorbells' },
        ],
      },
      { href: '/category/headphones', label: 'Headphones' },
      { href: '/category/raspberry-pi', label: 'Raspberry PI' },
    ],
  },
  { href: '/best-deals', label: 'Best Deals' },
  {
    href: '/coupons',
    label: 'Coupons',
    children: [
      { href: '/coupons/popular-brands', label: 'Popular Brands' },
      { href: '/stores', label: 'Stores' },
      { href: '/brands', label: 'Brands' },
    ],
  },
  { href: '/price-drops', label: 'Price Drops' },
  {
    href: '/posts',
    label: 'All Articles',
    children: [
      ...blogLinks,
    ],
  },
  ];
}

const navTestId = (label: string) => `nav-${label.toLowerCase().replace(/\s+/g, '-')}`;

export default async function Header() {
  /*
   * Both fetches feed the search dialog as well as the nav, so opening the
   * dialog costs no extra request. They are independent, so they run together.
   */
  const [blogCategories, recentPosts] = await Promise.all([
    listCategories().catch(() => []),
    listPosts({ page: 1, pageSize: 3 }).then((r) => r.data).catch(() => []),
  ]);
  const nav = buildNav(blogCategories);

  const searchChips = blogCategories
    .filter((category) => category.slug && category.name)
    .slice(0, 9)
    .map((category) => ({ label: category.name, slug: category.slug }));

  const searchSuggestions = recentPosts.map((post) => ({
    title: post.title,
    href: postPath(post),
    image: mediaUrl(post.coverImage ?? null),
    date: post.publishedAt ? fmtDate(post.publishedAt) : null,
  }));

  return (
    <header
      className="sticky top-0 z-50 border-b border-ink/10 bg-white/85 backdrop-blur transition-shadow"
      data-testid="site-header"
    >
      <StickyHeaderShadow />
      <div className="mx-auto flex h-[70px] max-w-[1366px] items-center justify-between gap-4 px-4 sm:h-[70px] sm:px-6">
        {/* Logo */}
        <Link
          href="/"
          className="block shrink-0"
          data-testid="logo-link"
          aria-label={`${SITE.name} home`}
        >
          <Image
            src="/nxt_bargains_logo.png"
            alt={SITE.name}
            width={450}
            height={218}
            priority
            className="h-10 w-auto"
          />
        </Link>

        {/* Desktop nav — center */}
        <nav
          className="hidden flex-1 justify-end md:flex"
          aria-label="Primary"
          data-testid="primary-nav"
        >
          <ul className="flex items-center gap-1">
            {nav.map((item) => (
              <li key={`${item.label}-${item.href}`} className="group relative">
                <Link
                  href={item.href}
                  className="top-nav-link inline-flex items-center px-3 py-2 font-['Outfit'] text-[#111111] transition hover:text-[#111111]"
                  data-testid={navTestId(item.label)}
                >
                  {item.label}
                  {item.children && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="ml-1.5 h-3.5 w-3.5 text-ink/45"
                      aria-hidden
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  )}
                </Link>
                {item.children && (
                  <div className="invisible absolute left-0 top-full z-50 min-w-[260px] translate-y-2 pt-2 opacity-0 transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                    <div className="rounded-xl border border-ink/10 bg-white p-2 shadow-xl shadow-ink/10">
                      {item.children.map((child) =>
                        child.children?.length ? (
                          <div key={child.label} className="group/nested relative">
                            <span className="top-nav-dropdown-link flex items-center justify-between px-3 py-2 font-['Outfit'] text-sm font-semibold text-ink/85">
                              {child.label}
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="ml-2 h-3.5 w-3.5 text-ink/45"
                                aria-hidden
                              >
                                <path d="m9 6 6 6-6 6" />
                              </svg>
                            </span>
                            <div className="invisible absolute left-full top-0 z-50 min-w-[220px] -translate-x-1 pl-2 opacity-0 transition duration-150 group-hover/nested:visible group-hover/nested:translate-x-0 group-hover/nested:opacity-100 group-focus-within/nested:visible group-focus-within/nested:translate-x-0 group-focus-within/nested:opacity-100">
                              <div className="rounded-xl border border-ink/10 bg-white p-2 shadow-xl shadow-ink/10">
                                {child.children.map((nested) => (
                                  <Link
                                    key={nested.href}
                                    href={nested.href}
                                    className="top-nav-dropdown-link block px-3 py-2 font-['Outfit'] text-sm text-ink/75 transition hover:text-primary"
                                  >
                                    {nested.label}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <Link
                            key={child.href}
                            href={child.href!}
                            className="top-nav-dropdown-link block px-3 py-2 font-['Outfit'] text-sm text-ink/75 transition hover:text-primary"
                          >
                            {child.label}
                          </Link>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Desktop right side: search */}
        <div className="hidden items-center gap-2 md:flex">
          <SearchDialog
            chips={searchChips}
            suggestions={searchSuggestions}
            label={`Search ${SITE.name}`}
          />
        </div>

        {/* Mobile: hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <MobileNav items={nav} />
        </div>
      </div>
    </header>
  );
}
