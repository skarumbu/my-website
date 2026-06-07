# Phase 4: Write API - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Add three authenticated write endpoints to the existing Python Azure Functions backend (`posts-api` repo): `POST /api/posts` (create), `PUT /api/posts/:slug` (full update), and `DELETE /api/posts/:slug` (delete). Auth is enforced via Azure App Service Easy Auth — the platform validates the Bearer token and injects claims; the handler reads `X-MS-CLIENT-PRINCIPAL`. No new Azure resources required beyond enabling Easy Auth on the posts-api Function App. The read endpoints from Phase 2 are unchanged.

</domain>

<decisions>
## Implementation Decisions

### Request/Response Contract
- **D-01:** `POST /api/posts` accepts JSON body `{ title: string, description: string, body: string, published: bool }`. The API generates the slug via `generate_slug()` and returns `{ slug }` on success (201).
- **D-02:** `PUT /api/posts/:slug` accepts the same JSON shape as POST — full replacement. Slug is immutable (taken from the URL). `updatedAt` is always auto-set by the backend (Phase 1 D-02). Returns the updated post fields on success (200).
- **D-03:** `DELETE /api/posts/:slug` has no request body. Returns 204 No Content on success.
- **D-04:** `published` field in PUT controls published/draft toggle — no separate endpoint needed. The editor sends `published: true` to publish, `published: false` to unpublish.

### Authentication
- **D-05:** Use **Azure App Service Easy Auth** — follow the `ideas-api` pattern exactly. Enable Azure AD authentication on the posts-api Function App. Add a `require_auth()` helper (identical to `C:\Users\Sriram\ideas-api\auth.py`) that reads the `X-MS-CLIENT-PRINCIPAL` header and raises `ValueError("Unauthenticated")` if missing.
- **D-06:** Any write request that fails `require_auth()` returns a 401 JSON response `{ "error": "Unauthorized" }`. No mutation occurs.

### Claude's Discretion
- **CORS / OPTIONS preflight:** Enable CORS for the posts-api Function App in Azure (via Bicep or portal), allowing `https://www.quixotry.me`. This handles OPTIONS preflight for POST/PUT/DELETE from the browser without a manual OPTIONS handler.
- **Validation errors:** Return 400 `{ "error": "..." }` for missing required fields or invalid slug format — follow the existing `_json_response()` pattern.
- **Slug conflict on POST:** If `generate_slug()` produces a slug that already exists, `generate_slug()` already handles deduplication (appends `-2`, `-3`) — no special handling needed.
- **Storage errors:** Return 500 `{ "error": "storage error" }` on unexpected exceptions — consistent with read routes.
- **404 on PUT/DELETE:** Return 404 `{ "error": "not found" }` if the slug blob doesn't exist.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Scope & Requirements
- `.planning/REQUIREMENTS.md` — API-03, API-04, API-05, SEC-02 (the 4 requirements this phase must satisfy)
- `.planning/ROADMAP.md` §Phase 4 — Success criteria and phase goal

### Existing Backend (work happens here)
- `C:\Users\Sriram\posts-api\function_app.py` — Existing route structure, `_json_response()` helper, `ALLOWED_ORIGIN` constant, `SLUG_RE` pattern — all patterns to follow
- `C:\Users\Sriram\posts-api\schema.py` — `build_post()`, `validate_post()`, `serialize_post()`, `parse_post()`, `REQUIRED_FIELDS` — use these for all frontmatter operations; never f-string YAML
- `C:\Users\Sriram\posts-api\slugs.py` — `generate_slug()` for slug derivation on POST, `get_container_client()` for blob storage access
- `C:\Users\Sriram\posts-api\requirements.txt` — Check before adding any new Python dependency

### Auth Pattern Reference (copy, not import)
- `C:\Users\Sriram\ideas-api\auth.py` — `require_auth()` reads `X-MS-CLIENT-PRINCIPAL` (EasyAuth header); copy this pattern into posts-api (do NOT import across repos)
- `C:\Users\Sriram\ideas-api\function_app.py` — See `_unauthorized()` helper and how `require_auth()` is called at the top of write handlers

### Prior Phase Context
- `.planning/phases/01-storage-schema/01-CONTEXT.md` §D-01–D-03 — Frontmatter schema (6 fields locked: title, slug, date, published, description, updatedAt)
- `.planning/STATE.md` §Known Pitfalls — YAML corruption pitfall (use python-frontmatter's `serialize_post()`, never f-string YAML); MSAL scope pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `schema.py::build_post()` — builds a frontmatter.Post from title/slug/date/description/body/published; use for POST and PUT
- `schema.py::validate_post()` — returns list of error strings; call before writing to blob
- `schema.py::serialize_post()` — converts frontmatter.Post to YAML+markdown string for blob upload
- `schema.py::parse_post()` — used in PUT to read the existing blob before deciding whether it exists
- `slugs.py::generate_slug()` — auto-derives slug from title with dedup; use for POST
- `slugs.py::get_container_client()` — blob container access (DefaultAzureCredential / managed identity)

### Established Patterns
- Route pattern: `@app.route(route="posts/{slug}", methods=["GET", "PUT", "DELETE"])` — same decorator style
- Response pattern: `_json_response(data, status_code)` — consistent JSON + CORS header; use for all responses
- Error pattern: `{"error": "message"}` payload; 400/401/404/500 status codes
- Auth pattern: call `require_auth(req)` at top of handler; catch `ValueError` and return `_unauthorized()`
- Blob upload: `client.get_blob_client(f"{slug}.md").upload_blob(content, overwrite=True)`
- Blob delete: `client.get_blob_client(f"{slug}.md").delete_blob()`

### Integration Points
- `function_app.py` — add 3 new route handlers here (POST posts, PUT posts/{slug}, DELETE posts/{slug})
- New `auth.py` in posts-api — copy from ideas-api, imported in function_app.py
- Azure Function App — Easy Auth must be enabled (Azure AD provider) before write endpoints work
- CORS config — enable at Function App level for `https://www.quixotry.me`

</code_context>

<specifics>
## Specific Ideas

- The `require_auth()` pattern from `ideas-api/auth.py` is the exact model — copy the file into posts-api rather than creating something new.
- The existing comment in `function_app.py` ("Write routes (Phase 4) must validate the Bearer token in the handler before mutating any data") refers to calling `require_auth()` at the top of each write handler — not manual JWT validation.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 4-write-api*
*Context gathered: 2026-06-05*
