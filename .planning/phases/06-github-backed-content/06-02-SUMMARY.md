---
phase: 06-github-backed-content
plan: "02"
subsystem: api
tags: [github-api, requests, python, azure-functions, unittest-mock, function-app]

# Dependency graph
requires:
  - phase: 06-01
    provides: "GitHub Contents API helper layer in slugs.py (get_file_sha, list_posts_dir, create_file, update_file, delete_file, generate_slug)"
provides:
  - "function_app.py with all 5 handlers wired to GitHub API helpers — no blob storage code remains"
  - "test_function_app.py with 15 passing mock-based tests using patch('requests.get/put/delete')"
affects:
  - "06-03 (azure-infrastructure bicep — app settings for GITHUB_TOKEN/GITHUB_REPO already handled in function layer)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "patch('requests.get') at top-level requests module patches both function_app.py and slugs.py simultaneously (shared module object)"
    - "patch.dict(os.environ, _ENV) required alongside requests.get patch — env vars evaluated before mock intercepts"
    - "GitHub error mapping: 422 → 409 Conflict, other HTTPError → 502 storage error, 404 via sha=None check"
    - "SHA-first pattern for update/delete: GET file SHA before PUT/DELETE (GitHub Contents API requirement D-14)"

key-files:
  created: []
  modified:
    - "posts-api/function_app.py"
    - "posts-api/tests/test_function_app.py"

key-decisions:
  - "patch('requests.get') patches both function_app.py and slugs.py — they share the same requests module object, no per-module patching needed"
  - "encode_content inlined in test_function_app.py instead of imported from conftest — conftest.py is not directly importable as a Python module in this project layout"
  - "Error code changed from 500 to 502 for GitHub upstream errors in write handlers — distinguishes storage-layer failures from application errors per RESEARCH.md Pattern 8"
  - "update_post GET+parse is in a separate try/except block from the build+PUT block — allows distinct 404 vs 502 error responses at each stage"

requirements-completed: [GH-01, GH-02, GH-03, GH-04]

# Metrics
duration: 20min
completed: 2026-06-06
---

# Phase 6 Plan 02: function_app.py GitHub Rewrite Summary

**Rewrote all 5 Azure Functions handlers to use GitHub Contents API via slugs.py helpers; replaced 528 lines of blob storage + Azurite tests with 301 lines of requests-mock unit tests — 25 tests pass**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-06T00:15:00Z
- **Completed:** 2026-06-06T00:35:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Rewrote `function_app.py` — removed all azure.core.exceptions, azure.storage.blob, and get_container_client references; wired all 5 handlers to GitHub helper functions from slugs.py
- Auth gate (require_auth) remains first logic in all three write handlers (T-06-05 access control)
- Slug validation (SLUG_RE) fires before any GitHub API call in update_post, delete_post, get_post (T-06-06 path traversal prevention)
- Rewrote `test_function_app.py` — 15 tests using `patch("requests.get/put/delete")`; deleted all Azurite/monkeypatch/container_client patterns

## Task Commits

All committed to posts-api repo (`C:\Users\Sriram\posts-api`):

1. **Tasks 1 + 2: Rewrite function_app.py + rewrite test_function_app.py** - `e140411` (feat)

**Plan metadata:** (docs commit in my-website worktree)

## Files Created/Modified

- `posts-api/function_app.py` — All 5 handlers rewired to GitHub helpers; no blob imports remain; 502 for GitHub upstream errors; SHA-first pattern for update/delete
- `posts-api/tests/test_function_app.py` — 15 mock-based tests using patch("requests.get/put/delete") + patch.dict(os.environ); auth tests need no mock (gate fires before GitHub call)

## Decisions Made

- **patch at top-level requests module:** `patch("requests.get")` patches both `function_app.py` and `slugs.py` simultaneously because they both import from the same `requests` module object. No per-module patching needed.
- **encode_content inlined:** `conftest.py` is not directly importable as a Python module in this project layout (tests/ directory with `__init__.py` but conftest is not a package member). Inlined the one-line base64 function rather than adding sys.path manipulation.
- **502 for GitHub upstream errors:** Changed from 500 to 502 in write handlers to distinguish GitHub API failures from application-layer errors, following RESEARCH.md Pattern 8.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `from conftest import encode_content` raised ModuleNotFoundError**
- **Found during:** Task 2 (test_function_app.py initial run)
- **Issue:** The plan specified `from conftest import encode_content` but conftest.py is not directly importable as a Python module — pytest discovers it automatically but it cannot be imported with a regular `import` statement in this project layout (tests/ has `__init__.py`).
- **Fix:** Inlined the one-line `encode_content` function directly in `test_function_app.py` as a module-level helper. Functionally identical — same base64 encoding, same behavior.
- **Files modified:** `posts-api/tests/test_function_app.py`
- **Verification:** `python -m pytest tests/test_function_app.py -x -q` — 15 passed
- **Committed in:** `e140411`

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking import issue)
**Impact on plan:** Fix was necessary to run any tests. No scope creep — the encode_content logic is identical, just inlined rather than imported.

## Issues Encountered

None — the conftest import issue was caught immediately and fixed cleanly.

## User Setup Required

None - no external service configuration required for this plan. GITHUB_TOKEN and GITHUB_REPO are Azure Function App settings (configured in Plan 03 / infrastructure phase).

## Next Phase Readiness

- `function_app.py` is complete — all 5 handlers wired to GitHub API with no blob storage code remaining
- Full test suite passes: 25 tests (test_schema x5, test_slugs x5, test_function_app x15)
- Ready for Plan 03: azure-infrastructure Bicep update to swap storage app settings for GITHUB_TOKEN/GITHUB_REPO

## Self-Check: PASSED

- `posts-api/function_app.py` — exists and verified (no blob imports, all GitHub helper imports present)
- `posts-api/tests/test_function_app.py` — exists and verified (15 tests pass)
- Commit `e140411` exists in posts-api repo
- 25/25 tests pass (full suite)

---
*Phase: 06-github-backed-content*
*Completed: 2026-06-06*
