# Walking Skeleton — Posts & Writing System

**Phase:** 01-storage-schema
**Created:** 2026-05-30
**Scope:** Thinnest possible end-to-end storage slice — write a blob, read it back, schema round-trips.

---

## What the Skeleton Proves

After Phase 1 completes, a developer can:

1. Start Azurite locally (`azurite --silent --location .azurite`)
2. Run `pytest tests/ -v` from `C:\Users\Sriram\posts-api\`
3. Watch tests pass: slug generated → frontmatter serialized → blob written to Azurite → blob read back → frontmatter parsed → all 6 fields intact

That end-to-end chain (title → slug → `.md` blob → parse) is the skeleton. Every subsequent phase (Phase 2 read API, Phase 4 write API, Phase 5 editor) builds on top of it without renegotiating these decisions.

---

## Architectural Decisions (Fixed for All Subsequent Phases)

### Repos

| Concern | Repo | Path |
|---------|------|------|
| Python API + utilities | posts-api | `C:\Users\Sriram\posts-api\` |
| Infrastructure (Bicep) | azure-infrastructure | `C:\Users\Sriram\azure-infrastructure\` |
| Frontend (React SPA) | my-website | `C:\Users\Sriram\my-website\` |

**Rule:** Azure resources are declared in Bicep only. Python code never calls `create_container()` or any resource-creation API. Storage is provisioned by `postsapi.bicep`, consumed by `posts-api` functions.

### Storage

| Property | Value | Rationale |
|----------|-------|-----------|
| Storage type | Azure Blob Storage | Fits existing Azure setup; no DB to provision |
| Container name | `posts` (production), `posts-test` (local/CI) | Separation of concerns; tests don't pollute production |
| Blob naming | `{slug}.md` | Direct lookup by slug; no date prefix needed |
| Container access | `publicAccess: 'None'` + `allowBlobPublicAccess: false` | Defense in depth; SEC-03 |
| Auth (production) | RBAC `Storage Blob Data Contributor` via managed identity | No key rotation; consistent with ideasapi.bicep pattern |
| Auth (local dev) | `UseDevelopmentStorage=true` (Azurite) | No real Azure needed for local development |

### Post File Format

| Property | Value | Rationale |
|----------|-------|-----------|
| Format | Markdown with YAML frontmatter | Portable; human-readable; proven by gray-matter/python-frontmatter ecosystem |
| Serialization library | `python-frontmatter` 1.3.0 | Handles YAML edge cases (colons in titles, type coercion) |
| Frontmatter fields | 6 (see schema below) | Locked in D-01/D-02/D-03 |
| `updatedAt` management | Auto-set on every write by backend | D-02; no manual control needed |

**Frontmatter schema (all 6 fields, locked):**

```yaml
---
title: "My Post Title"          # string — always quoted by python-frontmatter
slug: my-post-title             # string — URL-safe, auto-derived from title
date: "2026-05-30T00:00:00+00:00"  # ISO 8601 string — creation date
published: false                # boolean — draft by default
description: "One-line summary" # string
updatedAt: "2026-05-30T12:34:56+00:00"  # ISO 8601 string — set on every write
---

Post body in Markdown here.
```

### Slug Algorithm

| Step | Action |
|------|--------|
| 1 | `python-slugify 8.0.4`: `slugify(title)` → lowercase, hyphenated, unicode-transliterated, special chars stripped |
| 2 | Check `container_client.list_blobs(name_starts_with=base_slug)` for `{slug}.md` existence |
| 3 | If `{base_slug}.md` exists: try `{base_slug}-2.md`, `{base_slug}-3.md`, ... |
| 4 | Return the first non-colliding candidate |

**Edge case:** Empty slug (e.g., title is all special chars) → `ValueError`. Caller handles.

### Python Stack

| Library | Version | Purpose |
|---------|---------|---------|
| `azure-functions` | latest | Azure Functions v4 Python worker |
| `azure-storage-blob` | >=12.29.0 | Blob CRUD |
| `azure-identity` | >=1.15.0 | Managed identity credential |
| `python-frontmatter` | >=1.3.0 | Frontmatter parse/serialize |
| `python-slugify` | >=8.0.4 | Slug generation |

**Python version:** 3.11 (matches `linuxFxVersion: 'Python|3.11'` in Bicep). Local tests run on Python 3.12 (acceptable for Phase 1 — no runtime-specific code).

### Infrastructure

| Resource | Name pattern | SKU |
|----------|-------------|-----|
| Storage account | `postsapi{uniqueString(rg.id)}` | Standard_LRS |
| Blob container | `posts` | — |
| App Service Plan | `posts-api-{env}-plan` | Y1 Dynamic (consumption) |
| Function App | `posts-api-{env}-{uniqueString(rg.id)}` | Linux, Python 3.11 |
| RBAC role | Storage Blob Data Contributor | `ba92f5b4-2d11-453d-a403-e96b0029c9fe` |

**Deploy path:** `postsapi.bicep` is a module wired into `main.bicep`. Deployed via `./deploy.sh` — no ad-hoc `az deployment group create` calls.

### Directory Layout

```
C:\Users\Sriram\posts-api\
├── function_app.py          # Azure Functions v4 entry point (health route only in Phase 1)
├── host.json                # Extension bundle v4
├── requirements.txt         # 5 packages (see above)
├── local.settings.json      # Azurite connection strings (gitignored)
├── .gitignore               # __pycache__, .venv, local.settings.json, .azurite/
├── schema.py                # build_post(), validate_post(), serialize_post(), parse_post()
├── slugs.py                 # generate_slug(title, container_client) -> str
├── pytest.ini               # testpaths = tests; python_files = test_*.py
└── tests/
    ├── conftest.py          # container_client fixture (Azurite)
    ├── test_schema.py       # STOR-02 tests (frontmatter round-trip, 6 fields, colon title)
    ├── test_slugs.py        # STOR-03 tests (basic, unicode, dedup -2/-3, empty title)
    └── test_storage.py      # STOR-01 tests (blob write+read via Azurite)

C:\Users\Sriram\azure-infrastructure\modules\
└── postsapi.bicep           # Storage account + blob container + function app + RBAC
```

`main.bicep` gains a `module postsAPI 'modules/postsapi.bicep'` block. `deploy.sh` needs no changes (postsapi.bicep derives all values internally — no new secret params in Phase 1).

### CI/CD

| Property | Value |
|----------|-------|
| Workflow file | `C:\Users\Sriram\posts-api\.github\workflows\deploy.yml` |
| Trigger | Push to `main` |
| Python version | 3.11 |
| Deploy command | `func azure functionapp publish ${{ secrets.POSTS_API_APP_NAME }} --python` |
| Secret required | `POSTS_API_APP_NAME` (set in GitHub repo settings after Phase 1 deploy) |

---

## What Subsequent Phases Build On

| Phase | Builds On |
|-------|-----------|
| Phase 2 — Public Reading API | `schema.py::parse_post()`, `ContainerClient.from_connection_string()`, container name `posts` |
| Phase 3 — Public Reading UI | Phase 2 API contract (slug, title, date, description, published fields) |
| Phase 4 — Write API | `schema.py::build_post()` + `slugs.py::generate_slug()` + `slugs.py::get_container_client()`, `auth.py` from ideas-api |
| Phase 5 — Editor UI | Phase 4 write API endpoints; MSAL token scope `postsApiRequest` (defined in authConfig.js) |

**Non-negotiable constraints for all phases:**

1. Never call `create_container()` in Python — container is declared in Bicep.
2. Never use `dangerouslySetInnerHTML` for post content — use `react-markdown`.
3. Always set frontmatter fields via `post["field"] = value` (not f-string YAML).
4. `POSTS_STORAGE_CONNECTION_STRING` and `POSTS_CONTAINER_NAME` come from env vars — never hardcode.
5. `publicAccess: 'None'` + `allowBlobPublicAccess: false` must never be relaxed.

---

*Walking Skeleton created: 2026-05-30*
