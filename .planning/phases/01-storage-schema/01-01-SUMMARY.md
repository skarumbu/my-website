---
phase: 01-storage-schema
plan: 01
subsystem: posts-api-scaffold
tags: [python, azure-functions, pytest, azurite, scaffold]
dependency_graph:
  requires: []
  provides: [posts-api-repo, venv, pytest-infrastructure, azurite-fixture]
  affects: [01-02-PLAN, 01-03-PLAN]
tech_stack:
  added:
    - azure-functions==1.24.0
    - azure-storage-blob==12.29.0
    - azure-identity==1.25.3
    - python-frontmatter==1.3.0
    - python-slugify==8.0.4
    - text-unidecode==1.3
    - pytest==9.0.3
  patterns:
    - Azure Functions v4 Python model (decorator-based, single function_app.py)
    - Azurite UseDevelopmentStorage=true connection string for local tests
    - pytest.skip() stubs for not-yet-implemented modules
key_files:
  created:
    - C:/Users/Sriram/posts-api/function_app.py
    - C:/Users/Sriram/posts-api/host.json
    - C:/Users/Sriram/posts-api/requirements.txt
    - C:/Users/Sriram/posts-api/local.settings.json
    - C:/Users/Sriram/posts-api/.gitignore
    - C:/Users/Sriram/posts-api/.github/workflows/deploy.yml
    - C:/Users/Sriram/posts-api/pytest.ini
    - C:/Users/Sriram/posts-api/tests/__init__.py
    - C:/Users/Sriram/posts-api/tests/conftest.py
    - C:/Users/Sriram/posts-api/tests/test_schema.py
    - C:/Users/Sriram/posts-api/tests/test_slugs.py
    - C:/Users/Sriram/posts-api/tests/test_storage.py
  modified: []
decisions:
  - "Used py -3.12 for venv (3.11 not installed; tests run fine on 3.12 for Phase 1 pure-Python code)"
  - "Deploy workflow adapted from ideas-api pattern; update-architecture job omitted (posts-api has no arch metadata yet)"
  - "slugify module imports as 'slugify' (not 'python_slugify'); from slugify import slugify is correct"
metrics:
  duration_minutes: 15
  completed_date: "2026-05-30"
  tasks_completed: 2
  tasks_total: 2
  files_created: 12
  files_modified: 0
---

# Phase 01 Plan 01: posts-api Scaffold Summary

**One-liner:** posts-api Python Azure Functions repo scaffolded with venv, 5 packages installed, pytest collecting 13 stub tests via Azurite fixture.

---

## What Was Built

The posts-api Python repository was created at `C:/Users/Sriram/posts-api/` from scratch with:

- **Git repo:** initialized with `main` branch; 2 commits
- **Azure Functions entry point:** `function_app.py` with health route returning `{"status": "ok", "service": "posts-api"}`
- **Config files:** `host.json` (extensionBundle v4), `requirements.txt` (5 packages), `local.settings.json` (gitignored)
- **CI/CD:** `.github/workflows/deploy.yml` adapted from ideas-api pattern using `POSTS_API_APP_NAME` secret
- **Python venv:** `.venv/` created with Python 3.12, all 5 packages installed
- **Test infrastructure:** `pytest.ini`, `tests/conftest.py` with Azurite fixture, 3 test stub files (13 total stubs, all skip cleanly)

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Verify package legitimacy (auto-approved) | N/A | N/A |
| 2 | Initialize posts-api repo with config files and CI/CD | 94e6387 | function_app.py, host.json, requirements.txt, .gitignore, .github/workflows/deploy.yml |
| 3 | Create pytest config and Azurite-backed test infrastructure | ed7ecf6 | pytest.ini, tests/__init__.py, tests/conftest.py, test_schema.py, test_slugs.py, test_storage.py |

## Verification Results

- `pytest tests/ -v` → 13 skipped, 0 failed, 0 errors
- All 5 packages importable in venv
- `git log --oneline` → 2 commits visible
- `local.settings.json` not tracked by git (gitignored)

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] python-slugify import name correction**
- **Found during:** Task 2 verification
- **Issue:** The plan's verification command used `import python_slugify` but the installed package exposes module `slugify` (not `python_slugify`). Running `import python_slugify` raises `ModuleNotFoundError`.
- **Fix:** Used `from slugify import slugify` in all references. The RESEARCH.md code examples also show `from python_slugify import slugify` — this import path does not work; the correct path is `from slugify import slugify`.
- **Files modified:** None — the fix is in verification command knowledge; test stubs don't import slugify yet (that's Plan 02).
- **Note:** When Plan 02 implements `slugs.py`, use `from slugify import slugify` (not `from python_slugify import slugify`).

**2. [Rule 2 - Scope] Deploy workflow: update-architecture job omitted**
- **Found during:** Task 2
- **Issue:** The ideas-api deploy.yml has a second `update-architecture` job that updates `src/architecture-metadata.json` in my-website. This job references `secrets.DESIGN_DOC_GH_TOKEN` and `secrets.ARCH_CONTENT_FOUNDRY_KEY` which are ideas-api-specific secrets.
- **Fix:** Omitted the `update-architecture` and `update-arch-content` jobs from posts-api deploy.yml. The posts-api does not have architecture metadata yet. This can be added in a later phase when the posts-api is deployed.

---

## Known Stubs

| File | Stub Type | Reason |
|------|-----------|--------|
| tests/test_schema.py | 5 pytest.skip() tests | schema.py not yet implemented (Plan 02) |
| tests/test_slugs.py | 5 pytest.skip() tests | slugs.py not yet implemented (Plan 02) |
| tests/test_storage.py | 3 pytest.skip() tests | storage layer not yet implemented (Plan 02) |

These stubs are intentional — the scaffold plan creates the test infrastructure only. Plan 02 implements schema.py and slugs.py and fills in the tests.

---

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. `local.settings.json` is gitignored per T-01-01 mitigation. Package legitimacy verified (T-01-SC) per Task 1 auto-approval.

---

## Self-Check: PASSED

- C:/Users/Sriram/posts-api/function_app.py — FOUND
- C:/Users/Sriram/posts-api/host.json — FOUND
- C:/Users/Sriram/posts-api/requirements.txt — FOUND
- C:/Users/Sriram/posts-api/tests/conftest.py — FOUND
- C:/Users/Sriram/posts-api/tests/test_schema.py — FOUND
- C:/Users/Sriram/posts-api/tests/test_slugs.py — FOUND
- C:/Users/Sriram/posts-api/tests/test_storage.py — FOUND
- Commit 94e6387 — FOUND
- Commit ed7ecf6 — FOUND
