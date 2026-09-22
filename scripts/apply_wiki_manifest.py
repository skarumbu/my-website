"""Applies a merged wiki-update PR to history-api: posts one new version per
page listed in docs/wiki-preview/manifest.json, using the as-merged preview
file content verbatim (never re-derived — a reviewer may have hand-edited it).

Run by .github/workflows/wiki-update-merge.yml on every merge of a
wiki-update/<repo>-pr-<n> branch into my-website's main. See
docs/design/2026-09-01-architecture-wiki-history-migration-design.md (in the
history-api repo) for the full design.

On a 409 (another wiki-update PR's version landed for this page between
preview generation and merge), the page's current version_id is refetched and
the same content is retried once with the refreshed expected_version_id —
last-writer-wins, since the merged preview reflects a human review. A second
409 fails only that page; pages are independent, so one page's failure does
not roll back the others already applied in the same run.

Usage:
  HISTORY_API_URL=https://history-api-prod.azurewebsites.net/api \\
  HISTORY_WRITE_KEY=<machine write key> \\
  python scripts/apply_wiki_manifest.py [--manifest PATH] [--preview-dir DIR]

Config (env):
  HISTORY_API_URL    base URL incl. /api
  HISTORY_WRITE_KEY  X-History-Key machine write key
"""

import argparse
import json
import os
import sys

import requests

SECTION = "architecture"
_TIMEOUT = (5, 30)

_DEFAULT_MANIFEST = os.path.join("docs", "wiki-preview", "manifest.json")
_DEFAULT_PREVIEW_DIR = os.path.join("docs", "wiki-preview")


def load_manifest(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_preview_content(preview_dir, key):
    with open(os.path.join(preview_dir, f"{key}.json"), "r", encoding="utf-8") as f:
        return f.read()


def _latest_version_id(api_url, key):
    """The page's current version_id, or "" if it doesn't exist yet. No auth
    needed — the architecture section is public."""
    resp = requests.get(f"{api_url}/sections/{SECTION}/documents/{key}", timeout=_TIMEOUT)
    if resp.status_code == 200:
        return resp.json().get("version_id", "")
    if resp.status_code in (401, 404):
        return ""
    resp.raise_for_status()
    raise RuntimeError(f"unexpected {resp.status_code} fetching latest version for {key!r}")


def _post_version(api_url, write_key, key, content, message, expected_version_id):
    body = {"content": content, "content_type": "json", "message": message}
    if expected_version_id:
        body["expected_version_id"] = expected_version_id
    return requests.post(
        f"{api_url}/documents/{SECTION}::{key}/versions",
        headers={"X-History-Key": write_key},
        json=body,
        timeout=_TIMEOUT,
    )


def apply_entry(api_url, write_key, preview_dir, entry):
    """Returns True on success, False if the page failed (and was reported)."""
    key = entry["key"]
    message = entry.get("message") or ""
    content = load_preview_content(preview_dir, key)
    expected = entry.get("base_version_id") or ""

    resp = _post_version(api_url, write_key, key, content, message, expected)
    if resp.status_code == 409:
        print(f"{key}: 409 against base_version_id={expected!r} — refetching and retrying once")
        expected = _latest_version_id(api_url, key)
        resp = _post_version(api_url, write_key, key, content, message, expected)
        if resp.status_code == 409:
            print(f"FAILED {key}: second 409 after retry — needs manual attention", file=sys.stderr)
            return False

    resp.raise_for_status()
    version_id = resp.json().get("version_id", "")
    print(f"applied {key}: version_id={version_id}")
    return True


def run_manifest(manifest, api_url, write_key, preview_dir):
    applied = 0
    failed = 0
    for entry in manifest:
        try:
            ok = apply_entry(api_url, write_key, preview_dir, entry)
        except Exception as exc:  # noqa: BLE001 - report and continue; pages are independent
            print(f"FAILED {entry.get('key')}: {exc}", file=sys.stderr)
            ok = False
        if ok:
            applied += 1
        else:
            failed += 1
    return {"applied": applied, "failed": failed}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--manifest", default=_DEFAULT_MANIFEST)
    parser.add_argument("--preview-dir", default=_DEFAULT_PREVIEW_DIR)
    args = parser.parse_args(argv)

    try:
        manifest = load_manifest(args.manifest)
    except FileNotFoundError:
        print(f"No manifest at {args.manifest} — nothing to apply.")
        return 0

    if not manifest:
        print("Manifest is empty — nothing to apply.")
        return 0

    api_url = os.environ["HISTORY_API_URL"].rstrip("/")
    write_key = os.environ["HISTORY_WRITE_KEY"]

    result = run_manifest(manifest, api_url, write_key, args.preview_dir)

    print(f"\nDone: {result['applied']} applied, {result['failed']} failed ({len(manifest)} pages total)")
    return 1 if result["failed"] else 0


if __name__ == "__main__":
    sys.exit(main())
