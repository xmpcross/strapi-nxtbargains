-- Offer→product matching: schema, indexes and the 4-tier waterfall.
--
-- Runs against the Strapi Postgres (container strapi-cms-postgres, db strapi),
-- which is where the live catalogue actually lives. Apply with:
--
--   docker exec -i strapi-cms-postgres psql -U strapi -d strapi \
--     < ops/sql/001-matching-waterfall.sql
--
-- Idempotent: safe to re-run.
--
-- Two things about this schema shape the whole file:
--
--   Strapi v5 keeps a draft row and a published row per entry, so the
--   catalogue's 721 products are 1,442 rows. Every lookup here filters on
--   published_at IS NOT NULL, or each match would come back doubled.
--
--   Strapi owns this schema and re-syncs it on boot. Nothing below adds or
--   alters a column for that reason — only extensions, functions and indexes,
--   which Strapi leaves alone. Normalisation is therefore an expression index
--   over an IMMUTABLE function rather than a generated column.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Specified for primary-key generation. Strapi issues its own integer ids and
-- varchar document_ids, so nothing here uses it; it is installed so a future
-- port of this schema to Supabase has it available.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Normalisation
-- ---------------------------------------------------------------------------

-- A GTIN-8/12/13/14 is the same number at different widths — a UPC-12 is an
-- EAN-13 with a leading zero. Comparing them as written makes the same product
-- look like two, so everything is widened to 14 digits before comparison.
CREATE OR REPLACE FUNCTION commerce_normalize_gtin(value text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN value IS NULL THEN NULL
    WHEN regexp_replace(value, '[^0-9]', '', 'g') = '' THEN NULL
    ELSE lpad(regexp_replace(value, '[^0-9]', '', 'g'), 14, '0')
  END;
$$;

CREATE OR REPLACE FUNCTION commerce_normalize_ident(value text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT nullif(upper(regexp_replace(coalesce(value, ''), '[^A-Za-z0-9]', '', 'g')), '');
$$;

-- Titles arrive from scrapes with the merchant's price furniture glued onto the
-- end, e.g.
--   "Levi's Women's Cinch Baggy42% offEnds in$48.99$4899List:$84.95$84.95"
-- Left in place that blob dominates the trigram profile and two unrelated
-- products on the same discount score as near-identical, so it is stripped
-- before the title is ever compared or indexed.
CREATE OR REPLACE FUNCTION commerce_normalize_title(value text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT nullif(
    btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            lower(coalesce(value, '')),
            -- price and promo furniture
            '(\d+%\s*off|limited time deal|ends in|typical price|list:|was:|save\s*\$?\d+|\$\s*\d[\d.,]*)',
            ' ', 'g'),
          -- anything that is not a letter, digit or space
          '[^a-z0-9]+', ' ', 'g'),
        '\s+', ' ', 'g')
    ),
  '');
$$;

-- ---------------------------------------------------------------------------
-- Indexes — one per tier of the waterfall
-- ---------------------------------------------------------------------------

-- Tier 1: global barcodes.
CREATE INDEX IF NOT EXISTS commerce_products_gtin_idx
  ON commerce_products (commerce_normalize_gtin(gtin))
  WHERE gtin IS NOT NULL AND published_at IS NOT NULL;

-- Tier 2: Amazon's stable identifier.
CREATE INDEX IF NOT EXISTS commerce_products_asin_idx
  ON commerce_products (commerce_normalize_ident(asin))
  WHERE asin IS NOT NULL AND published_at IS NOT NULL;

-- Tier 3: manufacturer part numbers are only unique within a brand, so the
-- index is composite and the lookup always supplies both.
CREATE INDEX IF NOT EXISTS commerce_products_brand_mpn_idx
  ON commerce_products (commerce_normalize_ident(brand), commerce_normalize_ident(mpn))
  WHERE mpn IS NOT NULL AND published_at IS NOT NULL;

-- Tier 4: fuzzy title. GIN over trigrams, which is what makes `%` and
-- similarity() index-assisted rather than a sequential scan of the catalogue.
CREATE INDEX IF NOT EXISTS commerce_products_title_trgm_idx
  ON commerce_products USING gin (commerce_normalize_title(name) gin_trgm_ops)
  WHERE published_at IS NOT NULL;

-- Offers are matched by the same identifiers coming the other way.
CREATE INDEX IF NOT EXISTS commerce_offers_merchant_sku_idx
  ON commerce_offers (commerce_normalize_ident(merchant_sku))
  WHERE merchant_sku IS NOT NULL AND published_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- The waterfall
-- ---------------------------------------------------------------------------

-- Returns at most one product: the first tier that hits wins, and the tiers are
-- ordered by how much the identifier is worth trusting. Tiers 1-3 are exact, so
-- they report confidence 1.0; tier 4 reports its trigram similarity, so a caller
-- can hold low-confidence matches for review instead of attaching them.
--
-- p_threshold applies to tier 4 only. Below it, no row is returned at all —
-- an unmatched offer is a smaller problem than an offer attached to the wrong
-- product, which is what the "50ml vs 100ml jar" contamination looks like in
-- practice.
--
-- Tier 4 additionally requires the brands to agree when both sides state one.
-- Trigram distance alone happily matches "Galaxy S24 128GB" to "Galaxy S24
-- 256GB"; the brand gate does not fix that, so callers that care about variant
-- collisions should compare capacity/size themselves before attaching. That
-- guard is deliberately not baked in here — see ops/match-offer.mjs --strict.
CREATE OR REPLACE FUNCTION commerce_match_offer(
  p_gtin      text DEFAULT NULL,
  p_asin      text DEFAULT NULL,
  p_brand     text DEFAULT NULL,
  p_mpn       text DEFAULT NULL,
  p_title     text DEFAULT NULL,
  p_site_tag  text DEFAULT 'nxt-bargains',
  p_threshold real DEFAULT 0.45
)
RETURNS TABLE (
  product_id  integer,
  document_id text,
  name        text,
  tier        integer,
  tier_name   text,
  confidence  real
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_gtin  text := commerce_normalize_gtin(p_gtin);
  v_asin  text := commerce_normalize_ident(p_asin);
  v_brand text := commerce_normalize_ident(p_brand);
  v_mpn   text := commerce_normalize_ident(p_mpn);
  v_title text := commerce_normalize_title(p_title);
BEGIN
  -- Tier 1 — exact GTIN. The gold standard: a barcode identifies one product
  -- globally, so a hit here needs no corroboration.
  IF v_gtin IS NOT NULL THEN
    RETURN QUERY
    SELECT p.id, p.document_id::text, p.name::text, 1, 'gtin'::text, 1.0::real
    FROM commerce_products p
    WHERE p.published_at IS NOT NULL
      AND p.product_status = 'active'
      AND p.tags::text ILIKE '%' || p_site_tag || '%'
      AND commerce_normalize_gtin(p.gtin) = v_gtin
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Tier 2 — Amazon ASIN.
  IF v_asin IS NOT NULL THEN
    RETURN QUERY
    SELECT p.id, p.document_id::text, p.name::text, 2, 'asin'::text, 1.0::real
    FROM commerce_products p
    WHERE p.published_at IS NOT NULL
      AND p.product_status = 'active'
      AND p.tags::text ILIKE '%' || p_site_tag || '%'
      AND commerce_normalize_ident(p.asin) = v_asin
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Tier 3 — brand + MPN. An MPN on its own is not unique across brands, so
  -- both are required; a bare MPN match is not accepted.
  IF v_mpn IS NOT NULL AND v_brand IS NOT NULL THEN
    RETURN QUERY
    SELECT p.id, p.document_id::text, p.name::text, 3, 'brand_mpn'::text, 1.0::real
    FROM commerce_products p
    WHERE p.published_at IS NOT NULL
      AND p.product_status = 'active'
      AND p.tags::text ILIKE '%' || p_site_tag || '%'
      AND commerce_normalize_ident(p.mpn) = v_mpn
      AND commerce_normalize_ident(p.brand) = v_brand
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Tier 4 — normalised title, trigram similarity, best match above threshold.
  IF v_title IS NOT NULL THEN
    RETURN QUERY
    SELECT p.id, p.document_id::text, p.name::text, 4, 'title_trgm'::text,
           similarity(commerce_normalize_title(p.name), v_title)::real
    FROM commerce_products p
    WHERE p.published_at IS NOT NULL
      AND p.product_status = 'active'
      AND p.tags::text ILIKE '%' || p_site_tag || '%'
      AND (v_brand IS NULL
           OR commerce_normalize_ident(p.brand) IS NULL
           OR commerce_normalize_ident(p.brand) = v_brand)
      AND similarity(commerce_normalize_title(p.name), v_title) >= p_threshold
    ORDER BY similarity(commerce_normalize_title(p.name), v_title) DESC
    LIMIT 1;
  END IF;
END;
$$;

COMMIT;
