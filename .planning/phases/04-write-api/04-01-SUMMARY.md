---
phase: 04-write-api
plan: "01"
subsystem: posts-api
tags: [auth, write-api, create-post, azure-functions, tdd]
dependency_graph:
  requires: []
  provides: [auth.py/require_auth, function_app.py/create_post, function_app.py/_unauthorized]
  affects: [posts-api]
tech_stack:
  added: []
  patterns: [Easy Auth X-MS-CLIENT-PRINCIPAL decoding, TDD RED/GREEN, auth-gate-first handler]
key_files:
  created:
    - C:\Users\Sriram\posts-api\auth.py
  modified:
    - C:\Users\Sriram\posts-api\function_app.py
    - C:\Users\Sriram\posts-api\tests\test_function_app.py
decisions:
  - Auth gate (require_auth) is first call in create_post before any body parsing or storage access (T-04-01)
  - _unauthorized() uses ALLOWED_ORIGIN constant not literal string (T-04-03 CORS mitigation)
  - auth.py is verbatim copy of ideas-api/auth.py to ensure consistent Easy Auth decoding with padding fix
metrics:
  duration: "15 min"
  completed_date: "2026-06-05"
  tasks_completed: 2
  files_changed: 3
---

# Phase 4 Plan 01: Write API — Create Post Endpoint Summary

**One-liner:** JWT/Easy Auth gate + POST /api/posts create handler with slug generation, frontmatter serialization, and blob upload returning 201 {slug}.

## What Was Built

Delivered the first vertical slice of the Write API: `POST /api/posts` create endpoint protected by Easy Auth token validation, with full TDD unit and integration coverage.

### Files Created

- `C:\Users\Sriram\posts-api\auth.py` — require_auth() decodes X-MS-CLIENT-PRINCIPAL header, raises ValueError if absent; verbatim copy of ideas-api/auth.py including base64 padding fix (`+ "=="`)

### Files Modified

- `C:\Users\Sriram\posts-api\function_app.py` — Added imports (require_auth, build_post, validate_post, serialize_post, generate_slug, datetime/timezone), `_unauthorized()` helper, and `create_post` handler at `@app.route(route="posts", methods=["POST"])`
- `C:\Users\Sriram\posts-api\tests\test_function_app.py` — Added 6 Wave 0 test stubs and `_make_auth_header()` helper for write handler coverage

## Task Summary

| Task | Name | Commit | Result |
|------|------|--------|--------|
| 1 | Create auth.py and Wave 0 test stubs (RED) | c6af179 | auth.py created; 6 stubs RED with AttributeError |
| 2 | Implement create_post handler (GREEN) | b07c560 | All 6 stubs GREEN; full suite 27/27 |

## Handler Call Sequence

Per D-05/D-06 and PATTERNS.md Pattern 1 (auth gate first):
1. `require_auth(req)` — ValueError → `_unauthorized()` 401 (T-04-01)
2. `req.get_json()` — Exception → 400 "Invalid JSON body"
3. Extract + strip title, description, body, published
4. Validate required fields → 400 "title and description are required" (T-04-04)
5. `get_container_client()` → `generate_slug()` → `build_post()` → `validate_post()` → `serialize_post()` → `upload_blob()` → 201 {"slug": slug}
6. Exception → 500 "storage error"

## Success Criteria Verification

- [x] auth.py exists with require_auth() identical to ideas-api/auth.py (verbatim copy)
- [x] create_post handler at `@app.route(route="posts", methods=["POST"])`
- [x] POST without X-MS-CLIENT-PRINCIPAL → 401 {"error": "Unauthorized"}
- [x] POST with valid auth + {title, description, body, published} → 201 {"slug": "..."}
- [x] POST with missing title or description → 400 {"error": "title and description are required"}
- [x] All 27 pytest tests pass (full suite green)
- [x] No changes to list_posts, get_post, health handlers

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Compliance

| Threat | Disposition | Implementation |
|--------|-------------|----------------|
| T-04-01 Elevation of Privilege | mitigated | require_auth() is first call in handler body |
| T-04-02 Tampering (YAML injection) | mitigated | serialize_post() uses python-frontmatter; no f-string YAML |
| T-04-03 Spoofing (CORS) | mitigated | ALLOWED_ORIGIN constant used in _unauthorized() and _json_response() |
| T-04-04 Tampering (missing fields) | mitigated | Validate after strip() before build_post is called |

## Known Stubs

None — all data flows are wired end-to-end.

## Threat Flags

None — no new security surface beyond what is documented in the plan's threat model.

## Self-Check: PASSED

- [x] C:\Users\Sriram\posts-api\auth.py exists
- [x] C:\Users\Sriram\posts-api\function_app.py modified (create_post, _unauthorized, imports)
- [x] C:\Users\Sriram\posts-api\tests\test_function_app.py modified (6 stubs + helper)
- [x] Commit c6af179 exists (Task 1 RED)
- [x] Commit b07c560 exists (Task 2 GREEN)
