# Phase 7: Arch Update Pipeline Generalization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-07
**Phase:** 07-arch-update-pipeline-generalization
**Areas discussed:** New package registration, Metadata job absorption, Existing repo cleanup, Secret name standardization

---

## New Package Registration

| Option | Description | Selected |
|--------|-------------|----------|
| Setup script | Run `scripts/register_package.py <name>` — generates AI-populated JSON entry + prints YAML | ✓ |
| Template files | Copy-paste from a template file + documented JSON schema | |
| Plain docs | CONTRIBUTING.md section explaining the 2-step process | |

**User's choice:** Setup script (`my-website/scripts/register_package.py`)

| Option | Description | Selected |
|--------|-------------|----------|
| AI-generated on registration | Script calls GPT-4o to populate starter JSON from repo README/code | ✓ |
| Blank skeleton | Minimal JSON stub developer fills in manually | |
| You decide | Claude picks based on existing arch_content_update.py pattern | |

**User's choice:** AI-generated on registration

| Option | Description | Selected |
|--------|-------------|----------|
| `.github/scripts/register_package.py` | Alongside existing arch_content_update.py | |
| `scripts/register_package.py` | Top-level scripts/ directory (new folder) | ✓ |

**User's choice:** `scripts/register_package.py` (top-level)

| Option | Description | Selected |
|--------|-------------|----------|
| Print YAML block to stdout | Developer gets ready-to-paste YAML | ✓ |
| Just update JSON, document YAML separately | Simpler script, developer looks up YAML | |

**User's choice:** Print YAML block to stdout

---

## Metadata Job Absorption

**Note:** User questioned whether the `update-architecture` metadata step is needed at all. Claude investigated `architecture-metadata.json` usage and found it shows "Last deploy: date · sha" on the Architecture page — distinct from `updatedAt`/`updatedBySha` in architecture-content.json (which only update on significant changes).

| Option | Description | Selected |
|--------|-------------|----------|
| Keep architecture-metadata.json | Shows true last-deploy date/sha on every push | |
| Drop — use updatedAt from architecture-content.json | Simpler, but shows last architectural update not last deploy | |
| Drop — remove deploy info from page entirely | Less clutter; architecture page shows architecture not deploy history | ✓ |

**User's choice:** Remove deploy info from the page entirely — delete `architecture-metadata.json` and its frontend display

**Notes:** This eliminates the entire `update-architecture` metadata job question — no absorption needed, just removal.

---

## Existing Repo Cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| Update all 7 repos in Phase 7 | Remove metadata job, update needs chain, clean 2-job pattern | ✓ |
| Leave existing repos, fix only new packages | Less work but leaves dead job chaining to deleted step | |

**User's choice:** Update all 7 existing repos

| Option | Description | Selected |
|--------|-------------|----------|
| Fix azure-infrastructure (replace broken dispatch approach) | Standard reusable job + proper architecture-content.json entry | ✓ |
| Out of scope | Leave broken dispatch approach as-is | |

**User's choice:** Fix azure-infrastructure

| Option | Description | Selected |
|--------|-------------|----------|
| Add posts-api to the pipeline | Wire up reusable job + add starter JSON entry | ✓ |
| Out of scope | Leave posts-api for later | |

**User's choice:** Add posts-api

---

## Secret Name Standardization

| Option | Description | Selected |
|--------|-------------|----------|
| Standardize to DESIGN_DOC_GH_TOKEN | ideas-api/ideas-bot already use this; update the other 4 | ✓ |
| Standardize to MY_WEBSITE_DISPATCH_TOKEN | Rename DESIGN_DOC_GH_TOKEN usages instead | |
| Standardize to ARCH_UPDATE_GH_TOKEN | New canonical name matching the reusable workflow's input alias | |
| Leave as-is | Both work; not worth rename risk | |

**User's choice:** `DESIGN_DOC_GH_TOKEN` across all repos

**Notes:** The 4 repos using `MY_WEBSITE_DISPATCH_TOKEN` only need the workflow YAML updated — the actual GitHub secret value stays the same.

---

## Claude's Discretion

- None — all key decisions were made explicitly by the user.

## Deferred Ideas

- **BOT-02 (remove REPO_MAP from ideas-bot)**: Came up in todos cross-reference. Out of scope; stays in `.planning/todos/pending/remove-repo-map-from-bot.md`.
- **Design doc check workflow generalization**: `design-doc-check.yml` follows the same pattern. Could be generalized in a future phase.
- **Architecture page deploy badge**: If "last deploy" info is ever wanted back, could source from GitHub API at runtime instead of a static JSON file.
