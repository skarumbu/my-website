# Phase 6: GitHub-Backed Content — Pattern Map

**Mapped:** 2026-06-06
**Files analyzed:** 9 files (7 modified, 2 deleted, 5 migrated)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `posts-api/slugs.py` | utility | request-response | `posts-api/slugs.py` (current) | self — rewrite of same file |
| `posts-api/function_app.py` | service | CRUD | `posts-api/function_app.py` (current) | self — rewrite of same file |
| `posts-api/requirements.txt` | config | — | `posts-api/requirements.txt` (current) | self — swap two deps |
| `posts-api/tests/conftest.py` | config | — | `posts-api/tests/conftest.py` (current) | self — rewrite fixtures |
| `posts-api/tests/test_slugs.py` | test | CRUD | `posts-api/tests/test_slugs.py` (current) | self — rewrite mocks |
| `posts-api/tests/test_function_app.py` | test | CRUD | `posts-api/tests/test_function_app.py` (current) | self — rewrite mocks |
| `posts-api/tests/test_storage.py` | test | — | `posts-api/tests/test_storage.py` (current) | DELETE — Azurite gone |
| `azure-infrastructure/modules/postsapi.bicep` | config | — | `azure-infrastructure/modules/postsapi.bicep` (current) | self — param swap |
| `azure-infrastructure/main.bicep` | config | — | `azure-infrastructure/main.bicep` (current) | self — param wiring |
| `posts/*.md` (5 files) | content | — | `docs/design/*.md` (current, pre-frontmatter) | self — file move + frontmatter |

---

## Pattern Assignments

### `posts-api/slugs.py` (utility, request-response)

**Analog:** `posts-api/slugs.py` (current — lines 1–56); rewrite replacing blob helpers with GitHub helpers.

**Current imports to REMOVE** (lines 1–9):
```python
import os
from slugify import slugify
from azure.identity import DefaultAzureCredential
from azure.storage.blob import ContainerClient
```

**New imports pattern:**
```python
import os
import base64
import requests
from slugify import slugify

POSTS_DIR = "posts"
```

**Current function to DELETE** — `get_container_client` (lines 12–31): Remove entirely. All callers in `function_app.py` must also remove their `get_container_client()` calls.

**Current `generate_slug` signature to CHANGE** (lines 34–56):
```python
# OLD: takes container_client as argument
def generate_slug(title: str, container_client: ContainerClient) -> str:
    ...
    existing = {b.name for b in container_client.list_blobs(name_starts_with=base_slug)}
    while f"{candidate}.md" in existing:
        ...
```

**New `generate_slug` pattern** — uses GitHub 404-probe instead of blob listing:
```python
# NEW: no container_client arg; uses _gh_url() + requests.get
def generate_slug(title: str) -> str:
    base_slug = slugify(title)
    if not base_slug:
        raise ValueError(f"Title '{title}' produces an empty slug")
    candidate = base_slug
    counter = 2
    while True:
        resp = requests.get(_gh_url(candidate), headers=_gh_headers())
        if resp.status_code == 404:
            return candidate
        if resp.status_code == 200:
            candidate = f"{base_slug}-{counter}"
            counter += 1
        else:
            resp.raise_for_status()
```

**New helper functions to ADD** (no existing analog — pure new code):
```python
def _gh_headers() -> dict:
    token = os.environ["GITHUB_TOKEN"]
    return {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "posts-api/1.0",
    }

def _gh_url(slug: str) -> str:
    repo = os.environ["GITHUB_REPO"]
    return f"https://api.github.com/repos/{repo}/contents/{POSTS_DIR}/{slug}.md"

def _gh_dir_url() -> str:
    repo = os.environ["GITHUB_REPO"]
    return f"https://api.github.com/repos/{repo}/contents/{POSTS_DIR}"

def get_file_sha(slug: str) -> tuple[str | None, str | None]:
    resp = requests.get(_gh_url(slug), headers=_gh_headers())
    if resp.status_code == 404:
        return None, None
    if resp.status_code >= 500:
        raise RuntimeError(f"GitHub error: {resp.status_code}")
    resp.raise_for_status()
    data = resp.json()
    content_b64 = data["content"].replace("\n", "")  # strip GitHub's embedded newlines
    raw = base64.b64decode(content_b64).decode("utf-8")
    return data["sha"], raw

def list_posts_dir() -> list:
    resp = requests.get(_gh_dir_url(), headers=_gh_headers())
    if resp.status_code == 404:
        return []
    resp.raise_for_status()
    file_entries = resp.json()
    posts = []
    for entry in file_entries:
        if not entry["name"].endswith(".md"):
            continue
        file_resp = requests.get(entry["url"], headers=_gh_headers())
        if file_resp.status_code != 200:
            continue
        content_b64 = file_resp.json()["content"].replace("\n", "")
        raw = base64.b64decode(content_b64).decode("utf-8")
        from schema import parse_post
        posts.append(parse_post(raw))
    return posts

def create_file(slug: str, content_str: str, commit_message: str) -> None:
    content_b64 = base64.b64encode(content_str.encode("utf-8")).decode("ascii")
    body = {"message": commit_message, "content": content_b64}
    resp = requests.put(_gh_url(slug), headers=_gh_headers(), json=body)
    if resp.status_code not in (200, 201):
        resp.raise_for_status()

def update_file(slug: str, content_str: str, sha: str, commit_message: str) -> None:
    content_b64 = base64.b64encode(content_str.encode("utf-8")).decode("ascii")
    body = {"message": commit_message, "content": content_b64, "sha": sha}
    resp = requests.put(_gh_url(slug), headers=_gh_headers(), json=body)
    resp.raise_for_status()

def delete_file(slug: str, sha: str, commit_message: str) -> None:
    body = {"message": commit_message, "sha": sha}
    resp = requests.delete(_gh_url(slug), headers=_gh_headers(), json=body)
    resp.raise_for_status()
```

---

### `posts-api/function_app.py` (service, CRUD)

**Analog:** `posts-api/function_app.py` (current — all 248 lines); rewrite the storage calls in each handler while keeping the surrounding structure unchanged.

**Imports to CHANGE** (lines 1–13):
```python
# REMOVE:
from azure.core.exceptions import ResourceNotFoundError
from slugs import get_container_client

# KEEP unchanged:
import json
import os
import re
import azure.functions as func
from schema import parse_post
from auth import require_auth
from schema import build_post, validate_post, serialize_post
from datetime import datetime, timezone

# ADD:
import requests
from slugs import generate_slug, get_file_sha, list_posts_dir, create_file, update_file, delete_file
```

**App-level constants — keep exactly as-is** (lines 17–20):
```python
app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)
ALLOWED_ORIGIN = "https://www.quixotry.me"
SLUG_RE = re.compile(r"^[a-z0-9-]+$")
```

**`_json_response` / `_unauthorized` helpers — keep exactly as-is** (lines 23–38):
```python
def _json_response(data: dict, status_code: int = 200) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps(data),
        status_code=status_code,
        mimetype="application/json",
        headers={"Access-Control-Allow-Origin": ALLOWED_ORIGIN},
    )

def _unauthorized(message: str = "Unauthorized") -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps({"error": message}),
        status_code=401,
        mimetype="application/json",
        headers={"Access-Control-Allow-Origin": ALLOWED_ORIGIN},
    )
```

**Auth gate pattern — keep exactly as-is** (lines 44–48, repeated in every write handler):
```python
try:
    require_auth(req)
except ValueError:
    return _unauthorized()
```

**`create_post` — storage section to REPLACE** (current lines 67–85):
```python
# OLD (blob):
client = get_container_client()
slug = generate_slug(title, client)
...
client.get_blob_client(f"{slug}.md").upload_blob(content.encode(), overwrite=True)

# NEW (GitHub):
slug = generate_slug(title)    # no client arg
post = build_post(...)
errors = validate_post(post)
if errors:
    return _json_response({"error": errors[0]}, status_code=400)
content = serialize_post(post)
create_file(slug, content, f"post: add {slug}")
return _json_response({"slug": slug}, status_code=201)
```

**Error handling for create — map GitHub errors** (replaces bare `except Exception`):
```python
except requests.exceptions.HTTPError as e:
    if e.response is not None and e.response.status_code == 422:
        return _json_response({"error": "conflict"}, status_code=409)
    return _json_response({"error": "storage error"}, status_code=502)
except Exception:
    return _json_response({"error": "storage error"}, status_code=502)
```

**`update_post` — storage section to REPLACE** (current lines 110–157):
```python
# OLD (blob):
client = get_container_client()
blob_client = client.get_blob_client(f"{slug}.md")
raw = blob_client.download_blob().readall().decode("utf-8")
existing = parse_post(raw)
original_date = existing.metadata.get("date")
...
blob_client.upload_blob(content.encode(), overwrite=True)

# NEW (GitHub — GET first for SHA + content, then PUT):
sha, raw = get_file_sha(slug)
if sha is None:
    return _json_response({"error": "not found"}, status_code=404)
existing = parse_post(raw)
original_date = existing.metadata.get("date")
...
content = serialize_post(post)
update_file(slug, content, sha, f"post: update {slug}")
```

**`delete_post` — storage section to REPLACE** (current lines 176–189):
```python
# OLD (blob):
client = get_container_client()
client.get_blob_client(f"{slug}.md").delete_blob()
# ResourceNotFoundError → 404

# NEW (GitHub — GET for SHA, then DELETE):
sha, _ = get_file_sha(slug)
if sha is None:
    return _json_response({"error": "not found"}, status_code=404)
delete_file(slug, sha, f"post: delete {slug}")
# 204 return — keep as-is (lines 186–189)
```

**`list_posts` — storage section to REPLACE** (current lines 200–218):
```python
# OLD (blob):
client = get_container_client()
for blob in client.list_blobs():
    raw = client.get_blob_client(blob.name).download_blob().readall().decode("utf-8")
    post = parse_post(raw)
    ...

# NEW (GitHub):
all_posts = list_posts_dir()
posts = []
for post in all_posts:
    if post.metadata.get("published") is True:
        date_val = post.metadata.get("date")
        updated_val = post.metadata.get("updatedAt")
        posts.append({
            "title": post.metadata.get("title"),
            "slug": post.metadata.get("slug"),
            "date": date_val.isoformat() if hasattr(date_val, "isoformat") else str(date_val) if date_val is not None else "",
            "description": post.metadata.get("description"),
            "updatedAt": updated_val.isoformat() if hasattr(updated_val, "isoformat") else str(updated_val) if updated_val is not None else "",
        })
posts.sort(key=lambda p: p["date"], reverse=True)
return _json_response({"posts": posts})
```

**`get_post` — storage section to REPLACE** (current lines 222–247):
```python
# OLD (blob):
client = get_container_client()
raw = client.get_blob_client(f"{slug}.md").download_blob().readall().decode("utf-8")
# ResourceNotFoundError → 404

# NEW (GitHub):
sha, raw = get_file_sha(slug)
if sha is None:
    return _json_response({"error": "not found"}, status_code=404)
post = parse_post(raw)
# published check + response shape unchanged from current lines 232–243
```

**204 response shape — keep exactly as-is** (current lines 186–189):
```python
return func.HttpResponse(
    status_code=204,
    headers={"Access-Control-Allow-Origin": ALLOWED_ORIGIN},
)
```

---

### `posts-api/requirements.txt` (config)

**Analog:** `posts-api/requirements.txt` (current — lines 1–5).

**Current file:**
```
azure-functions
azure-storage-blob>=12.23.1,<12.29.0
azure-identity>=1.15.0
python-frontmatter>=1.3.0
python-slugify>=8.0.4
```

**New file — remove 2 lines, add 1:**
```
azure-functions
requests>=2.28.0
python-frontmatter>=1.3.0
python-slugify>=8.0.4
```

---

### `posts-api/tests/conftest.py` (config, test setup)

**Analog:** `posts-api/tests/conftest.py` (current — lines 1–21).

**Entire file to REPLACE.** Remove the Azurite fixture entirely. Add the shared base64 helper used by all mock-based tests.

**New conftest pattern:**
```python
import base64

def encode_content(content_str: str) -> str:
    """Encode a string as base64 the way GitHub API returns it (no embedded newlines)."""
    return base64.b64encode(content_str.encode("utf-8")).decode("ascii")
```

No pytest fixtures needed. Tests use `unittest.mock.patch` directly.

---

### `posts-api/tests/test_slugs.py` (test, CRUD)

**Analog:** `posts-api/tests/test_slugs.py` (current — lines 1–40); rewrite Azurite-backed tests to `requests.get` mock-based.

**Current pattern to REPLACE** — Azurite container_client as fixture arg:
```python
# OLD: all tests take container_client fixture
def test_basic_slug(container_client):
    result = generate_slug("Hello World", container_client)
```

**New mock pattern — use `unittest.mock.patch`:**
```python
from unittest.mock import patch, MagicMock
from slugs import generate_slug

def test_basic_slug():
    """generate_slug('Hello World') -> 'hello-world' when GitHub returns 404."""
    mock_resp = MagicMock()
    mock_resp.status_code = 404
    with patch("slugs.requests.get", return_value=mock_resp):
        result = generate_slug("Hello World")
    assert result == "hello-world"

def test_dedup_suffix():
    """With 'hello-world' taken (200) and 'hello-world-2' free (404), returns 'hello-world-2'."""
    taken = MagicMock(); taken.status_code = 200
    free = MagicMock(); free.status_code = 404
    with patch("slugs.requests.get", side_effect=[taken, free]):
        result = generate_slug("Hello World")
    assert result == "hello-world-2"

def test_empty_title_raises():
    with pytest.raises(ValueError):
        generate_slug("!!!###")
    # No requests call made — ValueError raised before network touch
```

**Test coverage to preserve:**
- `test_basic_slug` — 404 → free slug
- `test_unicode_slug` — unicode transliteration still works (no mock needed, slugify is local)
- `test_dedup_suffix` — 200 then 404 → `-2` suffix
- `test_dedup_triple` — 200, 200, 404 → `-3` suffix
- `test_empty_title_raises` — ValueError before any request

---

### `posts-api/tests/test_function_app.py` (test, CRUD)

**Analog:** `posts-api/tests/test_function_app.py` (current — all 630 lines); rewrite all monkeypatch/Azurite calls to `patch("requests.*")`.

**Auth header helper — keep exactly as-is** (current lines 239–248):
```python
def _make_auth_header(email: str = "test@example.com") -> dict:
    claims = [
        {"typ": "preferred_username", "val": email},
        {"typ": "http://schemas.microsoft.com/identity/claims/objectidentifier", "val": "test-oid-123"},
        {"typ": "name", "val": "Test User"},
    ]
    principal = {"claims": claims}
    encoded = base64.b64encode(_json.dumps(principal).encode()).decode()
    return {"X-MS-CLIENT-PRINCIPAL": encoded}
```

**Imports to ADD at top of rewritten file:**
```python
from unittest.mock import patch, MagicMock, call
import base64
import json as _json
import pytest
import azure.functions as func
import function_app
from schema import build_post, serialize_post
from conftest import encode_content
```

**Current monkeypatch pattern to REPLACE throughout:**
```python
# OLD:
monkeypatch.setattr("function_app.get_container_client", lambda: mock_client)
mock_client.list_blobs.return_value = []

# NEW (list_posts):
mock_dir_resp = MagicMock(); mock_dir_resp.status_code = 200; mock_dir_resp.json.return_value = []
with patch("requests.get", return_value=mock_dir_resp):
    resp = function_app.list_posts(req)
```

**`test_get_post_success` — new mock pattern:**
```python
def test_get_post_success():
    post = build_post(title="Test", slug="test", date="2026-01-01T00:00:00+00:00",
                      description="d", body="b", published=True)
    raw = serialize_post(post)
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"sha": "abc123", "content": encode_content(raw)}
    with patch("requests.get", return_value=mock_resp):
        req = func.HttpRequest(method="GET", body=b"", url="/api/posts/test",
                               params={}, route_params={"slug": "test"})
        resp = function_app.get_post(req)
    assert resp.status_code == 200
```

**`test_get_post_not_found` — new mock pattern:**
```python
def test_get_post_not_found():
    mock_resp = MagicMock(); mock_resp.status_code = 404
    with patch("requests.get", return_value=mock_resp):
        req = func.HttpRequest(method="GET", body=b"", url="/api/posts/missing",
                               params={}, route_params={"slug": "missing"})
        resp = function_app.get_post(req)
    assert resp.status_code == 404
```

**`test_create_post_success` — new mock pattern:**
```python
def test_create_post_success():
    # generate_slug hits GET (404 = free), create_file hits PUT (201)
    get_resp = MagicMock(); get_resp.status_code = 404
    put_resp = MagicMock(); put_resp.status_code = 201
    with patch("requests.get", return_value=get_resp), \
         patch("requests.put", return_value=put_resp):
        req = func.HttpRequest(
            method="POST",
            body=_json.dumps({"title": "My Test Post", "description": "A desc",
                              "body": "Content", "published": False}).encode(),
            url="/api/posts", params={}, headers=_make_auth_header(),
        )
        resp = function_app.create_post(req)
    assert resp.status_code == 201
    assert "slug" in _json.loads(resp.get_body())
```

**`test_update_post_success` — new two-request pattern:**
```python
def test_update_post_success():
    post = build_post(title="Orig", slug="test-slug", date="2026-01-15T00:00:00+00:00",
                      description="desc", body="body", published=False)
    raw = serialize_post(post)
    get_resp = MagicMock(); get_resp.status_code = 200
    get_resp.json.return_value = {"sha": "abc123", "content": encode_content(raw)}
    put_resp = MagicMock(); put_resp.status_code = 200
    with patch("requests.get", return_value=get_resp), \
         patch("requests.put", return_value=put_resp):
        req = func.HttpRequest(
            method="PUT",
            body=_json.dumps({"title": "Updated", "description": "desc",
                              "body": "updated body", "published": True}).encode(),
            url="/api/posts/test-slug", params={},
            headers=_make_auth_header(), route_params={"slug": "test-slug"},
        )
        resp = function_app.update_post(req)
    assert resp.status_code == 200
```

**`test_delete_post_success` — new two-request pattern:**
```python
def test_delete_post_success():
    get_resp = MagicMock(); get_resp.status_code = 200
    get_resp.json.return_value = {"sha": "abc123", "content": encode_content("---\nslug: test\n---\n")}
    del_resp = MagicMock(); del_resp.status_code = 200
    with patch("requests.get", return_value=get_resp), \
         patch("requests.delete", return_value=del_resp):
        req = func.HttpRequest(method="DELETE", body=b"", url="/api/posts/test-slug",
                               params={}, headers=_make_auth_header(),
                               route_params={"slug": "test-slug"})
        resp = function_app.delete_post(req)
    assert resp.status_code == 204
    assert resp.get_body() == b""
```

**Auth tests — pattern unchanged** (test structure stays the same; only mock target changes):
```python
# OLD: monkeypatch.setattr("function_app.get_container_client", ...)
# NEW: patch("requests.get", ...) — but for auth tests, no requests call is
# made because auth gate fires first. No mock needed at all.
def test_create_post_requires_auth():
    req = func.HttpRequest(method="POST",
                           body=_json.dumps({"title": "T", "description": "D"}).encode(),
                           url="/api/posts", params={}, headers={})
    resp = function_app.create_post(req)
    assert resp.status_code == 401
```

**All integration tests (Azurite-backed) to DELETE** — every test with `container_client` fixture arg: `test_list_posts_returns_published_only`, `test_list_posts_excludes_drafts`, `test_list_posts_sorted_by_date`, `test_get_post_published`, `test_get_post_draft_returns_404`, `test_create_post_integration`, `test_update_post_preserves_date`, `test_update_post_integration`, `test_delete_post_integration`. Replace with pure unit tests using mocks.

---

### `posts-api/tests/test_storage.py` (DELETE)

**Action:** Delete the entire file. No replacement. Azurite integration tests are superseded by mock-based unit tests in `test_function_app.py` and `test_slugs.py`.

---

### `azure-infrastructure/modules/postsapi.bicep` (config)

**Analog:** `azure-infrastructure/modules/postsapi.bicep` (current — all 160 lines).

**Params to ADD at top** (after existing params, before `resource storageAccount`):
```bicep
@secure()
@description('GitHub PAT with repo scope for writing posts')
param githubToken string

@description('GitHub repo in owner/repo format (e.g. skarumbu/my-website)')
param githubRepo string = 'skarumbu/my-website'
```

**Resource block to DELETE** (current lines 33–39):
```bicep
// DELETE this block entirely:
resource postsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2022-09-01' = {
  parent: blobService
  name: 'posts'
  properties: {
    publicAccess: 'None'
  }
}
```

**`storageConnectionString` var to DELETE** (current line 41):
```bicep
// DELETE:
var storageConnectionString = 'DefaultEndpointsProtocol=https;...'
```

**App settings to REMOVE from `functionApp.properties.siteConfig.appSettings`** (current lines 93–99):
```bicep
// DELETE these two entries:
{
  name: 'POSTS_STORAGE_ACCOUNT_NAME'
  value: storageAccount.name
}
{
  name: 'POSTS_CONTAINER_NAME'
  value: 'posts'
}
```

**App settings to ADD** (insert after `POSTS_CLIENT_SECRET` entry, current line ~103):
```bicep
{
  name: 'GITHUB_TOKEN'
  value: githubToken
}
{
  name: 'GITHUB_REPO'
  value: githubRepo
}
```

**Role assignment to DELETE** (current lines 146–154):
```bicep
// DELETE this entire resource block:
resource blobDataContributorRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storageAccount
  name: guid(storageAccount.id, functionApp.id, 'StorageBlobDataContributor')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

**Resources to KEEP unchanged** (do NOT touch):
- `storageAccount` resource (lines 14–26) — required for `AzureWebJobsStorage`
- `blobService` resource (lines 28–31) — required by Functions runtime
- `appServicePlan` resource (lines 43–54)
- `functionApp` resource except the app settings swap above
- `authSettings` resource (lines 115–144)
- All `AzureWebJobsStorage`, `WEBSITE_CONTENTAZUREFILECONNECTIONSTRING`, `WEBSITE_CONTENTSHARE` settings
- `storageConnectionString` var MUST remain since it is still referenced by `AzureWebJobsStorage` and `WEBSITE_CONTENTAZUREFILECONNECTIONSTRING`

**CRITICAL: `storageConnectionString` var** — keep it if any app settings still reference it. `AzureWebJobsStorage` and `WEBSITE_CONTENTAZUREFILECONNECTIONSTRING` both use it. Only delete the var if all referencing settings are removed (they are NOT — keep the var).

**Output to KEEP** (lines 156–160) — `storageAccountName` output may still be used by external scripts; keep until confirmed unused:
```bicep
output storageAccountName string = storageAccount.name
```

---

### `azure-infrastructure/main.bicep` (config)

**Analog:** `azure-infrastructure/main.bicep` (current — lines 183–193 show postsAPI module call).

**New params to ADD** (after existing `postsApiClientSecret` param, around line 59):
```bicep
@secure()
@description('GitHub PAT with repo scope for posts-api to write to GitHub')
param githubToken string

@description('GitHub repo in owner/repo format for posts-api')
param githubRepo string = 'skarumbu/my-website'
```

**Module call to UPDATE** (current lines 183–193):
```bicep
// CURRENT:
module postsAPI 'modules/postsapi.bicep' = {
  name: 'postsAPIDeployment'
  scope: rg
  params: {
    location: location
    environment: environment
    azureTenantId: azureTenantId
    postsApiClientId: postsApiClientId
    postsApiClientSecret: postsApiClientSecret
  }
}

// NEW — add two params:
module postsAPI 'modules/postsapi.bicep' = {
  name: 'postsAPIDeployment'
  scope: rg
  params: {
    location: location
    environment: environment
    azureTenantId: azureTenantId
    postsApiClientId: postsApiClientId
    postsApiClientSecret: postsApiClientSecret
    githubToken: githubToken
    githubRepo: githubRepo
  }
}
```

---

### `posts/*.md` — Design Doc Migration (5 files)

**Analog:** `docs/design/*.md` (current) — move + prepend frontmatter.

**Frontmatter block template to prepend to each file:**
```yaml
---
title: "<H1 heading text from the file>"
slug: "<slug from migration table>"
date: "<YYYY-MM-DDT00:00:00+00:00>"
published: true
description: "<one-line summary>"
updatedAt: "<same as date>"
---
```

**Per-file mapping** (filename, slug, date, title from H1):

| Target path | Slug | Date | Title (from H1) |
|-------------|------|------|-----------------|
| `posts/per-idea-status-updates.md` | `per-idea-status-updates` | `2026-05-12T00:00:00+00:00` | `ADR: Per-Idea Status Updates` |
| `posts/dashboard-github-actions-expandable-cards.md` | `dashboard-github-actions-expandable-cards` | `2026-05-12T00:00:00+00:00` | `ADR: Dashboard — GitHub Actions Integration & Expandable Cards` |
| `posts/running-app.md` | `running-app` | `2026-05-23T00:00:00+00:00` | `ADR: Running App` |
| `posts/running-app-deployment-decisions.md` | `running-app-deployment-decisions` | `2026-05-25T00:00:00+00:00` | `ADR: Running App — Deployment & Auth Decisions` |
| `posts/posts-writing-system.md` | `posts-writing-system` | `2026-06-06T00:00:00+00:00` | `Design Doc: Posts & Writing System (v1.0)` |

**Concrete example** — `posts/per-idea-status-updates.md`:
```markdown
---
title: "ADR: Per-Idea Status Updates"
slug: per-idea-status-updates
date: "2026-05-12T00:00:00+00:00"
published: true
description: "Architecture decision record for adding per-idea status update tracking."
updatedAt: "2026-05-12T00:00:00+00:00"
---
# ADR: Per-Idea Status Updates

**Date:** 2026-05-12
...rest of file unchanged...
```

**Key frontmatter notes:**
- `date` and `updatedAt` must use ISO 8601 with timezone (`+00:00`) to match `python-frontmatter` date parsing behavior already in `schema.py`.
- `description` is the one-line summary; derive from the first sentence of the Context section or the document's stated purpose.
- The original file body below the frontmatter is untouched — only prepend the block.
- After migration, delete `docs/design/` directory (run `grep -r "docs/design" .` first to catch broken links, per Pitfall 5 in RESEARCH.md).

---

## Shared Patterns

### Auth Gate
**Source:** `posts-api/function_app.py` lines 44–48 (identical in all 3 write handlers)
**Apply to:** `create_post`, `update_post`, `delete_post`
```python
try:
    require_auth(req)
except ValueError:
    return _unauthorized()
```

### Slug Validation
**Source:** `posts-api/function_app.py` lines 100–102 (and 172–174)
**Apply to:** `update_post`, `delete_post`, `get_post`
```python
slug = req.route_params.get("slug")
if not slug or not SLUG_RE.match(slug):
    return _json_response({"error": "invalid slug"}, status_code=400)
```

### Date Serialization
**Source:** `posts-api/function_app.py` lines 210–215 (repeated in `list_posts`, `get_post`, `update_post`)
**Apply to:** All handlers that return post metadata
```python
date_val = post.metadata.get("date")
updated_val = post.metadata.get("updatedAt")
# Then in the dict:
"date": date_val.isoformat() if hasattr(date_val, "isoformat") else str(date_val) if date_val is not None else "",
"updatedAt": updated_val.isoformat() if hasattr(updated_val, "isoformat") else str(updated_val) if updated_val is not None else "",
```

### GitHub Error Mapping
**Source:** RESEARCH.md Pattern 8 (no existing codebase analog — new pattern)
**Apply to:** All handlers that call GitHub helpers
```python
except requests.exceptions.HTTPError as e:
    if e.response is not None and e.response.status_code == 422:
        return _json_response({"error": "conflict"}, status_code=409)
    return _json_response({"error": "storage error"}, status_code=502)
except Exception:
    return _json_response({"error": "storage error"}, status_code=502)
```

### Base64 Line-Break Stripping
**Source:** RESEARCH.md Pattern 2 + Pitfall 1
**Apply to:** Every `requests.get` call that reads file content from GitHub API
```python
content_b64 = data["content"].replace("\n", "")  # GitHub embeds \n every 60 chars
raw = base64.b64decode(content_b64).decode("utf-8")
```

### Test Auth Header Builder
**Source:** `posts-api/tests/test_function_app.py` lines 239–248
**Apply to:** All write handler tests in rewritten `test_function_app.py`
```python
def _make_auth_header(email: str = "test@example.com") -> dict:
    claims = [
        {"typ": "preferred_username", "val": email},
        {"typ": "http://schemas.microsoft.com/identity/claims/objectidentifier", "val": "test-oid-123"},
        {"typ": "name", "val": "Test User"},
    ]
    principal = {"claims": claims}
    encoded = base64.b64encode(_json.dumps(principal).encode()).decode()
    return {"X-MS-CLIENT-PRINCIPAL": encoded}
```

### Bicep Secure Param Pattern
**Source:** `azure-infrastructure/main.bicep` lines 38–41 (existing `githubPat` param — same pattern)
**Apply to:** `githubToken` param in both `postsapi.bicep` and `main.bicep`
```bicep
@secure()
@description('GitHub PAT with repo scope for ...')
param githubToken string
```

---

## No Analog Found

All files have close analogs (they are rewrites of existing files). No greenfield files exist in this phase.

---

## Metadata

**Analog search scope:** `C:\Users\Sriram\posts-api\`, `C:\Users\Sriram\azure-infrastructure\`, `C:\Users\Sriram\my-website\docs\design\`
**Files read:** `function_app.py`, `slugs.py`, `schema.py`, `auth.py`, `requirements.txt`, `tests/conftest.py`, `tests/test_function_app.py`, `tests/test_slugs.py`, `modules/postsapi.bicep`, `main.bicep`, 5 design docs (first 5–20 lines each)
**Pattern extraction date:** 2026-06-06
