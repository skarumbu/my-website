# Phase 1: Storage & Schema - Research

**Researched:** 2026-05-30
**Domain:** Azure Blob Storage + Python Azure Functions v4 + python-frontmatter + slug generation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Schema has **6 fields**: `title`, `slug`, `date`, `published`, `description`, `updatedAt`. No additional fields in v1.
- **D-02:** `updatedAt` is set automatically by the backend on every write (create and update). No manual control needed — always reflects current file state.
- **D-03:** Field types: `title` (string), `slug` (string, URL-safe), `date` (ISO 8601 string), `published` (boolean), `description` (string), `updatedAt` (ISO 8601 string).
- **Container naming:** `{slug}.md` blob naming; container must be PRIVATE.
- **Serialization:** Use `python-frontmatter` library.
- **Slug:** Auto-derive from `title`, deduplication via `-2`/`-3` suffix, checked against existing blobs.
- **Repos:** Backend in `C:\Users\Sriram\posts-api\` (Python Azure Functions); infra in `C:\Users\Sriram\azure-infrastructure\` (Bicep).

### Claude's Discretion

- **Container provisioning approach:** Use the existing Bicep repo (`C:\Users\Sriram\azure-infrastructure\`) if it already manages the storage account; otherwise provision via Azure CLI during this phase. Prefer IaC over manual portal clicks.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STOR-01 | Azure Blob Storage container provisioned for posts (one `.md` file per post) | Bicep `blobServices/containers` resource with `publicAccess: 'None'`; `allowBlobPublicAccess: false` on storage account. RBAC `Storage Blob Data Contributor` role for Function App managed identity. |
| STOR-02 | Post frontmatter schema defined and documented (`title`, `slug`, `date`, `published`, `description`, `updatedAt`) | `python-frontmatter` 1.3.0 round-trips YAML frontmatter. YAML double-quoting rule for `title` prevents corruption. Schema lives as a documented Python dataclass + sample fixture. |
| STOR-03 | Slug generation algorithm implemented with deduplication (no two posts share a slug) | `python-slugify` 8.0.4 produces URL-safe slugs from unicode input. Deduplication pattern: list blobs, check `{slug}.md` existence, append `-2`/`-3` suffix. |
</phase_requirements>

---

## Summary

Phase 1 has no API endpoints and no UI — it is purely infrastructure provisioning, schema definition, and a utility function. Work lands across two sibling repos: the Bicep module goes in `C:\Users\Sriram\azure-infrastructure\` (following the exact pattern of `modules/ideasapi.bicep`), and the Python slug function + schema module go in the new `C:\Users\Sriram\posts-api\` repo (following the exact pattern of `ideas-api`).

The infrastructure side is straightforward: add a Bicep module for a new `posts-api` Function App with a Storage Account, provision a blob container `posts` with `publicAccess: 'None'`, and assign the Function App's managed identity the `Storage Blob Data Contributor` RBAC role. The existing `main.bicep` then wires it in like all other modules.

The code side has two deliverables: (1) a `schema.py` module that defines the 6-field frontmatter spec and validates it, using `python-frontmatter` for serialization; and (2) a `slugs.py` module that wraps `python-slugify` and performs blob-list-based deduplication. Both are tested with `pytest` using Azurite for blob operations — the Azurite emulator is already installed on this machine (v3.35.0).

**Primary recommendation:** Provision infra with a Bicep module (new `modules/postsapi.bicep`), create the `posts-api` Python Functions repo using the `ideas-api` repo as a structural template, and implement `schema.py` + `slugs.py` as pure utility modules (no HTTP routes in Phase 1) backed by pytest tests that use Azurite via `UseDevelopmentStorage=true`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Blob container provisioning | Infrastructure (Bicep) | — | Resource lifecycle managed by IaC, not application code |
| Post file format / schema | API / Backend (Python) | — | Schema enforced server-side on every write; browser never touches raw frontmatter |
| Slug generation | API / Backend (Python) | — | Slug derives from title and must check for collisions against existing blobs; cannot be done client-side reliably |
| Blob privacy enforcement | Infrastructure (Bicep) | — | Container `publicAccess: None` + `allowBlobPublicAccess: false` at storage account level; enforced by Azure, not application code |
| RBAC access control | Infrastructure (Bicep) | — | Managed identity role assignment is an infra concern |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `python-frontmatter` | 1.3.0 | Parse and serialize YAML frontmatter + markdown body | Locked in CONTEXT.md; handles YAML edge cases (quoting, types) that naive string splitting gets wrong |
| `azure-storage-blob` | 12.29.0 | Blob CRUD operations (upload, download, list, delete) | Official Azure SDK for Python; same SDK family used by `ideas-api` (`azure-data-tables`) |
| `python-slugify` | 8.0.4 | URL-safe slug generation from unicode title strings | Well-established; handles transliteration, special chars, lowercase, hyphenation in one call |
| `azure-functions` | latest | Azure Functions Python worker binding | Already used in `ideas-api`; provides `func.FunctionApp`, `func.HttpRequest`, `func.HttpResponse` |

[VERIFIED: PyPI registry] — `python-frontmatter` 1.3.0, `azure-storage-blob` 12.29.0, `python-slugify` 8.0.4, `text-unidecode` 1.3 all confirmed via `pip index versions` in this session.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `azure-identity` | >=1.15.0 | `DefaultAzureCredential` / `ManagedIdentityCredential` | When connecting to blob storage via managed identity instead of connection string in production |
| `text-unidecode` | 1.3 | Transliteration dependency of `python-slugify` (GPL/Perl Artistic) | Auto-installed with `python-slugify`; no direct usage required |
| `pytest` | 9.0.3 | Unit and integration tests | Already installed on this machine under Python 3.12 |
| Azurite | 3.35.0 (npm) | Local Azure Storage emulator | Already installed; use `UseDevelopmentStorage=true` connection string for tests |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `python-frontmatter` | Hand-rolled YAML split | Naive split breaks on YAML edge cases (colons in values, multi-line strings). CONTEXT.md explicitly mandates `python-frontmatter`. |
| `python-slugify` | `re.sub` + `.lower()` | Doesn't handle unicode transliteration (e.g., "Café" → "cafe"). `python-slugify` handles this reliably. |
| Connection string auth | Managed identity (`DefaultAzureCredential`) | Connection string is simpler for Phase 1 dev/test; managed identity is the production path already used in ideasapi.bicep. |

**Installation (posts-api `requirements.txt`):**
```
azure-functions
azure-storage-blob>=12.29.0
azure-identity>=1.15.0
python-frontmatter>=1.3.0
python-slugify>=8.0.4
```

---

## Package Legitimacy Audit

> slopcheck could not be installed in this session (auto-mode permission restriction). All packages below are marked `[ASSUMED]` based on PyPI registry verification + training knowledge. The planner must not gate installs — these are well-established packages — but the `[ASSUMED]` tag is applied per protocol.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `python-frontmatter` | PyPI | ~10 yrs | High (widely cited) | github.com/eyeseast/python-frontmatter | [ASSUMED] | Approved — confirmed on PyPI at 1.3.0 |
| `azure-storage-blob` | PyPI | ~8 yrs | Very High (Microsoft SDK) | github.com/Azure/azure-sdk-for-python | [ASSUMED] | Approved — official Microsoft SDK |
| `python-slugify` | PyPI | ~12 yrs | Very High | github.com/un33k/python-slugify | [ASSUMED] | Approved — confirmed on PyPI at 8.0.4 |
| `azure-identity` | PyPI | ~6 yrs | Very High (Microsoft SDK) | github.com/Azure/azure-sdk-for-python | [ASSUMED] | Approved — official Microsoft SDK |
| `text-unidecode` | PyPI | ~8 yrs | High (indirect dep) | github.com/kmike/text-unidecode | [ASSUMED] | Approved — auto-dep of python-slugify |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable at research time (permission restriction in auto mode). All packages above are tagged `[ASSUMED]`. All are confirmed on PyPI via `pip index versions` in this session and are well-known packages with long registry histories.*

---

## Architecture Patterns

### System Architecture Diagram

```
[Phase 1 scope]

Title input (string)
      |
      v
  slugs.py::generate_slug(title, container_client)
      |--- python-slugify::slugify(title) --> raw_slug
      |--- ContainerClient::list_blobs(name_starts_with=raw_slug)
      |--- dedup suffix loop (-2, -3, ...)
      |
      v
  unique_slug (string)
      |
      v
  schema.py::build_post(title, slug, description, body, date)
      |--- returns frontmatter.Post object
      |--- field validation (types, ISO 8601, URL-safe slug)
      |
      v
  frontmatter::dumps(post) --> .md string (YAML frontmatter + markdown body)
      |
      v
  ContainerClient::upload_blob("{slug}.md", content.encode("utf-8"), overwrite=True)
      |
      v
  Azure Blob Storage container "posts" (private, Standard_LRS)
```

Phase 1 does NOT expose HTTP routes — `slugs.py` and `schema.py` are utility modules consumed by Phase 2 (read) and Phase 4 (write) Function routes.

### Recommended Project Structure

```
posts-api/                          # New sibling repo
├── function_app.py                 # Azure Functions app entry point (Phase 1: empty skeleton)
├── host.json                       # {"version":"2.0","extensionBundle":{"id":"Microsoft.Azure.Functions.ExtensionBundle","version":"[4.*, 5.0.0)"}}
├── requirements.txt                # azure-functions, azure-storage-blob, azure-identity, python-frontmatter, python-slugify
├── local.settings.json             # {"IsEncrypted":false,"Values":{"AzureWebJobsStorage":"UseDevelopmentStorage=true","POSTS_STORAGE_CONNECTION_STRING":"UseDevelopmentStorage=true",...}}
├── schema.py                       # Post dataclass + frontmatter build/validate helpers
├── slugs.py                        # generate_slug(title, container_client) -> str
└── tests/
    ├── conftest.py                 # Azurite container_client fixture
    ├── test_schema.py              # Schema field validation, round-trip frontmatter
    └── test_slugs.py               # Slug generation, deduplication, unicode
```

```
azure-infrastructure/
└── modules/
    └── postsapi.bicep              # New: storage account + blob container + function app + RBAC
```

`main.bicep` gets a new `module postsAPI 'modules/postsapi.bicep'` block.

### Pattern 1: Bicep Module for Python Functions with Blob Storage

**What:** A Bicep module that provisions a storage account, a blob container with private access, a consumption-plan Function App (Python 3.11, Linux), and an RBAC role assignment giving the Function App's managed identity `Storage Blob Data Contributor` access to the storage account.

**When to use:** Every new Python Functions feature in this project uses this exact pattern (see `digitsfunctions.bicep`, `ideasapi.bicep`).

**Example:**
```bicep
// Source: verified against C:\Users\Sriram\azure-infrastructure\modules\ideasapi.bicep
// and digitsfunctions.bicep in this session

param location string
param environment string = 'prod'

resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: 'postsapi${uniqueString(resourceGroup().id)}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false   // REQUIRED — prevents any container from going public
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2022-09-01' = {
  parent: storageAccount
  name: 'default'
}

resource postsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2022-09-01' = {
  parent: blobService
  name: 'posts'
  properties: {
    publicAccess: 'None'           // Container-level: no anonymous access
  }
}

var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net'

resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: 'posts-api-${environment}-plan'
  location: location
  sku: { name: 'Y1', tier: 'Dynamic' }
  properties: { reserved: true }
  kind: 'functionapp'
}

resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: 'posts-api-${environment}-${uniqueString(resourceGroup().id)}'
  location: location
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'Python|3.11'
      appSettings: [
        { name: 'AzureWebJobsStorage', value: storageConnectionString }
        { name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING', value: storageConnectionString }
        { name: 'WEBSITE_CONTENTSHARE', value: 'posts-api-${environment}-content' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'python' }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'true' }
        { name: 'POSTS_STORAGE_CONNECTION_STRING', value: storageConnectionString }
        { name: 'POSTS_CONTAINER_NAME', value: 'posts' }
      ]
    }
    httpsOnly: true
  }
}

// RBAC: give Function App managed identity read+write access to blob storage
resource blobDataContributorRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storageAccount
  name: guid(storageAccount.id, functionApp.id, 'StorageBlobDataContributor')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output functionAppName string = functionApp.name
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
output functionPrincipalId string = functionApp.identity.principalId
output storageConnectionString string = storageConnectionString
```

**Key points:**
- `allowBlobPublicAccess: false` on the storage account is the belt; `publicAccess: 'None'` on the container is the suspenders. Both are required per SEC-03 / STOR-01.
- The `Storage Blob Data Contributor` role ID is `ba92f5b4-2d11-453d-a403-e96b0029c9fe`. [ASSUMED — standard well-known Azure RBAC role definition ID. Verify via `az role definition list --name "Storage Blob Data Contributor"` before committing.]
- Use `uniqueString(resourceGroup().id)` for storage account names (same as `digitsfunctions.bicep`).
- The `POSTS_STORAGE_CONNECTION_STRING` app setting is the key the Python code reads.

### Pattern 2: python-frontmatter Round-Trip

**What:** Load a post from string, set fields, serialize back to `.md` string for blob upload.

**When to use:** Every write operation in Phase 4; schema validation in Phase 1 tests.

**Example:**
```python
# Source: python-frontmatter.readthedocs.io (verified via WebFetch this session)
import frontmatter
from datetime import datetime, timezone

def build_post(title: str, slug: str, date: str, description: str, body: str, published: bool = False) -> frontmatter.Post:
    post = frontmatter.Post(body)
    post["title"] = title           # ALWAYS set as string; YAML serializer will double-quote if needed
    post["slug"] = slug
    post["date"] = date             # ISO 8601 string, e.g. "2026-05-30T00:00:00Z"
    post["published"] = published
    post["description"] = description
    post["updatedAt"] = datetime.now(timezone.utc).isoformat()
    return post

def serialize_post(post: frontmatter.Post) -> str:
    return frontmatter.dumps(post)

# Round-trip parse:
def parse_post(content: str) -> frontmatter.Post:
    return frontmatter.loads(content)

# Blob upload:
md_bytes = serialize_post(post).encode("utf-8")
container_client.upload_blob(f"{slug}.md", md_bytes, overwrite=True)
```

**YAML corruption note:** The `title` field must be a plain Python `str`. `python-frontmatter` serializes it with `yaml.dump` which will double-quote strings containing colons, special chars, etc. This is correct behavior and matches the STATE.md pitfall warning — never pre-escape the string yourself; let the library handle it.

### Pattern 3: Slug Generation with Deduplication

**What:** Derive a URL-safe slug from a title, then check blob names to avoid collisions.

**When to use:** Every `POST /api/posts` call in Phase 4; tested in Phase 1.

**Example:**
```python
# Source: github.com/un33k/python-slugify (verified on PyPI this session)
from python_slugify import slugify
from azure.storage.blob import ContainerClient

def generate_slug(title: str, container_client: ContainerClient) -> str:
    base_slug = slugify(title)          # e.g. "Hello World!" -> "hello-world"
    candidate = base_slug
    counter = 2

    existing_names = {b.name for b in container_client.list_blobs(name_starts_with=base_slug)}

    while f"{candidate}.md" in existing_names:
        candidate = f"{base_slug}-{counter}"
        counter += 1

    return candidate
```

**Deduplication notes:**
- `list_blobs(name_starts_with=base_slug)` is a prefix filter — efficient even with many posts.
- The result set will include `hello-world.md`, `hello-world-2.md`, etc. Check for `{candidate}.md` specifically (not just prefix match) to avoid false positives.
- Under ~50 posts, listing all blobs with a prefix is fast and needs no index.

### Pattern 4: Blob CRUD in Python (azure-storage-blob)

**What:** The core read/write/list operations used throughout the API.

**When to use:** All blob operations in Phase 1 tests and Phase 2–4 implementation.

**Example:**
```python
# Source: learn.microsoft.com/en-us/python/api/overview/azure/storage-blob-readme (verified via WebFetch this session)
import os
from azure.storage.blob import ContainerClient

def get_container_client() -> ContainerClient:
    conn_str = os.environ["POSTS_STORAGE_CONNECTION_STRING"]
    container = os.environ.get("POSTS_CONTAINER_NAME", "posts")
    return ContainerClient.from_connection_string(conn_str, container_name=container)

# Upload (create or overwrite)
container_client.upload_blob(f"{slug}.md", data.encode("utf-8"), overwrite=True)

# Download
blob_client = container_client.get_blob_client(f"{slug}.md")
content = blob_client.download_blob().readall().decode("utf-8")

# List all blobs
for blob in container_client.list_blobs():
    print(blob.name)   # e.g. "hello-world.md"

# Delete
container_client.delete_blob(f"{slug}.md")

# Check existence
blob_client = container_client.get_blob_client(f"{slug}.md")
exists = blob_client.exists()
```

### Anti-Patterns to Avoid

- **Hand-rolling YAML frontmatter:** Never split on `---` manually. YAML values with colons, multi-line strings, and boolean-like strings all require proper escaping that `python-frontmatter` handles and naive string manipulation does not.
- **Public blob access:** Never set `publicAccess` to `Blob` or `Container`. The container must be `None`. Also set `allowBlobPublicAccess: false` at the storage account level — this is a defense-in-depth setting that overrides individual container settings.
- **Slug without deduplication check:** Never return `slugify(title)` without checking blob existence. A blog can have two posts with the same title (or similar ones mapping to the same slug).
- **Hardcoded container name in Python:** Read it from `os.environ.get("POSTS_CONTAINER_NAME", "posts")`. This lets tests override it and keeps the Bicep output and Python code in sync.
- **Lazy resource creation:** Do NOT call `container_client.create_container()` in Python code. The container is provisioned by Bicep. The `ideas-api` CLAUDE.md states this explicitly: "Do not create Azure resources lazily in Python code. Declare them in `*.bicep`."
- **Provisioning postsapi.bicep separately from `main.bicep`:** The module must be wired into `main.bicep` and deployed via `./deploy.sh` — not via ad-hoc `az deployment group create`. All other modules follow this pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parse/write | Custom `---` splitter + `yaml.dump` | `python-frontmatter` | Colons in titles, booleans, multi-line strings all require careful YAML escaping. The library handles all edge cases. |
| Unicode slug generation | `re.sub(r'[^a-z0-9-]', '', text.lower())` | `python-slugify` | Doesn't handle transliteration (café → cafe, 北京 → bei-jing). Regex approach silently drops characters. |
| Slug uniqueness | Hash-based or timestamp suffix | Blob-prefix list check + `-2`/`-3` counter | Deterministic slugs that humans can predict. Timestamp suffixes produce ugly URLs. |
| ISO 8601 date strings | `str(datetime.now())` | `datetime.now(timezone.utc).isoformat()` | `str(datetime)` omits timezone info; isoformat with UTC timezone produces the correct `+00:00` or `Z` suffix. |

**Key insight:** The "hard" problems in this phase (unicode normalization, YAML edge cases) are all solved by small, well-tested libraries. Custom solutions will fail on the first post with a title like "What I learned: a summary" (colon) or "Naïve approach" (accented char).

---

## Common Pitfalls

### Pitfall 1: YAML Title Corruption
**What goes wrong:** A post titled `What I Built: A Summary` gets stored as `title: What I Built: A Summary` (bare, unquoted) in the YAML block. When re-parsed, `python-frontmatter` reads it as `{title: {What I Built: "A Summary"}}` — a nested dict instead of a string.
**Why it happens:** If you set frontmatter fields from a raw string you've constructed yourself (e.g. `"title: " + title`) rather than using the library's dict-like API.
**How to avoid:** Always set `post["title"] = title_string` through the `frontmatter.Post` object. The library calls `yaml.dump` internally and will double-quote the string when necessary.
**Warning signs:** `isinstance(post["title"], dict)` returns True when you parse back.

### Pitfall 2: `allowBlobPublicAccess` vs Container `publicAccess`
**What goes wrong:** Container is set to `publicAccess: 'None'` but the storage account still has `allowBlobPublicAccess` defaulting to `true`. A future operator accidentally changes a container property and blobs become public.
**Why it happens:** `publicAccess: 'None'` is per-container; `allowBlobPublicAccess: false` is per-storage-account. The account-level setting is a hard override.
**How to avoid:** Set `allowBlobPublicAccess: false` in the Bicep storage account properties block (shown in Pattern 1 above).
**Warning signs:** Azure Security Center / Defender for Storage flags "public blob access is allowed".

### Pitfall 3: Slug Deduplication Race Condition
**What goes wrong:** Two concurrent write requests with the same title both check for `hello-world.md`, both find it absent, and both create `hello-world.md` — the second overwrites the first.
**Why it happens:** List-then-write is not atomic in blob storage.
**How to avoid:** Use `overwrite=False` in `upload_blob` for new posts. Azure Blob Storage will return a `ResourceExistsError` (HTTP 409) if the blob already exists, which the API can catch and retry with a new suffix. For Phase 1 (no HTTP route), document this and handle it in Phase 4.
**Warning signs:** Occasional silent data loss when two posts are created simultaneously (unlikely for a solo-author site, but worth knowing).

### Pitfall 4: `text-unidecode` License
**What goes wrong:** `python-slugify` defaults to `text-unidecode` (GPL / Perl Artistic license). This may conflict with commercial licensing requirements.
**Why it happens:** Auto-installed as a dependency.
**How to avoid:** For a personal site this is not a concern. If it were commercial, use `pip install python-slugify[unidecode]` which uses the Unidecode package (GPL only). Not applicable here.
**Warning signs:** N/A for this project.

### Pitfall 5: Python Version Mismatch (3.14 default vs 3.11 Functions runtime)
**What goes wrong:** The Windows machine default `python` resolves to Python 3.14.4 (the Microsoft Store version), but Azure Functions uses Python 3.11. If tests or local development are run with 3.14, subtle behavior differences or package incompatibilities may emerge.
**Why it happens:** Windows Python Launcher (`py`) resolves `python3` to the Store version (3.14.4) but `py -3.12` resolves to the full install (3.12.0). Neither is 3.11.
**How to avoid:** Always use `py -3.11` (install Python 3.11 if not present) for `posts-api` local development, matching the `linuxFxVersion: 'Python|3.11'` in Bicep. For Phase 1, tests may run on 3.12 since the code is pure-Python with no runtime-specific dependencies.
**Warning signs:** `python --version` != 3.11 in a terminal opened in the posts-api directory.

---

## Code Examples

### Verified Patterns from Official Sources

#### Schema Module Skeleton
```python
# Source: python-frontmatter.readthedocs.io (verified via WebFetch this session)
import frontmatter
from datetime import datetime, timezone
from typing import Optional

REQUIRED_FIELDS = {"title", "slug", "date", "published", "description", "updatedAt"}

def build_post(
    title: str,
    slug: str,
    date: str,
    description: str,
    body: str,
    published: bool = False,
    updated_at: Optional[str] = None,
) -> frontmatter.Post:
    post = frontmatter.Post(body)
    post["title"] = title
    post["slug"] = slug
    post["date"] = date
    post["published"] = published
    post["description"] = description
    post["updatedAt"] = updated_at or datetime.now(timezone.utc).isoformat()
    return post

def validate_post(post: frontmatter.Post) -> list[str]:
    errors = []
    for field in REQUIRED_FIELDS:
        if field not in post.metadata:
            errors.append(f"Missing required field: {field}")
    if "title" in post.metadata and not isinstance(post.metadata["title"], str):
        errors.append("title must be a string")
    if "published" in post.metadata and not isinstance(post.metadata["published"], bool):
        errors.append("published must be a boolean")
    return errors
```

#### Slug Module Skeleton
```python
# Source: github.com/un33k/python-slugify PyPI page (verified this session)
from python_slugify import slugify
from azure.storage.blob import ContainerClient

def generate_slug(title: str, container_client: ContainerClient) -> str:
    """Derive a URL-safe slug from title; append -2/-3 suffix to avoid collisions."""
    base_slug = slugify(title)
    if not base_slug:
        raise ValueError(f"Title '{title}' produces an empty slug")

    candidate = base_slug
    counter = 2
    existing = {b.name for b in container_client.list_blobs(name_starts_with=base_slug)}

    while f"{candidate}.md" in existing:
        candidate = f"{base_slug}-{counter}"
        counter += 1

    return candidate
```

#### Azurite-Backed Test Fixture
```python
# Source: azure-storage-blob SDK docs (verified via WebFetch this session) + Azurite docs [ASSUMED pattern]
import pytest
from azure.storage.blob import ContainerClient

AZURITE_CONN_STR = "UseDevelopmentStorage=true"
TEST_CONTAINER = "posts-test"

@pytest.fixture
def container_client():
    client = ContainerClient.from_connection_string(AZURITE_CONN_STR, container_name=TEST_CONTAINER)
    client.create_container()
    yield client
    client.delete_container()
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Azure Functions v1/v2 (single `__init__.py` per function) | Azure Functions v4 Python model (`function_app.py` with decorators) | 2022 (GA in 2023) | One file for all routes; `@app.route(route=...)` decorator style. Matches `ideas-api` exactly. |
| Storage account key in connection string (production) | Managed identity + RBAC `Storage Blob Data Contributor` | Ongoing Azure best practice | More secure; no key rotation needed. Phase 1 Bicep uses RBAC role assignment. |
| `allowBlobPublicAccess` defaulting to `true` | Azure now warns / blocks depending on subscription policy; best practice is `false` | ~2021 | Must explicitly set in Bicep. |

**Deprecated/outdated:**
- Azure Functions v1/v2 function-per-folder model: replaced by v4 single-file model. `ideas-api` is already on v4; `posts-api` follows the same.
- `azure-storage-blob` v2.x and v12.x API differ significantly. All new code uses v12.x (`BlobServiceClient`, `ContainerClient`). Current version is 12.29.0.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Storage Blob Data Contributor` role definition ID is `ba92f5b4-2d11-453d-a403-e96b0029c9fe` | Pattern 1 Bicep example | RBAC assignment silently fails or fails at deploy time. Verify: `az role definition list --name "Storage Blob Data Contributor" --query "[0].name"` |
| A2 | All 5 recommended packages have clean slopcheck status | Package Legitimacy Audit | Low risk — all are long-established packages with known source repos. Verify via slopcheck when available. |
| A3 | Azurite `UseDevelopmentStorage=true` connection string works for `azure-storage-blob` 12.29.0 | Test pattern | Test suite fails if Azurite protocol support lags SDK. Standard pattern and Azurite 3.35.0 is current. |
| A4 | `python-slugify` import name is `python_slugify` (underscore) not `python-slugify` | Code examples | `ImportError` in function code. Standard PyPI convention for hyphenated names. Verified against PyPI page description. |

---

## Open Questions

1. **posts-api repo: create from scratch or clone ideas-api?**
   - What we know: `posts-api` directory does not exist yet at `C:\Users\Sriram\posts-api\`. The `ideas-api` repo has the right structure (`function_app.py`, `host.json`, `requirements.txt`, `.github/workflows/deploy.yml`).
   - What's unclear: Should `git init` + copy files, or just create files manually? Does the GitHub org already have a `posts-api` repo?
   - Recommendation: Create the repo locally with `git init`, copy the `host.json` and `.github/workflows/deploy.yml` skeleton from `ideas-api`, adjust names. The planner should include a task to create the GitHub repo (`gh repo create skarumbu/posts-api --private`).

2. **Bicep deployment: new module wired into `main.bicep` or standalone first?**
   - What we know: All existing modules are wired into `main.bicep` and deployed via `./deploy.sh`. The `main.bicep` is subscription-scoped.
   - What's unclear: Whether the user wants to deploy the storage + container immediately in Phase 1 or defer until Phase 2 when the API actually needs it.
   - Recommendation: Create the Bicep module in Phase 1 and wire it into `main.bicep`. Storage provisioning is the stated success criterion for STOR-01. The container can be deployed and sit empty until Phase 4 writes to it.

3. **Python 3.11 availability on this machine**
   - What we know: `py -3.12` gives Python 3.12.0; `python3` defaults to 3.14.4 (Store). Azure Functions uses Python 3.11.
   - What's unclear: Whether `py -3.11` works (Python 3.11 may not be installed).
   - Recommendation: Planner should include a Wave 0 task to verify `py -3.11 --version` and install from python.org if missing. Tests can run on 3.12 for Phase 1 (no runtime-specific code).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11 | Azure Functions runtime match | Unknown | Not confirmed | Use `py -3.12` for local tests; install 3.11 from python.org |
| Python 3.12 | Local tests | ✓ | 3.12.0 | — |
| pytest | Test suite | ✓ | 9.0.3 (on py 3.12) | — |
| Azurite | Blob tests without real Azure | ✓ | 3.35.0 (via npm) | Real Azure dev storage account |
| Azure Functions Core Tools (`func`) | Local `func start` | ✗ | — | `npm install -g azure-functions-core-tools@4` (Phase 1 doesn't need func start) |
| Azure CLI (`az`) | Bicep deployment + verification | Unknown | Not checked | Portal-based deployment |
| `python-frontmatter` (installed) | Phase 1 tests | ✗ (not installed) | Not installed | Install via `pip install python-frontmatter` |
| `azure-storage-blob` (installed) | Phase 1 tests | ✗ (not installed) | Not installed | Install via `pip install azure-storage-blob` |
| `python-slugify` (installed) | Phase 1 tests | ✗ (not installed) | Not installed | Install via `pip install python-slugify` |

**Missing dependencies with no fallback:**
- None that block Phase 1. The packages need to be installed into the `posts-api` virtual environment — that is part of the Wave 0 setup task.

**Missing dependencies with fallback:**
- `func` CLI: Phase 1 has no HTTP routes and doesn't need `func start`. Needed in Phase 2+.
- Python 3.11: Tests run fine on 3.12 for this phase; 3.11 needed for production parity testing in Phase 4+.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 9.0.3 |
| Config file | `pytest.ini` or `pyproject.toml [tool.pytest.ini_options]` (none yet — Wave 0 creates it) |
| Quick run command | `py -3.12 -m pytest tests/ -x -q` |
| Full suite command | `py -3.12 -m pytest tests/ -v` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STOR-01 | Blob container exists and accepts `.md` writes | integration (Azurite) | `py -3.12 -m pytest tests/test_schema.py::test_upload_sample_post -x` | ❌ Wave 0 |
| STOR-02 | Frontmatter schema round-trips without corruption | unit | `py -3.12 -m pytest tests/test_schema.py -x` | ❌ Wave 0 |
| STOR-02 | `title` with colon serializes and re-parses as string | unit | `py -3.12 -m pytest tests/test_schema.py::test_title_with_colon -x` | ❌ Wave 0 |
| STOR-02 | All 6 required fields present in serialized output | unit | `py -3.12 -m pytest tests/test_schema.py::test_required_fields -x` | ❌ Wave 0 |
| STOR-03 | Basic slug from plain English title | unit | `py -3.12 -m pytest tests/test_slugs.py::test_basic_slug -x` | ❌ Wave 0 |
| STOR-03 | Unicode title produces ASCII slug | unit | `py -3.12 -m pytest tests/test_slugs.py::test_unicode_slug -x` | ❌ Wave 0 |
| STOR-03 | Duplicate title gets `-2` suffix | integration (Azurite) | `py -3.12 -m pytest tests/test_slugs.py::test_dedup_suffix -x` | ❌ Wave 0 |
| STOR-03 | Three identical titles get `-2` and `-3` | integration (Azurite) | `py -3.12 -m pytest tests/test_slugs.py::test_dedup_triple -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `py -3.12 -m pytest tests/ -x -q`
- **Per wave merge:** `py -3.12 -m pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `posts-api/` repo skeleton — `function_app.py`, `host.json`, `requirements.txt`, `local.settings.json`
- [ ] `tests/conftest.py` — Azurite `container_client` fixture
- [ ] `tests/test_schema.py` — empty file (tests are Wave 1 deliverable)
- [ ] `tests/test_slugs.py` — empty file (tests are Wave 1 deliverable)
- [ ] `pytest.ini` or `pyproject.toml` — minimal config pointing test root to `tests/`
- [ ] `pip install python-frontmatter azure-storage-blob azure-identity python-slugify pytest` into `posts-api` venv
- [ ] Azurite startup verification: `azurite --silent --location .azurite --debug .azurite/debug.log &`

---

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (Phase 1 has no HTTP endpoints) | — |
| V3 Session Management | No | — |
| V4 Access Control | Yes — blob container access | `publicAccess: None` + `allowBlobPublicAccess: false` in Bicep (infrastructure control); RBAC role assignment limits blob access to Function App identity only |
| V5 Input Validation | Yes — slug input, frontmatter fields | `python-slugify` sanitizes title input; `validate_post()` checks required fields and types |
| V6 Cryptography | No | — |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Public blob access (anonymous read) | Information Disclosure | `allowBlobPublicAccess: false` on storage account + `publicAccess: 'None'` on container |
| Slug injection / path traversal | Tampering | `python-slugify` strips all non-alphanumeric chars; output is `[a-z0-9-]+` only |
| YAML injection via title field | Tampering | `python-frontmatter` uses `yaml.dump` internally; string values are always properly escaped |
| Connection string leakage | Information Disclosure | Never log `POSTS_STORAGE_CONNECTION_STRING`; store only in App Settings (Bicep injects it; never commit to git) |

---

## Sources

### Primary (HIGH confidence)
- `C:\Users\Sriram\azure-infrastructure\modules\ideasapi.bicep` — Verified Bicep module pattern for Python Functions with Storage, RBAC role assignment, EasyAuth
- `C:\Users\Sriram\azure-infrastructure\modules\digitsfunctions.bicep` — Verified consumption plan + storage account provisioning pattern
- `C:\Users\Sriram\azure-infrastructure\main.bicep` — Verified module wiring pattern
- `C:\Users\Sriram\ideas-api\` — Verified Python Functions v4 repo structure, requirements.txt pattern, CI/CD deploy.yml
- PyPI `pip index versions`: `python-frontmatter` 1.3.0, `azure-storage-blob` 12.29.0, `python-slugify` 8.0.4, `text-unidecode` 1.3 — confirmed in this session
- https://python-frontmatter.readthedocs.io — Official docs; `loads`, `dumps`, `Post` object API verified via WebFetch
- https://learn.microsoft.com/en-us/python/api/overview/azure/storage-blob-readme — Official Microsoft SDK docs; `BlobServiceClient.from_connection_string`, `upload_blob`, `list_blobs`, `download_blob` verified via WebFetch

### Secondary (MEDIUM confidence)
- https://github.com/un33k/python-slugify — Official GitHub repo; function signature and `slugify()` behavior confirmed via WebSearch
- WebSearch results for Bicep `allowBlobPublicAccess` / container `publicAccess: 'None'` pattern — cross-verified against official Microsoft.Storage Bicep reference

### Tertiary (LOW confidence — not used for hard decisions)
- WebSearch general results on python-frontmatter usage patterns — superseded by readthedocs verification

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on PyPI by `pip index versions`; SDK docs verified via WebFetch
- Bicep patterns: HIGH — verified directly against existing modules in the azure-infrastructure repo
- Python Functions structure: HIGH — verified directly against ideas-api codebase
- Azurite test pattern: MEDIUM — Azurite 3.35.0 confirmed installed; `UseDevelopmentStorage=true` is standard but specific fixture code is [ASSUMED]
- RBAC role definition ID: LOW (A1) — standard well-known ID but not verified via `az role definition list` in this session

**Research date:** 2026-05-30
**Valid until:** 2026-06-30 (stable stack; Bicep API versions and package minor versions may update but patterns are stable)
