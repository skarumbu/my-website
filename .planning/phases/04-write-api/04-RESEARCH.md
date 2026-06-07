# Phase 4: Write API - Research

**Researched:** 2026-06-05
**Domain:** Python Azure Functions — authenticated write endpoints, Azure App Service Easy Auth
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `POST /api/posts` accepts JSON body `{ title, description, body, published }`. API generates slug via `generate_slug()`, returns `{ slug }` on 201.
- **D-02:** `PUT /api/posts/:slug` accepts same JSON shape as POST — full replacement. Slug is immutable (URL). `updatedAt` always auto-set by backend. Returns updated post fields on 200.
- **D-03:** `DELETE /api/posts/:slug` — no request body, returns 204 No Content on success.
- **D-04:** `published` field in PUT controls publish/unpublish toggle — no separate endpoint needed.
- **D-05:** Azure App Service Easy Auth — follow the `ideas-api` pattern exactly. Enable Azure AD authentication on the posts-api Function App. Add `require_auth()` helper (identical to `C:\Users\Sriram\ideas-api\auth.py`) that reads `X-MS-CLIENT-PRINCIPAL` header and raises `ValueError("Unauthenticated")` if missing.
- **D-06:** Any write request that fails `require_auth()` returns a 401 JSON response `{ "error": "Unauthorized" }`. No mutation occurs.

### Claude's Discretion

- **CORS / OPTIONS preflight:** Enable CORS for the posts-api Function App in Azure (via Bicep or portal), allowing `https://www.quixotry.me`. This handles OPTIONS preflight for POST/PUT/DELETE from the browser without a manual OPTIONS handler.
- **Validation errors:** Return 400 `{ "error": "..." }` for missing required fields or invalid slug format — follow the existing `_json_response()` pattern.
- **Slug conflict on POST:** `generate_slug()` already handles deduplication — no special handling needed.
- **Storage errors:** Return 500 `{ "error": "storage error" }` on unexpected exceptions.
- **404 on PUT/DELETE:** Return 404 `{ "error": "not found" }` if the slug blob doesn't exist.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| API-03 | `POST /api/posts` creates a new post blob from request body (MSAL-gated) | handler pattern in function_app.py + auth.py copy + build_post/serialize_post |
| API-04 | `PUT /api/posts/:slug` updates an existing post blob (MSAL-gated) | parse_post to read existing + build_post for rebuild + upload_blob(overwrite=True) |
| API-05 | `DELETE /api/posts/:slug` deletes a post blob (MSAL-gated) | delete_blob() on BlobClient + ResourceNotFoundError catch |
| SEC-02 | Write API endpoints validate Bearer token before any mutation | require_auth() at top of each handler; ValueError → _unauthorized() |
</phase_requirements>

---

## Summary

Phase 4 adds three authenticated write endpoints to the existing `posts-api` Python Azure Functions backend. All implementation work is in a single repo (`C:\Users\Sriram\posts-api`) — no new Azure resources beyond enabling Easy Auth on the existing Function App.

The auth pattern is completely established in `ideas-api/auth.py`: `require_auth()` decodes the `X-MS-CLIENT-PRINCIPAL` header that Azure App Service Easy Auth injects after token validation. The function handler never touches raw JWT bytes — the platform handles token validation. The handler calls `require_auth(req)` at the top, catches `ValueError`, and returns a 401. This is a straight copy-and-wire job.

The three write handlers follow the exact same decorator pattern as the existing read routes, use the same `_json_response()` helper, and delegate all blob and schema work to the existing `schema.py` / `slugs.py` modules. The Bicep module (`postsapi.bicep`) already has CORS configured for `https://www.quixotry.me` and the Function App has system-assigned managed identity with `StorageBlobDataContributor` — no infrastructure changes needed except adding the Easy Auth `authsettingsV2` resource to the Bicep module.

The phase produces four new files/modifications: `posts-api/auth.py` (copied), `posts-api/function_app.py` (3 new handlers), `posts-api/tests/test_function_app.py` (extended with write handler tests), and `azure-infrastructure/modules/postsapi.bicep` (Easy Auth resource added).

**Primary recommendation:** Copy `auth.py` from `ideas-api` verbatim, add `_unauthorized()` helper to `function_app.py`, wire `require_auth()` at the top of each write handler, and add Easy Auth `authsettingsV2` resource to `postsapi.bicep` matching the `ideasapi.bicep` pattern.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bearer token validation | Azure Platform (Easy Auth) | API tier (header read) | Platform validates token before request reaches handler; handler reads injected claims |
| Slug generation | API / Backend (slugs.py) | — | Deterministic, dedup-aware; must be server-side to prevent collisions |
| Post serialization (YAML+markdown) | API / Backend (schema.py) | — | python-frontmatter handles YAML escaping; never do this client-side |
| Blob storage writes | API / Backend (slugs.py ContainerClient) | — | Private container; all access through Functions, never direct browser |
| CORS preflight (OPTIONS) | Azure Platform (Function App CORS config) | — | Already configured in postsapi.bicep; no manual OPTIONS handler needed |
| Input validation | API / Backend (validate_post()) | — | schema.py::validate_post() returns error list; call before any blob write |

---

## Standard Stack

### Core

No new packages required. All dependencies are already in `posts-api/requirements.txt`:

| Library | Version in requirements.txt | Purpose | Status |
|---------|---------------------------|---------|--------|
| azure-functions | (latest in range) | HTTP handler framework, `func.HttpRequest/HttpResponse` | Already installed |
| azure-storage-blob | >=12.23.1,<12.29.0 | Blob upload/delete via `ContainerClient` | Already installed |
| azure-identity | >=1.15.0 | `DefaultAzureCredential` for managed identity auth to blob | Already installed |
| python-frontmatter | >=1.3.0 | `build_post`, `serialize_post`, `parse_post` | Already installed |
| python-slugify | >=8.0.4 | `generate_slug()` uses `from slugify import slugify` | Already installed |

[VERIFIED: codebase — `C:\Users\Sriram\posts-api\requirements.txt`]

### No New Dependencies

This phase adds zero new Python packages. All write handler logic composes already-installed libraries.

**Installation:** None required.

---

## Package Legitimacy Audit

No new packages are installed in this phase. Existing packages were vetted during Phase 1/2.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (Phase 5 editor — future)
    │  POST/PUT/DELETE /api/posts[/:slug]
    │  Authorization: Bearer <token>
    ▼
Azure App Service Easy Auth (platform layer)
    │  Validates Azure AD Bearer token
    │  Injects X-MS-CLIENT-PRINCIPAL header (base64 JSON)
    │  Rejects invalid tokens with 401 before handler fires
    ▼
Azure Function Handler (function_app.py)
    │
    ├─ require_auth(req)  ← reads X-MS-CLIENT-PRINCIPAL
    │      │ ValueError → _unauthorized() → 401 {"error":"Unauthorized"}
    │
    ├─ req.get_json()  ← parse request body
    │      │ Exception → 400 {"error":"Invalid JSON body"}
    │
    ├─ validate inputs (required fields, slug format)
    │      │ fail → 400 {"error":"..."}
    │
    ├─ build_post() / generate_slug()  ← schema.py + slugs.py
    │
    ├─ get_container_client()  ← DefaultAzureCredential / managed identity
    │
    ├─ upload_blob(overwrite=True)  ← POST/PUT
    │   OR delete_blob()            ← DELETE
    │      │ ResourceNotFoundError → 404 {"error":"not found"}
    │      │ Exception             → 500 {"error":"storage error"}
    │
    └─ _json_response(result, 201/200/204)
```

### Recommended Project Structure

```
posts-api/
├── function_app.py     # add create_post, update_post, delete_post handlers
├── auth.py             # NEW — copied from ideas-api/auth.py verbatim
├── schema.py           # unchanged (build_post, validate_post, serialize_post, parse_post)
├── slugs.py            # unchanged (generate_slug, get_container_client)
├── requirements.txt    # unchanged — no new dependencies
├── tests/
│   ├── conftest.py         # unchanged — Azurite fixture
│   ├── test_function_app.py # EXTENDED — add write handler tests
│   └── ...                 # test_schema.py, test_slugs.py unchanged
└── azure-infrastructure/
    └── modules/
        └── postsapi.bicep  # EXTENDED — add authsettingsV2 resource
```

### Pattern 1: Write Handler Structure

Every write handler follows this exact sequence. There is no variation allowed.

```python
# Source: C:\Users\Sriram\ideas-api\function_app.py (verified in codebase)

@app.route(route="posts", methods=["POST"])
def create_post(req: func.HttpRequest) -> func.HttpResponse:
    # 1. Auth gate — MUST be first, before any other work
    try:
        require_auth(req)
    except ValueError:
        return _unauthorized()

    # 2. Parse body
    try:
        body = req.get_json()
    except Exception:
        return _json_response({"error": "Invalid JSON body"}, status_code=400)

    # 3. Validate required fields
    title = body.get("title", "").strip()
    description = body.get("description", "").strip()
    post_body = body.get("body", "").strip()
    published = body.get("published", False)
    if not title or not description:
        return _json_response({"error": "title and description are required"}, status_code=400)

    # 4. Build + write
    try:
        client = get_container_client()
        slug = generate_slug(title, client)
        post = build_post(
            title=title,
            slug=slug,
            date=datetime.now(timezone.utc).isoformat(),
            description=description,
            body=post_body,
            published=bool(published),
        )
        errors = validate_post(post)
        if errors:
            return _json_response({"error": errors[0]}, status_code=400)
        content = serialize_post(post)
        client.get_blob_client(f"{slug}.md").upload_blob(content.encode(), overwrite=True)
        return _json_response({"slug": slug}, status_code=201)
    except Exception:
        return _json_response({"error": "storage error"}, status_code=500)
```

### Pattern 2: `_unauthorized()` Helper

Add to `function_app.py` alongside `_json_response()`. The ALLOWED_ORIGIN constant is already present.

```python
# Source: C:\Users\Sriram\ideas-api\function_app.py (verified in codebase)

def _unauthorized(message: str = "Unauthorized") -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps({"error": message}),
        status_code=401,
        mimetype="application/json",
        headers={"Access-Control-Allow-Origin": ALLOWED_ORIGIN},
    )
```

Note: ideas-api uses `"*"` for CORS — posts-api uses the scoped `ALLOWED_ORIGIN` constant. Keep posts-api consistent with its own pattern.

### Pattern 3: require_auth() — Exact Copy from ideas-api

```python
# Source: C:\Users\Sriram\ideas-api\auth.py (verified in codebase)

import base64
import json
import azure.functions as func

def require_auth(req: func.HttpRequest) -> tuple[str, str, str]:
    """Decode EasyAuth principal header. Returns (oid, email, display_name)."""
    principal_b64 = req.headers.get("X-MS-CLIENT-PRINCIPAL")
    if not principal_b64:
        raise ValueError("Unauthenticated")
    principal = json.loads(base64.b64decode(principal_b64 + "=="))
    claims = {c["typ"]: c["val"] for c in principal.get("claims", [])}
    oid = claims.get("http://schemas.microsoft.com/identity/claims/objectidentifier", claims.get("oid", ""))
    email = claims.get("preferred_username", claims.get("upn", claims.get("email", "")))
    name = claims.get("name", email)
    return oid, email, name
```

### Pattern 4: Easy Auth Bicep Resource

Add to `postsapi.bicep` after the `functionApp` resource, following the `ideasapi.bicep` pattern exactly.

```bicep
// Source: C:\Users\Sriram\azure-infrastructure\modules\ideasapi.bicep (verified in codebase)

@description('Azure Entra ID tenant ID for EasyAuth')
param azureTenantId string

@description('posts-api App Registration client ID')
param postsApiClientId string

@secure()
@description('posts-api App Registration client secret')
param postsApiClientSecret string

// Add to functionApp appSettings:
// { name: 'POSTS_CLIENT_SECRET', value: postsApiClientSecret }

resource authSettings 'Microsoft.Web/sites/config@2022-09-01' = {
  parent: functionApp
  name: 'authsettingsV2'
  properties: {
    globalValidation: {
      requireAuthentication: false      // ANONYMOUS on app, handler enforces auth
      unauthenticatedClientAction: 'AllowAnonymous'
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: postsApiClientId
          clientSecretSettingName: 'POSTS_CLIENT_SECRET'
          openIdIssuer: '${az.environment().authentication.loginEndpoint}${azureTenantId}/v2.0'
        }
        validation: {
          allowedAudiences: [
            'api://${postsApiClientId}'
          ]
        }
      }
    }
    login: {
      tokenStore: {
        enabled: true
      }
    }
  }
}
```

**Critical nuance:** `requireAuthentication: false` + `AllowAnonymous` is correct here. The public read routes must remain unauthenticated — Easy Auth validates tokens when present and injects `X-MS-CLIENT-PRINCIPAL`, but does NOT block unauthenticated requests. The handler then calls `require_auth()` and returns 401 if the header is missing. This is different from the `ideas-api` pattern which sets `requireAuthentication: true` because ALL its routes are gated. [ASSUMED — based on Easy Auth documentation pattern; verify the exact setting before applying]

### Pattern 5: PUT Handler (slug from URL, full replacement)

```python
# Source: pattern derived from existing get_post() in function_app.py + ideas-api PATCH pattern

@app.route(route="posts/{slug}", methods=["PUT"])
def update_post(req: func.HttpRequest) -> func.HttpResponse:
    try:
        require_auth(req)
    except ValueError:
        return _unauthorized()

    slug = req.route_params.get("slug")
    if not slug or not SLUG_RE.match(slug):
        return _json_response({"error": "invalid slug"}, status_code=400)

    try:
        body = req.get_json()
    except Exception:
        return _json_response({"error": "Invalid JSON body"}, status_code=400)

    try:
        client = get_container_client()
        blob_client = client.get_blob_client(f"{slug}.md")
        # Verify blob exists before overwriting
        blob_client.download_blob()  # raises ResourceNotFoundError if missing
    except ResourceNotFoundError:
        return _json_response({"error": "not found"}, status_code=404)
    except Exception:
        return _json_response({"error": "storage error"}, status_code=500)

    title = body.get("title", "").strip()
    description = body.get("description", "").strip()
    post_body = body.get("body", "")
    published = body.get("published", False)

    post = build_post(
        title=title,
        slug=slug,           # slug comes from URL, not body — immutable
        date=...,            # preserve original date — read from existing blob first
        description=description,
        body=post_body,
        published=bool(published),
        # updatedAt omitted → build_post auto-sets to now()
    )
    # ... validate, serialize, upload with overwrite=True
```

**Note on `date` preservation for PUT:** The existing blob must be read first (which also serves as the existence check), and the original `date` field preserved. The handler reads the blob content, parses it with `parse_post()`, extracts the original date, then rebuilds with the new fields. This avoids resetting the post's creation date on every edit.

### Anti-Patterns to Avoid

- **Don't manually decode the Bearer token.** Easy Auth does token validation; the handler only reads the injected `X-MS-CLIENT-PRINCIPAL` header. Trying to validate JWTs in Python would require `msal` or `PyJWT` and is both unnecessary and error-prone.
- **Don't f-string YAML.** Always use `serialize_post(post)` (i.e., `frontmatter.dumps(post)`). F-string interpolation into YAML breaks on titles containing colons, quotes, or newlines. [VERIFIED: codebase — schema.py docstring]
- **Don't add `date` to the POST body contract.** The handler sets `date = datetime.now(timezone.utc).isoformat()` — it is never accepted from the client.
- **Don't return 404 for an unauthenticated request to a write route.** Always return 401 when `require_auth()` raises. Returning 404 leaks existence information.
- **Don't use `@app.route(..., methods=["PUT", "DELETE"])` to combine routes.** The existing pattern uses separate handler functions per method for clarity and test isolation.
- **Don't add OPTIONS handlers manually.** CORS preflight is handled at the Function App platform level via the `cors` setting in Bicep / the portal. Manual OPTIONS handlers conflict with platform-level CORS.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT validation | Custom MSAL/PyJWT verify loop | Azure App Service Easy Auth | Platform handles token lifecycle, key rotation, multi-tenant validation; any custom code will have edge cases |
| YAML serialization | f-string or manual YAML construction | `schema.py::serialize_post()` (python-frontmatter) | Titles with colons, quotes, or special chars corrupt raw YAML; python-frontmatter handles all escaping |
| Slug deduplication | Custom regex + blob list | `slugs.py::generate_slug()` | Already implemented with prefix-filtered blob listing and counter suffix |
| Blob existence check | Listing all blobs to check for name | `blob_client.download_blob()` + catch `ResourceNotFoundError` | Direct blob client raises `ResourceNotFoundError` on missing blob; listing is expensive and racy |
| CORS preflight | `@app.route(route="...", methods=["OPTIONS"])` | Bicep `cors.allowedOrigins` setting | Platform CORS handles all preflight before handler is invoked |

**Key insight:** Every "build it yourself" impulse in this phase has a ready-made solution already present in the codebase or in the Azure platform. The phase is primarily integration work.

---

## Common Pitfalls

### Pitfall 1: POST Route Conflict with Existing GET Route

**What goes wrong:** Both `GET /api/posts` and `POST /api/posts` target the same route string `"posts"`. If the decorator is written as `@app.route(route="posts", methods=["GET", "POST"])` on the same function, or if a single handler tries to dispatch by method, the existing `list_posts` function breaks.

**Why it happens:** Azure Functions v4 Python SDK matches routes by path — methods are a filter on top. Both routes exist fine as separate functions with the same route string but different methods.

**How to avoid:** Add a separate `create_post` function with `@app.route(route="posts", methods=["POST"])`. The existing `list_posts` function keeps `methods=["GET"]` unchanged. [VERIFIED: codebase — function_app.py]

**Warning signs:** Tests for `list_posts` start returning 405 or routing to the wrong handler.

### Pitfall 2: PUT Route Conflict with Existing GET Route

**What goes wrong:** Same issue as above but for `"posts/{slug}"`. The existing `get_post` uses `@app.route(route="posts/{slug}", methods=["GET"])`. PUT and DELETE need their own functions on the same route.

**How to avoid:** Separate functions for `update_post` (PUT) and `delete_post` (DELETE), each using `@app.route(route="posts/{slug}", methods=["..."])`. [VERIFIED: codebase — ideas-api uses this exact multi-function-same-route pattern]

### Pitfall 3: Overwriting `date` on Every PUT

**What goes wrong:** `build_post()` always sets `date` to now if not provided. If the PUT handler creates a new `build_post()` without extracting the original `date` from the existing blob, every edit resets the post creation date.

**Why it happens:** `build_post()` signature includes `date` as a positional parameter — it's easy to pass `datetime.now()` without realizing it clobbers the original.

**How to avoid:** In the PUT handler, download and `parse_post()` the existing blob first (this also serves as the 404 check), extract `post.metadata["date"]`, and pass it to `build_post()`.

**Warning signs:** Published post dates jump to the edit time on every save.

### Pitfall 4: authsettingsV2 `requireAuthentication: true` Blocks Public Read Routes

**What goes wrong:** If `requireAuthentication: true` is set in the `authsettingsV2` resource (matching the ideas-api pattern without understanding the difference), all requests without a valid Bearer token get a 401 from the platform — including `GET /api/posts` and `GET /api/posts/:slug` which must remain public.

**Why it happens:** The ideas-api has no public endpoints — every route requires auth. The posts-api has both public (GET) and private (POST/PUT/DELETE) routes.

**How to avoid:** Set `requireAuthentication: false` and `unauthenticatedClientAction: 'AllowAnonymous'` in `authsettingsV2`. Easy Auth will still validate tokens when present and inject `X-MS-CLIENT-PRINCIPAL` — the handler then enforces auth for write routes only. [ASSUMED — verify this is the correct behavior for Easy Auth with `AllowAnonymous`; the ideas-api uses the opposite setting]

**Warning signs:** `GET /api/posts` starts returning 401 after Easy Auth is enabled.

### Pitfall 5: Missing App Registration Before Bicep Deploy

**What goes wrong:** `postsapi.bicep` needs a `postsApiClientId` (App Registration client ID) to configure Easy Auth. If Bicep is deployed before the App Registration exists in Azure Entra ID, the deploy fails.

**Why it happens:** Bicep references the App Registration by client ID — it can't create the registration itself.

**How to avoid:** Create the App Registration in Azure Entra ID first (via portal or `az ad app create`), note the client ID and client secret, then pass them to the Bicep deployment. The `ideas-api/setup-app-registration.sh` script is the reference for how this was done for ideas-api. The plan must include a human step for App Registration creation before Bicep deploy.

**Warning signs:** Bicep deploy completes but Easy Auth `authsettingsV2` resource fails with "Invalid client ID".

### Pitfall 6: base64 Padding in X-MS-CLIENT-PRINCIPAL Decode

**What goes wrong:** The `require_auth()` helper appends `"=="` to the base64 string before decoding: `base64.b64decode(principal_b64 + "==")`. Removing this or changing it causes `binascii.Error: Incorrect padding` for some token lengths.

**Why it happens:** Azure's base64 encoding may omit padding characters. Python's `base64.b64decode` requires correct padding. The `"=="` append is a safe over-pad (extra `=` characters are ignored).

**How to avoid:** Copy `auth.py` verbatim — don't refactor the `+ "=="`. [VERIFIED: codebase — ideas-api/auth.py]

---

## Code Examples

### Test Pattern for Unauthenticated Request (SEC-02)

```python
# Source: derived from existing test_function_app.py unit test pattern (verified in codebase)

def test_create_post_requires_auth(monkeypatch):
    """POST /api/posts without X-MS-CLIENT-PRINCIPAL returns 401."""
    req = func.HttpRequest(
        method="POST",
        body=b'{"title": "Test", "description": "Desc", "body": "Content", "published": false}',
        url="/api/posts",
        params={},
        headers={},  # no X-MS-CLIENT-PRINCIPAL
    )
    resp = function_app.create_post(req)
    assert resp.status_code == 401
    assert json.loads(resp.get_body()) == {"error": "Unauthorized"}
```

### Test Pattern for Authenticated Request (helper)

```python
# Source: derived from ideas-api auth.py + existing test pattern

import base64
import json as _json

def _make_auth_header(email: str = "test@example.com") -> dict:
    """Build X-MS-CLIENT-PRINCIPAL header for unit tests (no real Azure token needed)."""
    principal = {
        "claims": [
            {"typ": "preferred_username", "val": email},
            {"typ": "http://schemas.microsoft.com/identity/claims/objectidentifier", "val": "test-oid"},
            {"typ": "name", "val": "Test User"},
        ]
    }
    encoded = base64.b64encode(_json.dumps(principal).encode()).decode()
    return {"X-MS-CLIENT-PRINCIPAL": encoded}
```

### DELETE — 204 No Content Response

```python
# Source: C:\Users\Sriram\ideas-api\function_app.py delete_idea_route (verified in codebase)
# Note: _json_response() cannot return 204 (it always sets a body). Use func.HttpResponse directly.

return func.HttpResponse(
    status_code=204,
    headers={"Access-Control-Allow-Origin": ALLOWED_ORIGIN},
)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `UseDevelopmentStorage=true` connection string | Explicit Azurite connection string (see conftest.py) | azure-storage-blob >= 12.24.0 | conftest.py already updated; don't regress |
| Manual JWT validation in Azure Functions | Azure App Service Easy Auth + `X-MS-CLIENT-PRINCIPAL` | Platform feature, stable | No PyJWT/MSAL needed in handler code |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `requireAuthentication: false` + `AllowAnonymous` in authsettingsV2 allows public read routes to work while Easy Auth still injects the principal header for authenticated requests | Pitfall 4, Pattern 4 | If wrong, public GET routes become auth-gated, breaking the public reading UI; fix is to change the setting and redeploy Bicep |
| A2 | A new Azure AD App Registration must be created for posts-api before the Bicep authsettingsV2 resource can be deployed | Pitfall 5 | If an existing registration can be reused, the human step in the plan changes; check with the Azure portal before plan execution |

---

## Open Questions

1. **Can an existing App Registration be reused for posts-api Easy Auth?**
   - What we know: ideas-api has its own App Registration (`ideasApiClientId = 'bb744b67-...'`). The main.bicep currently passes no `postsApiClientId` to `postsapi.bicep`.
   - What's unclear: Whether the user wants to create a new App Registration for posts-api or reuse an existing one (e.g., the main site's registration).
   - Recommendation: Plan should include a human verify step to create the App Registration before the Bicep deploy task. The existing `ideas-api/setup-app-registration.sh` is a reference.

2. **Should the Bicep deploy be part of this phase or a separate manual step?**
   - What we know: CORS is already configured in `postsapi.bicep` (line 91-95 — `allowedOrigins: ['https://www.quixotry.me']`). Only the `authsettingsV2` resource needs adding.
   - What's unclear: Whether the Bicep change requires a full `az deployment sub create` or can be scoped to just the Function App resource.
   - Recommendation: Scope the Bicep change to the `postsapi.bicep` module with `az deployment group create` — narrower blast radius than a full subscription deploy.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python | posts-api venv | Yes | 3.12 (system), 3.14 (mise) | — |
| pytest (posts-api venv) | Test suite | Yes | 9.0.3 (in .venv) | — |
| Azure CLI | Bicep deploy | Yes | 2.83.0 | Portal |
| Azurite | Integration tests | Yes (pre-existing `.azurite/` dir) | unknown | Skip integration tests |
| azure-functions-core-tools | Local func run | Not checked | — | Tests work without it |

[VERIFIED: codebase — `.venv/Scripts/pytest`, `posts-api/.azurite/` directory exists]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 9.0.3 |
| Config file | `C:\Users\Sriram\posts-api\pytest.ini` |
| Quick run command | `cd C:\Users\Sriram\posts-api && .venv\Scripts\pytest tests\test_function_app.py -x -q` |
| Full suite command | `cd C:\Users\Sriram\posts-api && .venv\Scripts\pytest -x -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| API-03 | POST creates blob, returns {slug} with 201 | unit + integration | `pytest tests/test_function_app.py -k "create_post" -x` | No — Wave 0 gap |
| API-03 | POST without auth returns 401, no blob written | unit | `pytest tests/test_function_app.py -k "create_post_requires_auth" -x` | No — Wave 0 gap |
| API-04 | PUT updates existing blob, returns 200 with fields | unit + integration | `pytest tests/test_function_app.py -k "update_post" -x` | No — Wave 0 gap |
| API-04 | PUT on missing slug returns 404 | unit | `pytest tests/test_function_app.py -k "update_post_not_found" -x` | No — Wave 0 gap |
| API-04 | PUT preserves original `date` field | unit | `pytest tests/test_function_app.py -k "update_post_preserves_date" -x` | No — Wave 0 gap |
| API-05 | DELETE removes blob, returns 204 | unit + integration | `pytest tests/test_function_app.py -k "delete_post" -x` | No — Wave 0 gap |
| API-05 | DELETE on missing slug returns 404 | unit | `pytest tests/test_function_app.py -k "delete_post_not_found" -x` | No — Wave 0 gap |
| SEC-02 | PUT/DELETE without auth return 401 | unit | `pytest tests/test_function_app.py -k "requires_auth" -x` | No — Wave 0 gap |

### Sampling Rate

- **Per task commit:** `cd C:\Users\Sriram\posts-api && .venv\Scripts\pytest tests\test_function_app.py -x -q`
- **Per wave merge:** `cd C:\Users\Sriram\posts-api && .venv\Scripts\pytest -x -q`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- `tests/test_function_app.py` needs write handler tests (API-03, API-04, API-05, SEC-02 scenarios)
- `auth.py` must exist before any write handler tests can import it
- No new config files needed — `pytest.ini` and `conftest.py` cover write tests

---

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Azure App Service Easy Auth — platform validates Bearer token; handler reads injected claims |
| V3 Session Management | No | Stateless API; tokens managed by Azure AD, not the Function |
| V4 Access Control | Yes | `require_auth()` at top of every write handler before any mutation |
| V5 Input Validation | Yes | `validate_post()` checks required fields; SLUG_RE checks slug format; `bool(published)` coerces type |
| V6 Cryptography | No | No cryptographic operations in handlers; token crypto is platform-layer |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated write | Elevation of privilege | `require_auth()` first line of every write handler; 401 before any mutation |
| YAML injection via title | Tampering | `serialize_post()` uses python-frontmatter — library handles YAML escaping |
| Blob overwrite via slug collision | Tampering | `generate_slug()` deduplicates; PUT explicitly checks blob exists first |
| CORS bypass | Spoofing | Platform-level CORS config in Bicep; `ALLOWED_ORIGIN` constant in response headers |
| Slug traversal (e.g., `../secret`) | Info disclosure | `SLUG_RE = re.compile(r"^[a-z0-9-]+$")` — rejects any slug not matching this pattern |

---

## Sources

### Primary (HIGH confidence)

- `C:\Users\Sriram\posts-api\function_app.py` — existing route pattern, `_json_response()`, `ALLOWED_ORIGIN`, `SLUG_RE`
- `C:\Users\Sriram\posts-api\schema.py` — `build_post`, `validate_post`, `serialize_post`, `parse_post`, `REQUIRED_FIELDS`
- `C:\Users\Sriram\posts-api\slugs.py` — `generate_slug`, `get_container_client`
- `C:\Users\Sriram\posts-api\requirements.txt` — package list (no new deps needed)
- `C:\Users\Sriram\posts-api\tests/` — full test suite (conftest.py, test_function_app.py patterns)
- `C:\Users\Sriram\ideas-api\auth.py` — `require_auth()` exact implementation to copy
- `C:\Users\Sriram\ideas-api\function_app.py` — `_unauthorized()`, write handler call sequence
- `C:\Users\Sriram\azure-infrastructure\modules\postsapi.bicep` — existing CORS config, managed identity, role assignment
- `C:\Users\Sriram\azure-infrastructure\modules\ideasapi.bicep` — `authsettingsV2` resource pattern for Easy Auth

### Secondary (MEDIUM confidence)

- `C:\Users\Sriram\azure-infrastructure\main.bicep` — confirms `postsapi.bicep` currently receives only `location` and `environment` params; new params (tenant ID, client ID, secret) must be added

### Tertiary (LOW confidence — requires Azure verification)

- Easy Auth `requireAuthentication: false` + `AllowAnonymous` behavior with selective per-handler enforcement — [ASSUMED] verify in Azure portal or docs before deploying

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and verified in codebase
- Architecture: HIGH — all patterns taken directly from the existing codebase (ideas-api and posts-api)
- Auth pattern: HIGH — exact source code for `require_auth()` read and documented
- Bicep auth settings: MEDIUM — Easy Auth resource pattern verified from ideasapi.bicep; the `AllowAnonymous` variant is [ASSUMED]
- Pitfalls: HIGH — derived from reading actual code (schema.py docstring, conftest.py comment, function_app.py comment)

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (stable Azure Functions + Easy Auth patterns)
