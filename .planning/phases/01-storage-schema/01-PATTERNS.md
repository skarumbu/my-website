# Phase 1: Storage & Schema - Pattern Map

**Mapped:** 2026-05-30
**Files analyzed:** 9 new/modified files across two sibling repos
**Analogs found:** 7 / 9 (2 have no codebase analog — use RESEARCH.md patterns)

---

## File Classification

| New/Modified File | Repo | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|------|-----------|----------------|---------------|
| `modules/postsapi.bicep` | azure-infrastructure | config/infra | CRUD (blob provision) | `modules/digitsfunctions.bicep` | role-match + `modules/ideasapi.bicep` for RBAC |
| `main.bicep` (modify) | azure-infrastructure | config/infra | — | `main.bicep` lines 136–173 (ideasAPI block) | exact |
| `function_app.py` | posts-api | controller | request-response | `ideas-api/function_app.py` | exact (skeleton only in Phase 1) |
| `host.json` | posts-api | config | — | `ideas-api/host.json` | exact |
| `requirements.txt` | posts-api | config | — | `ideas-api/requirements.txt` | role-match |
| `local.settings.json` | posts-api | config | — | RESEARCH.md pattern (no analog in ideas-api — file is gitignored) | no analog |
| `schema.py` | posts-api | utility | transform | `ideas-api/ideas.py` lines 1–40 (entity model + validation) | partial |
| `slugs.py` | posts-api | utility | CRUD (blob list) | `ideas-api/ideas.py` lines 18–23 (storage client factory) | partial |
| `tests/conftest.py` | posts-api | test | — | no test files exist in ideas-api | no analog |
| `tests/test_schema.py` | posts-api | test | — | no test files exist in ideas-api | no analog |
| `tests/test_slugs.py` | posts-api | test | — | no test files exist in ideas-api | no analog |

---

## Pattern Assignments

### `modules/postsapi.bicep` (config/infra, new Bicep module)

**Primary analog:** `C:/Users/Sriram/azure-infrastructure/modules/digitsfunctions.bicep`
**Secondary analog (RBAC):** `C:/Users/Sriram/azure-infrastructure/modules/ideasapi.bicep`

**Storage account + consumption plan pattern** (`digitsfunctions.bicep` lines 1–28):
```bicep
param location string
param environment string

resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: 'digitsst${uniqueString(resourceGroup().id)}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
  }
}

resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: 'digits-plan-${environment}'
  location: location
  sku: { name: 'Y1', tier: 'Dynamic' }
  properties: { reserved: true }
  kind: 'functionapp'
}
```
NOTE: `postsapi.bicep` MUST add `allowBlobPublicAccess: false` to storage account properties — `digitsfunctions.bicep` omits it (older module). See RESEARCH.md Pattern 1.

**Function App appSettings pattern** (`digitsfunctions.bicep` lines 30–76):
```bicep
resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: 'digits-api-${environment}-${uniqueString(resourceGroup().id)}'
  location: location
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'Python|3.11'
      appSettings: [
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net' }
        { name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING', value: '...' }
        { name: 'WEBSITE_CONTENTSHARE', value: 'digits-api-${environment}-content' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'python' }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'true' }
        { name: 'TABLE_STORAGE_CONNECTION_STRING', value: '...' }
      ]
      cors: { allowedOrigins: ['*'] }
    }
    httpsOnly: true
  }
}
```
Adapt: replace `TABLE_STORAGE_CONNECTION_STRING` with `POSTS_STORAGE_CONNECTION_STRING`; add `POSTS_CONTAINER_NAME = 'posts'`; add `identity: { type: 'SystemAssigned' }` (required for RBAC — digitsfunctions.bicep has no managed identity; copy from ideasapi.bicep).

**Managed identity + RBAC pattern** (`ideasapi.bicep` lines 54–64 and 156–164):
```bicep
resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  // ...
  identity: {
    type: 'SystemAssigned'
  }
  // ...
}

resource tableStorageContributorRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storageAccount
  name: guid(storageAccount.id, functionApp.id, 'StorageTableDataContributor')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3')
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```
Adapt: change role definition ID to `ba92f5b4-2d11-453d-a403-e96b0029c9fe` (Storage Blob Data Contributor, not Table). Change `guid(...)` disambiguator string to `'StorageBlobDataContributor'`.

**Outputs pattern** (`digitsfunctions.bicep` lines 78–81):
```bicep
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
output functionAppName string = functionApp.name
output id string = functionApp.id
output storageConnectionString string = '...'
```
Add: `output functionPrincipalId string = functionApp.identity.principalId` (needed by main.bicep wiring — see ideasapi.bicep line 167).

**Blob container pattern** — no existing analog in codebase (ideasapi uses Table Storage, not Blob). Use RESEARCH.md Pattern 1:
```bicep
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2022-09-01' = {
  parent: storageAccount
  name: 'default'
}

resource postsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2022-09-01' = {
  parent: blobService
  name: 'posts'
  properties: {
    publicAccess: 'None'
  }
}
```

---

### `main.bicep` (modify — add postsAPI module block)

**Analog:** `C:/Users/Sriram/azure-infrastructure/main.bicep` lines 161–173 (ideasAPI block)

**Module wiring pattern** (lines 161–173):
```bicep
// Module: Ideas API (Azure Functions)
module ideasAPI 'modules/ideasapi.bicep' = {
  name: 'ideasAPIDeployment'
  scope: rg
  params: {
    location: location
    environment: environment
    azureTenantId: azureTenantId
    ideasApiClientId: ideasApiClientId
    ideasApiClientSecret: ideasApiClientSecret
    ideasApiWriteKey: ideasApiWriteKey
  }
}
```
Adapt: name `postsAPI`, reference `'modules/postsapi.bicep'`, pass only `location` and `environment` (Phase 1 postsapi.bicep needs no auth params).

**Output wiring pattern** (lines 239–249 — existing outputs):
```bicep
output ideasAPIUrl string = ideasAPI.outputs.functionAppUrl
output ideasAPIAppName string = ideasAPI.outputs.functionAppName
```
Add analogous lines for `postsAPIUrl` and `postsAPIAppName`.

**deploy.sh parameter pattern** (lines 47–54): postsapi.bicep adds no new secret params in Phase 1 (connection strings are derived inside the module), so `deploy.sh` needs no changes for Phase 1. Document this explicitly in the plan.

---

### `function_app.py` (posts-api, Phase 1 skeleton only)

**Analog:** `C:/Users/Sriram/ideas-api/function_app.py`

**App entry + imports pattern** (lines 1–19):
```python
import json
import os
from datetime import datetime

import azure.functions as func

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)
```

**Health route pattern** (lines 58–61):
```python
@app.route(route="health", methods=["GET"])
def health(req: func.HttpRequest) -> func.HttpResponse:
    return _json_response({"status": "ok"})
```
Phase 1 skeleton: include only the health route. No post routes until Phase 2/4.

**JSON response helper pattern** (lines 40–46):
```python
def _json_response(data: dict, status_code: int = 200) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps(data),
        status_code=status_code,
        mimetype="application/json",
        headers={"Access-Control-Allow-Origin": "*"},
    )
```

---

### `host.json` (posts-api)

**Analog:** `C:/Users/Sriram/ideas-api/host.json` (entire file)

**Exact pattern to copy:**
```json
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "maxTelemetryItemsPerSecond": 20
      }
    }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  }
}
```
Copy verbatim — no changes needed.

---

### `requirements.txt` (posts-api)

**Analog:** `C:/Users/Sriram/ideas-api/requirements.txt` (lines 1–5)

**Pattern** (existing file):
```
azure-functions
azure-data-tables>=12.4.0
azure-identity>=1.15.0
git+https://github.com/skarumbu/shared-logging.git@master#subdirectory=python
```

**Adapt for posts-api:**
```
azure-functions
azure-storage-blob>=12.29.0
azure-identity>=1.15.0
python-frontmatter>=1.3.0
python-slugify>=8.0.4
```
Replace `azure-data-tables` with `azure-storage-blob`. Replace `python-slugify` for blob. Keep `azure-identity` version pin. Omit `shared-logging` for Phase 1 (no HTTP routes yet — add in Phase 2 when logging is needed).

---

### `local.settings.json` (posts-api)

**Analog:** None — file is gitignored in ideas-api and not present in repo.

**Use RESEARCH.md pattern directly:**
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "POSTS_STORAGE_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "POSTS_CONTAINER_NAME": "posts-test"
  }
}
```
Note: `POSTS_CONTAINER_NAME` set to `posts-test` locally so Azurite tests and `func start` use a separate container from production `posts`.

---

### `schema.py` (posts-api, utility, transform)

**Closest analog:** `C:/Users/Sriram/ideas-api/ideas.py`

**Module-level constants + env config pattern** (ideas.py lines 11–13):
```python
CONNECTION_STRING = os.environ.get("IDEAS_TABLE_CONNECTION_STRING", "")
TABLE_NAME = "ideas"
VALID_STATUSES = {"open", "done", "dismissed"}
```
Adapt: define `REQUIRED_FIELDS = {"title", "slug", "date", "published", "description", "updatedAt"}`.

**Data model build pattern** (ideas.py lines 64–78 — create_idea entity construction):
```python
entity = {
    "PartitionKey": "ideas",
    "RowKey": str(uuid4()),
    "project": project,
    "title": title,
    "body": data.get("body", ""),
    "status": "open",
    "created_at": datetime.now(timezone.utc).isoformat(),
}
```
Adapt: replace table entity dict with `frontmatter.Post` construction. The `datetime.now(timezone.utc).isoformat()` pattern is reused verbatim for `updatedAt`.

**Validation pattern** (ideas.py lines 81–92 — field allowlist + type checks):
```python
allowed = {"status", "project", "project_id", "title", "body"}
unknown = set(updates) - allowed
if unknown:
    raise ValueError(f"Unknown fields: {', '.join(sorted(unknown))}.")
if "status" in updates and updates["status"] not in VALID_STATUSES:
    raise ValueError(f"status must be one of: {', '.join(sorted(VALID_STATUSES))}")
```
Adapt: check `REQUIRED_FIELDS` presence; check `isinstance(post["title"], str)` and `isinstance(post["published"], bool)`.

**Error handling pattern** (ideas.py lines 52–54):
```python
except Exception as exc:
    logger.error(f"list_ideas failed: {exc}")
    return []
```
schema.py is a pure utility (no HTTP layer) — raise `ValueError` on validation failure; let caller handle storage errors.

**Full schema.py implementation pattern** — use RESEARCH.md Code Examples section ("Schema Module Skeleton") as the primary reference since no frontmatter analog exists in the codebase.

---

### `slugs.py` (posts-api, utility, CRUD blob list)

**Closest analog:** `C:/Users/Sriram/ideas-api/ideas.py` lines 18–23 (storage client factory pattern)

**Storage client factory pattern** (ideas.py lines 18–23):
```python
def _get_table_client():
    if not CONNECTION_STRING:
        raise RuntimeError("IDEAS_TABLE_CONNECTION_STRING is not configured")
    svc = TableServiceClient.from_connection_string(CONNECTION_STRING)
    return svc.get_table_client(TABLE_NAME)
```
Adapt: use `ContainerClient.from_connection_string(conn_str, container_name=container)` with `os.environ["POSTS_STORAGE_CONNECTION_STRING"]` and `os.environ.get("POSTS_CONTAINER_NAME", "posts")`.

**Full slug deduplication pattern** — use RESEARCH.md Code Examples ("Slug Module Skeleton") as primary reference:
```python
from python_slugify import slugify
from azure.storage.blob import ContainerClient

def generate_slug(title: str, container_client: ContainerClient) -> str:
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

---

### `tests/conftest.py`, `tests/test_schema.py`, `tests/test_slugs.py` (posts-api, tests)

**Analog:** None — `ideas-api` has no test files.

Use RESEARCH.md Code Examples ("Azurite-Backed Test Fixture") as the primary reference for `conftest.py`:
```python
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

Test file structure: follow standard pytest conventions. Test names map directly to the RESEARCH.md Validation Architecture table (STOR-01, STOR-02, STOR-03 rows).

---

### `.github/workflows/deploy.yml` (posts-api, CI/CD)

**Analog:** `C:/Users/Sriram/ideas-api/.github/workflows/deploy.yml` (lines 1–45)

**Exact workflow structure to copy:**
```yaml
name: Deploy Ideas API to Azure Functions

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Install Azure Functions Core Tools
        run: npm install -g azure-functions-core-tools@4 --unsafe-perm true
      - name: Log in to Azure
        uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
          auth-type: SERVICE_PRINCIPAL
      - name: Clear WEBSITE_RUN_FROM_PACKAGE
        run: |
          az functionapp config appsettings delete \
            --name ${{ secrets.IDEAS_API_APP_NAME }} \
            --resource-group my-website-prod-rg \
            --setting-names WEBSITE_RUN_FROM_PACKAGE WEBSITE_CONTENTAZUREFILECONNECTIONSTRING WEBSITE_CONTENTSHARE
      - name: Deploy to Azure Functions
        run: func azure functionapp publish ${{ secrets.IDEAS_API_APP_NAME }} --python
```
Adapt: rename workflow to `Deploy Posts API to Azure Functions`; replace `IDEAS_API_APP_NAME` secret with `POSTS_API_APP_NAME`; keep Python 3.11 and resource group name unchanged.

---

## Shared Patterns

### Environment variable access (Python)
**Source:** `C:/Users/Sriram/ideas-api/ideas.py` lines 11–12
**Apply to:** `schema.py`, `slugs.py`, `function_app.py`
```python
CONNECTION_STRING = os.environ.get("IDEAS_TABLE_CONNECTION_STRING", "")
# Raises at call time if empty:
if not CONNECTION_STRING:
    raise RuntimeError("IDEAS_TABLE_CONNECTION_STRING is not configured")
```
Pattern: read env var at module level with `os.environ.get(...)`, check for empty at function call time (not at import time) so tests can override via fixture.

### UTC timestamp generation
**Source:** `C:/Users/Sriram/ideas-api/ideas.py` line 74
**Apply to:** `schema.py` (`updatedAt` field), `slugs.py` (if logging timestamps needed)
```python
from datetime import datetime, timezone
datetime.now(timezone.utc).isoformat()
```

### Azure Functions v4 route decorator
**Source:** `C:/Users/Sriram/ideas-api/function_app.py` lines 58–61
**Apply to:** `function_app.py` health route (Phase 1); all routes in Phase 2 and 4
```python
@app.route(route="health", methods=["GET"])
def health(req: func.HttpRequest) -> func.HttpResponse:
    ...
```

### EasyAuth decode
**Source:** `C:/Users/Sriram/ideas-api/auth.py` lines 1–17
**Apply to:** `posts-api/auth.py` (Phase 4 — copy verbatim, no changes needed)
```python
def require_auth(req: func.HttpRequest) -> tuple[str, str, str]:
    principal_b64 = req.headers.get("X-MS-CLIENT-PRINCIPAL")
    if not principal_b64:
        raise ValueError("Unauthenticated")
    principal = json.loads(base64.b64decode(principal_b64 + "=="))
    claims = {c["typ"]: c["val"] for c in principal.get("claims", [])}
    ...
```
Note for planner: Phase 1 does not need auth.py (no HTTP routes). Include it as a note-to-self for Phase 4.

### Bicep module wiring in main.bicep
**Source:** `C:/Users/Sriram/azure-infrastructure/main.bicep` lines 161–173
**Apply to:** postsAPI module block addition
Pattern: `module <name> 'modules/<file>.bicep' = { name: '<name>Deployment'; scope: rg; params: { location: location; environment: environment; ... } }`

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `local.settings.json` | config | — | Gitignored in ideas-api; not committed to any repo |
| `tests/conftest.py` | test | — | ideas-api has no test suite |
| `tests/test_schema.py` | test | — | ideas-api has no test suite |
| `tests/test_slugs.py` | test | — | ideas-api has no test suite |
| Blob container resource | infra | — | ideasapi.bicep and digitsfunctions.bicep use Table Storage only; no blob container resource exists |

For all files in this table, RESEARCH.md Code Examples section is the authoritative pattern source.

---

## Metadata

**Analog search scope:**
- `C:/Users/Sriram/azure-infrastructure/modules/` (15 Bicep modules scanned)
- `C:/Users/Sriram/ideas-api/` (all Python files read)
- `C:/Users/Sriram/my-website/src/` (not applicable to Phase 1 — no UI files)

**Files scanned:** 7 source files read in full (ideasapi.bicep, digitsfunctions.bicep, main.bicep, function_app.py, ideas.py, auth.py, requirements.txt); deploy.sh and deploy.yml read for CI/CD patterns

**Pattern extraction date:** 2026-05-30

**Critical deviations from analogs:**
1. `postsapi.bicep` must add `allowBlobPublicAccess: false` — `digitsfunctions.bicep` (the closest analog) omits this property. This is a SECURITY requirement per STOR-01.
2. `postsapi.bicep` must include `identity: { type: 'SystemAssigned' }` on the Function App — `digitsfunctions.bicep` omits it; copy from `ideasapi.bicep` lines 57–59.
3. Storage type is Blob (`azure-storage-blob`), not Table (`azure-data-tables`) — all storage client code differs from the ideas-api analog.
