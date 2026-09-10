#!/usr/bin/env python3
"""Audit the site against what AdSense actually means by "low value content".

Word count is not the criterion that rejected this site. For an affiliate
catalogue the relevant policy is Google's "thin affiliate" test: pages that
republish merchant data — price, image, title, a buy button — without adding
something a shopper could not get from the merchant. A 2,000-word product page
that is 90% identical to 270 others still fails it.

So this measures template similarity rather than length. Every product page is
reduced to its unique text (boilerplate blocks shared by >40% of pages are
subtracted first), converted to 5-word shingles, and compared pairwise by
Jaccard overlap. A catalogue where the median pair shares most of its shingles
is one generator's output wearing 271 URLs.

It also checks the things AdSense reviewers open by hand: the policy pages,
whether product pages carry anything original, and what is left that is thin.

  python3 ops/audit-adsense.py --json out.json
"""
from __future__ import annotations

import argparse
import json
import random
import re
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from itertools import combinations
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

ORIGIN, HOST = "http://127.0.0.1:3008", "nxt.bargains"
SITEMAP = "/tmp/claude-0/-opt/f1829e77-629e-480f-bca7-6e7a711eadb9/scratchpad/sitemap3.xml"

PRODUCT_CATS = {
    "smart-phones", "smartwatches", "tablets", "laptops", "smart-tvs",
    "smart-cameras", "smart-speakers", "smart-light-bulbs", "smart-door-locks",
    "smart-plugs", "smart-doorbells", "headphones", "raspberry-pi",
}
EDITORIAL_CATS = {
    "how-to-guides", "product-reviews", "product-comparisons", "product-roundups",
    "buying-guides", "best-sellers-articles", "top-rated-smart-electronics-devices",
    "nxt-bargains-informative-articles", "smart-home",
}


def fetch(path: str):
    try:
        req = Request(ORIGIN + path, headers={"Host": HOST, "User-Agent": "nxt-adsense-audit"})
        with urlopen(req, timeout=90) as res:
            return path, res.status, res.read().decode("utf-8", "replace")
    except Exception as error:                       # noqa: BLE001
        return path, 0, f"__ERROR__{error}"


def blocks_of(html: str):
    soup = BeautifulSoup(html, "html.parser")
    main = soup.find("main") or soup.body or soup
    for tag in main.find_all(["script", "style", "nav", "header", "footer", "svg", "noscript", "form"]):
        tag.decompose()
    out = []
    for tag in main.find_all(["p", "li", "h1", "h2", "h3", "h4", "td", "span", "div"], recursive=True):
        if tag.find(["p", "li", "h1", "h2", "h3", "h4", "td", "span", "div"]) is None:
            text = re.sub(r"\s+", " ", tag.get_text(" ", strip=True))
            if len(text) > 2:
                out.append(text)
    return out, soup


def shingles(text: str, n: int = 5):
    words = re.findall(r"[a-z0-9]+", text.lower())
    return {" ".join(words[i:i + n]) for i in range(max(0, len(words) - n + 1))}


def kind(path: str) -> str:
    parts = [p for p in path.split("/") if p]
    if not parts:
        return "home"
    if len(parts) == 2 and parts[0] in PRODUCT_CATS:
        return "product"
    if len(parts) == 2 and parts[0] in EDITORIAL_CATS:
        return "editorial"
    if parts[0] == "coupons":
        return "coupon"
    if parts[0] == "category":
        return "category"
    return "static"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json")
    args = ap.parse_args()

    urls = [u.replace(f"https://{HOST}", "") or "/"
            for u in re.findall(r"<loc>([^<]+)</loc>", open(SITEMAP).read())]
    print(f"fetching {len(urls)} urls", file=sys.stderr)
    with ThreadPoolExecutor(max_workers=8) as pool:
        fetched = list(pool.map(fetch, urls))

    pages, failed = {}, []
    for path, status, body in fetched:
        (pages.__setitem__(path, body) if status == 200 else failed.append((path, status)))

    parsed = {p: blocks_of(h) for p, h in pages.items()}
    seen = Counter()
    for blocks, _ in parsed.values():
        seen.update(set(blocks))
    cutoff = max(2, int(len(parsed) * 0.4))
    boiler = {b for b, c in seen.items() if c >= cutoff}

    unique_text, meta = {}, {}
    for path, (blocks, soup) in parsed.items():
        uniq = [b for b in blocks if b not in boiler]
        unique_text[path] = " ".join(uniq)
        meta[path] = {
            "kind": kind(path),
            "words": sum(len(b.split()) for b in uniq),
            "title": (soup.title.string or "").strip() if soup.title else "",
        }

    products = [p for p in unique_text if meta[p]["kind"] == "product"]
    editorial = [p for p in unique_text if meta[p]["kind"] == "editorial"]

    # Pairwise similarity on a sample — 271 pages is 36,585 pairs, more than is
    # needed to characterise the distribution.
    random.seed(7)
    sample = random.sample(products, min(60, len(products)))
    sh = {p: shingles(unique_text[p]) for p in sample}
    sims = []
    for a, b in combinations(sample, 2):
        sa, sb = sh[a], sh[b]
        if not sa or not sb:
            continue
        sims.append(len(sa & sb) / len(sa | sb))
    sims.sort()

    def pct(xs, q):
        return xs[int(len(xs) * q)] if xs else 0.0

    print("\n" + "=" * 78)
    print("ADSENSE / LOW-VALUE-CONTENT AUDIT")
    print("=" * 78)
    print(f"  pages fetched            : {len(pages)}   failed: {len(failed)}")
    print(f"  boilerplate blocks removed: {len(boiler)}")

    counts = Counter(m["kind"] for m in meta.values())
    total = sum(counts.values())
    print("\nPAGE MIX (affiliate-vs-editorial balance is the first thing a reviewer sees)")
    for k, v in counts.most_common():
        print(f"   {v:>4}  {v*100//total:>3}%  {k}")

    print("\nPRODUCT-PAGE TEMPLATE SIMILARITY (Jaccard on 5-word shingles)")
    print(f"   pairs compared : {len(sims)} (from a {len(sample)}-page sample)")
    print(f"   median overlap : {pct(sims,0.50)*100:.1f}%")
    print(f"   75th pct       : {pct(sims,0.75)*100:.1f}%")
    print(f"   90th pct       : {pct(sims,0.90)*100:.1f}%")
    print(f"   max            : {(sims[-1] if sims else 0)*100:.1f}%")
    near = sum(1 for s in sims if s > 0.60)
    print(f"   pairs >60% identical: {near} ({near*100//max(1,len(sims))}%)")

    for label, group in (("product", products), ("editorial", editorial)):
        ws = sorted(meta[p]["words"] for p in group)
        if ws:
            print(f"\n{label.upper()} unique words: median {ws[len(ws)//2]}, min {ws[0]}, max {ws[-1]}")

    print("\nPOLICY PAGES A REVIEWER CHECKS BY HAND")
    for path, label in [("/legal/privacy", "Privacy policy"), ("/legal/terms", "Terms"),
                        ("/legal/cookies", "Cookie policy"), ("/about", "About"),
                        ("/contact", "Contact")]:
        state = "present" if path in pages else "MISSING"
        words = meta.get(path, {}).get("words", 0)
        print(f"   {label:<16} {state:<8} {words:>5} words   {path}")

    thin = sorted(((meta[p]["words"], p) for p in unique_text if meta[p]["words"] < 300))
    print(f"\nSTILL UNDER 300 UNIQUE WORDS: {len(thin)}")
    for w, p in thin:
        print(f"   {w:>5}  {p}")

    if args.json:
        json.dump({
            "counts": dict(counts),
            "similarity": {"median": pct(sims, .5), "p75": pct(sims, .75), "p90": pct(sims, .9),
                           "max": sims[-1] if sims else 0, "pairs_over_60": near, "pairs": len(sims)},
            "meta": meta, "thin": thin, "failed": failed,
        }, open(args.json, "w"), indent=1)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
