# Phase 2: Public Reading API — Pattern Map

**Mapped:** 2026-05-31
**Files analyzed:** 2 (1 modified, 1 new)
**Analogs found:** 2 / 2

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `posts-api/function_app.py` | controller | request-response | `posts-api/function_app.py` (existing `health` handler + `_json_response`) | exact — extend same file |
| `posts-api/tests/test_function_app.py` | test | request-response | `posts-api/tests/test_slugs.py` (integration) + `posts-api/tests/test_schema.py` (unit) | role-match |

---

## Pattern Assignments

### `posts-api/function_app.py` — add `list_posts` and `get_post` handlers (controller, request-response)

**Analog:** `posts-api/function_app.py` — existing `health` handler and `_json_response` helper

**Imports pattern** (function_app.py lines 1–4 + additional import for Phase 2):

```python
import json
import os

import azure.functions as func
from azure.core.exceptions import ResourceNotFoundError   # ADD for Phase 2

from schema import parse_post
from slugs import get_container_client
```

**App declaration and shared helper** (function_app.py lines 8–19 — copy verbatim, do not change):

```python
app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

ALLOWED_ORIGIN = "https://www.quixotry.me"


def _json_response(data: dict, status_code: int = 200) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps(data),
        status_code=status_code,
        mimetype="application/json",
        headers={"Access-Control-Allow-Origin": ALLOWED_ORIGIN},
    )
```

**Core handler pattern — list endpoint** (new, modeled on existing `health` handler at lines 22–24):

```python
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
                    "date": (
                        post.metadata["date"].isoformat()
                        if hasattr(post.metadata["date"], "isoformat")
                        else str(post.metadata["date"])
                    ),
                    "description": post.metadata.get("description", ""),
                    "updatedAt": (
                        post.metadata["updatedAt"].isoformat()
                        if hasattr(post.metadata.get("updatedAt"), "isoformat")
                        else post.metadata.get("updatedAt", "")
                    ),
                })
        posts.sort(key=lambda p: p["date"], reverse=True)
        return _json_response({"posts": posts})
    except Exception:
        return _json_response({"error": "storage error"}, status_code=500)
```

**Core handler pattern — single-post endpoint** (new, route parameter variant):

```python
import re

SLUG_RE = re.compile(r"^[a-z0-9-]+$")

@app.route(route="posts/{slug}", methods=["GET"])
def get_post(req: func.HttpRequest) -> func.HttpResponse:
    slug = req.route_params.get("slug")
    if not slug or not SLUG_RE.match(slug):
        return _json_response({"error": "invalid slug"}, status_code=400)
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
            "date": (
                post.metadata["date"].isoformat()
                if hasattr(post.metadata["date"], "isoformat")
                else str(post.metadata["date"])
            ),
            "description": post.metadata.get("description", ""),
            "updatedAt": (
                post.metadata["updatedAt"].isoformat()
                if hasattr(post.metadata.get("updatedAt"), "isoformat")
                else post.metadata.get("updatedAt", "")
            ),
            "body": post.content,
        })
    except ResourceNotFoundError:
        return _json_response({"error": "not found"}, status_code=404)
    except Exception:
        return _json_response({"error": "storage error"}, status_code=500)
```

**Critical ordering rule for exception handling:** `except ResourceNotFoundError` MUST precede `except Exception`. `ResourceNotFoundError` is a subclass of `Exception`; reversing the order makes blob-not-found return 500 instead of 404.

**Critical rule — never call `get_container_client()` at module scope:** Module-level calls run at import time; the env var `POSTS_STORAGE_ACCOUNT_NAME` is not set in test environments, causing all tests to fail at import with `RuntimeError`. Always call inside the handler body.

**Date serialization rule:** `python-frontmatter` (via PyYAML) parses ISO 8601 date strings as Python `datetime` objects at parse time. Use `hasattr(val, "isoformat")` (or `isinstance(val, datetime)`) before calling `.isoformat()`. Do not pass raw datetime objects to `json.dumps()`.

---

### `posts-api/tests/test_function_app.py` — new test file (test, request-response)

**Analog 1 (integration test structure):** `posts-api/tests/test_slugs.py`
**Analog 2 (unit test structure):** `posts-api/tests/test_schema.py`

**File header and imports pattern** (modeled on test_slugs.py lines 1–6 and test_schema.py lines 1–6):

```python
"""
HTTP handler tests for the posts-api function_app.
API-01: GET /api/posts — list published posts sorted newest-first.
API-02: GET /api/posts/{slug} — return single published post; 404 on missing/draft.
"""
import pytest
import azure.functions as func

import function_app
from schema import build_post, serialize_post
```

**Azurite fixture usage pattern** (from conftest.py lines 15–20 — fixture is already provided, just reference it):

```python
# conftest.py already provides:
#   container_client  — creates "posts-test" container in Azurite, yields client, deletes on teardown
# Use it as a parameter in integration test functions:

def test_list_posts_returns_published_only(container_client):
    ...
```

**Unit test pattern — mock `get_container_client`** (monkeypatch; no Azurite required):

```python
def test_list_posts_empty(monkeypatch):
    """GET /api/posts with empty container -> 200 {"posts": []}."""
    mock_client = MagicMock()
    mock_client.list_blobs.return_value = []
    monkeypatch.setattr("function_app.get_container_client", lambda: mock_client)

    req = func.HttpRequest(method="GET", body=b"", url="/api/posts", params={})
    resp = function_app.list_posts(req)

    assert resp.status_code == 200
    body = json.loads(resp.get_body())
    assert body == {"posts": []}
```

**Unit test pattern — mock ResourceNotFoundError for 404**:

```python
from unittest.mock import MagicMock
from azure.core.exceptions import ResourceNotFoundError

def test_get_post_not_found(monkeypatch):
    """GET /api/posts/{slug} with missing blob -> 404."""
    mock_client = MagicMock()
    mock_blob_client = MagicMock()
    mock_blob_client.download_blob.side_effect = ResourceNotFoundError("not found")
    mock_client.get_blob_client.return_value = mock_blob_client
    monkeypatch.setattr("function_app.get_container_client", lambda: mock_client)

    req = func.HttpRequest(
        method="GET",
        body=b"",
        url="/api/posts/missing-slug",
        params={},
        route_params={"slug": "missing-slug"},
    )
    resp = function_app.get_post(req)

    assert resp.status_code == 404
```

**Integration test pattern — upload blob then call handler** (modeled on test_slugs.py lines 22–25):

```python
def test_list_posts_returns_published_only(container_client, monkeypatch):
    """Integration: only published=True posts appear in list response."""
    published = serialize_post(build_post(
        title="Published Post", slug="published-post",
        date="2026-05-30T00:00:00+00:00", description="desc",
        body="body", published=True,
    ))
    draft = serialize_post(build_post(
        title="Draft Post", slug="draft-post",
        date="2026-05-29T00:00:00+00:00", description="desc",
        body="body", published=False,
    ))
    container_client.upload_blob("published-post.md", published.encode(), overwrite=True)
    container_client.upload_blob("draft-post.md", draft.encode(), overwrite=True)

    monkeypatch.setattr("function_app.get_container_client", lambda: container_client)

    req = func.HttpRequest(method="GET", body=b"", url="/api/posts", params={})
    resp = function_app.list_posts(req)

    assert resp.status_code == 200
    body = json.loads(resp.get_body())
    slugs = [p["slug"] for p in body["posts"]]
    assert slugs == ["published-post"]
```

**`func.HttpRequest` constructor for route-param tests** (confirmed via API reference):

```python
# List endpoint — no route params
req = func.HttpRequest(method="GET", body=b"", url="/api/posts", params={})

# Single-post endpoint — pass route_params dict
req = func.HttpRequest(
    method="GET",
    body=b"",
    url="/api/posts/my-slug",
    params={},
    route_params={"slug": "my-slug"},
)
```

**Docstring convention** (from test_schema.py and test_slugs.py — one-line description of what the test asserts):

```python
def test_name():
    """Short plain-English description of what it checks and what result to expect."""
```

**Required test cases (from RESEARCH.md Validation Architecture):**

| Test name | Type | Azurite needed |
|-----------|------|---------------|
| `test_list_posts_empty` | unit (mock) | No |
| `test_list_posts_returns_published_only` | integration | Yes |
| `test_list_posts_excludes_drafts` | integration | Yes |
| `test_list_posts_sorted_by_date` | integration | Yes |
| `test_get_post_published` | integration | Yes |
| `test_get_post_not_found` | unit (mock) | No |
| `test_get_post_draft_returns_404` | integration | Yes |

---

## Shared Patterns

### `_json_response()` helper
**Source:** `posts-api/function_app.py` lines 13–19
**Apply to:** Both `list_posts` and `get_post` — all responses go through this helper; never construct `func.HttpResponse` directly in a handler.

```python
def _json_response(data: dict, status_code: int = 200) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps(data),
        status_code=status_code,
        mimetype="application/json",
        headers={"Access-Control-Allow-Origin": ALLOWED_ORIGIN},
    )
```

### `get_container_client()` — call site rule
**Source:** `posts-api/slugs.py` lines 12–31
**Apply to:** Both handlers.
Call inside the handler body only, never at module scope. The function reads `POSTS_STORAGE_ACCOUNT_NAME` from env; that variable is absent in pytest without the fixture or monkeypatch.

### Azurite fixture
**Source:** `posts-api/tests/conftest.py` lines 15–20
**Apply to:** All integration tests in `test_function_app.py`.
Accept `container_client` as a test parameter, then monkeypatch `function_app.get_container_client` to return that fixture client. Do not create a second fixture in `test_function_app.py` — reuse the one in `conftest.py`.

```python
# conftest.py fixture (already exists — do not duplicate):
@pytest.fixture
def container_client():
    client = ContainerClient.from_connection_string(AZURITE_CONN_STR, container_name=TEST_CONTAINER)
    client.create_container()
    yield client
    client.delete_container()
```

### Error response shape
**Source:** `posts-api/function_app.py` (established convention)
**Apply to:** All error branches in both handlers.
Always return `{"error": "<short message>"}` — never echo exception messages or tracebacks into the response body (information disclosure per SEC threat model in RESEARCH.md).

---

## No Analog Found

None. Both files have strong analogs within the existing `posts-api` codebase.

---

## Metadata

**Analog search scope:** `C:\Users\Sriram\posts-api\` — all Python source and test files
**Files read:** 7 (function_app.py, schema.py, slugs.py, conftest.py, test_schema.py, test_slugs.py, 02-RESEARCH.md)
**Pattern extraction date:** 2026-05-31
