/**
 * HTML parsers for retailer deals pages fetched through ZenRows.
 *
 * Extracted from fetch-amazon-daily-deals.mjs so the homepage "Popular Deals"
 * section and the /best-deals page parse the same markup with the same code.
 * They previously would have needed a copy each, and a copy drifts: every one
 * of these parsers keys on class names that have already changed under us at
 * least once, and a fix applied to one copy is a bug left standing in the other.
 *
 * Each parser takes the page HTML and returns a flat list of deal records. A
 * record is only returned when the page shows an actual saving — these pages
 * all carry ordinary recommendation carousels built from the same markup as
 * the deals, and without that rule the carousels come through as "deals".
 */

const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const money = (v) => (v ? Number(String(v).replace(/,/g, '')) : null);

/* Cards are found by their link element. `dcl-product` also appears ~330 times
   inside the page's <style> block, so matching on the container class finds CSS
   rather than markup. A card runs from one link to the next, read one at a time
   so a price cannot be taken from the neighbouring card. */
const AMAZON_CARD = /<a[^>]*class="[^"]*dcl-product-link[^"]*"[^>]*>/g;

export function parseAmazonDeals(html) {
  const anchors = [...html.matchAll(AMAZON_CARD)].map((m) => m.index);
  const out = [];
  const seen = new Set();

  for (let i = 0; i < anchors.length; i += 1) {
    const block = html.slice(anchors[i], anchors[i + 1] ?? html.length);
    const asin = block.match(/href="[^"]*?\/dp\/([A-Z0-9]{10})/)?.[1];
    if (!asin || seen.has(asin)) continue;

    const title = strip(block.slice(0, block.indexOf('</a>') + 1));
    if (title.length < 8) continue;

    const price = money(block.match(/dcl-product-price-new[^"]*"[\s\S]*?<span class="a-offscreen">\s*\$?([\d,]+(?:\.\d{2})?)/)?.[1]);
    const was = money(block.match(/dcl-product-price-old[^"]*"[\s\S]*?<span class="a-offscreen">\s*\$?([\d,]+(?:\.\d{2})?)/)?.[1]);
    let pct = Number(strip(block).match(/(\d{1,2})%\s*off/i)?.[1]) || null;
    if (price === null) continue;
    if (!pct && was && was > price) pct = Math.round((1 - price / was) * 100);
    if (!pct) continue;

    // src precedes class on these tags, so the img is located first and its src
    // read out of it rather than matching the two in a fixed order.
    const imgTag = block.match(/<img[^>]*dcl-dynamic-image[^>]*>/)?.[0];
    seen.add(asin);
    out.push({
      id: asin,
      title,
      price,
      wasPrice: was,
      percentOff: pct,
      currency: 'USD',
      image: imgTag?.match(/src="([^"]+)"/)?.[1] ?? null,
      badge: block.match(/>(Limited time deal|Deal of the Day|Prime Exclusive Deal|Lightning Deal)</i)?.[1] ?? null,
      url: `https://www.amazon.com/dp/${asin}`,
    });
  }
  return out;
}

/* eBay's deals page shares no markup with Amazon's.

   Tiles are located by their /itm/ link: the container class `dne-itemtile`
   cannot be used, because `\b` also matches before the hyphen in
   `dne-itemtile-title` and `dne-itemtile-price`, which returned 772 "tiles" for
   101 products. The link appears 206 times for those 101 — each product is
   linked twice, from its image and its title — so ids are deduplicated. */
export function parseEbayDeals(html) {
  const links = [...html.matchAll(/href="https:\/\/www\.ebay\.com\/itm\/(\d+)[^"]*"/g)];
  const out = [];
  const seen = new Set();

  for (const link of links) {
    const id = link[1];
    if (seen.has(id)) continue;
    const block = html.slice(link.index, link.index + 3000);

    const title = block.match(/title="([^"]{8,180})"/)?.[1];
    if (!title) continue;

    /* The amount is not the price node's own text: it sits inside a nested
       <span itemprop="price">, behind a <meta> tag. Matching ">$" directly
       after the class found nothing at all. */
    const price = money(block.match(/dne-itemtile-price[\s\S]{0,240}?\$([\d,]+\.?\d{0,2})/)?.[1]);
    if (price === null) continue;

    const was = money(block.match(/Previous price:\s*\$?([\d,]+\.?\d{0,2})/)?.[1]);
    let pct = Number(block.match(/(\d{1,2})%\s*off/i)?.[1]) || null;
    if (!pct && was && was > price) pct = Math.round((1 - price / was) * 100);
    if (!pct) continue;

    seen.add(id);
    out.push({
      id,
      title: title.replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
      price,
      wasPrice: was,
      percentOff: pct,
      currency: 'USD',
      image: block.match(/<img[^>]*src="(https:\/\/i\.ebayimg[^"]+)"/)?.[1] ?? null,
      badge: block.match(/>(Almost gone|Free shipping|Trending)</i)?.[1] ?? null,
      url: `https://www.ebay.com/itm/${id}`,
    });
  }
  return out;
}

/* Walmart ships its data as JSON, so this reads __NEXT_DATA__ rather than the
   markup. That is the difference between a parser that survives a redesign and
   one that does not — the others key on class names.

   The page also mentions "captcha" three times in bundle filenames while
   serving perfectly good content, so presence of that word is not a block
   signal here; the real ones (px-captcha, "robot or human") are absent. */
export function parseWalmartDeals(html) {
  const raw = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!raw) return [];

  let stacks;
  try {
    stacks = JSON.parse(raw)?.props?.pageProps?.initialData?.searchResult?.itemStacks ?? [];
  } catch {
    return [];
  }

  const out = [];
  const seen = new Set();
  for (const stack of stacks) {
    for (const item of stack.items ?? []) {
      const id = item.usItemId;
      if (!id || seen.has(id) || !item.name) continue;

      const info = item.priceInfo ?? {};
      const price = money(String(info.linePrice ?? info.currentPrice ?? '').replace(/[^\d.,]/g, ''));
      const was = money(String(info.wasPrice ?? '').replace(/[^\d.,]/g, ''));
      if (price === null) continue;
      if (!was || was <= price) continue;

      seen.add(id);
      out.push({
        id: String(id),
        title: item.name,
        price,
        wasPrice: was,
        percentOff: Math.round((1 - price / was) * 100),
        currency: 'USD',
        image: item.imageInfo?.thumbnailUrl ?? null,
        badge: item.badges?.flags?.[0]?.text ?? null,
        url: item.canonicalUrl ? `https://www.walmart.com${item.canonicalUrl.split('?')[0]}` : null,
      });
    }
  }
  return out.filter((d) => d.url);
}

/* Newegg splits one product across three sibling nodes: the image sits before
   the title anchor, the price after it. There is no single container class that
   wraps all three and appears only in markup — `item-cell` occurs inside the
   page's <style> block — so the title anchors are used as the boundaries, and
   each card is read as the span between one title and the next. The image is
   taken from the span *preceding* its title for the same reason.

   Price is assembled from three nodes: <strong>100</strong><sup>.00</sup>
   behind a separate $ symbol span, so it cannot be matched as one number. */
export function parseNeweggDeals(html) {
  const titles = [...html.matchAll(/<a[^>]*href="(https:\/\/www\.newegg\.com\/[^"]*?\/p\/([A-Z0-9]+)[^"]*)"[^>]*class="goods-title"[^>]*>([^<]{6,200})<\/a>/g)];
  const out = [];
  const seen = new Set();

  for (let i = 0; i < titles.length; i += 1) {
    const [, url, id, rawTitle] = titles[i];
    if (seen.has(id)) continue;

    const after = html.slice(titles[i].index, titles[i + 1]?.index ?? html.length);
    const before = html.slice(titles[i - 1]?.index ?? 0, titles[i].index);

    const whole = after.match(/goods-price-current[\s\S]{0,300}?goods-price-value"><strong>([\d,]+)<\/strong>/)?.[1];
    const cents = after.match(/goods-price-current[\s\S]{0,300}?goods-price-value"><strong>[\d,]+<\/strong><sup>\.(\d{2})<\/sup>/)?.[1];
    const price = whole === undefined ? null : money(whole) + (cents ? Number(cents) / 100 : 0);
    if (price === null) continue;

    const was = money(after.match(/goods-price-was[^"]*"[^>]*>\s*\$?([\d,]+(?:\.\d{2})?)/)?.[1]);
    if (!was || was <= price) continue;   // a listing, not a deal

    // A was-price one cent above the current one is a rounding artefact, not a
    // saving: it renders as "0% off", which reads as a bug on the page.
    const percentOff = Math.round((1 - price / was) * 100);
    if (percentOff < 1) continue;

    seen.add(id);
    out.push({
      id,
      title: rawTitle.replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim(),
      price,
      wasPrice: was,
      percentOff,
      currency: 'USD',
      image: [...before.matchAll(/<img[^>]*src="(https:\/\/c1\.neweggimages\.com\/productimage\/[^"]+)"/g)].pop()?.[1] ?? null,
      badge: after.match(/>(Lowest price|Shell Shocker|Best Deal)</i)?.[1] ?? null,
      url: url.split('?')[0],
    });
  }
  return out;
}

/**
 * eBay's non-US deals pages.
 *
 * Kept separate from parseEbayDeals rather than folded into it, because the
 * US parser is in daily use and the international markup differs in three ways
 * that each broke it outright:
 *
 *   The domain. The US parser anchors on ebay.com; these are ebay.co.uk,
 *   ebay.com.au and ebay.de, so not a single tile matched.
 *
 *   Quoting. ebay.de serves minified HTML with unquoted attributes
 *   (href=https://... , class=dne-itemtile-price), so every regex written
 *   around class="..." missed. The UK and AU pages are quoted like the US one,
 *   which is what made this look like a domain-only problem at first.
 *
 *   Number format. Prices arrive as "EUR 9,99", "AU $110.00" and "£99.99" —
 *   a comma is the decimal separator in one and a thousands separator in
 *   another, so a single strip-the-punctuation rule turns 9,99 into 999.
 *
 * The discount wording differs too: "Previous price"/"RRP" and "% off" in the
 * UK and AU, "UVP" and "% Rabatt" in Germany.
 */
const INTL_ITEM = /href=["']?(https:\/\/www\.ebay\.(?:co\.uk|com\.au|de|fr|it|es|ie|nl|pl|at|ch)\/itm\/(\d+))/g;

/**
 * "EUR 9,99" / "AU $110.00" / "£1,299.99" -> a number.
 *
 * Which separator is decimal is decided by position, not by locale: whichever
 * of . or , appears last is the decimal point, and a lone separator followed
 * by exactly two digits at the end of the string is decimal too. That handles
 * every format on these pages without needing to know which site produced it.
 */
export function parseIntlMoney(raw) {
  if (!raw) return null;
  const text = String(raw).replace(/[^\d.,]/g, '');
  if (!text) return null;

  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  let normalised;
  if (lastDot >= 0 && lastComma >= 0) {
    normalised = lastDot > lastComma
      ? text.replace(/,/g, '')
      : text.replace(/\./g, '').replace(',', '.');
  } else if (lastComma >= 0) {
    normalised = /,\d{2}$/.test(text) ? text.replace(',', '.') : text.replace(/,/g, '');
  } else {
    normalised = text;
  }

  const value = Number(normalised);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function parseEbayDealsIntl(html) {
  const links = [...html.matchAll(INTL_ITEM)];
  const out = [];
  const seen = new Set();

  for (let i = 0; i < links.length; i += 1) {
    const [, url, id] = links[i];
    if (seen.has(id)) continue;

    // Each product is linked twice (image and title), so the window has to be
    // wide enough to reach the price from the first of the pair.
    const block = html.slice(links[i].index, links[i].index + 4000);

    const title = block.match(/title="([^"]{8,200})"/)?.[1];
    if (!title) continue;

    const currency = block.match(/priceCurrency\s+content=["']?([A-Z]{3})/)?.[1] ?? null;
    const price = parseIntlMoney(block.match(/itemprop=["']?price["']?[^>]*>([^<]{1,40})</)?.[1]);
    if (price === null) continue;

    const was = parseIntlMoney(block.match(/itemtile-price-strikethrough[^>]*>([^<]{1,40})</)?.[1]);
    let pct = Number(block.match(/(\d{1,2})\s*%\s*(?:off|Rabatt|de r[ée]duction|di sconto|de descuento)/i)?.[1]) || null;
    if (!pct && was && was > price) pct = Math.round((1 - price / was) * 100);
    if (!pct) continue;   // a listing, not a deal

    seen.add(id);
    out.push({
      id,
      title: title.replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim(),
      price,
      wasPrice: was,
      percentOff: pct,
      currency,
      image: block.match(/src=["']?(https:\/\/i\.ebayimg\.com\/images\/g\/[^\s"'>]+)/)?.[1] ?? null,
      badge: null,
      url: url.split('?')[0],
    });
  }
  return out;
}
