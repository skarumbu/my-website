"""One-time backfill: import every architecture wiki page into history-api as
its initial version, before /architecture is cut over to fetch from history-api
at runtime.

For each key in src/architecture-pages.json it builds the *effective* page
(template-merged, reverse-links resolved) via scripts/arch_effective_page.py,
serializes it canonically, and POSTs it as version 1 of
``architecture::<key>``.

Idempotent — safe to re-run after a partial failure: a page that already exists
in history-api is skipped unless ``--force``. ``--dry-run`` builds and
size-checks every page and prints what it would POST, without contacting
history-api.

The size guard runs as a pre-pass over *all* pages: if any effective page
exceeds history-api's 32768-byte per-version cap the whole run aborts before a
single POST, rather than discovering it halfway through production.

Usage:
  HISTORY_API_URL=https://history-api-prod.azurewebsites.net/api \\
  HISTORY_WRITE_KEY=<machine write key> \\
  python scripts/backfill_arch_history.py [--dry-run] [--force]

Config (env):
  HISTORY_API_URL    base URL incl. /api  (not required for --dry-run)
  HISTORY_WRITE_KEY  X-History-Key machine write key  (not required for --dry-run)
"""

import argparse
import json
import os
import sys

import requests

from arch_effective_page import (
    build_effective_page,
    load_templates,
    to_canonical_json,
)

SECTION = "architecture"
MAX_CONTENT_BYTES = 32768  # history-api handlers/save_version.go: maxContentBytes
COMMIT_MESSAGE = "backfill: initial import"
_TIMEOUT = (5, 30)

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_OVERLAYS_PATH = os.path.join(_REPO_ROOT, "src", "architecture-pages.json")


def load_overlays(path=None):
    with open(path or _OVERLAYS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def build_pages(overlays, templates):
    """Effective-page content for every overlay key, in file order.

    Returns ``[(key, content_str, byte_len), ...]``.
    """
    built = []
    for key in overlays:
        page = build_effective_page(key, overlays[key], overlays, templates)
        if page is None:
            raise RuntimeError(f"no template or overlay for key {key!r}")
        content = to_canonical_json(page)
        built.append((key, content, len(content.encode("utf-8"))))
    return built


def assert_within_size_limit(pages):
    """Abort the whole run if any page exceeds the per-version cap."""
    oversized = [(k, n) for (k, _, n) in pages if n > MAX_CONTENT_BYTES]
    if oversized:
        detail = ", ".join(f"{k} ({n} bytes)" for k, n in oversized)
        raise SystemExit(
            f"ABORT: {len(oversized)} page(s) exceed the {MAX_CONTENT_BYTES}-byte "
            f"history-api version cap: {detail}. No pages were written."
        )


def _document_exists(api_url, write_key, key):
    resp = requests.get(
        f"{api_url}/sections/{SECTION}/documents/{key}",
        headers={"X-History-Key": write_key},
        timeout=_TIMEOUT,
    )
    if resp.status_code == 200:
        return True
    if resp.status_code == 404:
        return False
    resp.raise_for_status()
    raise RuntimeError(f"unexpected {resp.status_code} checking {key}")


def _post_version(api_url, write_key, key, content):
    resp = requests.post(
        f"{api_url}/documents/{SECTION}::{key}/versions",
        headers={"X-History-Key": write_key},
        json={"content": content, "content_type": "json", "message": COMMIT_MESSAGE},
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json().get("version_id", "")


def run_backfill(pages, api_url, write_key, force=False, dry_run=False):
    imported = 0
    skipped = 0
    failed = 0

    for key, content, nbytes in pages:
        if dry_run:
            print(f"[dry-run] {key}: {nbytes} bytes, would POST version 1")
            imported += 1
            continue

        try:
            if not force and _document_exists(api_url, write_key, key):
                print(f"skip {key}: already exists in history-api")
                skipped += 1
                continue
            version_id = _post_version(api_url, write_key, key, content)
        except Exception as exc:  # noqa: BLE001 - report and continue; run is re-runnable
            print(f"FAILED {key}: {exc}")
            failed += 1
            continue

        print(f"imported {key}: {nbytes} bytes, version_id={version_id}")
        imported += 1

    return {"imported": imported, "skipped": skipped, "failed": failed}


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--force", action="store_true", help="re-import keys that already exist")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="build + size-check every page and print, without contacting history-api",
    )
    args = parser.parse_args(argv)

    overlays = load_overlays()
    templates = load_templates()
    pages = build_pages(overlays, templates)

    # Pre-pass: abort before any write if a page is too large.
    assert_within_size_limit(pages)
    print(f"{len(pages)} pages built, all within {MAX_CONTENT_BYTES} bytes")

    api_url = ""
    write_key = ""
    if not args.dry_run:
        try:
            api_url = os.environ["HISTORY_API_URL"].rstrip("/")
            write_key = os.environ["HISTORY_WRITE_KEY"]
        except KeyError as missing:
            raise SystemExit(f"missing required env var: {missing}")

    result = run_backfill(pages, api_url, write_key, force=args.force, dry_run=args.dry_run)

    print(
        f"\nDone: {result['imported']} imported, "
        f"{result['skipped']} skipped, {result['failed']} failed "
        f"({len(pages)} pages total)"
    )
    return 1 if result["failed"] else 0


if __name__ == "__main__":
    sys.exit(main())
