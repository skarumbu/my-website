---
phase: 01-storage-schema
reviewed: 2026-05-30T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - C:/Users/Sriram/posts-api/schema.py
  - C:/Users/Sriram/posts-api/slugs.py
  - C:/Users/Sriram/posts-api/function_app.py
  - C:/Users/Sriram/posts-api/requirements.txt
  - C:/Users/Sriram/posts-api/tests/conftest.py
  - C:/Users/Sriram/posts-api/tests/test_schema.py
  - C:/Users/Sriram/posts-api/tests/test_slugs.py
  - C:/Users/Sriram/posts-api/tests/test_storage.py
  - C:/Users/Sriram/posts-api/.github/workflows/deploy.yml
  - C:/Users/Sriram/azure-infrastructure/modules/postsapi.bicep
  - C:/Users/Sriram/azure-infrastructure/main.bicep
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the posts-api Python Azure Functions service (schema, slugs, function app, tests) and the
azure-infrastructure Bicep modules that provision it. The core logic in `schema.py` and `slugs.py`
is well-structured and correctly implemented. The round-trip frontmatter tests are solid. However,
there are three critical issues that must be resolved before this ships: a storage account key is
exposed in ARM deployment outputs, the same key is passed redundantly as a plaintext app setting
despite managed identity already being wired up, and the function app has no authentication
(anonymous HTTP access) with wildcard CORS. There are also four warnings around missing test
execution in CI, a slug prefix-collision false positive, incomplete field validation, and CORS
misconfiguration.

---

## Critical Issues

### CR-01: Storage account key leaked in Bicep output

**File:** `C:/Users/Sriram/azure-infrastructure/modules/postsapi.bicep:114`
**Issue:** `output storageConnectionString string = storageConnectionString` emits the full
connection string — including the storage account key — as a plain ARM deployment output. ARM
outputs are stored in deployment history, visible in the Azure portal to anyone with read access to
the resource group, and often captured in CI logs. This exposes the key to any principal that can
read deployment history, which is far broader than intended.

**Fix:** Remove the `storageConnectionString` output entirely. The value is only used internally
within the module. If a caller genuinely needs to reference the storage account, output the storage
account name or resource ID and let the caller construct a reference:
```bicep
// Remove this line:
output storageConnectionString string = storageConnectionString

// If the caller needs the account name, add instead:
output storageAccountName string = storageAccount.name
```

---

### CR-02: Plaintext storage connection string (account key) passed as app setting — managed identity already configured

**File:** `C:/Users/Sriram/azure-infrastructure/modules/postsapi.bicep:83-85`
**Issue:** The `POSTS_STORAGE_CONNECTION_STRING` app setting is set to `storageConnectionString`,
which embeds the storage account key. The same Bicep file already grants the function app's
managed identity the `StorageBlobDataContributor` role on the storage account (lines 101-109),
meaning key-based auth is unnecessary. Shipping a long-lived storage account key as an app setting
creates a credential that can be extracted from the portal, leaked in diagnostics, and is difficult
to rotate.

**Fix:** Remove the `POSTS_STORAGE_CONNECTION_STRING` app setting. Update `slugs.py` to
authenticate with `DefaultAzureCredential` instead of a connection string:
```python
# slugs.py — replace get_container_client():
from azure.identity import DefaultAzureCredential
from azure.storage.blob import ContainerClient

def get_container_client() -> ContainerClient:
    account_name = os.environ.get("POSTS_STORAGE_ACCOUNT_NAME", "")
    if not account_name:
        raise RuntimeError("POSTS_STORAGE_ACCOUNT_NAME environment variable is not set or empty")
    container = os.environ.get("POSTS_CONTAINER_NAME", "posts")
    url = f"https://{account_name}.blob.core.windows.net"
    return ContainerClient(url, container_name=container, credential=DefaultAzureCredential())
```
Add `POSTS_STORAGE_ACCOUNT_NAME` as the app setting (value: `storageAccount.name`) and remove
`POSTS_STORAGE_CONNECTION_STRING`.

---

### CR-03: Function app deployed with anonymous HTTP auth and wildcard CORS

**File:** `C:/Users/Sriram/posts-api/function_app.py:7` and
`C:/Users/Sriram/azure-infrastructure/modules/postsapi.bicep:91-94`
**Issue:** `func.AuthLevel.ANONYMOUS` means any HTTP client on the internet can invoke all routes
on this function app with no credential required. Combined with `allowedOrigins: ['*']` in the
Bicep CORS config, the service is completely open. While the current implementation only has a
health check route, the auth level is set at the `FunctionApp` level and applies to all routes
that will be added in subsequent phases (create post, list posts, etc.). Shipping with
`ANONYMOUS` and `*` CORS now establishes a pattern that future routes will inherit.

**Fix:** For write routes that modify data, use `func.AuthLevel.FUNCTION` (requires a function
key) or implement application-level authentication using Azure Static Web Apps managed auth or
an API key header. For CORS, restrict `allowedOrigins` to the known frontend domain:
```bicep
cors: {
  allowedOrigins: [
    'https://www.quixotry.me'
  ]
}
```
At minimum, document the intent: if anonymous is chosen deliberately (e.g., public read API),
gate write operations behind an explicit auth check in the function handler, not the function
app auth level.

---

## Warnings

### WR-01: Deploy workflow never runs tests

**File:** `C:/Users/Sriram/posts-api/.github/workflows/deploy.yml:1-39`
**Issue:** The CI/CD workflow installs Python and the Azure Functions Core Tools but never
installs the Python package dependencies (`pip install -r requirements.txt`) or runs the test
suite (`pytest`). A regression in `schema.py` or `slugs.py` would pass CI and deploy to
production without any test failure.

**Fix:** Add test and lint steps before the deploy step:
```yaml
- name: Install dependencies
  run: pip install -r requirements.txt pytest

- name: Run tests
  run: pytest tests/ -v
  # Note: integration tests (test_storage.py, test_slugs.py) require Azurite;
  # either spin up Azurite as a service container or mark those tests with
  # @pytest.mark.integration and skip them in CI with: pytest tests/ -v -m "not integration"
```

---

### WR-02: Slug prefix filter produces false-positive collisions

**File:** `C:/Users/Sriram/posts-api/slugs.py:45`
**Issue:** `list_blobs(name_starts_with=base_slug)` returns all blobs whose names begin with
`base_slug`. For a title that generates `hello-world`, this query will also return
`hello-world-notes.md`, `hello-world-2026.md`, etc. — blobs that belong to entirely different
posts. These names will appear in the `existing` set and cause the deduplication loop to skip
candidates unnecessarily (e.g., if `hello-world-2.md` is an unrelated post, the generator
skips `-2` for a new "Hello World" post and assigns `-3`, even though `-2` was available as a
derived slug for this title).

**Fix:** After collecting existing blobs, filter to only the exact slug pattern relevant to the
current title:
```python
import re

raw = {b.name for b in container_client.list_blobs(name_starts_with=base_slug)}
pattern = re.compile(rf"^{re.escape(base_slug)}(-\d+)?\.md$")
existing = {name for name in raw if pattern.match(name)}
```

---

### WR-03: validate_post missing type checks for date, description, slug, updatedAt

**File:** `C:/Users/Sriram/posts-api/schema.py:39-54`
**Issue:** `validate_post` only enforces types for `title` (must be str) and `published` (must
be bool). Fields `slug`, `date`, `description`, and `updatedAt` are checked only for presence,
not type. A caller who parses a corrupt YAML file where `date: 12345` (integer) or `slug: null`
passes validation silently. This gap matters because `validate_post` is the contract boundary
for data integrity.

**Fix:** Extend type checks for the remaining string fields:
```python
for field in ("slug", "date", "description", "updatedAt"):
    if field in post.metadata and not isinstance(post.metadata[field], str):
        errors.append(f"{field} must be a string")
```

---

### WR-04: Hardcoded Azurite AccountKey in test conftest will trigger secret scanners

**File:** `C:/Users/Sriram/posts-api/tests/conftest.py:9`
**Issue:** The Azurite well-known development AccountKey
(`Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==`)
is hardcoded in the conftest. While this specific key is public domain (shipped with Azurite and
documented in Microsoft's own samples), tools like `truffleHog`, `gitleaks`, and GitHub's secret
scanning treat it as a real credential and will flag it, failing any secret-scanning gate in CI.

**Fix:** Add a comment that explicitly identifies this as the public Azurite dev key to help
human reviewers, and consider whether CI secret scanning needs an allowlist entry. Alternatively,
read it from an environment variable with the known key as default:
```python
AZURITE_ACCOUNT_KEY = os.environ.get(
    "AZURITE_ACCOUNT_KEY",
    "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=="
)
```

---

## Info

### IN-01: `azure-functions` dependency is unpinned in requirements.txt

**File:** `C:/Users/Sriram/posts-api/requirements.txt:1`
**Issue:** All other packages have version constraints (`>=X.Y.Z,<A.B.C` or `>=X.Y.Z`), but
`azure-functions` has no constraint. A future `pip install` could pick up a major version with
breaking API changes (e.g., a v3 that removes `func.AuthLevel` or changes the decorator API).

**Fix:** Pin to the current compatible range:
```
azure-functions>=1.21.0,<2.0.0
```

---

### IN-02: Dead import in function_app.py

**File:** `C:/Users/Sriram/posts-api/function_app.py:3`
**Issue:** `from datetime import datetime, timezone` is imported but neither `datetime` nor
`timezone` is used anywhere in the file. The health route returns a static response with no
timestamp.

**Fix:** Remove the unused import:
```python
# Remove this line:
from datetime import datetime, timezone
```

---

_Reviewed: 2026-05-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
