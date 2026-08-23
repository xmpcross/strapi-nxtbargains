/**
 * Category introductions for the storefront category pages.
 *
 * Kept in the frontend rather than written into `commerce-category.description`
 * because that taxonomy is a pool shared with the other storefronts — four of
 * these slugs (the smart-home-* ones) are nxtsmart.homes categories and already
 * carry that site's own one-line copy in Strapi. Writing nxt.bargains prose
 * there would push it onto their pages too.
 *
 * Brand and retailer names below were taken from what each category actually
 * holds in the catalogue, so the copy stays true to the page it sits on. Keep
 * it that way when editing: if a brand leaves the catalogue, it should leave
 * the paragraph.
 */

type CategoryCopy = string[];

const CATEGORY_DESCRIPTIONS: Record<string, CategoryCopy> = {
  'smart-phones': [
    'Smartphones are the most heavily discounted category in consumer electronics, and also the hardest to price honestly — the same handset can carry four different prices depending on storage, colour, carrier lock and whether a retailer is clearing last year’s model. This page puts those listings side by side so the real price is visible before you commit.',
    'The catalogue covers Samsung Galaxy, Google Pixel, Apple iPhone, OnePlus, Nothing and Motorola handsets, with offers drawn from eBay, Walmart, Best Buy, Newegg and the Google Store. Filter by brand to stay inside an ecosystem, or by price band if the budget is fixed and the model is not.',
    'Two things are worth checking before you buy. Storage tiers are where margins hide, so confirm the capacity in the listing title matches the one you priced. And an unlocked handset is usually the cheaper long-run purchase even when a carrier-locked version looks better on the sticker.',
  ],
  tablets: [
    'Tablets sit in an awkward gap between phone and laptop, which makes them unusually easy to overbuy. The spread between a mid-range model and a top-tier one is large, and for reading, streaming and light browsing the cheaper tier is often indistinguishable in daily use.',
    'This category tracks Apple iPad and Samsung Galaxy Tab models, with current offers from Walmart, eBay, Newegg, Best Buy and Apple. Sorting by price low to high is the quickest way to see where each generation actually lands once retailer discounts are applied.',
    'Decide first whether you need a keyboard and stylus, because those accessories often cost more than the gap between two tablet tiers. If the answer is yes and the work is real work, price a laptop in the same session before deciding.',
  ],
  laptops: [
    'Laptop pricing moves faster than almost anything else on this site. Configurations are refreshed constantly, retailers discount aggressively around new releases, and the same model number can appear with different memory and storage at prices hundreds of dollars apart.',
    'The catalogue covers Apple, Dell, Lenovo, HP and Asus machines, compared across Walmart, eBay, Newegg, Best Buy and Adorama. Use the brand filter to narrow to a platform, then check the specifications on the product page before comparing — two listings with the same name are frequently not the same machine.',
    'Memory and storage are the specifications worth paying for, because neither can be upgraded on most modern laptops. Processor generation matters less than the marketing suggests for everyday work, and last year’s chip is usually where the value is.',
  ],
  smartwatches: [
    'A smartwatch is the rare device where the ecosystem matters more than the specification sheet. A watch that pairs poorly with your phone will be a worse daily experience than a cheaper one that pairs well, regardless of what the feature list promises.',
    'This category covers Garmin, Samsung, Apple, Google, Amazfit and OnePlus, with prices compared across Walmart, eBay, Best Buy, Newegg and Target. Garmin dominates the endurance and multisport end of the catalogue; Apple and Samsung sit closer to the general-purpose end.',
    'Check case size before ordering, since most model families ship in two and the listing title is the only place it appears. Battery life is the other honest differentiator — the gap between a multi-day watch and a daily-charge one is the difference most owners actually notice.',
  ],
  'smart-tvs': [
    'Television pricing is seasonal and severe. The same panel can swing hundreds of dollars between launch, mid-year and clearance, so the useful question is rarely which TV is best but which good TV is currently cheap.',
    'The catalogue tracks Samsung, LG and Sony sets, with offers from Walmart, Best Buy, Newegg, eBay and Samsung directly. Panel technology, refresh rate and resolution are all listed on the product pages, which is where the meaningful comparisons happen.',
    'Panel type does more for picture quality than any other single specification, and it is the one thing you cannot change later. Screen size is worth deciding by viewing distance rather than by budget, because an oversized panel in a small room is a compromise you will notice every day.',
  ],
  headphones: [
    'Headphones are bought on sound and kept on comfort. Reviews concentrate on the first because it is easier to describe, but fit and clamping force are what determine whether a pair gets used after the first month.',
    'This category covers Sony, Apple and Bose, compared across Best Buy, Walmart, Adorama, Macy’s and Newegg. These three brands sit at the top of most noise-cancelling comparisons, so the choice usually comes down to price and fit rather than capability.',
    'Noise cancelling is the feature most worth paying for if you commute or work in a shared space, and the least worth paying for if you do not. Check whether a listing is for the current generation — previous-generation flagships are frequently the better purchase once discounted.',
  ],
  'smart-cameras': [
    'A home camera is a long-term commitment to whoever makes it. The hardware is the smaller part of the decision; the app, the storage model and the subscription terms are what you actually live with.',
    'The catalogue covers Ring, eufy, Google and eufyCam, with prices compared across eBay, Newegg, Best Buy, Walmart and eufy directly. Specifications including field of view, night vision and audio support are surfaced on each product page.',
    'The important question is where footage is stored. Local storage on a card avoids a recurring fee, cloud storage usually does not, and the difference over a few years frequently exceeds the price of the camera. Check power too — wired and battery models suit very different mounting positions.',
  ],
  'video-doorbells': [
    'A video doorbell is the most-used smart home device in most households, which makes reliability worth more than features. A doorbell that misses events or lags on the live view fails at the only job it has.',
    'This category covers Ring, eufy and Google, compared across Best Buy, eufy, Newegg, eBay and Walmart. Product pages list resolution, field of view and whether the model supports existing doorbell wiring.',
    'Wiring decides most of this purchase. A wired doorbell replacing existing chimes never needs charging; a battery model can go anywhere but comes down periodically. As with cameras, confirm whether recorded clips need a subscription before you buy.',
  ],
  'smart-door-locks': [
    'Smart locks are the one smart home category where a failure locks you out of your own house, so the mechanical side of the product matters as much as the connected side.',
    'The catalogue covers Aqara, Yale and Schlage, with offers from Best Buy, Walmart, eBay, Newegg and Lowe’s. Product pages list connectivity and assistant support, both of which vary considerably across this category.',
    'Check that the lock fits your door before anything else — backset, thickness and existing hardware all constrain the choice, and a lock that does not fit is a return rather than a compromise. A physical key override or keypad backup is worth insisting on.',
  ],
  'smart-light-bulbs': [
    'Smart lighting is the cheapest way into a connected home and the easiest to get wrong, because bulbs are bought individually but experienced as a system. Mixing brands across one room usually means running two apps to control one space.',
    'This category covers Govee and Philips, compared across Walmart, eBay, Best Buy and Newegg. Product pages list connectivity and assistant support, which determine whether bulbs will answer to the hub or voice assistant you already run.',
    'Decide between hub-based and direct wi-fi bulbs before buying the first one, since that choice is difficult to reverse cheaply. Check the fitting and whether the bulb is dimmable on the circuit you intend to use, as a smart bulb on a dimmer switch often behaves poorly.',
  ],
  'smart-plugs': [
    'Smart plugs are the least glamorous smart home purchase and frequently the most useful, turning existing lamps, fans and heaters into scheduled devices for very little money.',
    'The catalogue covers Amazon and TP-Link, with offers from eBay, Poshmark and Newegg. Assistant support is listed on each product page, which is the specification that matters most for a device with no interface of its own.',
    'Check the rated load before using a plug with anything that heats, since space heaters and kettles exceed what many plugs are rated to carry. Physical size matters too — a bulky plug can block the second socket on a double outlet.',
  ],
  'smart-speakers': [
    'A smart speaker is chosen twice: once as a speaker and once as an assistant. The two rarely rank in the same order, and which matters more depends entirely on whether the device ends up in a kitchen or a living room.',
    'This category covers Amazon, Sonos and Google, compared across Best Buy, eBay, Walmart, the Google Store and Sonos directly. Sonos sits at the audio-first end of the catalogue; Amazon and Google compete on assistant capability and price.',
    'Pick the assistant that matches the rest of your home, because mixing them means duplicated routines and devices that cannot talk to each other. If the speaker will carry music rather than timers and weather, judge it on sound and treat the assistant as a bonus.',
  ],
  'raspberry-pi': [
    'The Raspberry Pi is priced unlike anything else in this catalogue. Board prices are low and stable, but availability has historically been the constraint, and retailer stock rather than headline price is often what decides the purchase.',
    'This category tracks Raspberry Pi boards and related hardware across Newegg, eBay and Best Buy. Because listings vary between bare boards, kits and bundles, the product pages are worth reading closely before comparing prices.',
    'A bare board is rarely the whole cost. Power supply, storage card, case and cooling are all effectively required, and a kit that looks more expensive is frequently cheaper once those are added. Compare on the total rather than the board alone.',
  ],
  'smart-home-devices': [
    'This is the broad category for connected hardware that does not fit neatly into lighting, security or audio — hubs, sensors, plugs, displays and the accessories that hold a smart home together.',
    'The catalogue covers Ring, Amazon, eufy, Google, Govee and Philips, with prices compared across eBay, Best Buy, Walmart, Newegg and eufy directly. Assistant support is listed on each product page and is usually the deciding specification.',
    'Compatibility is the thing to check first. A device that does not speak to the hub or assistant you already run will either need a second app or sit unused, and that constraint matters more than the price difference between two comparable models.',
  ],
  'smart-home-security': [
    'Home security hardware is sold on fear and bought on habit. The systems that work are the ones people keep armed, which usually means the ones that are least annoying to live with rather than the ones with the longest feature list.',
    'The catalogue covers Ring, eufy, Google, Aqara, Yale and Schlage, compared across Best Buy, eBay, Newegg, Walmart and eufy directly. It spans cameras, locks, sensors and full kits, so the product pages are where the meaningful specification differences appear.',
    'Look closely at what requires a subscription. Recording, smart alerts and professional monitoring are commonly separated across tiers, and the recurring cost over a few years often exceeds the hardware. Local storage options are worth seeking out for that reason.',
  ],
  'smart-home-automation': [
    'Automation is where a collection of smart devices becomes a smart home. It is also where incompatibility becomes obvious, because a routine can only span devices that share a platform.',
    'This category covers Govee, Philips, Amazon and TP-Link, with offers from eBay, Walmart, Best Buy, Newegg and Poshmark. Assistant support and connectivity are listed on each product page and determine what can be automated together.',
    'Choose a platform before you choose products. Committing to one assistant or hub early makes every later purchase simpler, whereas assembling devices first and trying to unify them afterwards usually means running several apps permanently.',
  ],
  'smart-home-entertainment': [
    'Connected entertainment hardware — speakers, streamers and the devices that route audio and video around a home — is judged on how well it disappears into a room rather than on specifications.',
    'The catalogue covers Amazon, Sonos and Google, compared across Best Buy, eBay, Walmart, the Google Store and Sonos directly. Supported services and assistant compatibility are listed on the product pages.',
    'Multi-room audio is where platform lock-in bites hardest, because speakers from different makers generally will not group together. If more rooms are likely later, that first speaker is effectively choosing the system for all of them.',
  ],
};

/** Fallback for a category with no written copy yet. Rendered as one paragraph. */
function genericDescription(name: string): CategoryCopy {
  const lower = name.toLowerCase();
  return [
    `This page collects the ${lower} in the NXT.Bargains catalogue and puts current retailer prices side by side, so the cheapest available offer is visible without opening a tab for every store.`,
    `Each product page carries the full specification set imported for that item, along with every merchant offer currently on record. Use the filters to narrow by brand, store, availability, condition or price band.`,
    `Prices and availability change frequently and are refreshed on a schedule rather than live, so treat the figures here as a guide and confirm the final price, shipping and condition at the retailer before buying.`,
  ];
}

function categoryDescriptionCopy(category: { name: string; slug: string }): CategoryCopy {
  return CATEGORY_DESCRIPTIONS[category.slug] ?? genericDescription(category.name);
}

function firstSentences(text: string, limit = 3): string {
  const sentences = text
    .replace(/\s+/g, ' ')
    .trim()
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  return sentences.slice(0, limit).join(' ').replace(/\s+/g, ' ').trim();
}

/** Single-paragraph category page introduction, capped at three sentences. */
export function categoryDescriptionParagraph(category: { name: string; slug: string }): string {
  return firstSentences(categoryDescriptionCopy(category).join(' '));
}

/** Single-paragraph form, for meta descriptions and structured data. */
export function categoryDescriptionSummary(category: { name: string; slug: string }): string {
  return categoryDescriptionParagraph(category);
}
