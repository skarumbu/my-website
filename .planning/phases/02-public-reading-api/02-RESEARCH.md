# Phase 2: Public Reading API — Research

**Researched:** 2026-05-31
**Domain:** Azure Functions Python v2 — HTTP routes, Blob Storage read operations
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| API-01 | `GET /api/posts` returns all published posts sorted by date descending (public) | list_blobs() + parse_post() filter; date sort on metadata |
| API-02 | `GET /api/posts/:slug` returns a single published post by slug (public) | get_blob_client(slug + ".md") + download_blob(); 404 on missing/unpublished |
| SEC-03 | Azure Blob Storage container is private — all access through Functions, never direct browser | Confirmed by existing Bicep: `publicAccess: 'None'` + `allowBlobPublicAccess: false` |
</phase_requirements>

---

## Summary

Phase 2 adds two read-only HTTP endpoints to the existing `posts-api` Azure Functions app. The infrastructure and storage patterns are locked from Phase 1: `get_container_client()` in `slugs.py` and `parse_post()` / `validate_post()` in `schema.py` are the only storage utilities needed. No new Python packages are required — the existing `requirements.txt` already has `azure-functions`, `azure-storage-blob`, `azure-identity`, and `python-frontmatter`.

The list endpoint (`GET /api/posts`) must iterate over all blobs in the container, download and parse each `.md` file, filter to `published=True`, then sort by `date` descending. There is no blob-side metadata to filter on — the `published` flag lives inside the file content, so every blob must be read. At the current expected post count (<50) this is acceptable; the STATE.md open question about an `_index.json` optimization is explicitly deferred.

The single-post endpoint (`GET /api/posts/:slug`) constructs the blob name `{slug}.md`, attempts download, parses the content, and returns 404 if the blob is absent or if `published=False`. Both endpoints reuse the existing `_json_response()` helper which handles `Content-Type: application/json` and the `Access-Control-Allow-Origin` CORS header.

**Primary recommendation:** Add two route handlers directly in `function_app.py`, reusing `get_container_client()`, `parse_post()`, and `_json_response()`. Catch `ResourceNotFoundError` from `azure.core.exceptions` for 404 handling. No new modules needed.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Published-post filtering | API / Backend (Functions) | — | `published` flag is inside blob content, not a storage-tier attribute; filtering is pure Python |
| Date sorting | API / Backend (Functions) | — | Sort applied in-memory after parse; no DB query planner |
| CORS enforcement | API / Backend (Functions) | Azure Functions host | `_json_response()` injects CORS header; Functions host also enforces Bicep CORS config |
| Blob access control | Azure Storage (private container) | — | `publicAccess: 'None'` set in Bicep; direct browser access is structurally impossible |
| Route parameter extraction | Azure Functions runtime | — | Runtime populates `req.route_params`; handler reads it |
| Auth (none for read) | — | — | `ANONYMOUS` auth level is correct; no bearer token needed for public read |

---

## Standard Stack

### Core (all already installed — no new packages)

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------------------|---------|--------------|
| `azure-functions` | pinned in venv | HTTP trigger, `func.HttpRequest`, `func.HttpResponse`, `func.FunctionApp` | Required runtime binding |
| `azure-storage-blob` | `>=12.23.1,<12.29.0` | `ContainerClient.list_blobs()`, `BlobClient.download_blob()` | Official Azure SDK |
| `azure-identity` | `>=1.15.0` | `DefaultAzureCredential` (managed identity in Azure, az-login locally) | Official Azure SDK |
| `python-frontmatter` | `>=1.3.0` | `parse_post()` parses YAML frontmatter + body | Already in schema.py |
| `azure-core` | (transitive dep of azure-storage-blob) | `ResourceNotFoundError` exception | Standard error type for all Azure SDKs |

**Installation:** No new installs. All dependencies exist in `requirements.txt` and the `.venv`.

**Version verification:** These are already installed and tested in Phase 1. [VERIFIED: passing Phase 1 tests]

---

## Package Legitimacy Audit

No new packages are introduced in Phase 2. All dependencies were vetted in Phase 1.

| Package | Registry | Disposition |
|---------|----------|-------------|
| azure-functions | PyPI | Approved (Phase 1) |
| azure-storage-blob | PyPI | Approved (Phase 1) |
| azure-identity | PyPI | Approved (Phase 1) |
| python-frontmatter | PyPI | Approved (Phase 1) |
| azure-core | PyPI (transitive) | Approved — official Microsoft package |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser / Phase 3 UI
        |
        | HTTPS GET /api/posts
        | HTTPS GET /api/posts/{slug}
        v
Azure Functions (posts-api)
  function_app.py
  ┌──────────────────────────────────────────┐
  │ list_posts()                             │
  │   get_container_client()                 │
  │   → ContainerClient.list_blobs()         │  (all blobs, no server-side filter)
  │   → for each blob:                       │
  │       download_blob().readall()           │
  │       parse_post()                        │
  │       if published=True: include          │
  │   → sort by date desc                    │
  │   → _json_response([{metadata...}, ...]) │
  │                                          │
  │ get_post(slug)                           │
  │   get_container_client()                 │
  │   → get_blob_client(slug + ".md")        │
  │   → download_blob().readall()            │
  │       ResourceNotFoundError → 404        │
  │   → parse_post()                         │
  │       published=False → 404              │
  │   → _json_response({meta + body})        │
  └──────────────────────────────────────────┘
        |
        | DefaultAzureCredential (managed identity)
        v
Azure Blob Storage — "posts" container (PRIVATE)
  {slug}.md files (YAML frontmatter + markdown body)
```

### Recommended Project Structure

No structural changes needed. Both handlers go in `function_app.py`:

```
posts-api/
├── function_app.py     # Add list_posts + get_post handlers here
├── schema.py           # Unchanged — parse_post(), validate_post()
├── slugs.py            # Unchanged — get_container_client()
├── requirements.txt    # Unchanged
├── host.json           # Unchanged
├── tests/
│   ├── conftest.py         # Unchanged — Azurite fixture
│   ├── test_schema.py      # Unchanged
│   ├── test_slugs.py       # Unchanged
│   ├── test_storage.py     # Unchanged
│   └── test_function_app.py  # NEW — unit tests for list_posts + get_post
```

### Pattern 1: Route with no path parameter — GET /api/posts

**What:** Decorator-only route, no `{slug}` token. Returns a JSON array.
**When to use:** List endpoints.

```python
# Source: learn.microsoft.com/en-us/azure/azure-functions/functions-reference-python (v2 model)
@app.route(route="posts", methods=["GET"])
def list_posts(req: func.HttpRequest) -> func.HttpResponse:
    try:
        client = get_container_client()
        posts = []
        for blob in client.list_blobs():
            blob_client = client.get_blob_client(blob.name)
            raw = blob_client.download_blob().readall().decode("utf-8")
            post = parse_post(raw)
            if post.metadata.get("published") is True:
                posts.append({
                    "title": post.metadata["title"],
                    "slug": post.metadata["slug"],
                    "date": post.metadata["date"],
                    "description": post.metadata.get("description", ""),
                    "updatedAt": post.metadata.get("updatedAt", ""),
                })
        posts.sort(key=lambda p: p["date"], reverse=True)
        return _json_response({"posts": posts})
    except Exception:
        return _json_response({"error": "storage error"}, status_code=500)
```

### Pattern 2: Route with path parameter — GET /api/posts/{slug}

**What:** Curly-brace token in the `route` string; value read via `req.route_params.get("slug")`.
**When to use:** Single-resource GET by ID/slug.

```python
# Source: learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-http-webhook-trigger
#   (Python v2 section — route parameters available via req.route_params)
from azure.core.exceptions import ResourceNotFoundError

@app.route(route="posts/{slug}", methods=["GET"])
def get_post(req: func.HttpRequest) -> func.HttpResponse:
    slug = req.route_params.get("slug")
    if not slug:
        return _json_response({"error": "missing slug"}, status_code=400)
    try:
        client = get_container_client()
        blob_client = client.get_blob_client(f"{slug}.md")
        raw = blob_client.download_blob().readall().decode("utf-8")
        post = parse_post(raw)
        if post.metadata.get("published") is not True:
            return _json_response({"error": "not found"}, status_code=404)
        return _json_response({
            "title": post.metadata["title"],
            "slug": post.metadata["slug"],
            "date": post.metadata["date"],
            "description": post.metadata.get("description", ""),
            "updatedAt": post.metadata.get("updatedAt", ""),
            "body": post.content,
        })
    except ResourceNotFoundError:
        return _json_response({"error": "not found"}, status_code=404)
    except Exception:
        return _json_response({"error": "storage error"}, status_code=500)
```

### Pattern 3: Unit testing with func.HttpRequest and route_params

**What:** The `func.HttpRequest` constructor accepts a `route_params` keyword argument — a plain dict.
**When to use:** Every handler test.

```python
# Source: learn.microsoft.com/en-us/python/api/azure-functions/azure.functions.httprequest
#   (constructor signature confirms route_params kwarg)
import azure.functions as func

# For the list endpoint (no route params)
req = func.HttpRequest(method="GET", body=b"", url="/api/posts", params={})

# For the single-post endpoint
req = func.HttpRequest(
    method="GET",
    body=b"",
    url="/api/posts/my-slug",
    params={},
    route_params={"slug": "my-slug"},
)
```

### Pattern 4: Mocking get_container_client in unit tests

**What:** Patch `function_app.get_container_client` (or pass a real Azurite-backed client) to avoid real Azure calls.
**When to use:** Unit tests (mock) and integration tests (Azurite).

```python
# Unit test — mock the container client entirely
from unittest.mock import MagicMock, patch
import function_app

def test_list_posts_empty(monkeypatch):
    mock_client = MagicMock()
    mock_client.list_blobs.return_value = []
    monkeypatch.setattr("function_app.get_container_client", lambda: mock_client)
    req = func.HttpRequest(method="GET", body=b"", url="/api/posts", params={})
    resp = function_app.list_posts(req)
    assert resp.status_code == 200

# Integration test — use real Azurite via conftest.py container_client fixture
# Upload test blobs to the fixture container, then call the handler directly
# after temporarily pointing get_container_client at the Azurite client.
```

### Anti-Patterns to Avoid

- **Don't filter blobs server-side by blob name prefix for "published":** The `published` flag is inside the file content, not in the blob name. There is no prefix pattern to exploit. Always download and parse to determine published status.
- **Don't return the `body` in the list endpoint:** The list payload should contain only list metadata fields (`title`, `slug`, `date`, `description`, `updatedAt`). Including `body` in the list response wastes bandwidth and is not needed by the UI.
- **Don't use string concatenation for `date` sorting:** The `date` field from frontmatter may be a `datetime` object (python-frontmatter parses ISO dates automatically) or a string depending on how it was written. Normalize to string with `.isoformat()` if it is a datetime before returning in JSON; sort as a string (ISO 8601 strings sort lexicographically correctly).
- **Don't swallow `ResourceNotFoundError` silently without a 404 response:** Catching `Exception` broadly must come after the specific `ResourceNotFoundError` catch; otherwise blob-not-found becomes a 500.
- **Don't call `get_container_client()` once at module scope:** DefaultAzureCredential resolves lazily; module-scope initialization can cause import errors in test environments without the env vars set. Call inside the handler.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom regex/split parser | `parse_post()` from `schema.py` (wraps `python-frontmatter`) | Edge cases: colons in titles, multiline values, unicode |
| Blob 404 detection | Check `blob_client.exists()` then download | Catch `ResourceNotFoundError` on `download_blob()` | Two-call approach has a TOCTOU race; one-call + exception is idiomatic SDK pattern |
| Date sorting | Custom date parser | `sorted(..., key=lambda p: p["date"], reverse=True)` — ISO 8601 strings sort correctly as strings | No need for `datetime.fromisoformat` just for sort order |
| CORS header | Add per-handler | `_json_response()` already injects `Access-Control-Allow-Origin` | Consistency; single place to change the origin |

**Key insight:** Everything this phase needs already exists in the codebase. The only new code is the two route handler functions in `function_app.py` and their tests.

---

## SEC-03 Verification: Container Privacy

**Status: Already satisfied by Phase 1 Bicep.** [VERIFIED: postsapi.bicep]

Relevant Bicep settings in `C:\Users\Sriram\azure-infrastructure\modules\postsapi.bicep`:

```bicep
resource storageAccount '...' = {
  properties: {
    allowBlobPublicAccess: false   // Account-level: no container can be made public
  }
}

resource postsContainer '...' = {
  properties: {
    publicAccess: 'None'           // Container-level: explicitly private
  }
}
```

Both `allowBlobPublicAccess: false` (account-level) and `publicAccess: 'None'` (container-level) are set. Direct browser requests to `https://{storageAccount}.blob.core.windows.net/posts/{slug}.md` will receive HTTP 403 without a SAS token or managed identity credential. The Function App has `StorageBlobDataContributor` role assignment via managed identity — this is the only access path.

**No additional Bicep changes are needed for SEC-03.** The verification task for Phase 2 is to confirm the deployed container returns 403 on a direct `curl` request.

---

## Response Shape Decisions

### GET /api/posts — list response

```json
{
  "posts": [
    {
      "title": "My Post Title",
      "slug": "my-post-title",
      "date": "2026-05-30T00:00:00+00:00",
      "description": "Short excerpt shown in post list.",
      "updatedAt": "2026-05-30T12:34:56.789012+00:00"
    }
  ]
}
```

- Array wrapped in `{"posts": [...]}` object — easier to extend with pagination metadata later (v2 requirement)
- No `body` field — body is large, not needed for list UI (Phase 3 READ-02 only needs title, date, description)
- Sorted newest-first by `date`
- Drafts (`published=False`) excluded entirely

### GET /api/posts/:slug — single post response

```json
{
  "title": "My Post Title",
  "slug": "my-post-title",
  "date": "2026-05-30T00:00:00+00:00",
  "description": "Short excerpt shown in post list.",
  "updatedAt": "2026-05-30T12:34:56.789012+00:00",
  "body": "# My Post Title\n\nFull markdown content here..."
}
```

- Flat structure (all fields at top level) — simpler for Phase 3 UI to consume
- `body` is raw markdown — Phase 3 will render via `react-markdown`
- 404 if slug does not exist OR if `published=False`

---

## Common Pitfalls

### Pitfall 1: date field type mismatch in JSON serialization

**What goes wrong:** `python-frontmatter` parses ISO 8601 date strings as Python `datetime` objects. `json.dumps()` raises `TypeError: Object of type datetime is not JSON serializable`.
**Why it happens:** PyYAML (used by python-frontmatter) auto-converts `date: 2026-05-30T00:00:00+00:00` to a `datetime` at parse time.
**How to avoid:** Normalize date fields before JSON serialization: `post.metadata["date"].isoformat() if isinstance(post.metadata["date"], datetime) else post.metadata["date"]`. Or use a custom JSON encoder.
**Warning signs:** `TypeError` in logs when the first post with a proper ISO date is parsed.

### Pitfall 2: Broad exception catch masks ResourceNotFoundError

**What goes wrong:** If `except Exception` comes before `except ResourceNotFoundError`, blob-not-found returns 500 instead of 404.
**Why it happens:** `ResourceNotFoundError` is a subclass of `HttpResponseError` which is a subclass of `AzureError` which is a subclass of `Exception`. Order matters.
**How to avoid:** Always put `except ResourceNotFoundError` before `except Exception` in the same try/except block.
**Warning signs:** Tests expecting 404 get 500; storage error logs appear for normal missing-slug lookups.

### Pitfall 3: Calling get_container_client() at module scope

**What goes wrong:** `import function_app` in tests raises `RuntimeError: POSTS_STORAGE_ACCOUNT_NAME environment variable is not set or empty`.
**Why it happens:** Module-level code runs at import time; the env var is not set in the test environment.
**How to avoid:** Call `get_container_client()` inside each handler function, not at module scope.
**Warning signs:** All tests fail at import with RuntimeError before any test body executes.

### Pitfall 4: list_blobs() does not return file content

**What goes wrong:** Expecting `blob.content` or `blob.data` to be available from `list_blobs()` iterator items.
**Why it happens:** `list_blobs()` returns `BlobProperties` objects (name, size, last_modified, etc.), not content. Content requires a separate `download_blob()` call.
**How to avoid:** Iterate `list_blobs()` for blob names only; call `get_blob_client(blob.name).download_blob()` for each blob you want to read.
**Warning signs:** `AttributeError: 'BlobProperties' object has no attribute 'content'`.

### Pitfall 5: Route shadow — "posts" vs "posts/{slug}"

**What goes wrong:** Azure Functions v2 may match `GET /api/posts/some-slug` against the `posts` (no-param) route if route specificity is handled incorrectly.
**Why it happens:** Route ordering matters; more-specific routes must be registered to avoid shadowing. In practice, `posts/{slug}` is more specific and Azure Functions routes correctly, but naming collisions should be tested.
**How to avoid:** Test both `GET /api/posts` and `GET /api/posts/my-slug` end-to-end. The more-specific route wins in Azure Functions routing.
**Warning signs:** `GET /api/posts/my-slug` returns the full post list instead of a single post.

---

## Code Examples

### List all blobs and download each (verified pattern)

```python
# Source: learn.microsoft.com/en-us/azure/storage/blobs/storage-blobs-list-python
#   + learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-download-python
from azure.core.exceptions import ResourceNotFoundError

container_client = get_container_client()
for blob in container_client.list_blobs():          # yields BlobProperties
    blob_client = container_client.get_blob_client(blob.name)
    raw = blob_client.download_blob().readall().decode("utf-8")
    post = parse_post(raw)
```

### Download a single blob by name, handle not-found

```python
# Source: learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-download-python
#   + learn.microsoft.com/en-us/python/api/azure-core/azure.core.exceptions.resourcenotfounderror
from azure.core.exceptions import ResourceNotFoundError

try:
    blob_client = container_client.get_blob_client(f"{slug}.md")
    raw = blob_client.download_blob().readall().decode("utf-8")
except ResourceNotFoundError:
    return _json_response({"error": "not found"}, status_code=404)
```

### Route parameter access in Python v2

```python
# Source: learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-http-webhook-trigger
#   Python v2 section: "route parameters are available to the function via req.route_params"
@app.route(route="posts/{slug}", methods=["GET"])
def get_post(req: func.HttpRequest) -> func.HttpResponse:
    slug = req.route_params.get("slug")   # returns None if somehow absent
```

### Creating mock HttpRequest with route_params in tests

```python
# Source: learn.microsoft.com/en-us/python/api/azure-functions/azure.functions.httprequest
#   (constructor accepts route_params kwarg — confirmed by API reference)
import azure.functions as func

req = func.HttpRequest(
    method="GET",
    body=b"",
    url="/api/posts/my-slug",
    params={},
    route_params={"slug": "my-slug"},
)
```

### Handling datetime serialization from python-frontmatter

```python
# Source: [ASSUMED] — PyYAML datetime parsing behavior; standard Python pattern
from datetime import datetime

def _safe_str(val):
    """Convert datetime to ISO string; pass through anything else."""
    return val.isoformat() if isinstance(val, datetime) else str(val) if val is not None else None
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Python v1 (function.json per function) | Python v2 (decorator-based, single function_app.py) | Fewer files; route defined inline with handler |
| `UseDevelopmentStorage=true` connection string (deprecated) | Explicit Azurite connection string (as in conftest.py) | Required for azure-storage-blob >= 12.24.0 |
| Anonymous SAS URL for blob access | Managed identity + RBAC role assignment | No secrets to rotate; postsapi.bicep already implements this |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Sorting ISO 8601 date strings lexicographically produces correct newest-first order | Response Shape, Pitfalls | If dates are not ISO 8601 or are stored as non-string types that serialize differently, sort order is wrong. Mitigated by `build_post()` always storing ISO strings. |
| A2 | `func.HttpRequest` constructor accepts `route_params` as a keyword argument | Code Examples | Tests cannot construct mock requests with route params. Verify by running `py -c "import azure.functions as func; help(func.HttpRequest.__init__)"` in venv. |
| A3 | `_json_response()` helper is sufficient for all Phase 2 responses (no streaming needed) | Architecture | Post bodies are markdown text; for typical blog posts (<100KB) a single `json.dumps()` is fine. Would need streaming only for very large posts. |

---

## Open Questions

1. **Date field format in existing blobs**
   - What we know: `build_post()` stores date as a string passed by the caller (e.g., `"2026-05-30T00:00:00+00:00"`). python-frontmatter parses this back as a `datetime` object at read time.
   - What's unclear: Whether any test or seed blobs were created with non-ISO date strings.
   - Recommendation: The handler must defensively call `.isoformat()` if the value is a `datetime`, and `str()` as a final fallback. Tests should include a blob with a datetime-parsed date.

2. **`_index.json` optimization**
   - What we know: STATE.md notes blob-scan is acceptable under ~50 posts.
   - What's unclear: Phase 2 should not implement this optimization — it is explicitly deferred.
   - Recommendation: Ignore; plan should not include any `_index.json` tasks.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.12 | posts-api venv | Yes | 3.12.x (used in Phase 1) | — |
| Azurite | Integration tests | Assumed running locally | N/A | Tests must be run with Azurite active; conftest creates/destroys test container |
| Azure Functions Core Tools | Local func run | [ASSUMED] | — | Not required for unit/integration tests via pytest |
| Posts-api .venv | All tests | Yes | Activated via `posts-api\.venv` | — |

**Missing dependencies with no fallback:** Azurite must be running for any test in `test_function_app.py` that uses the `container_client` fixture from conftest.py. Unit tests that mock `get_container_client()` can run without Azurite.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest (already configured in Phase 1) |
| Config file | `C:\Users\Sriram\posts-api\pytest.ini` |
| Quick run command | `cd C:\Users\Sriram\posts-api && .venv\Scripts\python -m pytest tests/test_function_app.py -x -q` |
| Full suite command | `cd C:\Users\Sriram\posts-api && .venv\Scripts\python -m pytest -q` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| API-01 | `GET /api/posts` returns only published posts, sorted newest-first | Integration (Azurite) | `pytest tests/test_function_app.py::test_list_posts_returns_published_only -x` | No — Wave 0 |
| API-01 | `GET /api/posts` excludes drafts | Integration (Azurite) | `pytest tests/test_function_app.py::test_list_posts_excludes_drafts -x` | No — Wave 0 |
| API-01 | `GET /api/posts` returns sorted newest-first | Integration (Azurite) | `pytest tests/test_function_app.py::test_list_posts_sorted_by_date -x` | No — Wave 0 |
| API-01 | `GET /api/posts` with empty container returns empty list | Unit (mock) | `pytest tests/test_function_app.py::test_list_posts_empty -x` | No — Wave 0 |
| API-02 | `GET /api/posts/{slug}` returns 200 with body for valid published slug | Integration (Azurite) | `pytest tests/test_function_app.py::test_get_post_published -x` | No — Wave 0 |
| API-02 | `GET /api/posts/{slug}` returns 404 for missing slug | Unit (mock) | `pytest tests/test_function_app.py::test_get_post_not_found -x` | No — Wave 0 |
| API-02 | `GET /api/posts/{slug}` returns 404 for unpublished post | Integration (Azurite) | `pytest tests/test_function_app.py::test_get_post_draft_returns_404 -x` | No — Wave 0 |
| SEC-03 | Container is private — direct blob URL returns 403 | Manual smoke test | `curl -I https://{account}.blob.core.windows.net/posts/test.md` | Manual only |

### Sampling Rate

- **Per task commit:** `pytest tests/test_function_app.py -q`
- **Per wave merge:** `pytest -q` (full suite including schema, slugs, storage tests)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/test_function_app.py` — all API-01 and API-02 test cases listed above
- [ ] No new framework install needed — pytest already configured

---

## Security Domain

### Applicable ASVS Categories (security_asvs_level: 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Read routes are intentionally public (ANONYMOUS auth level) |
| V3 Session Management | No | Stateless API; no sessions |
| V4 Access Control | Yes | Container is private; Functions managed identity is the only access path (SEC-03) |
| V5 Input Validation | Yes | `slug` route parameter used to construct blob name — must not allow path traversal |
| V6 Cryptography | No | No encryption at rest beyond Azure Storage default; no keys handled in code |

### Slug Input Validation (V5)

The `slug` value from `req.route_params.get("slug")` is used directly to construct the blob name: `f"{slug}.md"`. Azure Blob Storage does not support directory traversal (no filesystem path resolution), so `../secret` as a slug simply produces a blob lookup for `../secret.md` which will 404. However, as a defensive practice:

- **Allowed pattern:** slugs from `generate_slug()` are always lowercase alphanumeric + hyphens (python-slugify output)
- **Recommended guard:** Validate `slug` matches `^[a-z0-9-]+$` before constructing the blob name. Return 400 if it does not match. [ASSUMED — not in official ASVS docs but standard input validation practice]

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Direct blob URL access bypassing Functions | Elevation of Privilege | `allowBlobPublicAccess: false` + `publicAccess: 'None'` in Bicep (already set) |
| Slug injection to access unintended blobs | Tampering | Regex validation on slug before blob lookup; Azure Blob Storage does not resolve `..` paths anyway |
| Information disclosure via 500 errors | Information Disclosure | Return generic `{"error": "storage error"}` in 500 responses; do not echo exception messages |

---

## Sources

### Primary (HIGH confidence)

- [Azure Functions HTTP trigger — Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-http-webhook-trigger) — Python v2 route parameter syntax (`{slug}` in route string, `req.route_params.get("slug")`); updated 2026-02-03
- [List blobs with Python — Microsoft Learn](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blobs-list-python) — `ContainerClient.list_blobs()` returns `BlobProperties` (name only, no content); updated 2025-07-30
- [Download a blob with Python — Microsoft Learn](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-download-python) — `download_blob().readall()` with `encoding='UTF-8'` returns str; updated 2025-07-30
- [azure.core.exceptions.ResourceNotFoundError — Microsoft Learn](https://learn.microsoft.com/en-us/python/api/azure-core/azure.core.exceptions.resourcenotfounderror) — correct import and usage for 404 handling
- [azure.functions.HttpRequest — Microsoft Learn](https://learn.microsoft.com/en-us/python/api/azure-functions/azure.functions.httprequest) — `route_params` kwarg confirmed in constructor
- `C:\Users\Sriram\posts-api\function_app.py` — existing `_json_response()` helper and `ALLOWED_ORIGIN` constant
- `C:\Users\Sriram\posts-api\schema.py` — `parse_post()`, `validate_post()`, `REQUIRED_FIELDS`
- `C:\Users\Sriram\posts-api\slugs.py` — `get_container_client()`
- `C:\Users\Sriram\posts-api\tests\conftest.py` — Azurite fixture pattern (create/yield/delete container)
- `C:\Users\Sriram\azure-infrastructure\modules\postsapi.bicep` — `allowBlobPublicAccess: false`, `publicAccess: 'None'` confirmed

### Secondary (MEDIUM confidence)

- [Azure Functions Python v2 Unit Testing Guide — GitHub Wiki](https://github.com/Azure/azure-functions-python-worker/wiki/Unit-Testing-Guide) — `func.HttpRequest` mock constructor pattern
- [Handle Errors — Azure SDK for Python](https://learn.microsoft.com/en-us/azure/developer/python/sdk/fundamentals/errors) — exception hierarchy and catch ordering

### Tertiary (LOW confidence)

- None — all critical claims are HIGH or MEDIUM.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and tested in Phase 1
- Architecture patterns: HIGH — route parameter and blob SDK patterns verified against official Microsoft docs
- SEC-03 status: HIGH — verified directly in postsapi.bicep source
- Pitfalls: HIGH — date serialization and exception ordering are documented SDK behaviors
- Test patterns: MEDIUM — `func.HttpRequest(route_params=...)` constructor confirmed via API reference; specific pytest mock patterns are [ASSUMED] until run

**Research date:** 2026-05-31
**Valid until:** 2026-07-31 (azure-storage-blob and azure-functions are stable; no fast-moving changes expected in read-path APIs)
