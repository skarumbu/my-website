# Phase 4: Write API - Pattern Map

**Mapped:** 2026-06-05
**Files analyzed:** 4 (1 new, 3 modified)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `C:\Users\Sriram\posts-api\auth.py` | utility | request-response | `C:\Users\Sriram\ideas-api\auth.py` | exact (verbatim copy) |
| `C:\Users\Sriram\posts-api\function_app.py` | controller | CRUD + request-response | `C:\Users\Sriram\ideas-api\function_app.py` | exact (same framework, same pattern) |
| `C:\Users\Sriram\posts-api\tests\test_function_app.py` | test | request-response | `C:\Users\Sriram\posts-api\tests\test_function_app.py` | exact (extend existing file) |
| `C:\Users\Sriram\azure-infrastructure\modules\postsapi.bicep` | config | — | `C:\Users\Sriram\azure-infrastructure\modules\ideasapi.bicep` | role-match (same resource type, different auth mode) |

---

## Pattern Assignments

### `C:\Users\Sriram\posts-api\auth.py` (utility, request-response)

**Analog:** `C:\Users\Sriram\ideas-api\auth.py`
**Action:** Copy verbatim — do not modify.

**Complete file** (lines 1–17):
```python
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

**Critical note:** The `+ "=="` padding on line 12 is load-bearing — Azure's base64 may omit padding; extra `=` characters are silently ignored by Python. Do not remove it.

---

### `C:\Users\Sriram\posts-api\function_app.py` — additions (controller, CRUD)

**Analog:** `C:\Users\Sriram\ideas-api\function_app.py`
**Action:** Add imports, `_unauthorized()` helper, and three new handler functions. Existing functions are unchanged.

**New import to add** (add after existing imports at top, lines 1–9 of posts-api version):
```python
from auth import require_auth
from schema import build_post, validate_post, serialize_post
from slugs import generate_slug
from datetime import datetime, timezone
```

**`_unauthorized()` helper** — add alongside existing `_json_response()` (after line 25):
```python
def _unauthorized(message: str = "Unauthorized") -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps({"error": message}),
        status_code=401,
        mimetype="application/json",
        headers={"Access-Control-Allow-Origin": ALLOWED_ORIGIN},
    )
```

**Note:** ideas-api uses `"*"` for CORS (line 54 of ideas-api/function_app.py); posts-api must use the `ALLOWED_ORIGIN` constant (already defined at line 15 of posts-api/function_app.py) to keep scoped CORS consistent.

**Auth gate pattern** — exact call sequence at top of every write handler (from ideas-api/function_app.py lines 79–81, 124–126, 149–151, 178–180):
```python
try:
    require_auth(req)
except ValueError:
    return _unauthorized()
```

**POST /api/posts handler** — separate function, separate decorator from existing `list_posts` (see Pitfall 1 in RESEARCH.md):
```python
@app.route(route="posts", methods=["POST"])
def create_post(req: func.HttpRequest) -> func.HttpResponse:
    # 1. Auth gate — MUST be first
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

**PUT /api/posts/{slug} handler** — separate function from existing `get_post` (Pitfall 2 in RESEARCH.md). Must read existing blob first to preserve `date` field (Pitfall 3):
```python
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

    # Read existing blob — serves as 404 check AND preserves original date
    try:
        client = get_container_client()
        blob_client = client.get_blob_client(f"{slug}.md")
        raw = blob_client.download_blob().readall().decode("utf-8")
        existing = parse_post(raw)
        original_date = existing.metadata.get("date")
    except ResourceNotFoundError:
        return _json_response({"error": "not found"}, status_code=404)
    except Exception:
        return _json_response({"error": "storage error"}, status_code=500)

    title = body.get("title", "").strip()
    description = body.get("description", "").strip()
    post_body = body.get("body", "")
    published = body.get("published", False)
    if not title or not description:
        return _json_response({"error": "title and description are required"}, status_code=400)

    try:
        post = build_post(
            title=title,
            slug=slug,           # slug from URL — immutable
            date=original_date,  # preserve original creation date
            description=description,
            body=post_body,
            published=bool(published),
            # updated_at omitted → build_post auto-sets to now()
        )
        errors = validate_post(post)
        if errors:
            return _json_response({"error": errors[0]}, status_code=400)
        content = serialize_post(post)
        blob_client.upload_blob(content.encode(), overwrite=True)
        date_val = post.metadata.get("date")
        updated_val = post.metadata.get("updatedAt")
        return _json_response({
            "title": post.metadata.get("title"),
            "slug": post.metadata.get("slug"),
            "date": date_val.isoformat() if hasattr(date_val, "isoformat") else str(date_val) if date_val is not None else "",
            "description": post.metadata.get("description"),
            "updatedAt": updated_val.isoformat() if hasattr(updated_val, "isoformat") else str(updated_val) if updated_val is not None else "",
            "published": post.metadata.get("published"),
        }, status_code=200)
    except Exception:
        return _json_response({"error": "storage error"}, status_code=500)
```

**Note on `date` isoformat pattern:** The `date_val.isoformat() if hasattr(date_val, "isoformat") else str(...)` guard is the existing posts-api convention (function_app.py lines 48, 50, 75, 77). Use it consistently in the PUT response.

**DELETE /api/posts/{slug} handler** — separate function; 204 must use `func.HttpResponse` directly since `_json_response()` always sets a body (from ideas-api/function_app.py lines 177–198):
```python
@app.route(route="posts/{slug}", methods=["DELETE"])
def delete_post(req: func.HttpRequest) -> func.HttpResponse:
    try:
        require_auth(req)
    except ValueError:
        return _unauthorized()

    slug = req.route_params.get("slug")
    if not slug or not SLUG_RE.match(slug):
        return _json_response({"error": "invalid slug"}, status_code=400)

    try:
        client = get_container_client()
        client.get_blob_client(f"{slug}.md").delete_blob()
    except ResourceNotFoundError:
        return _json_response({"error": "not found"}, status_code=404)
    except Exception:
        return _json_response({"error": "storage error"}, status_code=500)

    return func.HttpResponse(
        status_code=204,
        headers={"Access-Control-Allow-Origin": ALLOWED_ORIGIN},
    )
```

**Note:** ideas-api DELETE uses `"*"` CORS (line 198 of ideas-api/function_app.py); posts-api must use `ALLOWED_ORIGIN` constant here too.

**Route pattern — slug validation** — copy from existing `get_post` (function_app.py lines 61–63):
```python
slug = req.route_params.get("slug")
if not slug or not SLUG_RE.match(slug):
    return _json_response({"error": "invalid slug"}, status_code=400)
```

**Error cascade pattern** — copy from existing `get_post` (function_app.py lines 80–83):
```python
except ResourceNotFoundError:
    return _json_response({"error": "not found"}, status_code=404)
except Exception:
    return _json_response({"error": "storage error"}, status_code=500)
```

---

### `C:\Users\Sriram\posts-api\tests\test_function_app.py` — additions (test, request-response)

**Analog:** `C:\Users\Sriram\posts-api\tests\test_function_app.py` (extend existing file)

**Existing test request pattern** (lines 32–37 and 49–59) — all new tests follow this `func.HttpRequest` construction style:
```python
req = func.HttpRequest(
    method="POST",
    body=b'{"title": "Test", "description": "Desc", "body": "Content", "published": false}',
    url="/api/posts",
    params={},
    headers={},
)
```

**Auth header helper** — add once near top of new test section; used by all authenticated-request tests:
```python
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

**Unauthenticated test pattern** (SEC-02) — from RESEARCH.md Code Examples:
```python
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

**Monkeypatch pattern for write tests** — based on existing read tests (test_function_app.py lines 27–37):
```python
def test_create_post_success(monkeypatch):
    mock_client = MagicMock()
    mock_blob = MagicMock()
    mock_client.get_blob_client.return_value = mock_blob
    monkeypatch.setattr("function_app.get_container_client", lambda: mock_client)
    monkeypatch.setattr("function_app.generate_slug", lambda title, client: "test-title")
    # ...
```

**Integration test pattern for write tests** — based on existing integration tests (test_function_app.py lines 86–116), using the `container_client` fixture:
```python
def test_create_post_integration(monkeypatch, container_client):
    monkeypatch.setattr("function_app.get_container_client", lambda: container_client)
    # monkeypatch auth to inject valid header via req construction
    req = func.HttpRequest(
        method="POST",
        body=b'{"title": "My Post", "description": "Desc", "body": "Body text", "published": false}',
        url="/api/posts",
        params={},
        headers=_make_auth_header(),
    )
    resp = function_app.create_post(req)
    assert resp.status_code == 201
    body = json.loads(resp.get_body())
    assert "slug" in body
```

**DELETE 204 assertion pattern** — `resp.get_body()` returns `b""` for 204; do not try to JSON-parse it:
```python
def test_delete_post_success(monkeypatch):
    # ...
    resp = function_app.delete_post(req)
    assert resp.status_code == 204
    assert resp.get_body() == b""
```

---

### `C:\Users\Sriram\azure-infrastructure\modules\postsapi.bicep` — additions (config)

**Analog:** `C:\Users\Sriram\azure-infrastructure\modules\ideasapi.bicep`

**New params to add** (after existing `param environment string` at line 2 of postsapi.bicep):
```bicep
@description('Azure Entra ID tenant ID for EasyAuth')
param azureTenantId string

@description('posts-api App Registration client ID')
param postsApiClientId string

@secure()
@description('posts-api App Registration client secret')
param postsApiClientSecret string
```

**New app setting to add** inside `functionApp` `appSettings` array (after line 90 of postsapi.bicep, alongside existing settings):
```bicep
{
  name: 'POSTS_CLIENT_SECRET'
  value: postsApiClientSecret
}
```

**`authsettingsV2` resource to add** after `functionApp` resource (after line 99 of postsapi.bicep). This differs from ideasapi.bicep lines 125–154 in one critical way: `requireAuthentication: false` + `AllowAnonymous` instead of `true` + `Return401`, because GET routes must remain public:
```bicep
resource authSettings 'Microsoft.Web/sites/config@2022-09-01' = {
  parent: functionApp
  name: 'authsettingsV2'
  properties: {
    globalValidation: {
      requireAuthentication: false          // DIFFERENT from ideas-api — public GET routes must not be blocked
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

**ideas-api analog for comparison** (ideasapi.bicep lines 125–154) uses `requireAuthentication: true` + `Return401` — that setting is correct for ideas-api because every route requires auth, but would break posts-api public read endpoints. See RESEARCH.md Pitfall 4.

**`main.bicep` must also be updated** to pass the three new params into the `postsapi` module call. Analog: how `ideasApiClientId`, `ideasApiClientSecret`, and `azureTenantId` are passed to the `ideasapi` module in `C:\Users\Sriram\azure-infrastructure\main.bicep`.

---

## Shared Patterns

### Authentication Gate
**Source:** `C:\Users\Sriram\ideas-api\function_app.py` lines 79–81, 124–126, 149–151, 178–180
**Apply to:** All three write handlers (`create_post`, `update_post`, `delete_post`) — always first line of handler body, before any other work.
```python
try:
    require_auth(req)
except ValueError:
    return _unauthorized()
```

### `_json_response()` + CORS Header
**Source:** `C:\Users\Sriram\posts-api\function_app.py` lines 19–25
**Apply to:** All response paths in all three write handlers except 204.
```python
def _json_response(data: dict, status_code: int = 200) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps(data),
        status_code=status_code,
        mimetype="application/json",
        headers={"Access-Control-Allow-Origin": ALLOWED_ORIGIN},
    )
```
**Note:** Posts-api always uses `ALLOWED_ORIGIN` (scoped), never `"*"`.

### Error Cascade (ResourceNotFoundError → 404, Exception → 500)
**Source:** `C:\Users\Sriram\posts-api\function_app.py` lines 80–83
**Apply to:** All blob storage operations in `update_post` and `delete_post`.
```python
except ResourceNotFoundError:
    return _json_response({"error": "not found"}, status_code=404)
except Exception:
    return _json_response({"error": "storage error"}, status_code=500)
```

### Slug Validation
**Source:** `C:\Users\Sriram\posts-api\function_app.py` lines 61–63
**Apply to:** `update_post` and `delete_post` (slug comes from URL path).
```python
slug = req.route_params.get("slug")
if not slug or not SLUG_RE.match(slug):
    return _json_response({"error": "invalid slug"}, status_code=400)
```

### 204 No Content Response
**Source:** `C:\Users\Sriram\ideas-api\function_app.py` line 198
**Apply to:** `delete_post` success path only. Cannot use `_json_response()` for 204 — use `func.HttpResponse` directly.
```python
return func.HttpResponse(
    status_code=204,
    headers={"Access-Control-Allow-Origin": ALLOWED_ORIGIN},
)
```

### date isoformat serialization guard
**Source:** `C:\Users\Sriram\posts-api\function_app.py` lines 48, 50, 75, 77
**Apply to:** PUT response body where `date` and `updatedAt` fields are serialized.
```python
date_val.isoformat() if hasattr(date_val, "isoformat") else str(date_val) if date_val is not None else ""
```

---

## No Analog Found

All four files have close analogs in the codebase. No entries.

---

## Anti-Patterns (from analog reading)

| Anti-Pattern | Source Evidence | Correct Pattern |
|---|---|---|
| Combining POST and GET on one function with `methods=["GET", "POST"]` | posts-api has separate `list_posts` (GET) and the new `create_post` (POST) must also be separate — see function_app.py lines 33–55 | Separate `@app.route` decorated functions per method |
| `_json_response()` for 204 No Content | `_json_response` always serializes a body — ideas-api uses `func.HttpResponse(status_code=204, ...)` directly at line 198 | `func.HttpResponse(status_code=204, headers={...})` |
| `"*"` for CORS in `_unauthorized()` | ideas-api uses `"*"` (line 54) but posts-api uses `ALLOWED_ORIGIN` (line 15) | Always use `ALLOWED_ORIGIN` constant in posts-api |
| Building `date` from `datetime.now()` in PUT handler | Resets post creation date on every edit — see RESEARCH.md Pitfall 3 | Download existing blob, `parse_post()`, extract `post.metadata["date"]`, pass to `build_post()` |
| f-string YAML construction | schema.py docstring and RESEARCH.md explicitly call this out as causing corruption | `serialize_post(post)` which wraps `frontmatter.dumps(post)` |

---

## Metadata

**Analog search scope:** `C:\Users\Sriram\posts-api\`, `C:\Users\Sriram\ideas-api\`, `C:\Users\Sriram\azure-infrastructure\modules\`
**Files read:** 8 source files (posts-api/function_app.py, posts-api/schema.py, posts-api/tests/test_function_app.py, ideas-api/auth.py, ideas-api/function_app.py, azure-infrastructure/modules/postsapi.bicep, azure-infrastructure/modules/ideasapi.bicep, CONTEXT.md + RESEARCH.md)
**Pattern extraction date:** 2026-06-05
