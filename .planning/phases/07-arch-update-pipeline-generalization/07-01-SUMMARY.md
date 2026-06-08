---
phase: 7
plan: "07-01"
title: "my-website cleanup"
subsystem: frontend
tags: [architecture, cleanup, tooling]
dependency_graph:
  requires: []
  provides: [architecture-metadata-removed, register-package-script, posts-api-starter-entry]
  affects: [src/Architecture.tsx, src/architecture/PackageDetail.tsx, src/architecture-content.json, scripts/register_package.py]
tech_stack:
  added: [scripts/register_package.py]
  patterns: [azure-openai-gpt4o-client, git-clone-commit-push-pattern]
key_files:
  created:
    - scripts/register_package.py
  modified:
    - src/Architecture.tsx
    - src/architecture/PackageDetail.tsx
    - src/architecture-content.json
  deleted:
    - src/architecture-metadata.json
decisions:
  - "D-06: Deleted architecture-metadata.json — Last Deploy metadata system removed entirely"
  - "D-07: Removed metadata import, ServiceMeta type, deployLabel function, and Last Deploy column/cell from Architecture.tsx and PackageDetail.tsx"
  - "D-12: Added hand-crafted posts-api starter entry to architecture-content.json with key exactly matching repo_name used in PLAN-03"
  - "D-05: register_package.py prints YAML using DESIGN_DOC_GH_TOKEN as the canonical secret name"
metrics:
  duration: "~15 min"
  completed: "2026-06-07"
  tasks: 3
  files: 4
---

# Phase 7 Plan 01: my-website cleanup Summary

**One-liner:** Deleted architecture-metadata.json + Last Deploy display from frontend; added register_package.py onboarding script and posts-api starter entry in architecture-content.json.

## What Was Built

Three changes entirely within the my-website repo:

1. **Metadata removal (D-06, D-07):** Deleted `src/architecture-metadata.json` and removed all references from `Architecture.tsx` (import, ServiceMeta type, meta const, deployLabel function, Last Deploy `<th>` column header, Last Deploy `<td>` cell, 4th tuple element from data rows) and `PackageDetail.tsx` (import, ServiceMeta type, meta const, metaKey interface field, metaKey properties from all package objects, m variable assignment, lastDeploy JSX block). Build confirmed clean with `npm run build`.

2. **Register script (D-01 to D-05):** Created `scripts/register_package.py` — accepts `<package-name>` as CLI arg, fetches README from GitHub (main/master fallback), calls Azure OpenAI GPT-4o to generate a starter `architecture-content.json` entry, clones my-website repo and commits the new entry, then prints a ready-to-paste YAML job block. YAML uses `DESIGN_DOC_GH_TOKEN` as the canonical secret name mapping to `ARCH_UPDATE_GH_TOKEN`. Passes Python syntax check (`ast.parse`).

3. **posts-api starter entry (D-12):** Added `"posts-api"` key to `src/architecture-content.json` with all required fields (summary, description, features, architecture.overview, architecture.keyPoints, dataFlow: null). Key matches the `repo_name` value PLAN-03 will use in the reusable workflow call. File remains valid JSON with 2-space indent and trailing newline.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Delete architecture-metadata.json and remove frontend references | 50e3eb6 | src/architecture-metadata.json (deleted), src/Architecture.tsx, src/architecture/PackageDetail.tsx |
| 2 | Create scripts/register_package.py | 768fbcb | scripts/register_package.py (created) |
| 3 | Add posts-api starter entry to architecture-content.json | df1f7a6 | src/architecture-content.json |

## Verification Results

- `npm run build` — succeeded with no TypeScript errors (only pre-existing ESLint warnings unrelated to this plan)
- `node -e "JSON.parse(...)"` — valid JSON confirmed
- `python -c "import ast; ast.parse(...)"` — syntax OK
- `src/architecture-metadata.json` — does not exist (confirmed)
- `"posts-api"` key present in architecture-content.json — confirmed

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — posts-api entry is a hand-crafted starter with real content. The reusable workflow will update it with AI-generated content on the first posts-api deploy after PLAN-03 wires it.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes introduced.

## Self-Check: PASSED

- scripts/register_package.py: EXISTS
- src/architecture-content.json: EXISTS (valid JSON, contains posts-api key)
- src/architecture-metadata.json: DELETED (confirmed)
- Commits 50e3eb6, 768fbcb, df1f7a6: FOUND in git log
