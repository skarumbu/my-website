---
phase: 02-public-reading-api
reviewed: 2026-05-31T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - C:\Users\Sriram\posts-api\function_app.py
  - C:\Users\Sriram\posts-api\tests\test_function_app.py
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-31T00:00:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed the two Phase 2 source files: `function_app.py` (the Azure Functions HTTP layer) and
`tests/test_function_app.py` (unit + integration tests). The supporting modules `schema.py`,
`slugs.py`, and `tests/conftest.py` were also read to understand the call graph.

The API shape and security posture are reasonable: anonymous read-only routes, slug validated by
regex before use as a blob key, and CORS restricted to a single origin. However, two issues are
serious enough to block shipping: CORS preflight is unhandled (browsers will block all requests from
the web frontend), and a single corrupt or unparseable blob in storage causes the entire list
endpoint to return 500, erasing all visibility into healthy posts.

Four additional warnings cover silent error swallowing, nullable fields leaking into JSON,
inconsistent slug sourcing, and a fragile sort. Two info items flag a dead import and a missing test
for the CORS header.

---

## Critical Issues

### CR-01: No OPTIONS preflight handler — CORS blocks all browser requests

**File:** `C:\Users\Sriram\posts-api\function_app.py:13-25`

**Issue:** `_json_response` adds `Access-Control-Allow-Origin` to GET/error responses, but the
`FunctionApp` registers no `OPTIONS` route for either `posts` or `posts/{slug}`. Browsers perform
an HTTP OPTIONS preflight before any cross-origin request that carries a custom header or uses a
content-type other than `text/plain`. When the preflight lands, Azure Functions returns a 404 with
no CORS headers, and the browser refuses to fire the actual GET. The React frontend at
`quixotry.me` will be unable to call either endpoint the moment it sends any standard JSON `Accept`
header or when Fetch's mode triggers a preflight.

**Fix:** Register explicit OPTIONS handlers (or a single catch-all) that return the required
preflight response headers:

```python
CORS_HEADERS = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
}

def _json_response(data: dict, status_code: int = 200) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps(data),
        status_code=status_code,
        mimetype="application/json",
        headers=CORS_HEADERS,
    )

@app.route(route="posts", methods=["OPTIONS"])
def list_posts_preflight(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(status_code=204, headers=CORS_HEADERS)

@app.route(route="posts/{slug}", methods=["OPTIONS"])
def get_post_preflight(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(status_code=204, headers=CORS_HEADERS)
```

---

### CR-02: Single bad blob poisons the entire `list_posts` response

**File:** `C:\Users\Sriram\posts-api\function_app.py:36-55`

**Issue:** The entire blob-iteration loop runs inside a single `try/except Exception` block. If any
one blob has a corrupt download, a YAML parse failure in `parse_post`, or an unexpected field type,
the exception propagates out of the loop and the handler returns `{"error": "storage error"}` with
status 500 — hiding all the other healthy published posts from callers. On a site with one
malformed draft in storage, the public reading API goes completely dark.

The `parse_post` call (line 41) calls `frontmatter.loads`, which can raise on malformed YAML.
`download_blob().readall()` can fail per-blob independently of container-level access. Neither is
isolated.

**Fix:** Wrap the per-blob processing in its own try/except so failures are logged and skipped
rather than fatal:

```python
import logging

posts = []
for blob in client.list_blobs():
    try:
        raw = client.get_blob_client(blob.name).download_blob().readall().decode("utf-8")
        post = parse_post(raw)
    except Exception as exc:          # noqa: BLE001
        logging.warning("Skipping blob %s: %s", blob.name, exc)
        continue
    if post.metadata.get("published") is True:
        ...
        posts.append({...})
```

The outer try/except can remain to catch container-level failures (e.g., `get_container_client`
raising).

---

## Warnings

### WR-01: Bare `except Exception` silently discards error details in both handlers

**File:** `C:\Users\Sriram\posts-api\function_app.py:54, 82`

**Issue:** Both `list_posts` and `get_post` catch `Exception` without logging the exception. When
Azure Functions returns a 500, there is no traceback in Application Insights or stdout, making
production debugging impossible. The error is fully silent.

**Fix:** Add `logging.exception` (or at minimum `logging.error`) before returning the 500 response:

```python
except Exception:
    logging.exception("Unhandled error in list_posts")
    return _json_response({"error": "storage error"}, status_code=500)
```

---

### WR-02: `title`, `slug`, and `description` can be `None` in JSON responses

**File:** `C:\Users\Sriram\posts-api\function_app.py:45-51, 72-79`

**Issue:** Both handlers call `post.metadata.get("title")`, `post.metadata.get("slug")`, and
`post.metadata.get("description")` without a default. If any of these fields is absent from a
blob's frontmatter, the JSON response will contain `"title": null`. Callers (React frontend) that
assume these are non-null strings will break with TypeErrors at runtime. The schema module defines
`REQUIRED_FIELDS` but `parse_post` and the handlers never call `validate_post` — so a blob that
was written without a required field produces a structurally invalid API response silently.

**Fix:** Either call `validate_post` after `parse_post` and skip/reject posts that fail validation,
or supply safe defaults:

```python
# Option A — skip invalid posts
errors = validate_post(post)
if errors:
    logging.warning("Blob %s failed validation: %s", blob.name, errors)
    continue

# Option B — safe defaults (less preferred: hides data bugs)
posts.append({
    "title": post.metadata.get("title") or "",
    "slug": post.metadata.get("slug") or "",
    ...
})
```

---

### WR-03: `get_post` returns the metadata slug, not the route slug — inconsistency risk

**File:** `C:\Users\Sriram\posts-api\function_app.py:66, 74`

**Issue:** The handler reads the blob `f"{slug}.md"` using the route-validated slug, but returns
`post.metadata.get("slug")` in the response body. If the filename and the `slug` frontmatter field
ever differ (e.g., a blob was renamed without updating its frontmatter), the API will return a slug
that does not match the URL the caller used to reach it. This can produce broken links or cache
key mismatches on the frontend.

**Fix:** Return the validated route slug directly instead of trusting the metadata:

```python
return _json_response({
    "title": post.metadata.get("title"),
    "slug": slug,           # use the validated route param, not metadata
    ...
})
```

---

### WR-04: Date sort is lexicographic — a missing date floats unpredictably

**File:** `C:\Users\Sriram\posts-api\function_app.py:48, 52`

**Issue:** Posts are sorted by the string value of `p["date"]` (line 52). When `date_val` is
`None`, the serialized date is `""`. An empty string is lexicographically less than any ISO date,
so with `reverse=True` it sorts to the last position. While this happens to be a "safe" failure
(missing-date posts go last), the behavior is entirely undocumented and fragile: a date stored as
a Python `datetime` object will serialize via `.isoformat()` producing `"2026-05-30T00:00:00+00:00"`,
while a date stored as a plain YAML string (no time component) would serialize via `str()` as
`"2026-05-30"`. Mixed formats in the same list will sort incorrectly — the time-bearing ISO string
sorts after the date-only string for the same calendar day (`"2026-05-30T..."` > `"2026-05-30"`),
so a post stored as date-only will appear older than the same-day post with a full timestamp.

**Fix:** Normalize the date at sort time:

```python
from datetime import date, datetime

def _sort_key(p: dict) -> str:
    d = p["date"]
    # Ensure a consistent prefix for sorting; empty string goes last (sentinel)
    return d if d else "0000-00-00"

posts.sort(key=_sort_key, reverse=True)
```

Or better, parse to a datetime before sorting so mixed formats compare correctly.

---

## Info

### IN-01: `os` is imported but never used in `function_app.py`

**File:** `C:\Users\Sriram\posts-api\function_app.py:2`

**Issue:** `import os` appears at the top of `function_app.py` but `os` is not referenced anywhere
in the file. The `os.environ` calls are in `slugs.py`, not here.

**Fix:** Remove the unused import.

```python
# Remove this line:
import os
```

---

### IN-02: Tests do not assert the CORS header is present on responses

**File:** `C:\Users\Sriram\posts-api\tests\test_function_app.py:26-78`

**Issue:** Every test asserts on `status_code` and `body` but none checks
`resp.get_headers().get("Access-Control-Allow-Origin")`. Given CR-01 above, CORS is a correctness
concern for this API. A test that verifies the header is set (and set to the correct origin) would
have surfaced the missing OPTIONS handler earlier.

**Fix:** Add assertions to at least the happy-path tests:

```python
assert resp.get_headers().get("Access-Control-Allow-Origin") == "https://www.quixotry.me"
```

---

_Reviewed: 2026-05-31T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
