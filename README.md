# NXT.Bargains — Frontend

**NXT.Bargains** is a product-comparison, deals, and coupons site for consumer
electronics. It compares one product across major marketplaces, tracks price
history, surfaces the best deals and coupon codes, and publishes editorial
buying guides — with every outbound link monetized through affiliate programs.

This repo is the **Next.js frontend**. Content comes from a **Strapi** headless
CMS; coupons, deals, and product offers come from a layer of **affiliate feeds
and APIs** cached to disk and (increasingly) to Strapi.

---

## 1. Tech stack

| Layer | Tech |
|---|---|
| Framework | **Next.js 15** (App Router, React Server Components) |
| UI | **React 19**, **Tailwind CSS 3** + `@tailwindcss/typography` |
| Language | **TypeScript** |
| CMS | **Strapi 5** (headless) at `cms.fxnstudio.com` |
| Fonts | Self-hosted **Outfit** (body) + **Urbanist** (display) |
| Misc | `date-fns`, `qs`, `lottie-web` |
| Hosting | Native `next start` via **systemd** behind **nginx** (prod); **Netlify**-ready |

Design tokens (the "Best Buy"-style palette — primary `#0046be`, dark `#1d252c`,
yellow accents) live in `app/globals.css` and `tailwind.config.ts`.

---

## 2. How the site is put together

```
                 ┌────────────────────────┐
   Editors  ───► │  Strapi CMS            │  posts, categories, products,
                 │  cms.fxnstudio.com     │  offers, merchants, reviews,
                 └───────────┬────────────┘  comments, nxt-coupons
                             │ REST (+ API token)
                             ▼
 Affiliate     ┌────────────────────────────────────┐
 feeds/APIs ─► │  Next.js frontend (this repo)       │ ─► HTML / SSR / ISR
 (data/*.json) │  app/ · components/ · lib/          │
               └───────────┬────────────────────────┘
                           │ outbound clicks
                           ▼
              Impact / Takeads / CJ affiliate links ─► merchants
```

- **Strapi** is the source of truth for editorial content (blog posts,
  categories) and the commerce catalog (products, offers, merchants, reviews).
- **Affiliate feeds** (CouponAPI.org, Impact, RapidAPI, etc.) are pulled by the
  `scripts/` and written to `data/*.json`, which `lib/` reads at request time.
- **Every outbound link is affiliate-monetized where possible** — either the
  feed already provides a tracked link, or Takeads has a conversion for it.
  Anything neither covers goes out unmonetized rather than broken.

---

## 3. Strapi CMS

Public base: `https://cms.fxnstudio.com` (`NEXT_PUBLIC_STRAPI_URL`).
Internal base (same box only): `STRAPI_INTERNAL_URL` (e.g. `127.0.0.1:8888`).
Access via `STRAPI_API_TOKEN` (read) / `STRAPI_WRITE_TOKEN` (write). Wrapper:
`lib/strapi.ts`.

Collections consumed:

| Collection | Used for |
|---|---|
| `nxt-posts` | Blog articles (comparisons, reviews, roundups, how-to, guides) |
| `nxt-categories` | Article categories |
| `commerce-products` | Product catalog (`/products`, category pages) — tagged `nxt-bargains` |
| `commerce-categories` | Product categories |
| `commerce-offers` | Per-merchant offers/prices on a product |
| `commerce-merchants` | Merchants/stores |
| `commerce-price-snapshots` | Price history → `/price-drops` |
| `commerce-reviews` | Product reviews |
| `nxt-comments` | Article comments |
| **`nxt-coupon`** | **CMS-curated coupons** (see `strapi-cms/nxt-coupon/`) — optional layer on top of the feed caches |

The `nxt-coupon` content type is scaffolded in `strapi-cms/nxt-coupon/` (schema +
controller/route/service + README). Add it to the Strapi project to manage
coupons editorially; the frontend prefers it when present.

---

## 4. Coupons & affiliate monetization (the core commercial engine)

### Coupon source priority

`lib/coupon-data.ts` resolves coupons in this order (first non-empty wins, per
store; local sources merge in "auto" mode):

```
1. Strapi  nxt-coupons          (CMS-curated, if the collection exists)
2. Local feed cache            data/coupons-<source>.json
3. Legacy RapidAPI / JSON cache (get-promo-codes; paused by default)
4. Starter/fallback coupons
```

The active local feed source is controlled by **`COUPON_FEED_SOURCE`**:
- `couponapi` → read only `data/coupons-couponapi.json` (current default)
- `feedico`   → read only `data/coupons-feedico.json`
- unset       → CouponAPI preferred, Feedico as fallback (merged, de-duped)

### Affiliate programs / feeds

| Program / feed | Env | Role |
|---|---|---|
| **CouponAPI.org** | `COUPONAPI_KEY` | **Primary coupon feed** — aggregates CJ / Impact / FlexOffers / etc.; returns affiliate-ready links. `scripts/fetch-couponapi.mjs` |
| **Feedico** | `FEEDICO_API_TOKEN` | Coupon aggregator (Admitad, etc.). `scripts/sync-feedico-coupons.mjs`. Currently inactive |
| **RapidAPI** | `RAPIDAPI_KEY` | `get-promo-codes` (coupons/stores — **paused** via `COUPONS_API_PAUSED=true`), `real-time-product-search` (best-deals/products), `amazon-promo-codes-and-deals` |
| **Impact Radius** | `IMPACT_*` | Walmart affiliate (products via Catalog, promotions via `/Promotions`). `lib/impact-links.ts`, `scripts/fetch-impact-promotions.mjs` |
| **eBay** | `EBAY_CLIENT_ID/SECRET`, `EBAY_EPN_CAMPAIGN_ID` | Buy Browse API (products) + eBay Partner Network |
| **Awin / Tradedoubler** | `AWIN_*`, `TRADEDOUBLER_*` | Voucher/promotion feeds |
| **Amazon Associates** | `NEXT_PUBLIC_AMAZON_AFFILIATE_TAG` | Amazon affiliate tag |
| **Takeads** | `TAKEADS_PUBLIC_KEY`, `TAKEADS_SUB_ID` | Long-tail link **converter** — monetizes links no other network covers. Map built ahead of time by `scripts/fetch-takeads-links.mjs` into `data/takeads-links.json`; `lib/takeads-links.ts` reads it at render time |

### Link handling rules
- Feed links that are **already affiliate-ready** (CouponAPI's `affiliate_link`,
  Impact `TrackingLink`, Admitad `offerUrl`) are used **verbatim** — never
  double-wrapped.
- Links **without** tracking (Google Shopping, manual coupons) fall through to
  **Takeads**, which is a lookup in a prebuilt map rather than a network call —
  so nothing sits in the render path. A URL with no entry is left as-is.
- **Amazon** stays on **Amazon Associates** via its own tag — it is *not*
  sourced from the affiliate networks (they don't carry Amazon).

---

## 5. Data pipeline (`scripts/` → `data/`)

Cron-style scripts pull feeds and write JSON caches under `data/` that `lib/`
reads at request time:

| Script | Writes | Purpose |
|---|---|---|
| `fetch-couponapi.mjs` | `coupons-couponapi.json` | CouponAPI.org coupons (US-filtered, target merchants) |
| `sync-feedico-coupons.mjs` | `coupons-feedico.json` (+ optional Strapi upsert) | Feedico coupons; `--networks`/`--dry` modes |
| `fetch-impact-promotions.mjs` | `coupons-impact.json` | Impact/Walmart promotions |
| `fetch-coupon-stores.mjs` | `coupon-stores.json` | The ~18k coupon store directory |
| `refresh-high-intent-coupons.mjs` | `coupon-store-coupons.json` | Cached coupons for curated (high-intent) stores |
| `fetch-real-time-best-deals.mjs` | `best-deals-realtime.json` | `/best-deals` (Real-Time Product Search) |
| `fetch-best-sellers.mjs` / `fetch-*-best-sellers` | `best-sellers*.json` | Best-seller tabs |
| `fetch-live-offers.mjs` | `live-offers.json` (+ Strapi) | Live product offers |
| `fetch-coupons-awin.mjs` / `-tradedoubler.mjs` | `coupons-awin.json` / `-tradedoubler.json` | Direct network vouchers |

`data/high-intent-coupon-stores.json` is **curated config** (which stores are
featured/indexable), not a pure cache.

### One-shot catalog imports

`scripts/import-gsmarena-specs.py` writes GSMArena specification tables from a
filled workbook straight into `commerce-products.specs.gsmarena` — the shape
`app/products/[slug]/page.tsx` renders as the GSMArena spec panel. It merges
into `specs` rather than replacing it, skips rows whose spec text says
`NOT FOUND ON GSMARENA` (Garmin/Amazfit watches have no GSMArena page), and
leaves an already-populated `specs.gsmarena` alone unless `--force`.

```bash
python3 scripts/import-gsmarena-specs.py --dry     # report, no writes
python3 scripts/import-gsmarena-specs.py           # write to Strapi
```

---

## 6. Routes overview

- `/` — homepage (hero, trending, coupons section)
- `/products`, `/products/[slug]` — product catalog + detail (price comparison)
- `/category`, `/category/[slug]` — product categories
- `/[category]`, `/[category]/[slug]` — article categories + posts
- `/posts` — **All Articles** index
- `/best-deals` — ranked live deals (affiliate-wrapped)
- `/price-drops` — tracked price history drops
- `/coupons`, `/coupons/[storeSlug]`, `/coupons/amazon` — coupon hub + store pages
- `/stores`, `/brands` — coupon store / brand directories
- `/best-sellers`, `/best-sellers/[merchant]` — marketplace best-sellers
- `/search`, `/about`, `/contact`, `/legal/*`
- `/sitemap` (interactive HTML) + `/sitemap.xml` + `/feed.xml` + `/robots.txt`

**SEO:** `app/sitemap.ts` emits only indexable, valuable URLs (products, posts,
categories, and coupon stores that actually have content); thin coupon-store
pages are `noindex`. `/sitemap` is a human-facing, filterable index.

### AI crawler policy

`robots.txt` is **version-controlled** in `app/robots.txt/route.ts` — that route
handler is the single source of truth. We deliberately split AI crawlers into
two classes and treat them differently:

- **Training crawlers → `Disallow: /`** — we do not permit our original review /
  comparison content to be scraped for training or fine-tuning AI models.
  Blocked: `GPTBot`, `Google-Extended`, `Applebot-Extended`, `ClaudeBot`,
  `CCBot`, `Bytespider`, `Amazonbot`, `meta-externalagent`, `cohere-ai`,
  `Diffbot`, `Omgilibot`, `Timpibot`.
- **Answer / search crawlers → explicitly `Allow: /`** — these drive citations
  and referral traffic in generative search, which is worth real visibility for
  a deals site, with no content-protection downside. Allowed:
  `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `Perplexity-User`,
  `Claude-SearchBot`, `Claude-User`, `Applebot`. (Conventional `Googlebot` /
  `Bingbot` are covered by the default `*` group.)

The `*` group carries `Content-Signal: search=yes,ai-train=no,use=reference` (a
Cloudflare content-signals / EU DSM Directive Art. 4 reservation of rights) and
keeps `Disallow: /search` + `Disallow: /api/` plus the `Sitemap:` directive. The
same two disallows are repeated on each explicitly-allowed answer bot, because a
crawler that matches its own `User-agent` group ignores the `*` group.

> ⚠️ **Cloudflare "Managed robots.txt / Block AI bots" must stay OFF.** That
> feature *prepends* Cloudflare's own AI-bot block to whatever the origin serves.
> If it is re-enabled, the served `robots.txt` ends up with duplicate/conflicting
> groups and `app/robots.txt/route.ts` is no longer authoritative. It was ON
> previously (the served file showed a `# BEGIN Cloudflare Managed content`
> block); it must be **disabled in the Cloudflare dashboard** (AI Audit → bot
> controls / Managed robots.txt) so this repo governs crawl policy. Verify with
> `curl -s https://nxt.bargains/robots.txt` — there should be **no**
> `Cloudflare Managed content` block.

To change the policy, edit the `ANSWER_BOTS` / `TRAINING_BOTS` lists in
`app/robots.txt/route.ts` and redeploy.

---

## 7. Environment variables

Copy `.env.example` → `.env.local` (git-ignored). Key groups:

```bash
# Strapi
NEXT_PUBLIC_STRAPI_URL=https://cms.fxnstudio.com
STRAPI_INTERNAL_URL=            # same-box only; DO NOT set on Netlify
STRAPI_API_TOKEN=
STRAPI_WRITE_TOKEN=

# Site / Amazon
NEXT_PUBLIC_SITE_URL=https://nxt.bargains
NEXT_PUBLIC_AMAZON_AFFILIATE_TAG=

# Coupons
COUPON_FEED_SOURCE=couponapi
COUPONS_API_PAUSED=true
COUPONAPI_KEY=
FEEDICO_API_TOKEN=
RAPIDAPI_KEY=

# Affiliate networks
IMPACT_ACCOUNT_SID=            IMPACT_AUTH_TOKEN=
IMPACT_WALMART_CATALOG_ID=     IMPACT_TRACKING_TEMPLATE=
EBAY_CLIENT_ID=                EBAY_CLIENT_SECRET=       EBAY_EPN_CAMPAIGN_ID=
AWIN_API_TOKEN= AWIN_PUBLISHER_ID= AWIN_REGION= AWIN_PROMOTIONS_FEED_URL=
TRADEDOUBLER_PUBLISHER_ID=     TRADEDOUBLER_VOUCHER_TOKEN=

# Takeads (long-tail link converter)
TAKEADS_PUBLIC_KEY= TAKEADS_SUB_ID=
```

---

## 8. Local development

```bash
npm install
cp .env.example .env.local     # fill in the values
npm run dev                     # http://localhost:3001
```

Requires **Node 20+** (Next 15 rejects 18.x).

```bash
npm run build                   # production build
npm run lint
```

---

## 9. Deployment

### A. Native (RETIRED — no longer production)
Formerly served by the **`nxt-bargains.service`** systemd unit (`next start` on
`127.0.0.1:3008`, behind nginx for `https://nxt.bargains`). That host is gone:
production is Netlify, built from `main` (see NETLIFY.md).

Nothing may assume `127.0.0.1:3008` is reachable. `middleware.ts` defaulted an
internal origin to it and every product page 500'd with "tcp connect error:
Connection refused" once the site moved, because the rewrite proxied to a port
that no longer exists. Anything internal-origin-shaped is a migration hazard —
the same trap NETLIFY.md documents for `STRAPI_INTERNAL_URL`.

```bash
npm run build
sudo systemctl restart nxt-bargains.service
# verify the origin directly (bypass public cache):
curl -skL --resolve nxt.bargains:443:127.0.0.1 https://nxt.bargains/
```

### B. Netlify
`netlify.toml` + `@netlify/plugin-nextjs` build SSR/ISR/functions. See
**[NETLIFY.md](NETLIFY.md)** for the full guide. Key points:
- Set all env vars in the Netlify UI; **do not** set `STRAPI_INTERNAL_URL`.
- A **data snapshot** of `data/*.json` is committed so the read-only functions
  have runtime data; `included_files` bundles
  it. Refresh by re-committing the data + re-deploying.
- The `scripts/` cron jobs do **not** run on Netlify — data is a build-time
  snapshot there.

---

## 10. Directory map

```
app/           Routes (App Router) — pages, layouts, sitemap, feed, api/
components/    UI components (Header, Footer, cards, filters, SitemapExplorer…)
lib/           Data & business logic:
               strapi.ts · coupon-data.ts · coupon-stores.ts · commerce.ts
               impact-links.ts · best-sellers.ts · product-url.ts · seo.ts · site.ts
scripts/       Feed/cron fetchers → data/*.json (+ some Strapi upserts)
data/          JSON caches / curated config (snapshot committed for Netlify)
strapi-cms/    nxt-coupon content-type to add to the Strapi project
public/        Static assets, logos, fonts
```

## Deployment

Hosted on **Netlify**, built from `main` on push. `netlify.toml` carries the
configuration.

### Why Netlify rather than Vercel or Cloudflare

This is a server-rendered Next.js app that also expects a **filesystem**: twelve
call sites read `data/*.json` via `join(process.cwd(), …)` at request time,
around 38 MB in total.

- **Netlify** — already solved. `included_files = ["data/**"]` bundles them.
- **Vercel** — works, but needs `outputFileTracingIncludes`; the tracer cannot
  follow computed paths.
- **Cloudflare** — don't. Workers have no filesystem, so those reads have
  nowhere to go without rewriting them onto KV or R2.

The Vercel caveat matters because of *how* it fails: the loaders catch their own
errors and return empty, so a missing bundle gives a green build and a working
site with silently empty coupons and offers.

### Environment variables

Set in the Netlify UI, not committed:

```text
NEXT_PUBLIC_STRAPI_URL           CMS the site reads at request time
STRAPI_API_TOKEN
NEXT_PUBLIC_GA_MEASUREMENT_ID    analytics, loaded only after consent
TAKEADS_PUBLIC_KEY               link conversion map, built ahead of the build
TAKEADS_SUB_ID
```

### Cost, and why branches matter

Netlify bills in credits: **300/month free, and a production deploy costs 15** —
roughly 20 releases before sites pause until the next month. Push work to a
branch (nothing builds) and merge to `main` only when releasing. Opening a pull
request does trigger a Deploy Preview, so hold off on the PR until you mean it.

### The weekly data jobs

Two cron jobs on the origin server write into `data/` every Sunday:

```cron
0  3 * * 0  scripts/fetch-openwebninja-store-bestsellers.mjs
20 3 * * 0  scripts/fetch-openwebninja-amazon-new-releases.mjs
```

Netlify serves whatever was committed, so **a fetch alone does not update the
live site** — the refreshed data has to be committed and deployed. Either make
that a deliberate step or move the jobs into CI.

