---
phase: 04-write-api
verified: 2026-06-05T00:00:00Z
status: human_needed
score: 14/14
overrides_applied: 0
human_verification:
  - test: "Run the full pytest suite including integration tests (requires Azurite running)"
    expected: "All 23 tests pass (20 unit + 3 integration for create_post, update_post, delete_post)"
    why_human: "Integration tests connect to Azurite (local Azure Blob emulator). Cannot run without the service running."
  - test: "Confirm GET /api/posts returns 200 without a Bearer token on the deployed posts-api Function App"
    expected: "HTTP 200 with JSON body containing a 'posts' array — public route unblocked"
    why_human: "Requires live Azure deployment; cannot verify programmatically without hitting the production endpoint."
  - test: "Confirm POST /api/posts with no Bearer token returns 401 on the deployed posts-api Function App"
    expected: "HTTP 401 from Easy Auth layer — not from handler code"
    why_human: "Requires live Azure deployment. The SUMMARY claims this was verified by the human at checkpoint, but the verifier cannot independently confirm."
  - test: "Confirm Azure Portal shows Microsoft identity provider enabled on posts-api Function App"
    expected: "Authentication blade shows Microsoft provider with status Enabled and requireAuthentication: false"
    why_human: "Portal state cannot be verified programmatically."
---

# Phase 4: Write API — Verification Report

**Phase Goal:** Implement the write API (POST, PUT, DELETE /api/posts) on the posts-api Azure Function App, protected by Easy Auth, so that authenticated users can create, update, and delete posts.
**Verified:** 2026-06-05
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

All truths verified against actual codebase files. SUMMARY.md claims were not used as evidence — every item below was confirmed by reading source code directly.

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | POST /api/posts with valid X-MS-CLIENT-PRINCIPAL creates a blob and returns 201 {slug} | VERIFIED | `create_post` in function_app.py lines 42–85: auth gate → body parse → validate → generate_slug → upload_blob → `_json_response({"slug": slug}, status_code=201)` |
| 2  | POST /api/posts without X-MS-CLIENT-PRINCIPAL returns 401 and writes nothing | VERIFIED | function_app.py lines 45–48: `require_auth(req)` is first call; `ValueError` → `_unauthorized()` before any body parsing or storage call. Test `test_create_post_requires_auth` asserts `mock_client.get_blob_client.called is False`. |
| 3  | POST /api/posts with missing title or description returns 400 before touching storage | VERIFIED | function_app.py lines 63–64: `if not title or not description: return _json_response({"error": "title and description are required"}, status_code=400)`. Occurs before the storage try-block. |
| 4  | require_auth() raises ValueError when X-MS-CLIENT-PRINCIPAL header is absent | VERIFIED | auth.py lines 9–11: `principal_b64 = req.headers.get("X-MS-CLIENT-PRINCIPAL"); if not principal_b64: raise ValueError("Unauthenticated")`. Padding fix `+ "=="` is present on line 12. |
| 5  | PUT /api/posts/:slug with valid auth updates the blob and returns 200 with post fields | VERIFIED | `update_post` at function_app.py lines 88–157: returns `_json_response({title, slug, date, description, updatedAt, published}, status_code=200)`. Test `test_update_post_success` asserts all 6 fields present. |
| 6  | PUT /api/posts/:slug preserves the original date field — it does not reset to now() | VERIFIED | function_app.py lines 116, 135: `original_date = existing.metadata.get("date")` then `build_post(date=original_date, ...)`. Test `test_update_post_preserves_date` asserts `body["date"] == "2026-01-15T00:00:00+00:00"`. |
| 7  | PUT /api/posts/missing-slug returns 404 before attempting any write | VERIFIED | function_app.py lines 111–120: download_blob raises `ResourceNotFoundError` → `return _json_response({"error": "not found"}, status_code=404)`. Upload_blob is never reached. |
| 8  | DELETE /api/posts/:slug with valid auth deletes the blob and returns 204 with empty body | VERIFIED | `delete_post` at function_app.py lines 160–189: `delete_blob()` then `func.HttpResponse(status_code=204, headers={...})` — NOT `_json_response()`. Test `test_delete_post_success` asserts `resp.get_body() == b""`. |
| 9  | DELETE /api/posts/missing-slug returns 404 | VERIFIED | function_app.py lines 180–181: `except ResourceNotFoundError: return _json_response({"error": "not found"}, status_code=404)`. Test `test_delete_post_not_found` confirms. |
| 10 | PUT and DELETE without auth return 401 — no mutation occurs | VERIFIED | Both `update_post` (line 94–97) and `delete_post` (line 165–168) call `require_auth(req)` as first instruction. Tests `test_update_post_requires_auth` and `test_delete_post_requires_auth` each assert `mock_client.get_blob_client.called is False`. |
| 11 | All write handler tests pass (existing + new) | VERIFIED (unit) / UNCERTAIN (integration) | 20 unit tests pass confirmed by `pytest -k "not integration"`. 3 integration tests collected (test_create_post_integration, test_update_post_integration, test_delete_post_integration) but not run — require Azurite. |
| 12 | Easy Auth authsettingsV2 resource exists in postsapi.bicep with requireAuthentication: false and AllowAnonymous | VERIFIED | postsapi.bicep lines 115–144: `resource authSettings 'Microsoft.Web/sites/config@2022-09-01'`, `name: 'authsettingsV2'`, `requireAuthentication: false`, `unauthenticatedClientAction: 'AllowAnonymous'`. |
| 13 | postsapi.bicep receives azureTenantId, postsApiClientId, postsApiClientSecret as parameters | VERIFIED | postsapi.bicep lines 4–12: all three params declared. `postsApiClientSecret` is decorated `@secure()`. |
| 14 | main.bicep passes the three new params to the postsapi module call | VERIFIED | main.bicep lines 183–191 (confirmed via grep): `postsAPI` module receives `azureTenantId: azureTenantId`, `postsApiClientId: postsApiClientId`, `postsApiClientSecret: postsApiClientSecret`. Top-level params `postsApiClientId` (line 55) and `postsApiClientSecret` (line 59, `@secure()`) confirmed. No duplicate `azureTenantId` param (already existed at line 34). |

**Score:** 14/14 truths verified (Truth 11 is VERIFIED for unit scope, integration scope deferred to human)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `C:\Users\Sriram\posts-api\auth.py` | require_auth() — decodes X-MS-CLIENT-PRINCIPAL, raises ValueError if absent | VERIFIED | Exists, 18 lines, substantive. Contains `def require_auth`, `X-MS-CLIENT-PRINCIPAL`, `base64.b64decode(principal_b64 + "==")`. Imported by function_app.py line 10 `from auth import require_auth`. |
| `C:\Users\Sriram\posts-api\function_app.py` | _unauthorized() helper + create_post + update_post + delete_post handlers | VERIFIED | Exists, 248 lines, fully substantive. All three handlers at correct `@app.route` decorators. `_unauthorized()` at lines 32–38 uses `ALLOWED_ORIGIN` constant. |
| `C:\Users\Sriram\posts-api\tests\test_function_app.py` | Write handler tests for create_post, update_post, delete_post | VERIFIED | 23 tests collected: 6 for create_post (requires_auth, missing_title, missing_description, invalid_json, success, integration), 5 for update_post, 4 for delete_post. `_make_auth_header()` helper at line 239. |
| `C:\Users\Sriram\azure-infrastructure\modules\postsapi.bicep` | authsettingsV2 resource + three new params | VERIFIED | Contains all three params and `authsettingsV2` child resource. `requireAuthentication: false`, `AllowAnonymous`, `POSTS_CLIENT_SECRET`, `postsApiClientId`. |
| `C:\Users\Sriram\azure-infrastructure\main.bicep` | postsapi module call with new params wired | VERIFIED | Module call at lines 183–191 passes all three Easy Auth params. `postsApiClientId` top-level param confirmed. No duplicate `azureTenantId`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| function_app.py::create_post | auth.py::require_auth | `from auth import require_auth` (line 10) | WIRED | Import confirmed line 10; called at line 46 inside create_post. |
| function_app.py::create_post | schema.py::build_post, validate_post, serialize_post | `from schema import build_post, validate_post, serialize_post` (line 11) | WIRED | Import confirmed; all three called in create_post lines 70, 79, 81. |
| function_app.py::create_post | slugs.py::generate_slug | `from slugs import generate_slug` (line 12) | WIRED | Import confirmed; called at line 69. |
| function_app.py::update_post | parse_post | `blob_client.download_blob().readall().decode() → parse_post(raw)` (line 115) | WIRED | `parse_post` imported from schema (line 8, pre-existing); called in update_post line 115. |
| function_app.py::update_post | original_date | `existing.metadata.get("date")` (line 116) | WIRED | Confirmed at line 116; passed as `date=original_date` to `build_post` at line 135. |
| function_app.py::delete_post | func.HttpResponse(status_code=204) | direct HttpResponse — NOT _json_response() (lines 186–189) | WIRED | Confirmed: `func.HttpResponse(status_code=204, headers={"Access-Control-Allow-Origin": ALLOWED_ORIGIN})` — no body. |
| postsapi.bicep::functionApp appSettings | POSTS_CLIENT_SECRET app setting | `postsApiClientSecret` param passed as app setting value (line 101–103) | WIRED | `name: 'POSTS_CLIENT_SECRET'`, `value: postsApiClientSecret` confirmed. |
| postsapi.bicep::authsettingsV2 | functionApp resource | `parent: functionApp` (line 116) | WIRED | `parent: functionApp` confirmed at line 116. |

### Data-Flow Trace (Level 4)

All three write handlers (create_post, update_post, delete_post) receive real data from the request body and write to/read from actual Azure Blob Storage via the `get_container_client()` → SDK calls chain. No hardcoded empty returns exist on the happy path. The 401, 400, 404, and 500 error returns are correct short-circuits, not stubs.

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| create_post | `slug` | `generate_slug(title, client)` — derives from title, deduplicates against blob listing | Yes | FLOWING |
| create_post | blob upload | `client.get_blob_client(f"{slug}.md").upload_blob(content.encode(), overwrite=True)` | Yes | FLOWING |
| update_post | `original_date` | `parse_post(raw).metadata.get("date")` from existing blob download | Yes | FLOWING |
| update_post | blob upload | `blob_client.upload_blob(content.encode(), overwrite=True)` | Yes | FLOWING |
| delete_post | blob deletion | `client.get_blob_client(f"{slug}.md").delete_blob()` | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All three handlers importable | `.venv/Scripts/python -c "import function_app; print(callable(function_app.create_post), callable(function_app.update_post), callable(function_app.delete_post))"` | `True True True` | PASS |
| auth.py base64 padding fix present | `.venv/Scripts/python -c "from auth import require_auth; import inspect; src=inspect.getsource(require_auth); print('+ \"==\"' in src)"` | `True` | PASS |
| 20 unit tests pass | `.venv/Scripts/pytest tests/test_function_app.py -k "not integration" -q` | `20 passed, 3 deselected in 0.57s` | PASS |
| 23 tests collected (correct count) | `.venv/Scripts/pytest tests/test_function_app.py --co -q` | 23 tests listed | PASS |

### Probe Execution

No probe scripts declared in any PLAN.md for this phase. Step 7c: SKIPPED (no probe-*.sh files).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| API-03 | 04-01 | POST /api/posts creates a new post blob (MSAL-gated) | SATISFIED | `create_post` at `@app.route(route="posts", methods=["POST"])` — auth-gated, blob upload, returns 201 {slug}. Checkbox marked `[x]` in REQUIREMENTS.md. |
| API-04 | 04-02 | PUT /api/posts/:slug updates an existing post blob (MSAL-gated) | SATISFIED | `update_post` at `@app.route(route="posts/{slug}", methods=["PUT"])` — auth-gated, date-preserving update. **Note: REQUIREMENTS.md checkbox is `[ ]` unchecked — documentation staleness, not an implementation gap.** |
| API-05 | 04-02 | DELETE /api/posts/:slug deletes a post blob (MSAL-gated) | SATISFIED | `delete_post` at `@app.route(route="posts/{slug}", methods=["DELETE"])` — auth-gated, returns bare 204. **Note: REQUIREMENTS.md checkbox is `[ ]` unchecked — documentation staleness, not an implementation gap.** |
| SEC-02 | 04-01, 04-02, 04-03 | Write API endpoints validate Bearer token before any mutation | SATISFIED | All three write handlers call `require_auth(req)` as first instruction. postsapi.bicep deploys authsettingsV2 with Easy Auth platform injection. Checkbox marked `[x]` in REQUIREMENTS.md. |

**Orphaned requirements check:** REQUIREMENTS.md traceability table maps API-03, API-04, API-05, SEC-02 to Phase 4. All four are addressed across Plans 04-01, 04-02, 04-03. No orphaned requirements.

**Documentation staleness (WARNING):** REQUIREMENTS.md lines 16–17 show `[ ]` (unchecked) for API-04 and API-05 despite both being implemented and tested. The traceability table (lines 98–99) also shows "Pending" for both. This is a stale documentation artifact — the code fully satisfies both requirements. The file should be updated to `[x]` for API-04 and API-05, and the traceability table should read "Complete".

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No TBD, FIXME, XXX, TODO, HACK, or PLACEHOLDER markers in any of the four phase files (auth.py, function_app.py, test_function_app.py, postsapi.bicep). No empty handlers, no hardcoded empty data on happy paths, no return null/return [].

### Human Verification Required

#### 1. Integration Test Suite (Azurite)

**Test:** Start Azurite (`azurite --silent --location /tmp/azurite --debug /tmp/azurite/debug.log &`) then run `cd C:\Users\Sriram\posts-api && .venv\Scripts\pytest tests\test_function_app.py -x -q`
**Expected:** All 23 tests pass — including `test_create_post_integration`, `test_update_post_integration`, and `test_delete_post_integration`
**Why human:** Integration tests require the Azurite local blob storage emulator to be running. The verifier cannot start services.

#### 2. Live Deployment — Public Read Still Works

**Test:** `curl https://<posts-api-hostname>/api/posts` (no Authorization header)
**Expected:** HTTP 200 with `{"posts": [...]}` — authsettingsV2 `requireAuthentication: false + AllowAnonymous` keeps this public
**Why human:** Requires the live Azure deployment. The plan included a human-verify checkpoint that was completed, but the verifier cannot independently confirm live endpoint behavior.

#### 3. Live Deployment — Unauthenticated Write Returns 401

**Test:** `curl -X POST https://<posts-api-hostname>/api/posts -H "Content-Type: application/json" -d '{"title":"test","description":"test"}'`
**Expected:** HTTP 401 `{"error": "Unauthorized"}` — from the `require_auth()` handler gate
**Why human:** Same as above — requires live Azure endpoint.

#### 4. Azure Portal — Easy Auth Provider Status

**Test:** Azure Portal → posts-api Function App → Authentication blade
**Expected:** Microsoft identity provider listed with status "Enabled". `requireAuthentication` shown as false (AllowAnonymous mode).
**Why human:** Portal state cannot be queried programmatically in this context.

### Gaps Summary

No implementation gaps found. All 14 must-have truths are VERIFIED against the actual codebase.

The only open items are:
1. **Integration tests** requiring Azurite — test code is correct and complete; this is a runtime dependency, not a code gap.
2. **Live deployment verification** — the SUMMARY reports the human-verify checkpoint passed (GET 200, POST 401 confirmed), but the verifier cannot independently confirm live Azure state.
3. **REQUIREMENTS.md staleness** — API-04 and API-05 checkboxes and traceability table entries should be updated to `[x]` / "Complete" to reflect the completed implementation. This is a documentation cleanup, not a blocking gap.

---

_Verified: 2026-06-05_
_Verifier: Claude (gsd-verifier)_
