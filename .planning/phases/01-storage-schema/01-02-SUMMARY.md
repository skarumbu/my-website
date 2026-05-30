---
phase: 01-storage-schema
plan: 02
subsystem: posts-api-schema-slugs
tags: [python, schema, slugs, frontmatter, azure-storage-blob, pytest, tdd, azurite]
dependency_graph:
  requires: [01-01]
  provides: [schema.py, slugs.py, passing-tests]
  affects: [01-03-PLAN, phase-02, phase-04]
tech_stack:
  added:
    - python-frontmatter==1.3.0 (schema serialization via frontmatter.Post dict API)
    - python-slugify==8.0.4 (unicode slug generation, imported as 'from slugify import slugify')
    - azure-storage-blob==12.23.1 (pinned for Azurite 3.35.0 API compatibility)
  patterns:
    - TDD RED/GREEN per task (6 commits total: 3 RED + 3 GREEN)
    - frontmatter.Post dict API for YAML field assignment (no f-string YAML)
    - Explicit Azurite connection string (UseDevelopmentStorage=true deprecated in SDK >=12.24)
    - Blob prefix-based slug deduplication (list_blobs(name_starts_with=base_slug))
key_files:
  created:
    - C:/Users/Sriram/posts-api/schema.py
    - C:/Users/Sriram/posts-api/slugs.py
  modified:
    - C:/Users/Sriram/posts-api/tests/test_schema.py
    - C:/Users/Sriram/posts-api/tests/test_slugs.py
    - C:/Users/Sriram/posts-api/tests/test_storage.py
    - C:/Users/Sriram/posts-api/tests/conftest.py
    - C:/Users/Sriram/posts-api/requirements.txt
decisions:
  - "Used 'from slugify import slugify' (not 'from python_slugify import slugify') — module name is slugify, not python_slugify"
  - "Pinned azure-storage-blob to >=12.23.1,<12.29.0 — SDK 12.29.0 uses API 2026-04-06 which Azurite 3.35.0 does not support"
  - "Updated conftest.py to use explicit Azurite connection string — UseDevelopmentStorage=true deprecated in SDK >=12.24"
  - "build_post() sets updatedAt via datetime.now(timezone.utc).isoformat() when not provided"
  - "validate_post() returns list of error strings; empty list = valid post"
metrics:
  duration_minutes: 25
  completed_date: "2026-05-30"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 5
---

# Phase 01 Plan 02: schema.py + slugs.py Implementation Summary

**One-liner:** schema.py and slugs.py implemented TDD-style with 13 pytest tests green — YAML frontmatter round-trips, unicode slug transliteration, and blob dedup verified end-to-end via Azurite.

---

## What Was Built

Two core utility modules for the posts-api, implemented via TDD with 6 commits (RED/GREEN pairs for each of 3 tasks):

### schema.py
- `build_post(title, slug, date, description, body, published=False, updated_at=None)` — creates `frontmatter.Post` with all 6 required fields set via dict API (no f-string YAML)
- `validate_post(post)` — returns list of error strings; checks all REQUIRED_FIELDS present, title is str, published is bool
- `serialize_post(post)` — returns `frontmatter.dumps(post)` (one line)
- `parse_post(content)` — returns `frontmatter.loads(content)` (one line)
- `REQUIRED_FIELDS = {"title", "slug", "date", "published", "description", "updatedAt"}`

### slugs.py
- `generate_slug(title, container_client)` — unicode-safe slug with prefix-based dedup (`list_blobs(name_starts_with=base_slug)`), raises `ValueError` for empty slug
- `get_container_client()` — reads `POSTS_STORAGE_CONNECTION_STRING` env var (raises `RuntimeError` if empty), returns `ContainerClient`

### Test Suite (13 tests, all passing)
- `tests/test_schema.py` — 5 tests: required fields, colon title round-trip, published bool, frontmatter round-trip, updatedAt auto-set
- `tests/test_slugs.py` — 5 tests: basic slug, unicode transliteration, dedup -2 suffix, dedup -3 suffix, empty title ValueError
- `tests/test_storage.py` — 3 integration tests: upload, download+parse, container exists

---

## Tasks Completed

| Task | Name | RED Commit | GREEN Commit | Files |
|------|------|-----------|--------------|-------|
| 1 | schema.py with passing tests | f1a9d63 | e2cdbac | schema.py, tests/test_schema.py |
| 2 | slugs.py with passing tests | 9d29584 | 55280ab | slugs.py, tests/test_slugs.py, conftest.py, requirements.txt |
| 3 | Storage integration tests green | 0bfd12c | e2e19fd | tests/test_storage.py |

---

## Verification Results

- `pytest tests/ -v` → 13 passed, 0 failed, 0 skipped, 0 errors
- No f-string YAML in schema.py (`grep -n 'f"title'` → no matches)
- No `create_container` in schema.py or slugs.py
- `from slugify import slugify` (correct module name — not python_slugify)
- Git log shows 6 TDD commits in proper RED/GREEN order

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] azure-storage-blob API version incompatibility with Azurite 3.35.0**
- **Found during:** Task 2 GREEN phase (first test run with Azurite)
- **Issue:** azure-storage-blob 12.29.0 uses API version 2026-04-06 which is not supported by Azurite 3.35.0. Error: `InvalidHeaderValue: The API version 2026-04-06 is not supported by Azurite`.
- **Fix:** Downgraded azure-storage-blob to `>=12.23.1,<12.29.0` in requirements.txt and installed 12.23.1 in venv. This version uses API 2024-08-04 which Azurite 3.35.0 supports.
- **Files modified:** `requirements.txt`
- **Commit:** 55280ab

**2. [Rule 3 - Blocking] UseDevelopmentStorage=true deprecated in newer SDK**
- **Found during:** Task 2 GREEN phase (during SDK version testing)
- **Issue:** While testing SDK versions, found that `UseDevelopmentStorage=true` connection string raises `ValueError: Connection string missing required connection details` in SDK versions 12.24.x–12.26.x. The shorthand was deprecated.
- **Fix:** Updated `conftest.py` to use the explicit Azurite connection string: `DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=...;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;`
- **Files modified:** `tests/conftest.py`
- **Commit:** 55280ab

**3. [Rule 1 - Bug carried from Plan 01] python-slugify import path**
- **Documented in Plan 01 SUMMARY:** `from python_slugify import slugify` does not work — module name is `slugify` not `python_slugify`.
- **Fix:** Used `from slugify import slugify` in slugs.py (per Plan 01 decision already in STATE.md).
- **Acceptance criteria note:** The plan's acceptance criteria says `slugs.py contains "from python_slugify import slugify"` but this import raises ModuleNotFoundError. Correctness over literal plan compliance — using `from slugify import slugify` as required.

---

## Known Stubs

None — all 13 tests are real implementations with passing assertions. No pytest.skip() calls remain.

---

## Threat Flags

No new network endpoints, auth paths, or schema changes beyond plan scope.

Threat mitigations verified:
- **T-02-01 (YAML injection):** schema.py uses `post["title"] = title_string` throughout — no f-string YAML construction. `grep -n 'f"title'` shows zero matches.
- **T-02-02 (type coercion):** `validate_post()` checks `isinstance(post.metadata["published"], bool)`. `test_published_is_bool` passes.
- **T-03-01 (slug collision):** `generate_slug()` checks existing blob names before returning. `test_dedup_triple` verifies -3 suffix.
- **T-03-02 (path traversal):** `python-slugify` strips all non-alphanumeric chars. `test_empty_title_raises` verifies ValueError for `"!!!###"`.
- **T-02-03 (connection string in errors):** `get_container_client()` RuntimeError message states env var name only, not value.

---

## Self-Check: PASSED

- C:/Users/Sriram/posts-api/schema.py — FOUND
- C:/Users/Sriram/posts-api/slugs.py — FOUND
- C:/Users/Sriram/posts-api/tests/test_schema.py — FOUND (5 real tests, no skips)
- C:/Users/Sriram/posts-api/tests/test_slugs.py — FOUND (5 real tests, no skips)
- C:/Users/Sriram/posts-api/tests/test_storage.py — FOUND (3 real tests, no skips)
- Commit f1a9d63 (test RED schema) — FOUND
- Commit e2cdbac (feat GREEN schema) — FOUND
- Commit 9d29584 (test RED slugs) — FOUND
- Commit 55280ab (feat GREEN slugs) — FOUND
- Commit 0bfd12c (test RED storage) — FOUND
- Commit e2e19fd (test GREEN all 13) — FOUND
