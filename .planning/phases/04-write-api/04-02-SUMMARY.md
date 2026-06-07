---
phase: 04-write-api
plan: "02"
subsystem: api
tags: [azure-functions, blob-storage, auth, update-post, delete-post, tdd, easy-auth]

requires:
  - phase: 04-write-api/04-01
    provides: [auth.py/require_auth, function_app.py/create_post, function_app.py/_unauthorized, ALLOWED_ORIGIN, SLUG_RE]

provides:
  - function_app.py/update_post — PUT /api/posts/{slug} with date preservation
  - function_app.py/delete_post — DELETE /api/posts/{slug} returning bare 204
  - 9 new tests covering auth gates, 404 on missing slug, date preservation, success unit + integration

affects: [04-write-api/04-03, phase-05-editor-ui]

tech-stack:
  added: []
  patterns:
    - Auth-gate-first handler (require_auth before any slug read or storage access)
    - Read-then-overwrite for date preservation (download_blob → parse_post → original_date → upload_blob overwrite=True)
    - Bare 204 HttpResponse (not _json_response) for DELETE success path

key-files:
  created: []
  modified:
    - C:\Users\Sriram\posts-api\function_app.py
    - C:\Users\Sriram\posts-api\tests\test_function_app.py

key-decisions:
  - "update_post reads existing blob before write — serves as both existence check (404) and original date source (Pitfall 3)"
  - "delete_post returns func.HttpResponse(status_code=204) directly — _json_response() always writes a body and cannot be used for 204"
  - "Auth checked before slug validation and before any storage call (T-04-05, T-04-06, T-04-07) — unauthenticated requests to unknown slugs always get 401 not 404"

patterns-established:
  - "Pattern: Read-then-overwrite for update — download_blob → parse_post → extract original_date → build_post(date=original_date) → upload_blob(overwrite=True)"
  - "Pattern: Bare 204 for DELETE — func.HttpResponse(status_code=204, headers={'Access-Control-Allow-Origin': ALLOWED_ORIGIN}) with no body"

requirements-completed: [API-04, API-05, SEC-02]

duration: 20min
completed: 2026-06-05
---

# Phase 4 Plan 02: Write API — Update and Delete Post Endpoints Summary

**PUT /api/posts/{slug} (update with original-date preservation) and DELETE /api/posts/{slug} (bare 204) handlers, each auth-gated first, with 9 TDD stubs gone GREEN and full 23-test suite passing.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-05T12:00:00Z
- **Completed:** 2026-06-05T12:20:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `update_post` handler at `@app.route(route="posts/{slug}", methods=["PUT"])`: auth gate first, SLUG_RE validation, reads existing blob to extract original creation date (prevents Pitfall 3 — date reset on edit), builds updated post, uploads with `overwrite=True`, returns 200 with all 6 fields
- `delete_post` handler at `@app.route(route="posts/{slug}", methods=["DELETE"])`: auth gate first, SLUG_RE validation, `delete_blob()`, returns bare `func.HttpResponse(status_code=204)` — no body
- 9 new Wave 0 stubs (5 for update_post, 4 for delete_post) went RED then GREEN; full suite 23/23 green with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Wave 0 test stubs for update_post and delete_post** - `e087646` (test)
2. **Task 2: Implement update_post and delete_post handlers** - `3758b73` (feat)

## Files Created/Modified

- `C:\Users\Sriram\posts-api\function_app.py` — Added `update_post` (PUT) and `delete_post` (DELETE) handlers after `create_post`; no existing functions modified
- `C:\Users\Sriram\posts-api\tests\test_function_app.py` — Appended 9 new test stubs for update and delete paths (requires_auth, not_found, preserves_date, success unit, integration)

## Decisions Made

- `update_post` reads the existing blob with `download_blob()` before writing — this serves dual purpose: (a) 404 existence check and (b) extraction of `original_date` from `parse_post(raw).metadata.get("date")`. This is the correct guard against Pitfall 3 (date reset on every PUT).
- `delete_post` returns `func.HttpResponse(status_code=204, headers={...})` directly, not via `_json_response()`. `_json_response()` always writes a JSON body; using it for 204 would violate the HTTP spec.
- Auth is checked before slug validation (before any storage access) per T-04-05, T-04-06, T-04-07: a request to `/api/posts/any-slug` without auth always returns 401, never 404 — prevents existence leakage.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Compliance

| Threat | Disposition | Implementation |
|--------|-------------|----------------|
| T-04-05 Elevation of Privilege (update_post) | mitigated | require_auth() is first call; ValueError → _unauthorized() 401 before any slug read |
| T-04-06 Elevation of Privilege (delete_post) | mitigated | require_auth() is first call; ValueError → _unauthorized() 401 before delete_blob() |
| T-04-07 Info Disclosure (401 vs 404 ordering) | mitigated | Auth checked before existence check — unauthenticated requests always 401 |
| T-04-08 Tampering (slug path traversal) | mitigated | SLUG_RE = r"^[a-z0-9-]+$" rejects /, ., and any non-safe chars before blob access |
| T-04-09 Tampering (PUT overwriting wrong blob) | mitigated | Explicit download_blob() before upload_blob() — existence check + date preservation |
| T-04-10 Tampering (YAML injection) | mitigated | serialize_post() uses python-frontmatter; no f-string YAML construction |

## Issues Encountered

None.

## Known Stubs

None — all data flows are wired end-to-end.

## Threat Flags

None — no new security surface beyond what is documented in the plan's threat model.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full write API surface complete: create (POST), update (PUT), delete (DELETE) — all auth-gated
- Plan 04-03 (infrastructure/Bicep) can now proceed; it does not depend on handler code
- Phase 5 (Editor UI) has the complete API contract it needs to wire the editor to

---
*Phase: 04-write-api*
*Completed: 2026-06-05*
