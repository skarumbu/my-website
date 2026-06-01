---
phase: 02-public-reading-api
plan: "01"
subsystem: posts-api
tags: [azure-functions, blob-storage, tdd, public-api, python]
dependency_graph:
  requires: [01-storage-schema]
  provides: [list_posts_endpoint, get_post_endpoint]
  affects: [my-website-frontend-phase3]
tech_stack:
  added: []
  patterns: [tdd-red-green, slug-validation, exception-ordering, date-serialization-guard]
key_files:
  created:
    - C:\Users\Sriram\posts-api\tests\test_function_app.py
  modified:
    - C:\Users\Sriram\posts-api\function_app.py
decisions:
  - "test_get_post_invalid_slug added beyond the 7 named tests — covers the ^[a-z0-9-]+$ slug validation must_have truth which the behavior spec listed but acceptance criteria omitted"
  - "ResourceNotFoundError catch precedes except Exception in get_post — prevents blob-not-found silently returning 500 (T-02-01)"
  - "Date/updatedAt serialized via hasattr(isoformat) guard — python-frontmatter parses ISO strings back as datetime objects; raw datetime passed to json.dumps would raise TypeError"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-31"
  tasks: 2
  files: 2
---

# Phase 2 Plan 1: Public Reading API — list_posts and get_post Summary

**One-liner:** TDD implementation of GET /api/posts and GET /api/posts/{slug} Azure Functions handlers with slug validation, published-only filtering, and ResourceNotFoundError-before-Exception ordering.

---

## What Was Built

Two HTTP read endpoints added to `C:\Users\Sriram\posts-api\function_app.py`:

- **`list_posts` (GET /api/posts):** Iterates all blobs, parses each with `parse_post()`, filters to `published=True`, serializes date/updatedAt via `.isoformat()` guard, sorts descending by ISO date string, returns `{"posts": [...]}`. No body field in list response.
- **`get_post` (GET /api/posts/{slug}):** Validates slug against `SLUG_RE = re.compile(r"^[a-z0-9-]+$")`, returns 400 on mismatch. Downloads `{slug}.md`, parses, returns 404 if `published` is not `True`. Returns all six fields: title, slug, date, description, updatedAt, body. `except ResourceNotFoundError` precedes `except Exception`.

Both handlers call `get_container_client()` inside the function body (never at module scope).

---

## Test Coverage

8 test cases in `tests/test_function_app.py` (21 total in suite — 0 failures):

| Test | Type | Covers |
|------|------|--------|
| test_list_posts_empty | unit | API-01 empty container |
| test_get_post_not_found | unit | API-02 ResourceNotFoundError → 404 |
| test_get_post_invalid_slug | unit | T-02-01 slug validation → 400 |
| test_list_posts_returns_published_only | integration | API-01 filters drafts |
| test_list_posts_excludes_drafts | integration | API-01 all-drafts → empty |
| test_list_posts_sorted_by_date | integration | API-01 newest-first sort |
| test_get_post_published | integration | API-02 200 + all 6 fields |
| test_get_post_draft_returns_404 | integration | API-02 draft → 404 |

---

## TDD Gate Compliance

RED commit: `cf32d51` — `test(02-01): add failing tests for list_posts and get_post (RED)`
GREEN commit: `8a71a2d` — `feat(02-01): implement list_posts and get_post HTTP handlers (GREEN)`

Both gates satisfied. No REFACTOR commit needed (implementation was clean on first pass).

---

## Commits (posts-api repo)

| Hash | Message |
|------|---------|
| cf32d51 | test(02-01): add failing tests for list_posts and get_post (RED) |
| 8a71a2d | feat(02-01): implement list_posts and get_post HTTP handlers (GREEN) |

---

## Deviations from Plan

### Extra Test Added (Rule 2 — Missing Critical Functionality)

**`test_get_post_invalid_slug` added as 8th test case**
- **Found during:** Task 1 analysis
- **Issue:** The plan's acceptance criteria listed "exactly 7 test functions" but the `must_haves.truths` required slug validation coverage (`GET /api/posts/{slug} returns 400 when the slug contains characters outside ^[a-z0-9-]+$`) and the `<behavior>` block explicitly listed `test_get_post_invalid_slug`. The behavior spec takes precedence over the count discrepancy.
- **Fix:** Added `test_get_post_invalid_slug` unit test covering the `^[a-z0-9-]+$` validation path.
- **Files modified:** `tests/test_function_app.py`
- **Commit:** cf32d51

---

## Known Stubs

None — all response fields wired to actual blob storage data.

---

## Threat Flags

No new security surface beyond what the plan's threat model covers. SLUG_RE validation (T-02-01) and generic error responses (T-02-02) both implemented as specified.

---

## Self-Check: PASSED

- `C:\Users\Sriram\posts-api\tests\test_function_app.py` — created, 8 test functions, all pass
- `C:\Users\Sriram\posts-api\function_app.py` — modified with list_posts, get_post, SLUG_RE, correct import order
- Commit cf32d51 exists in posts-api repo
- Commit 8a71a2d exists in posts-api repo
- Full suite: 21 passed, 0 failed
