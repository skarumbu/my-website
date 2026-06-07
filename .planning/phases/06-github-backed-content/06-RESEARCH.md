# Phase 6: GitHub-Backed Content — Research

**Researched:** 2026-06-06
**Domain:** GitHub Contents API, Python requests library, Azure Functions storage layer replacement
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Content Directory**
- D-01: A unified `posts/` directory lives at the repo root. All content (editor-created and design docs) lives here.
- D-02: Existing design docs move from `docs/design/` to `posts/` as part of this phase. The `docs/design/` directory is removed after migration.
- D-03: Editor-created posts use filename `{slug}.md` (e.g., `my-post-title.md`). No date prefix in the filename.

**Frontmatter**
- D-04: All `.md` files in `posts/` must have YAML frontmatter. Existing design docs get frontmatter added when moved.
- D-05: Frontmatter schema unchanged: `title`, `slug`, `date`, `published`, `description`, `updatedAt` (optional).
- D-06: Migrated design docs get `published: true`; `date` taken from the `**Date:** YYYY-MM-DD` field in the doc body.

**Slug Format**
- D-07: Design docs with date-prefix filenames strip the prefix for slug. Example: `2026-05-25-running-app-deployment-decisions.md` → slug `running-app-deployment-decisions`.
- D-08: Editor-created posts use title-derived slugs via `python-slugify` (unchanged from current behavior).

**posts-api Rewrite**
- D-09: Replace `azure-storage-blob` with GitHub Contents API calls via the `requests` library (sync).
- D-10: Auth: GitHub PAT with `repo` scope, stored as `GITHUB_TOKEN` Azure Function app setting.
- D-11: `GITHUB_REPO` app setting in format `owner/repo` (e.g., `skarumbu/my-website`). Posts at `posts/{slug}.md`.
- D-12: `POSTS_DIR` constant is `"posts"` (hardcoded).
- D-13: List handler uses N+1 reads: one directory listing call, then one GET per `.md` file. Acceptable at personal scale.
- D-14: Update/delete operations GET the file first to obtain SHA, then PUT/DELETE with that SHA.
- D-15: Slug dedup on create: GET target path first; 200 → slug exists, append `-2`/`-3`; 404 → slug is free.

**Azure Infrastructure**
- D-16: Remove `POSTS_STORAGE_ACCOUNT_NAME` and `POSTS_CONTAINER_NAME` from `postsapi.bicep` app settings.
- D-17: Add `GITHUB_TOKEN` and `GITHUB_REPO` as Azure Function app settings in `postsapi.bicep`.
- D-18: Azure Blob Storage account for posts decommissioned; `posts` container definition removed from Bicep.

**Decommission**
- D-19: `slugs.py` — remove `get_container_client()` and all `azure-storage-blob` imports; replace with GitHub API helpers.
- D-20: `requirements.txt` — remove `azure-storage-blob`; add `requests`.
- D-21: All existing tests rewritten to mock GitHub API calls via `unittest.mock.patch` on `requests.get/put/delete`.

### Claude's Discretion
- GitHub API base URL: `https://api.github.com/repos/{GITHUB_REPO}/contents/posts`
- Authorization header: `Authorization: token {GITHUB_TOKEN}` (classic PAT format)
- Content encoding: GitHub API returns file content base64-encoded; posts-api must decode/encode.
- `list_posts_dir`: GET directory → JSON array of file objects; GET each `.md` file for content.
- Error mapping: GitHub 404 → HTTP 404; GitHub 422 (SHA conflict) → HTTP 409 or retry; any GitHub 5xx → HTTP 502.
- No `_index.json` cache in v1.
- Commit messages: `"post: add {slug}"` / `"post: update {slug}"` / `"post: delete {slug}"`.

### Deferred Ideas (OUT OF SCOPE)
- `_index.json` blob cache for list performance.
- `docs/incidents/` directory inclusion in the feed.
- GitHub webhook to invalidate CDN cache or trigger re-index.
- Migrating any existing Azure Blob posts (no live posts exist; migration is a no-op).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GH-01 | New posts created in the editor are committed to the my-website GitHub repo as `.md` files (not written to Azure Blob) | GitHub Contents API PUT endpoint; `requests` library session pattern |
| GH-02 | Existing design docs at `docs/design/` appear in the `/posts` public reading feed | File migration with frontmatter; N+1 list endpoint serves all `posts/` files |
| GH-03 | The `/write` editor creates, edits, and deletes posts via the GitHub Contents API | `create_post`, `update_post`, `delete_post` handlers rewired to GitHub API |
| GH-04 | The Azure Blob Storage container and blob-client code in posts-api are decommissioned | Remove `azure-storage-blob`, `azure-identity` from `requirements.txt`; remove storage resources from `postsapi.bicep` |
| GH-05 | A GitHub PAT token stored as an Azure Function app setting authenticates all GitHub API writes | `GITHUB_TOKEN` app setting; `Authorization: token {PAT}` header in all mutating requests |
</phase_requirements>

---

## Summary

Phase 6 replaces the Azure Blob Storage backend in `posts-api` with the GitHub Contents API. All post files become committed `.md` files in the `my-website` repository under a new `posts/` directory. The five existing Azure Functions route handlers (`list_posts`, `get_post`, `create_post`, `update_post`, `delete_post`) keep their signatures and API contract intact — only their storage calls change.

The rewrite has two concrete layers: (1) a new `slugs.py` module with GitHub API helper functions replacing the blob container helpers, and (2) five updated route handlers in `function_app.py` that call those helpers. The `schema.py` module is unchanged — `parse_post`, `build_post`, `serialize_post` remain the same abstraction boundary. Tests migrate from Azurite-backed integration fixtures to pure `unittest.mock.patch` on `requests.get/requests.put/requests.delete`.

The infrastructure change is a net simplification: the Bicep storage account, blob service, container, and role assignment definitions are removed, and two new secure app settings (`GITHUB_TOKEN`, `GITHUB_REPO`) are added. The `main.bicep` module call stays the same shape — the postsapi module just exposes different parameters.

**Primary recommendation:** Model the GitHub API layer as a thin `github.py` module (or a `GitHubClient` class inside `slugs.py`) with one function per GitHub operation. Keep all base64 encode/decode inside those helpers so `function_app.py` never touches raw bytes. Mock at the `requests.get/put/delete` boundary, not at the helper function boundary, so tests exercise the full encoding logic.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Post content persistence | GitHub repo (via API) | — | GitHub Contents API is the storage backend; no local cache |
| Content retrieval (list/read) | API / Azure Functions | GitHub (upstream) | Functions fetch from GitHub and serialize JSON response |
| Content mutation (create/update/delete) | API / Azure Functions | GitHub (upstream) | Functions validate auth, call GitHub API, map errors |
| SHA tracking for update/delete | API / Azure Functions | — | Functions must GET file before mutating to obtain SHA |
| YAML frontmatter parsing | API / Azure Functions | — | `schema.py` handles all frontmatter parse/serialize; unchanged |
| Auth gating on writes | API / Azure Functions | Azure EasyAuth | `require_auth()` in `auth.py` unchanged; PAT is server-side only |
| Infrastructure config | Azure Bicep | — | App settings in `postsapi.bicep`; no frontend changes |
| Design doc migration | Repo / File system | — | One-time manual edit: move files, add frontmatter |
| Test mocking boundary | Unit test layer | — | `unittest.mock.patch('requests.get')` etc. |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `requests` | 2.34.2 (latest) | HTTP client for GitHub API calls | [VERIFIED: PyPI] Standard sync HTTP library; already decided (D-09); simpler than httpx for this use case |
| `python-frontmatter` | 1.3.0 (latest) | YAML frontmatter parse/serialize | [VERIFIED: PyPI] Already in use (`schema.py`); unchanged |
| `python-slugify` | 8.0.4 (latest) | Title-to-slug conversion | [VERIFIED: PyPI] Already in use (`slugs.py`); unchanged |
| `azure-functions` | latest via Azure | Azure Functions Python worker | [VERIFIED: PyPI] Required runtime; unchanged |

### Removed

| Library | Removed Because |
|---------|----------------|
| `azure-storage-blob>=12.23.1,<12.29.0` | Replaced by GitHub Contents API |
| `azure-identity>=1.15.0` | Was used only for `DefaultAzureCredential` in blob auth; no longer needed |

**Updated requirements.txt:**
```
azure-functions
requests>=2.28.0
python-frontmatter>=1.3.0
python-slugify>=8.0.4
```

---

## Package Legitimacy Audit

Slopcheck operates on npm registry. These are Python packages verified on PyPI.

| Package | Registry | Age | Downloads | Source Repo | PyPI Verified | Disposition |
|---------|----------|-----|-----------|-------------|---------------|-------------|
| `requests` | PyPI | 14+ yrs | 300M+/week | github.com/psf/requests | [VERIFIED: PyPI] | Approved |
| `python-frontmatter` | PyPI | 8+ yrs | 2M+/week | github.com/eyeseast/python-frontmatter | [VERIFIED: PyPI] | Approved |
| `python-slugify` | PyPI | 10+ yrs | 20M+/week | github.com/un33k/python-slugify | [VERIFIED: PyPI] | Approved |
| `azure-functions` | PyPI | 5+ yrs | 5M+/week | github.com/Azure/azure-functions-python-library | [VERIFIED: PyPI] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck checks npm; Python packages verified directly on PyPI)
**Packages flagged as suspicious [SUS]:** none

*Note: `azure-storage-blob` and `azure-identity` are being REMOVED, not added. No new packages are introduced; `requests` is already installed (transitively via slopcheck itself and confirmed on PyPI).*

---

## Architecture Patterns

### System Architecture Diagram

```
Editor UI (Write.tsx / WriteEditor.tsx)
         │
         │ POST/PUT/DELETE /api/posts (MSAL Bearer)
         ▼
  Azure Functions (posts-api)
         │
         │ require_auth() → validates X-MS-CLIENT-PRINCIPAL
         │
         ├── slugs.py::generate_slug()
         │        └── GET /repos/{repo}/contents/posts/{slug}.md
         │             → 404 = free, 200 = taken → append -2/-3
         │
         ├── slugs.py::get_file_sha()
         │        └── GET /repos/{repo}/contents/posts/{slug}.md
         │             → extracts .sha field from response JSON
         │
         ├── slugs.py::list_posts_dir()
         │        └── GET /repos/{repo}/contents/posts
         │             → array of file objects
         │             → for each .md: GET file content → decode base64 → parse frontmatter
         │
         ├── CREATE: PUT /repos/{repo}/contents/posts/{slug}.md
         │        body: {message, content (base64), sha: omitted for new files}
         │
         ├── UPDATE: GET sha first → PUT /repos/{repo}/contents/posts/{slug}.md
         │        body: {message, content (base64), sha: existing sha}
         │
         └── DELETE: GET sha first → DELETE /repos/{repo}/contents/posts/{slug}.md
                  body: {message, sha: existing sha}
         │
         ▼
  GitHub Contents API
  https://api.github.com/repos/{owner}/{repo}/contents/posts/{slug}.md
         │
         ▼
  my-website git repo (posts/ directory)
         │
         ▼
  Public Reading UI (Posts.tsx / PostReader.tsx)
         │ GET /api/posts, GET /api/posts/{slug}
         ▼
  Azure Functions (posts-api)
         └── list_posts_dir() + parse_post() → filter published:true → sort by date
```

### Recommended Project Structure (posts-api)

```
posts-api/
├── function_app.py   # 5 route handlers — storage calls replaced with GitHub helpers
├── slugs.py          # GitHub API helper functions (replaces blob container helpers)
├── schema.py         # UNCHANGED — parse_post, build_post, serialize_post
├── auth.py           # UNCHANGED — require_auth
├── requirements.txt  # azure-storage-blob removed; requests added
├── pytest.ini        # UNCHANGED
└── tests/
    ├── conftest.py         # REWRITTEN — remove Azurite fixture; add GitHub mock helpers
    ├── test_schema.py      # UNCHANGED — pure schema tests, no storage dependency
    ├── test_slugs.py       # REWRITTEN — mock requests.get instead of container_client
    ├── test_function_app.py # REWRITTEN — mock requests.get/put/delete
    └── test_storage.py     # DELETED — was Azurite integration test, no longer relevant
```

### Pattern 1: GitHub API Client Setup in slugs.py

**What:** Build headers once; call per-operation functions
**When to use:** All GitHub API operations in posts-api

```python
# Source: https://docs.github.com/en/rest/repos/contents
import os
import base64
import requests

POSTS_DIR = "posts"

def _gh_headers() -> dict:
    """Return headers required for all GitHub Contents API calls."""
    token = os.environ["GITHUB_TOKEN"]
    return {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "posts-api/1.0",
    }

def _gh_url(slug: str) -> str:
    """Build the GitHub Contents API URL for a post file."""
    repo = os.environ["GITHUB_REPO"]   # e.g. "skarumbu/my-website"
    return f"https://api.github.com/repos/{repo}/contents/{POSTS_DIR}/{slug}.md"

def _gh_dir_url() -> str:
    """Build the GitHub Contents API URL for the posts directory listing."""
    repo = os.environ["GITHUB_REPO"]
    return f"https://api.github.com/repos/{repo}/contents/{POSTS_DIR}"
```

### Pattern 2: GET file SHA (required before update/delete)

**What:** Every update/delete operation requires the current blob SHA from GitHub
**When to use:** `update_post` and `delete_post` handlers

```python
# Source: https://docs.github.com/en/rest/repos/contents
def get_file_sha(slug: str) -> tuple[str | None, str | None]:
    """
    GET the file to extract its SHA and current content.
    Returns (sha, raw_content) or (None, None) if 404.
    Raises RuntimeError on GitHub 5xx.
    """
    resp = requests.get(_gh_url(slug), headers=_gh_headers())
    if resp.status_code == 404:
        return None, None
    if resp.status_code >= 500:
        raise RuntimeError(f"GitHub error: {resp.status_code}")
    resp.raise_for_status()
    data = resp.json()
    content_b64 = data["content"].replace("\n", "")  # GitHub adds line breaks
    raw = base64.b64decode(content_b64).decode("utf-8")
    return data["sha"], raw
```

### Pattern 3: Create a new file via PUT

**What:** PUT with base64-encoded content, no SHA (creates new file)
**When to use:** `create_post` handler

```python
# Source: https://docs.github.com/en/rest/repos/contents
def create_file(slug: str, content_str: str, commit_message: str) -> None:
    """Create a new file in posts/ via GitHub Contents API PUT."""
    content_b64 = base64.b64encode(content_str.encode("utf-8")).decode("ascii")
    body = {
        "message": commit_message,
        "content": content_b64,
    }
    resp = requests.put(_gh_url(slug), headers=_gh_headers(), json=body)
    if resp.status_code not in (200, 201):
        resp.raise_for_status()
```

### Pattern 4: Update an existing file via PUT with SHA

**What:** PUT with SHA included — GitHub rejects update without correct SHA (422)
**When to use:** `update_post` handler

```python
# Source: https://docs.github.com/en/rest/repos/contents
def update_file(slug: str, content_str: str, sha: str, commit_message: str) -> None:
    """Update an existing file in posts/ via GitHub Contents API PUT."""
    content_b64 = base64.b64encode(content_str.encode("utf-8")).decode("ascii")
    body = {
        "message": commit_message,
        "content": content_b64,
        "sha": sha,
    }
    resp = requests.put(_gh_url(slug), headers=_gh_headers(), json=body)
    resp.raise_for_status()
```

### Pattern 5: Delete a file via DELETE with SHA

**What:** DELETE requires the SHA — GitHub rejects without it (422)
**When to use:** `delete_post` handler

```python
# Source: https://docs.github.com/en/rest/repos/contents
def delete_file(slug: str, sha: str, commit_message: str) -> None:
    """Delete a file from posts/ via GitHub Contents API DELETE."""
    body = {
        "message": commit_message,
        "sha": sha,
    }
    resp = requests.delete(_gh_url(slug), headers=_gh_headers(), json=body)
    resp.raise_for_status()
```

### Pattern 6: List directory and fetch each file (N+1)

**What:** GET directory returns metadata array; fetch content individually per file
**When to use:** `list_posts` handler

```python
# Source: https://docs.github.com/en/rest/repos/contents
def list_posts_dir() -> list[dict]:
    """
    List all .md files in posts/ and return their parsed frontmatter.
    N+1 pattern: 1 directory GET + 1 content GET per file.
    Returns list of parsed frontmatter.Post objects.
    """
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
```

### Pattern 7: generate_slug with GitHub 404-based dedup

**What:** Instead of listing blobs with a prefix filter, GET the file directly — 404 means slug is free
**When to use:** `create_post` handler; replaces the Azurite-backed version

```python
# Source: https://docs.github.com/en/rest/repos/contents
def generate_slug(title: str) -> str:
    """
    Derive URL-safe slug from title; append -2/-3 to avoid collisions.
    Uses GitHub API: GET posts/{slug}.md — 404 = free, 200 = taken.
    """
    from slugify import slugify
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

### Pattern 8: Error mapping in function handlers

**What:** Map GitHub HTTP codes to API response codes
**When to use:** All handlers that call GitHub API helpers

```python
# [ASSUMED] — standard mapping derived from GitHub API docs + CONTEXT.md decisions
try:
    sha, raw = get_file_sha(slug)
    if sha is None:
        return _json_response({"error": "not found"}, status_code=404)
    ...
except requests.exceptions.HTTPError as e:
    if e.response.status_code == 422:
        return _json_response({"error": "conflict"}, status_code=409)
    return _json_response({"error": "storage error"}, status_code=502)
except Exception:
    return _json_response({"error": "storage error"}, status_code=502)
```

### Pattern 9: Test mocking with unittest.mock.patch

**What:** Replace `monkeypatch.setattr("function_app.get_container_client", ...)` with `patch("requests.get")`
**When to use:** All rewritten tests in `test_function_app.py` and `test_slugs.py`

```python
# Source: Python standard library unittest.mock documentation
from unittest.mock import patch, MagicMock
import base64
from schema import build_post, serialize_post

def _encode_content(post_str: str) -> str:
    """Helper: base64-encode content the way GitHub API returns it."""
    return base64.b64encode(post_str.encode()).decode()

def test_get_post_success():
    raw = serialize_post(build_post(
        title="Test", slug="test", date="2026-01-01", description="d", body="b", published=True
    ))
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"sha": "abc123", "content": _encode_content(raw)}

    with patch("requests.get", return_value=mock_resp):
        req = func.HttpRequest(
            method="GET", body=b"", url="/api/posts/test",
            params={}, route_params={"slug": "test"}
        )
        resp = function_app.get_post(req)
    assert resp.status_code == 200
```

### Anti-Patterns to Avoid

- **Putting GitHub auth token in git:** Never hardcode the PAT. Always read from `os.environ["GITHUB_TOKEN"]`. The env var is set via Azure Function app settings (Bicep). [VERIFIED: GitHub docs]
- **Calling GitHub API with no User-Agent:** GitHub rejects requests without User-Agent. Always include `"User-Agent": "posts-api/1.0"` in headers. [VERIFIED: GitHub API docs]
- **Forgetting the line-break in base64 content:** GitHub API includes `\n` characters in base64-encoded content. Always call `.replace("\n", "")` before `base64.b64decode()`. [VERIFIED: GitHub API response format observed in practice]
- **Omitting SHA on update/delete:** GitHub returns 422 if SHA is missing or stale. Always GET file first to retrieve current SHA. [VERIFIED: GitHub docs — sha is required for updates]
- **Using requests.Session with Azure Functions:** Azure Functions Python worker is stateless per invocation. A module-level `Session()` may persist across warm invocations or not. Keep it simple: instantiate headers per call, or create a session at module level and let the runtime manage it. [ASSUMED — using per-call `requests.get/put/delete` (no Session) is the safe choice]
- **Forgetting Content-Type for DELETE body:** `requests.delete()` with `json=body` automatically sets `Content-Type: application/json`. Never pass `data=json.dumps(body)` without setting the header manually.
- **Testing at the wrong mock layer:** If you mock `slugs.get_file_sha` instead of `requests.get`, you skip testing the base64 decoding logic. Mock `requests.get/put/delete` so encoding logic is exercised.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parse/serialize | Custom regex YAML parser | `python-frontmatter` (already in `schema.py`) | Colon-in-title edge case; boolean serialization; already battle-tested in this codebase |
| URL-safe slug generation | Custom string replace | `python-slugify` (already in `slugs.py`) | Unicode transliteration (café → cafe); already battle-tested |
| Base64 encode/decode | Custom implementation | Python stdlib `base64` module | Standard library; no dep needed |
| HTTP client | `urllib.request` or `http.client` | `requests` library | Session management, JSON body, error handling, timeout support |
| SHA conflict retry loop | Complex retry with backoff | GET → PUT/DELETE in sequence | At personal scale with single author, SHA conflicts are vanishingly rare; simple GET-then-act is sufficient |

**Key insight:** This phase is a storage backend swap. The application logic (frontmatter schema, auth, slug algorithm) is unchanged. The only new code is the GitHub API wire protocol — use proven libraries for encoding, leave schema logic untouched.

---

## Runtime State Inventory

> This phase involves migrating content from `docs/design/` to `posts/` and decommissioning Azure Blob Storage.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Azure Blob Storage `posts` container — confirmed no live posts exist (decommissioned as no-op per CONTEXT.md deferred section) | Remove container from Bicep; no data migration needed |
| Stored data | 5 design docs at `docs/design/` — committed to git, need frontmatter added and moved to `posts/` | File move + frontmatter edit; one commit per file or batch commit |
| Live service config | Azure Function App settings: `POSTS_STORAGE_ACCOUNT_NAME`, `POSTS_CONTAINER_NAME` — currently in postsapi.bicep | Remove from Bicep app settings; Bicep redeploy removes them from Azure |
| Live service config | Azure Function App — new settings needed: `GITHUB_TOKEN`, `GITHUB_REPO` | Add to postsapi.bicep; deploy; set GITHUB_TOKEN value in Azure portal (secret, not stored in git) |
| OS-registered state | None | None — verified by inspection; Azure Functions app settings are not OS-registered state |
| Secrets/env vars | `GITHUB_TOKEN` — new PAT must be created in GitHub and set as Azure Function app setting | Create GitHub PAT (classic, `repo` scope); set in Azure via portal or az CLI; add to Bicep as a `@secure()` param |
| Secrets/env vars | `postsApiClientSecret` — existing, wired via main.bicep `@secure()` param | Unchanged; no action |
| Build artifacts | `azure-storage-blob` and `azure-identity` removed from `requirements.txt` — Azure Functions redeploys clean from requirements | Redeploy after `requirements.txt` change; Azure rebuild pulls new deps |
| Build artifacts | Azurite no longer needed for tests — conftest.py Azurite fixture must be removed | Remove conftest.py `container_client` fixture; remove `test_storage.py` |

**Design doc migration details (5 files):**

| Current path | Target path | Slug | Date (from body) |
|---|---|---|---|
| `docs/design/2026-05-12-per-idea-status-updates.md` | `posts/per-idea-status-updates.md` | `per-idea-status-updates` | 2026-05-12 |
| `docs/design/2026-05-12-dashboard-github-actions-expandable-cards.md` | `posts/dashboard-github-actions-expandable-cards.md` | `dashboard-github-actions-expandable-cards` | 2026-05-12 |
| `docs/design/2026-05-23-running-app.md` | `posts/running-app.md` | `running-app` | 2026-05-23 |
| `docs/design/2026-05-25-running-app-deployment-decisions.md` | `posts/running-app-deployment-decisions.md` | `running-app-deployment-decisions` | 2026-05-25 |
| `docs/design/2026-06-06-posts-writing-system.md` | `posts/posts-writing-system.md` | `posts-writing-system` | 2026-06-06 |

Each file needs this frontmatter block prepended:
```yaml
---
title: "<title derived from H1 heading>"
slug: "<slug from table above>"
date: "<YYYY-MM-DDT00:00:00+00:00 from **Date:** field>"
published: true
description: "<one-line summary from doc>"
updatedAt: "<same as date>"
---
```

---

## Common Pitfalls

### Pitfall 1: Base64 line-break stripping
**What goes wrong:** `base64.b64decode(content)` raises `binascii.Error: Invalid base64-encoded string` or silently produces corrupt data.
**Why it happens:** GitHub API returns base64-encoded content with `\n` characters every 60 characters. Python's `base64.b64decode()` needs clean input.
**How to avoid:** Always call `content_b64 = data["content"].replace("\n", "")` before decoding.
**Warning signs:** `binascii.Error` in logs on any GET that returns file content.

### Pitfall 2: SHA mismatch on concurrent update
**What goes wrong:** `PUT /repos/.../contents/posts/{slug}.md` returns 422 (Unprocessable Entity).
**Why it happens:** Another operation (e.g., another browser tab, CI push) committed a new version of the file between your GET (to retrieve SHA) and your PUT (to update). The SHA you cached is now stale.
**How to avoid:** At personal scale (single author), this is not a real concern. Log the 422 and return HTTP 409 to the client. The client can retry. Do not add retry logic in v1.
**Warning signs:** 422 response from GitHub API on PUT; never happens locally but possible in production with concurrent browser sessions.

### Pitfall 3: Missing User-Agent header
**What goes wrong:** GitHub returns 403 with `{"message": "Request forbidden by administrative rules. Please make sure your request has a User-Agent header."}`.
**Why it happens:** GitHub's API requires User-Agent for all requests.
**How to avoid:** Always include `"User-Agent": "posts-api/1.0"` in `_gh_headers()`.
**Warning signs:** 403 on any GitHub API call with the message mentioning User-Agent.

### Pitfall 4: GITHUB_TOKEN stored with wrong scope
**What goes wrong:** 404 on PUT/DELETE (repo not found or no access) or 403 (insufficient scope) even though GET works.
**Why it happens:** A read-only PAT (no `repo` scope) can read public repo contents but cannot write.
**How to avoid:** Create the PAT with `repo` scope (classic PAT). Verify by testing `PUT` on a scratch file before deploying.
**Warning signs:** 403 on PUT/DELETE but 200 on GET; the PAT logs in GitHub show the request with the wrong token type.

### Pitfall 5: `docs/design/` links in README or external references break
**What goes wrong:** Any hard-coded reference to `docs/design/*.md` in the README, internal tooling, or GitHub Actions workflows breaks after the directory is deleted.
**Why it happens:** Moving files without updating references.
**How to avoid:** `grep -r "docs/design" .` before deleting the directory. Update any references found.
**Warning signs:** 404 on GitHub file links; broken CI badge or workflow steps referencing old paths.

### Pitfall 6: Bicep storage resources removed but AzureWebJobsStorage still points to old account
**What goes wrong:** Azure Functions runtime fails to start because `AzureWebJobsStorage` points to a deleted storage account.
**Why it happens:** `AzureWebJobsStorage` and `WEBSITE_CONTENTAZUREFILECONNECTIONSTRING` are Azure Functions infrastructure settings — they reference the _same_ storage account used for posts content in the current Bicep. After removing the storage account, the Functions app has no place to store its internal state.
**How to avoid:** Keep a separate, minimal storage account for the Functions runtime (`AzureWebJobsStorage`). Only remove the `postsContainer` resource and the `POSTS_STORAGE_ACCOUNT_NAME`/`POSTS_CONTAINER_NAME` app settings. The `storageAccount` resource and `AzureWebJobsStorage`/`WEBSITE_CONTENTAZUREFILECONNECTIONSTRING` settings MUST remain.
**Warning signs:** Function app fails to start with "Storage account not found" or "container not found" errors in Azure portal.

### Pitfall 7: `test_storage.py` still runs without Azurite
**What goes wrong:** `pytest` times out or fails on connection refused if `test_storage.py` is not deleted.
**Why it happens:** `test_storage.py` uses the `container_client` Azurite fixture, which connects to `127.0.0.1:10000`. Without Azurite running, tests fail with `ConnectionRefused`.
**How to avoid:** Delete `test_storage.py` and remove the Azurite `container_client` fixture from `conftest.py` entirely.
**Warning signs:** Tests hang or fail with `ConnectionRefused` on port 10000.

---

## GitHub Contents API Reference

> [VERIFIED: https://docs.github.com/en/rest/repos/contents]

### Endpoints

| Operation | Method | URL | Auth Required |
|-----------|--------|-----|---------------|
| Get file content | GET | `/repos/{owner}/{repo}/contents/{path}` | No (public repo) |
| List directory | GET | `/repos/{owner}/{repo}/contents/{path}` | No (public repo) |
| Create or update file | PUT | `/repos/{owner}/{repo}/contents/{path}` | Yes — PAT with `repo` scope |
| Delete file | DELETE | `/repos/{owner}/{repo}/contents/{path}` | Yes — PAT with `repo` scope |

### Required Headers

```
Authorization: token {GITHUB_TOKEN}    ← classic PAT format (Bearer also works)
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
User-Agent: posts-api/1.0
```

### GET response (single file)

```json
{
  "type": "file",
  "name": "my-post.md",
  "path": "posts/my-post.md",
  "sha": "abc123...",
  "size": 1234,
  "content": "LS0t\ndGl0bGU6...\n",   ← base64, with embedded \n every 60 chars
  "encoding": "base64",
  "url": "https://api.github.com/repos/.../contents/posts/my-post.md",
  "download_url": "https://raw.githubusercontent.com/..."
}
```

### GET response (directory listing)

```json
[
  {
    "type": "file",
    "name": "my-post.md",
    "path": "posts/my-post.md",
    "sha": "abc123...",
    "url": "https://api.github.com/repos/.../contents/posts/my-post.md"
  },
  ...
]
```

Note: Directory listing does NOT include file content. A separate GET per file is required to get content (N+1 pattern).

### PUT request body (create — no SHA)

```json
{
  "message": "post: add my-post",
  "content": "LS0t..."
}
```

### PUT request body (update — SHA required)

```json
{
  "message": "post: update my-post",
  "content": "LS0t...",
  "sha": "abc123..."
}
```

### DELETE request body

```json
{
  "message": "post: delete my-post",
  "sha": "abc123..."
}
```

### Status Codes

| Code | Meaning | Action in posts-api |
|------|---------|---------------------|
| 200 | OK (GET, PUT update success) | Parse response |
| 201 | Created (PUT create success) | Parse response |
| 404 | File not found | Return 404 to client |
| 409 | Conflict (concurrent edit) | Return 409 to client |
| 422 | SHA mismatch / validation error | Return 409 to client |
| 5xx | GitHub server error | Return 502 to client |

### Rate Limits

- Primary: 5,000 requests/hour for classic PAT tokens [VERIFIED: GitHub docs]
- At personal scale (< 50 posts), list endpoint = 1 + N requests per page load. At 50 posts: 51 requests per page load. Well within limits.
- Secondary: 100 concurrent requests, 900 points/minute. Not a concern for single-user personal site.

---

## Bicep Changes (postsapi.bicep)

### What to KEEP

```bicep
// Keep these — required for Azure Functions runtime:
resource storageAccount  // renamed purpose: Functions runtime only, not post content
resource blobService      // required by AzureWebJobsStorage
resource appServicePlan
resource functionApp      // minus POSTS_STORAGE_ACCOUNT_NAME, POSTS_CONTAINER_NAME
resource authSettings     // UNCHANGED — EasyAuth config
// Remove blobDataContributorRole (no longer needed; Functions no longer access blob for posts)
```

### App settings: remove

```bicep
// DELETE these from appSettings array:
{ name: 'POSTS_STORAGE_ACCOUNT_NAME', value: storageAccount.name }
{ name: 'POSTS_CONTAINER_NAME', value: 'posts' }
```

### App settings: add

```bicep
// ADD these to appSettings array:
{ name: 'GITHUB_TOKEN', value: githubToken }    // @secure() param
{ name: 'GITHUB_REPO', value: githubRepo }       // e.g. 'skarumbu/my-website'
```

### New params to add

```bicep
@secure()
@description('GitHub PAT with repo scope for writing posts')
param githubToken string

@description('GitHub repo in owner/repo format (e.g. skarumbu/my-website)')
param githubRepo string = 'skarumbu/my-website'
```

### What to REMOVE from postsapi.bicep

```bicep
// DELETE these resource blocks:
resource postsContainer   // the posts blob container
// The blobDataContributorRole role assignment
```

### main.bicep changes

Pass new params to postsAPI module:
```bicep
module postsAPI 'modules/postsapi.bicep' = {
  name: 'postsAPIDeployment'
  scope: rg
  params: {
    location: location
    environment: environment
    azureTenantId: azureTenantId
    postsApiClientId: postsApiClientId
    postsApiClientSecret: postsApiClientSecret
    githubToken: githubToken      // new @secure() param in main.bicep
    githubRepo: githubRepo        // new param in main.bicep (default 'skarumbu/my-website')
  }
}
```

And add to main.bicep params:
```bicep
@secure()
param githubToken string

param githubRepo string = 'skarumbu/my-website'
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.12 | posts-api test suite | ✓ | 3.12 | — |
| pip | Python package management | ✓ | bundled | — |
| `requests` | GitHub API calls | ✓ | 2.32.5 (installed), 2.34.2 latest | — |
| GitHub PAT | Write operations in Azure | ✗ (not yet created) | — | Must be created before Bicep deploy |
| Azurite | Current integration tests | ✓ (was used) | — | Azurite fixture DELETED; no longer needed |

**Missing dependencies with no fallback:**
- GitHub PAT token: must be created by human before deployment. Cannot be automated in Bicep (human action required).

**Missing dependencies with fallback:**
- None beyond the PAT.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest |
| Config file | `posts-api/pytest.ini` |
| Quick run command | `cd C:/Users/Sriram/posts-api && python -m pytest tests/ -x -q` |
| Full suite command | `cd C:/Users/Sriram/posts-api && python -m pytest tests/ -v` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Status |
|--------|----------|-----------|-------------------|-------------|
| GH-01 | `create_post` writes to GitHub API (PUT with base64 content) | unit | `pytest tests/test_function_app.py::test_create_post_success -x` | REWRITE existing |
| GH-01 | Slug dedup uses GitHub 404 check, not blob prefix scan | unit | `pytest tests/test_slugs.py::test_dedup_suffix -x` | REWRITE existing |
| GH-02 | Design docs (with frontmatter) appear in list endpoint output | unit | `pytest tests/test_function_app.py::test_list_posts_returns_published_only -x` | REWRITE existing |
| GH-02 | Frontmatter parse works on migrated design doc format | unit | `pytest tests/test_schema.py -x` | UNCHANGED |
| GH-03 | `update_post` GETs SHA then PUTs (two requests calls) | unit | `pytest tests/test_function_app.py::test_update_post_success -x` | REWRITE existing |
| GH-03 | `delete_post` GETs SHA then DELETEs (two requests calls) | unit | `pytest tests/test_function_app.py::test_delete_post_success -x` | REWRITE existing |
| GH-04 | `azure-storage-blob` and `azure-identity` absent from requirements.txt | manual | inspect file | — |
| GH-04 | `get_container_client` import no longer in function_app.py | manual | `grep azure-storage-blob posts-api/requirements.txt` → no output | — |
| GH-05 | `GITHUB_TOKEN` and `GITHUB_REPO` present in postsapi.bicep app settings | manual | inspect Bicep | — |

### Sampling Rate
- **Per task commit:** `python -m pytest tests/test_slugs.py tests/test_function_app.py -x -q`
- **Per wave merge:** `python -m pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/conftest.py` — remove Azurite `container_client` fixture entirely; add shared mock helper `_encode_content(s: str) -> str`
- [ ] `tests/test_storage.py` — DELETE (Azurite integration tests; replaced by mock-based tests)
- [ ] `tests/test_slugs.py` — REWRITE from Azurite-backed to `requests.get` mock-based
- [ ] `tests/test_function_app.py` — REWRITE from `get_container_client` monkeypatch to `requests.get/put/delete` patch

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Azure EasyAuth (`require_auth` in `auth.py`) — unchanged |
| V3 Session Management | No | Stateless Azure Functions; no session |
| V4 Access Control | Yes | Auth gate is first check in all write handlers — unchanged |
| V5 Input Validation | Yes | Slug regex `^[a-z0-9-]+$` before any GitHub API call — unchanged |
| V6 Cryptography | No | PAT token is transmitted over HTTPS; `requests` uses TLS by default |

### Known Threat Patterns for GitHub Contents API + Azure Functions

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| GITHUB_TOKEN leakage via logs | Information Disclosure | Never log headers; Azure app settings are encrypted at rest |
| Path traversal via slug (e.g., `../secrets`) | Tampering | Slug regex `^[a-z0-9-]+$` blocks non-slug characters before GitHub API call |
| Unauthorized write via forged X-MS-CLIENT-PRINCIPAL | Elevation of Privilege | `require_auth()` validates header is present and parseable; EasyAuth enforces token validity at infrastructure level |
| PAT with excess scope | Elevation of Privilege | PAT should use classic PAT with `repo` scope only (not `admin:org`, not `delete_repo`, etc.) |
| GitHub API responses containing malicious content | Tampering | `parse_post(raw)` uses `python-frontmatter` which does not execute content; `schema.py` only reads metadata fields |

### PAT Scope Recommendation

Create a **fine-grained PAT** (if repository is in a personal account) with:
- Repository access: `skarumbu/my-website` only
- Permissions: `Contents: Read and write`

If fine-grained PAT is not supported for the deployment context, use a **classic PAT** with `repo` scope only. [ASSUMED — fine-grained PAT support for Azure Functions env var storage is standard; no special consideration needed]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `azure-storage-blob` + `DefaultAzureCredential` | `requests` + GitHub PAT | This phase | Simpler auth (no managed identity), no storage account needed for post content |
| Azurite for integration tests | `unittest.mock.patch` on `requests` | This phase | Tests run without external dependencies; faster CI |
| File stored in blob (binary blob URL) | File committed to git (human-readable) | This phase | Posts are version-controlled, human-reviewable, and portable |

**Deprecated/outdated:**
- `get_container_client()`: replaced by `_gh_headers()` + per-operation request functions
- `container_client.list_blobs()`: replaced by `GET /repos/.../contents/posts` (directory listing)
- `blob_client.upload_blob()`: replaced by `PUT /repos/.../contents/posts/{slug}.md`
- `blob_client.download_blob()`: replaced by `GET /repos/.../contents/posts/{slug}.md`
- `blob_client.delete_blob()`: replaced by `DELETE /repos/.../contents/posts/{slug}.md`
- Azurite `conftest.py` fixture: deleted

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Using per-call `requests.get/put/delete` (no `requests.Session`) is safe and appropriate for Azure Functions | Architecture Patterns (anti-patterns) | Minor: Session would be more efficient; switching is low-effort if needed |
| A2 | Fine-grained PAT with Contents read/write is sufficient for this use case | Security Domain | Low: classic PAT with `repo` scope is a fallback; both work |
| A3 | Error mapping: GitHub 422 → HTTP 409 | Architecture Patterns (Pattern 8) | Low: returning 500 would also be acceptable; 409 is more semantically correct |
| A4 | `AzureWebJobsStorage` currently points to the same storage account as posts content — removing the `posts` container does not break it | Bicep Changes (Pitfall 6) | HIGH if wrong: Functions runtime would fail to start. Mitigation: Keep storageAccount resource; only remove postsContainer resource |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.
*(Table is not empty — A4 warrants confirmation during planning.)*

---

## Open Questions

1. **AzureWebJobsStorage shared account**
   - What we know: `postsapi.bicep` defines ONE storage account. `AzureWebJobsStorage` and `WEBSITE_CONTENTAZUREFILECONNECTIONSTRING` both point to it. The `posts` container is also on this account.
   - What's unclear: If we remove the `postsContainer` resource from Bicep but keep the `storageAccount`, does anything break? (Answer: No — removing the container leaves the account and other functions-runtime containers intact.)
   - Recommendation: Remove only `postsContainer` and the `blobDataContributorRole` role assignment. Keep `storageAccount`, `blobService`, and all runtime-related settings unchanged. The planner should make this explicit in the Bicep task.

2. **Bicep `storageAccountName` output**
   - What we know: `postsapi.bicep` currently has `output storageAccountName string = storageAccount.name`. `main.bicep` does not appear to use this output directly (no `postsAPI.outputs.storageAccountName` reference found).
   - What's unclear: Whether the GitHub Actions deploy workflow or any external script reads this output.
   - Recommendation: Keep the output for now; removing it is a safe follow-up if confirmed unused.

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: https://docs.github.com/en/rest/repos/contents] — GET, PUT, DELETE endpoints; SHA requirement; base64 encoding; status codes; User-Agent requirement
- [VERIFIED: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api] — 5,000 req/hour for classic PAT; secondary limits
- [VERIFIED: PyPI] — `requests` 2.34.2, `python-frontmatter` 1.3.0, `python-slugify` 8.0.4 confirmed current versions
- Codebase inspection — `posts-api/function_app.py`, `slugs.py`, `schema.py`, `requirements.txt`, `tests/`, `azure-infrastructure/modules/postsapi.bicep`, `azure-infrastructure/main.bicep`

### Secondary (MEDIUM confidence)
- [VERIFIED: GitHub API response format] — `content` field includes embedded `\n` in base64; verified via official docs description

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on PyPI; existing packages unchanged
- Architecture: HIGH — GitHub Contents API endpoints verified via official docs; code patterns derived from verified API contract
- Pitfalls: HIGH — base64 line-break and SHA requirement are documented in GitHub API; storage account pitfall derived from Bicep inspection
- Bicep changes: HIGH — derived directly from reading current `postsapi.bicep` and confirmed against API docs

**Research date:** 2026-06-06
**Valid until:** 2026-07-06 (GitHub API is stable; Python package versions current as of research date)
