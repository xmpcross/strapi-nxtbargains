# NXT Coupon — Strapi content type

CMS-curated coupon/deal source for NXT.Bargains. This makes coupons **editorially
controlled and independent of the external coupon API** (which is currently paused
via `COUPONS_API_PAUSED=true`). The frontend prefers these records and falls back
to the legacy RapidAPI/JSON-cache source only when the collection is empty/missing.

## Install into Strapi (cms.fxnstudio.com)

These files match Strapi 5's file layout. Copy them into the Strapi project:

```
src/api/nxt-coupon/
├── content-types/nxt-coupon/schema.json
├── controllers/nxt-coupon.ts
├── routes/nxt-coupon.ts
└── services/nxt-coupon.ts
```

(If your Strapi project is JavaScript rather than TypeScript, rename the three
`.ts` files to `.js` — the factory bodies are identical.)

Then restart Strapi. The collection **NXT Coupon** appears in the admin, exposing
`GET /api/nxt-coupons`.

## Permissions

Settings → Users & Permissions → Roles → **Public**: enable **only** `find` and
`findOne` for `nxt-coupon`. Leave `create` / `update` / `delete` disabled.

If the frontend uses an API token (`STRAPI_API_TOKEN`), instead grant that token
read access to `nxt-coupon`.

## Fields (map 1:1 to the frontend `Coupon`)

| Field | Type | Notes |
|---|---|---|
| `title` | string (req) | Offer headline |
| `store` | string (req) | Store/brand display name (e.g. "Amazon") |
| `storeSlug` | string | Slug for `/coupons/{slug}` routing; defaults from `store` |
| `code` | string | Promo code (omit for a Sale/deal) |
| `discount` | string | e.g. "Up to 40% off" |
| `category` | string | e.g. "Amazon coupons" |
| `couponType` | enum | `Coupon` \| `Promo code` \| `Sale` |
| `destinationUrl` | string | Raw merchant URL — auto affiliate-wrapped (GeniusLink/Impact) |
| `affiliateUrl` | string | Pre-wrapped link; used verbatim if set |
| `featured` | boolean | Surfaces in "Today's best" + homepage |
| `isBrand` | boolean | Include in the Brands feed / brand groups |
| `verifiedLabel` | string | e.g. "Updated today" |
| `expiresAt` | datetime | Optional; unpublish or remove when expired |
| `displayOrder` | integer | Lower = earlier |
| `externalId` | string | Idempotency key for automated sync (e.g. `feedico:12345`) |
| `source` | string | Provenance, e.g. `feedico:cj` (manual entries can leave blank) |

Link handling: the frontend uses `affiliateUrl` if present, else affiliate-wraps
`destinationUrl` (GeniusLink), else links to the internal `/coupons/{storeSlug}`
page. So you can paste a raw merchant URL and monetization is applied automatically.

## Automated source: Feedico → this collection

The frontend repo ships `scripts/sync-feedico-coupons.mjs`, which pulls the
[Feedico](https://feedico.io) affiliate-coupon feed and upserts into this
collection by `externalId` (create/update, idempotent). Feedico returns
affiliate-ready links → stored in `affiliateUrl` and used verbatim.

```
# in the frontend repo, after setting FEEDICO_API_TOKEN + STRAPI_API_TOKEN
node scripts/sync-feedico-coupons.mjs --dry      # inspect the field mapping
node scripts/sync-feedico-coupons.mjs --limit=500
```

- **Amazon is skipped** by the sync — keep Amazon Associates + GeniusLink for Amazon.
- Requires an **API token** with write access to `nxt-coupon` (Settings → API Tokens).
- Schedule it on a cron (hourly/daily) to keep the feed fresh.
- Feedico's real field names may differ — adjust `mapFeedicoCoupon()` in the script
  after checking a `--dry` sample.
