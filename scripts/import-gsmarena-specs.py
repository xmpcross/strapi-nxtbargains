#!/usr/bin/env python3
"""Import product specifications from a filled workbook into Strapi commerce-products.

    python3 scripts/import-gsmarena-specs.py --dry     # report only, no writes
    python3 scripts/import-gsmarena-specs.py           # write to Strapi
    python3 scripts/import-gsmarena-specs.py --slug samsung-galaxy-s25-fe-256gb
    python3 scripts/import-gsmarena-specs.py --brand Garmin --brand Amazfit

Input is the "Products" sheet of a workbook whose spec columns hold a flattened
spec table as text:

    [Body]
    Dimensions: 160.6 x 75.6 x 9 mm
    : IP68 rating (1.5m/30 min)

Two columns can carry that table, and they are written to two different keys
because they are two different sources:

  `gsmarena_specifications`  → `specs.gsmarena`      (source: GSMArena)
  `fallback_specifications`  → `specs.manufacturer`  (source: per `fallback_source`,
                                                      e.g. Garmin's or Amazfit's
                                                      own product page)

GSMArena has no device page for most Garmin/Amazfit watches, so those rows say
NOT FOUND ON GSMARENA in the GSMArena column and carry the manufacturer's specs
in the fallback column instead. Keeping them apart is the point: the workbook
stamps every fallback table `[Source: … — NOT GSMArena]`, and filing it under
`specs.gsmarena` would record a provenance the data itself denies.

Both go in the shape `app/products/[slug]/page.tsx` renders
(`structuredSpecificationGroups`):

    { "manufacturer": { "source": "Garmin", "sourceUrl": …, "specifications": [
        { "category": "Body", "specifications": [ { "name": …, "value": … } ] } ] } }

Why Python and not another .mjs like its neighbours: those scripts poll
affiliate HTTP feeds on a cron, this one reads a spreadsheet once. openpyxl is
already on the box; a Node xlsx reader would be a new dependency for a
one-shot job.

A row with neither a real GSMArena table nor a fallback is skipped, not written
with its placeholder text — that would render as a real spec panel.

The write merges: existing `specs` keys (the dataforseo-product-info fields)
are preserved and only the target key is replaced.

Env (.env.local): STRAPI_INTERNAL_URL or NEXT_PUBLIC_STRAPI_URL, plus
STRAPI_WRITE_TOKEN if set, else STRAPI_API_TOKEN.
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_WORKBOOK = "/opt/assets/nxt-bargains-gsmarena-phones-watches-FILLED.xlsx"
SHEET = "Products"
NOT_FOUND_MARKER = "NOT FOUND ON GSMARENA"


def load_env():
    env_file = ROOT / ".env.local"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        m = re.match(r"^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$", line)
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2)


def parse_source(fallback_source):
    """Split `Garmin: https://www.garmin.com/en-US/p/1611937/` into name and URL."""
    text = (fallback_source or "").strip()
    if not text:
        return "", ""
    name, sep, url = text.partition(": ")
    if sep and url.strip().startswith("http"):
        return name.strip(), url.strip()
    return ("", text) if text.startswith("http") else (text, "")


def parse_specifications(blob, category_name):
    """Turn the flattened `[Group]` / `key: value` text into Strapi spec groups.

    Lines that open with a bare colon are GSMArena's unnamed continuation rows
    (an IP rating under Body, the storage type under Memory). The renderer drops
    any entry without a label, so they are labelled with their group name rather
    than a made-up attribute name — it keeps the fact and invents nothing.

    A `[Source: …]` banner heads every fallback table. It names the provenance,
    which is carried in the metadata instead, so it never becomes a spec group —
    it has no rows under it and drops out with the other empty groups.
    """
    groups = []
    current = None
    for raw in blob.splitlines():
        line = raw.strip()
        if not line:
            continue
        heading = re.match(r"^\[(.+)\]$", line)
        if heading:
            current = {"category": heading.group(1).strip(), "specifications": []}
            groups.append(current)
            continue
        if current is None or ":" not in line:
            continue
        name, _, value = line.partition(":")
        name = name.strip() or current["category"]
        value = re.sub(r"\s+", " ", value).strip()
        if value:
            current["specifications"].append({"name": name, "value": value})
    return [g for g in groups if g["specifications"]]


def read_rows(workbook_path):
    wb = openpyxl.load_workbook(workbook_path, read_only=True, data_only=True)
    rows = wb[SHEET].iter_rows(values_only=True)
    header = [str(c).strip() if c else "" for c in next(rows)]
    idx = {name: i for i, name in enumerate(header)}
    required = ["slug", "brand", "category", "gsmarena_title", "gsmarena_url", "gsmarena_specifications"]
    missing = [c for c in required if c not in idx]
    if missing:
        sys.exit(f"{workbook_path}: '{SHEET}' sheet is missing column(s): {', '.join(missing)}")
    out = []
    for row in rows:
        if not row or not row[idx["slug"]]:
            continue
        out.append({key: row[i] for key, i in idx.items()})
    wb.close()
    return out


class Strapi:
    def __init__(self, base, token, timeout=60):
        self.base = base.rstrip("/")
        self.token = token
        self.timeout = timeout

    def _request(self, method, path, payload=None):
        url = f"{self.base}/api/{path}"
        body = json.dumps(payload).encode() if payload is not None else None
        req = urllib.request.Request(url, data=body, method=method)
        req.add_header("Authorization", f"Bearer {self.token}")
        req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as res:
                return json.load(res)
        except urllib.error.HTTPError as err:
            detail = err.read().decode(errors="replace")[:400]
            raise SystemExit(f"Strapi {err.code} on {method} {url}: {detail}")

    def get_product(self, slug):
        query = urllib.parse.urlencode(
            {"filters[slug][$eq]": slug, "fields[0]": "slug", "fields[1]": "name", "fields[2]": "specs"}
        )
        data = self._request("GET", f"commerce-products?{query}").get("data") or []
        return data[0] if data else None

    def update_specs(self, document_id, specs):
        return self._request("PUT", f"commerce-products/{document_id}", {"data": {"specs": specs}})


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--workbook", default=DEFAULT_WORKBOOK, help=f"xlsx to import (default: {DEFAULT_WORKBOOK})")
    ap.add_argument("--dry", action="store_true", help="report what would change, write nothing")
    ap.add_argument("--slug", action="append", help="only this slug (repeatable)")
    ap.add_argument("--brand", action="append", help="only this brand, case-insensitive (repeatable)")
    ap.add_argument("--limit", type=int, help="stop after N products")
    ap.add_argument("--force", action="store_true", help="overwrite a specs.gsmarena that is already populated")
    ap.add_argument("--report", help="write a JSON report of the run to this path")
    args = ap.parse_args()

    load_env()
    base = os.environ.get("STRAPI_INTERNAL_URL") or os.environ.get("NEXT_PUBLIC_STRAPI_URL")
    token = os.environ.get("STRAPI_WRITE_TOKEN") or os.environ.get("STRAPI_API_TOKEN")
    if not base or not token:
        sys.exit("Set STRAPI_INTERNAL_URL/NEXT_PUBLIC_STRAPI_URL and STRAPI_API_TOKEN in .env.local")
    strapi = Strapi(base, token)
    extracted_at = date.today().isoformat()

    rows = read_rows(args.workbook)
    if args.slug:
        wanted = set(args.slug)
        rows = [r for r in rows if r["slug"] in wanted]
        for slug in sorted(wanted - {r["slug"] for r in rows}):
            print(f"  ?  {slug}: not in the workbook")
    if args.brand:
        brands = {b.strip().lower() for b in args.brand}
        rows = [r for r in rows if (r.get("brand") or "").strip().lower() in brands]

    report = {"updated": [], "skipped_not_found": [], "skipped_existing": [], "missing_in_strapi": [], "unchanged": []}
    print(f"{'DRY RUN — ' if args.dry else ''}{len(rows)} row(s) from {args.workbook} → {base}\n")

    for row in rows:
        slug = row["slug"]
        gsmarena_blob = row.get("gsmarena_specifications") or ""
        fallback_blob = row.get("fallback_specifications") or ""
        if args.limit and len(report["updated"]) >= args.limit:
            break

        # GSMArena first: it is the consistent source across the catalogue, and
        # the fallback column is only filled where GSMArena has no page at all.
        if NOT_FOUND_MARKER not in gsmarena_blob and parse_specifications(gsmarena_blob, row.get("category")):
            key = "gsmarena"
            groups = parse_specifications(gsmarena_blob, row.get("category"))
            title = (row.get("gsmarena_title") or "").strip()
            url = (row.get("gsmarena_url") or "").strip()
            meta = {
                "url": url,
                "source": "GSMArena",
                "sourceUrl": url,
                "cleanModel": title,
                "sourceTitle": title,
                "sourceImage": "",
                "matchStatus": "matched",
                "matchConfidence": "manual",
            }
        elif parse_specifications(fallback_blob, row.get("category")):
            key = "manufacturer"
            groups = parse_specifications(fallback_blob, row.get("category"))
            source_name, url = parse_source(row.get("fallback_source"))
            meta = {
                "url": url,
                "source": source_name or (row.get("brand") or "").strip(),
                "sourceUrl": url,
                "sourceTitle": (row.get("original_title") or "").strip(),
                "matchStatus": "matched",
                "matchConfidence": "manual",
            }
        else:
            report["skipped_not_found"].append(slug)
            print(f"  –  {slug}: no specifications in either column, skipped")
            continue

        product = strapi.get_product(slug)
        if not product:
            report["missing_in_strapi"].append(slug)
            print(f"  !  {slug}: no commerce-product with this slug")
            continue

        specs = product.get("specs")
        specs = dict(specs) if isinstance(specs, dict) else {}
        if isinstance(specs.get(key), dict) and specs[key].get("specifications") and not args.force:
            report["skipped_existing"].append(slug)
            print(f"  =  {slug}: already has specs.{key}, left alone (--force to replace)")
            continue

        specs[key] = {**meta, "extractedAt": extracted_at, "specifications": groups}

        rows_count = sum(len(g["specifications"]) for g in groups)
        if not args.dry:
            strapi.update_specs(product["documentId"], specs)
        report["updated"].append(
            {"slug": slug, "key": key, "source": meta["source"], "groups": len(groups), "rows": rows_count, "url": meta["url"]}
        )
        print(f"  {'·' if args.dry else '✓'}  {slug}: {len(groups)} group(s), {rows_count} rows → specs.{key} ({meta['source']})")

    print(
        f"\n{'Would update' if args.dry else 'Updated'}: {len(report['updated'])}"
        f" · no specifications: {len(report['skipped_not_found'])}"
        f" · already populated: {len(report['skipped_existing'])}"
        f" · not in Strapi: {len(report['missing_in_strapi'])}"
    )
    if args.report:
        report["ranAt"] = datetime.now(timezone.utc).isoformat()
        report["dryRun"] = args.dry
        Path(args.report).write_text(json.dumps(report, indent=2))
        print(f"Report: {args.report}")


if __name__ == "__main__":
    main()
