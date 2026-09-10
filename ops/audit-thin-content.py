#!/usr/bin/env python3
"""Find pages whose unique body content is too thin to rank.

Measures what a search engine would count as *this page's* content, which is
not the same as the page's word count. Every page here carries a header, a
filter sidebar, a footer and a coupon rail — well over a thousand words of
identical furniture — so a naive count makes the emptiest product page look
substantial. Two things guard against that:

  Only <main> is read, and nav/header/footer/script/style/svg are dropped
  from it.

  Any text block appearing on more than 40% of pages is treated as
  boilerplate and subtracted. That is what catches the sidebar and the
  coupon rail, which sit inside <main> on the category and product templates.

Served from 127.0.0.1:3008 with a Host header rather than over the public
name: same markup, no CDN in the way, and it does not put 438 requests
through nginx.

  python3 ops/audit-thin-content.py
  python3 ops/audit-thin-content.py --limit 40 --json out.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

ORIGIN = "http://127.0.0.1:3008"
HOST = "nxt.bargains"
SITEMAP = "/tmp/claude-0/-opt/f1829e77-629e-480f-bca7-6e7a711eadb9/scratchpad/sitemap.xml"

# Below this many unique words a page has little chance of ranking for anything
# competitive; below the second it is effectively an empty template.
THIN = 300
VERY_THIN = 120


def fetch(url: str) -> tuple[str, int, str]:
    path = url.replace(f"https://{HOST}", "") or "/"
    try:
        req = Request(ORIGIN + path, headers={"Host": HOST, "User-Agent": "nxt-content-audit"})
        with urlopen(req, timeout=90) as res:
            return path, res.status, res.read().decode("utf-8", "replace")
    except Exception as error:                      # noqa: BLE001 - reported, not raised
        return path, 0, f"__ERROR__{error}"


def extract(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")

    title = (soup.title.string or "").strip() if soup.title else ""
    desc_tag = soup.find("meta", attrs={"name": "description"})
    description = (desc_tag.get("content") or "").strip() if desc_tag else ""
    h1 = [h.get_text(" ", strip=True) for h in soup.find_all("h1")]
    headings = len(soup.find_all(["h2", "h3"]))

    main = soup.find("main") or soup.body or soup
    for tag in main.find_all(["script", "style", "nav", "header", "footer", "svg", "noscript", "form"]):
        tag.decompose()

    # Blocks, not one flat string: boilerplate is removed block by block below.
    blocks = [re.sub(r"\s+", " ", t.get_text(" ", strip=True))
              for t in main.find_all(["p", "li", "h1", "h2", "h3", "h4", "span", "div"], recursive=True)
              if t.find(["p", "li", "h1", "h2", "h3", "h4", "span", "div"]) is None]
    blocks = [b for b in blocks if len(b) > 2]

    return {
        "title": title,
        "description": description,
        "h1": h1,
        "headings": headings,
        "blocks": blocks,
        "images": len(main.find_all("img")),
        "links": len(main.find_all("a")),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="audit only the first N urls")
    parser.add_argument("--json", help="write the full result set here")
    args = parser.parse_args()

    urls = re.findall(r"<loc>([^<]+)</loc>", open(SITEMAP).read())
    if args.limit:
        urls = urls[: args.limit]
    print(f"auditing {len(urls)} urls", file=sys.stderr)

    with ThreadPoolExecutor(max_workers=8) as pool:
        fetched = list(pool.map(fetch, urls))

    pages, failures = {}, []
    for path, status, body in fetched:
        if status != 200:
            failures.append((path, status, body[:90]))
            continue
        pages[path] = extract(body)

    # A block on >40% of pages is furniture, not content.
    seen = Counter()
    for data in pages.values():
        seen.update(set(data["blocks"]))
    cutoff = max(2, int(len(pages) * 0.4))
    boilerplate = {block for block, count in seen.items() if count >= cutoff}
    print(f"identified {len(boilerplate)} boilerplate blocks (on >={cutoff} of {len(pages)} pages)", file=sys.stderr)

    rows = []
    for path, data in pages.items():
        unique = [b for b in data["blocks"] if b not in boilerplate]
        words = sum(len(b.split()) for b in unique)
        rows.append({
            "path": path,
            "words": words,
            "raw_words": sum(len(b.split()) for b in data["blocks"]),
            "title": data["title"],
            "title_len": len(data["title"]),
            "description": data["description"],
            "desc_len": len(data["description"]),
            "h1_count": len(data["h1"]),
            "subheadings": data["headings"],
            "images": data["images"],
            "links": data["links"],
        })

    rows.sort(key=lambda r: r["words"])
    if args.json:
        json.dump({"pages": rows, "failures": failures}, open(args.json, "w"), indent=1)

    def group(path: str) -> str:
        parts = [p for p in path.split("/") if p]
        return "/" + (parts[0] if parts else "(home)")

    print(f"\n{'='*96}\nTHIN CONTENT AUDIT — {len(rows)} pages\n{'='*96}")
    very = [r for r in rows if r["words"] < VERY_THIN]
    thin = [r for r in rows if VERY_THIN <= r["words"] < THIN]
    print(f"  very thin (<{VERY_THIN} unique words): {len(very)}")
    print(f"  thin ({VERY_THIN}-{THIN}):              {len(thin)}")
    print(f"  ok (>={THIN}):                     {len(rows)-len(very)-len(thin)}")

    by_group = {}
    for row in rows:
        by_group.setdefault(group(row["path"]), []).append(row["words"])
    print(f"\n{'section':<26}{'pages':>6}{'median':>8}{'min':>7}{'max':>7}{'<300':>7}")
    for name, values in sorted(by_group.items(), key=lambda kv: sorted(kv[1])[len(kv[1]) // 2]):
        values.sort()
        median = values[len(values) // 2]
        print(f"{name:<26}{len(values):>6}{median:>8}{values[0]:>7}{values[-1]:>7}{sum(1 for v in values if v < THIN):>7}")

    print(f"\n{'-'*96}\n60 THINNEST PAGES\n{'-'*96}")
    print(f"{'words':>6} {'imgs':>5} {'h2/3':>5}  {'desc':>5}  path")
    for row in rows[:60]:
        print(f"{row['words']:>6} {row['images']:>5} {row['subheadings']:>5}  {row['desc_len']:>5}  {row['path']}")

    missing_desc = [r for r in rows if r["desc_len"] == 0]
    bad_h1 = [r for r in rows if r["h1_count"] != 1]
    dupe_titles = [(t, c) for t, c in Counter(r["title"] for r in rows).items() if c > 1]
    dupe_desc = [(d, c) for d, c in Counter(r["description"] for r in rows if r["description"]).items() if c > 1]

    print(f"\n{'-'*96}\nMETADATA\n{'-'*96}")
    print(f"  missing meta description : {len(missing_desc)}")
    print(f"  not exactly one <h1>     : {len(bad_h1)}")
    print(f"  duplicate titles         : {len(dupe_titles)} groups covering {sum(c for _, c in dupe_titles)} pages")
    print(f"  duplicate descriptions   : {len(dupe_desc)} groups covering {sum(c for _, c in dupe_desc)} pages")
    for title, count in sorted(dupe_titles, key=lambda kv: -kv[1])[:8]:
        print(f"      {count:>3}x  {title[:78]}")
    if failures:
        print(f"\n  FAILED TO FETCH: {len(failures)}")
        for path, status, err in failures[:10]:
            print(f"      {status}  {path}  {err}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
