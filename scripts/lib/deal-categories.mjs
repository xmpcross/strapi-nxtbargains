/**
 * Whether a deal belongs to one of the site's stated product categories.
 *
 * The retailer deals pages are general-merchandise feeds: Amazon's goldbox and
 * eBay's deals carry cowboy boots, earrings, patio furniture, Lego and t-shirts
 * alongside electronics. Publishing those on a consumer-electronics price
 * comparison site is the "site does not follow its stated topic" problem, and
 * it is the reason the deal sections read as an untargeted affiliate dump.
 *
 * An allowlist, not a denylist. The site's scope is thirteen named categories,
 * so anything that cannot be placed in one of them is out. A denylist would
 * mean enumerating every product category on Amazon, which is not a finite
 * task and fails open on whatever nobody thought of.
 *
 * Order matters throughout: the first rule that matches wins, so the more
 * specific pattern has to come first. "smart tv" is tested before "tablet"
 * because Fire TV tablets satisfy both, and headphones before smartphone
 * because "phone" is a substring of "headphone".
 */

/** The thirteen categories the site actually covers. */
export const DEAL_CATEGORY_RULES = [
  ['smart-tvs', /\b(smart ?tv|4k tv|oled tv|qled tv|mini[- ]?led tv|roku tv|google tv|fire tv stick|streaming stick|soundbar)\b/i],
  ['headphones', /\b(headphone|headset|earbud|earphone|airpod|in[- ]ear|over[- ]ear|noise[- ]cancelling|bone conduction)\b/i],
  ['smartwatches', /\b(smart ?watch|apple watch|galaxy watch|pixel watch|fitness tracker|fitbit|garmin (?:forerunner|venu|vivoactive|fenix)|smart band)\b/i],
  ['laptops', /\b(laptop|notebook computer|macbook|chromebook|ultrabook|thinkpad|ideapad|zenbook|vivobook)\b/i],
  ['tablets', /\b(tablet|ipad|galaxy tab|fire hd|fire 7)\b/i],
  ['smart-phones', /\b(smart ?phone|iphone|galaxy s\d|galaxy a\d|galaxy z (?:fold|flip)|pixel \d|unlocked phone|cell ?phone|moto g)\b/i],
  ['smart-cameras', /\b(security camera|surveillance camera|wifi camera|wi-fi camera|indoor camera|outdoor camera|baby monitor|dash ?cam|blink (?:mini|outdoor)|wyze cam|ring (?:stick up|indoor|spotlight|floodlight)|arlo|eufycam|trail camera)\b/i],
  ['smart-doorbells', /\b(doorbell|video doorbell)\b/i],
  ['smart-door-locks', /\b(smart lock|door lock|deadbolt|keyless entry|keypad lock|fingerprint lock)\b/i],
  ['smart-speakers', /\b(smart speaker|echo dot|echo show|echo studio|echo pop|homepod|nest (?:audio|mini|hub)|alexa speaker|google assistant speaker)\b/i],
  ['smart-light-bulbs', /\b(smart bulb|smart light|led bulb|light strip|lightstrip|hue bulb|smart lamp|govee)\b/i],
  ['smart-plugs', /\b(smart plug|smart outlet|smart power strip|wifi plug|wi-fi plug|smart switch)\b/i],
  ['raspberry-pi', /\b(raspberry pi|rasp ?pi|pi (?:zero|pico|400)|single[- ]board computer)\b/i],
];

/**
 * Titles that satisfy a category pattern while plainly not being the product.
 *
 * A case, a screen protector or a charging cable for a phone is not a phone,
 * and a feed filtered on keywords alone fills with $9 accessories because they
 * name the device they fit. This runs before the category rules for that
 * reason — a "Screen Protector for Apple Watch" would otherwise pass as a
 * smartwatch.
 */
const ACCESSORY = new RegExp(
  '\\b(' + [
    'case', 'cases', 'cover', 'skin', 'sleeve', 'pouch', 'holster',
    'screen protector', 'tempered glass', 'film',
    'charger', 'charging cable', 'usb cable', 'cable', 'adapter', 'dongle',
    'power bank', 'battery pack', 'wall plate',
    'mount', 'stand', 'holder', 'bracket', 'tripod', 'grip',
    'band', 'strap', 'wristband', 'watch band',
    'lens protector', 'cleaning kit', 'carrying bag',
    'replacement', 'spare part', 'refill',
    'gift card', 'subscription', 'warranty', 'antivirus', 'software licen[cs]e',
  ].join('|') + ')\\b', 'i');

/* "Bundle" and "kit" are deliberately absent: a Raspberry Pi starter kit and
   an Echo bundle are legitimate catalogue items, and excluding them would drop
   real products to catch a few accessories. */

/**
 * Adjacent consumer electronics — on-theme, but outside the thirteen.
 *
 * Filtering to the named categories alone left 27 deals out of 257, which
 * emptied two of the three homepage tabs. These are things a reader of an
 * electronics price-comparison site would expect to see and would not consider
 * off-topic: storage, networking, monitors, desktops, peripherals, projectors,
 * e-readers, streaming boxes, robot vacuums and the rest of the smart-home
 * shelf.
 *
 * They are a separate tier rather than extra entries in DEAL_CATEGORY_RULES so
 * the distinction stays legible: everything here is grouped under a generic
 * 'electronics' category and none of it claims to belong to one of the site's
 * own thirteen. Widen this list, not the one above.
 */
const ADJACENT_ELECTRONICS = new RegExp(
  '\\b(' + [
    'ssd', 'nvme', 'hard drive', 'external drive', 'flash drive', 'memory card', 'micro ?sd', 'usb stick',
    'ram|ddr[45]|memory module',
    'router', 'mesh wi-?fi', 'wi-?fi extender', 'range extender', 'network switch', 'modem', 'nas',
    'monitor', 'display port', 'ultrawide',
    'desktop pc', 'gaming pc', 'mini pc', 'all-in-one pc', 'workstation',
    'graphics card', 'gpu', 'rtx \\d', 'radeon', 'processor|cpu cooler|motherboard|pc case|power supply',
    'keyboard', 'mouse', 'trackpad', 'webcam', 'microphone', 'docking station',
    'projector', 'e-?reader', 'kindle', 'kobo',
    'streaming (?:device|box|player)', 'chromecast', 'apple tv',
    'robot vacuum', 'robotic vacuum',
    'thermostat', 'smart hub', 'smart sensor', 'motion sensor', 'water leak detector', 'smoke detector',
    'drone', 'action camera', 'gopro',
    'game console', 'playstation \\d', 'xbox series', 'nintendo switch',
    'printer', 'scanner',
    'power bank', 'portable charger',
  ].join('|') + ')\\b', 'i');

/**
 * The category a deal belongs to, or null when it is off-topic.
 *
 * Returns one of the site's own thirteen where it can, then 'electronics' for
 * the adjacent tier, then null.
 */
export function dealCategory(title) {
  const text = String(title || '');
  if (!text) return null;
  if (ACCESSORY.test(text)) return null;

  const named = DEAL_CATEGORY_RULES.find(([, pattern]) => pattern.test(text))?.[0];
  if (named) return named;

  return ADJACENT_ELECTRONICS.test(text) ? 'electronics' : null;
}

/** Convenience predicate for filtering a feed. */
export function isOnTopicDeal(title) {
  return dealCategory(title) !== null;
}
