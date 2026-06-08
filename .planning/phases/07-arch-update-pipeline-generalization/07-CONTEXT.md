# Phase 7: Arch Update Pipeline Generalization - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Every package repo auto-updates the architecture page on deploy with a single reusable job call. Onboarding a new package requires exactly two steps: (1) run `scripts/register_package.py <name>` in my-website (generates an AI-populated starter entry in architecture-content.json and prints ready-to-paste YAML), (2) paste that YAML job into the package's deploy.yml.

The `architecture-metadata.json` file and the `update-architecture` metadata job are eliminated entirely (display removed from the Architecture page). All existing repos are updated to remove the dead metadata job and chain `update-arch-content` directly to `deploy`. Secret naming is standardized to `DESIGN_DOC_GH_TOKEN` across all repos.

</domain>

<decisions>
## Implementation Decisions

### New Package Registration
- **D-01:** Registration uses a setup script: `scripts/register_package.py <package-name>` in my-website
- **D-02:** Script location: `my-website/scripts/register_package.py` (top-level scripts/ directory — new folder)
- **D-03:** Script generates an AI-populated starter entry in `src/architecture-content.json` (same GPT-4o call as arch_content_update.py, scanned from the package's GitHub repo README/code)
- **D-04:** Script prints the ready-to-paste YAML job block to stdout so onboarding is a copy-paste operation
- **D-05:** The printed YAML uses `DESIGN_DOC_GH_TOKEN` as the canonical secret name

### Architecture Metadata
- **D-06:** `src/architecture-metadata.json` is deleted entirely
- **D-07:** The "Last deploy" display is removed from the Architecture page (Architecture.tsx and PackageDetail.tsx)
- **D-08:** The `update-architecture` job (metadata commit) is removed from ALL repo deploy workflows — no replacement needed
- **D-09:** `updatedAt` / `updatedBySha` in architecture-content.json (written by arch_content_update.py) remain — they reflect last *architectural* update, not last deploy

### Existing Repo Cleanup
- **D-10:** All 7 existing repos (digits, dashboard_api, momentum_finder, trail_finder, ideas-api, ideas-bot, learning-plan-api) have their `update-architecture` job removed; `update-arch-content` job is updated to `needs: deploy` (was `needs: update-architecture`)
- **D-11:** `azure-infrastructure`: remove `dispatch-architecture-update.yml`, add `update-arch-content` reusable job to `deploy.yml`, and add a proper starter entry in `architecture-content.json`
- **D-12:** `posts-api`: add `update-arch-content` reusable job to `deploy.yml`, add starter entry in `architecture-content.json`

### Secret Name Standardization
- **D-13:** Canonical PAT secret name is `DESIGN_DOC_GH_TOKEN` across all repos
- **D-14:** Repos currently using `MY_WEBSITE_DISPATCH_TOKEN` for the arch update job (digits, dashboard_api, momentum_finder, trail_finder) are updated to `DESIGN_DOC_GH_TOKEN`
- **D-15:** Note: `MY_WEBSITE_DISPATCH_TOKEN` may still exist in some repos for other purposes — only the `ARCH_UPDATE_GH_TOKEN` input alias in the reusable workflow (which maps from the caller's secret) is affected

### Reviewed Todos (folded consideration)
- **remove-repo-map-from-bot.md** (BOT-02): reviewed but not folded — out of scope for Phase 7, belongs to ideas-bot work

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reusable Workflow (my-website)
- `.github/workflows/arch-content-update-reusable.yml` — the reusable workflow that packages call; absorbs the metadata step too after D-08
- `.github/scripts/arch_content_update.py` — AI update script; `register_package.py` will reuse the same GPT-4o client pattern

### Content Files (my-website)
- `src/architecture-content.json` — the JSON file that register_package.py writes starter entries into
- `src/architecture-metadata.json` — **DELETE this file** (D-06)
- `src/architecture-history-index.json` — maintained by arch_content_update.py; no change needed

### Frontend Components (my-website)
- `src/Architecture.tsx` — remove the `architecture-metadata.json` import and `lastDeploy` display (D-07)
- `src/architecture/PackageDetail.tsx` — remove the `architecture-metadata.json` import and `lastDeploy` display (D-07)

### Package Deploy Workflows (sibling repos)
- `C:/Users/Sriram/digits/.github/workflows/deploy.yml` — remove `update-architecture` job, update `update-arch-content` needs (D-10)
- `C:/Users/Sriram/dashboard_api/.github/workflows/deploy.yml` — same (D-10)
- `C:/Users/Sriram/momentum_finder/.github/workflows/deploy.yml` — same (D-10)
- `C:/Users/Sriram/trail_finder/.github/workflows/deploy.yml` — same (D-10)
- `C:/Users/Sriram/ideas-api/.github/workflows/deploy.yml` — same (D-10)
- `C:/Users/Sriram/ideas-bot/.github/workflows/deploy.yml` — same (D-10)
- `C:/Users/Sriram/learning-plan-api/.github/workflows/deploy.yml` — same (D-10)
- `C:/Users/Sriram/azure-infrastructure/.github/workflows/deploy.yml` — add `update-arch-content` job (D-11)
- `C:/Users/Sriram/azure-infrastructure/.github/workflows/dispatch-architecture-update.yml` — **DELETE** (D-11)
- `C:/Users/Sriram/posts-api/.github/workflows/deploy.yml` — add `update-arch-content` job (D-12)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.github/scripts/arch_content_update.py`: GPT-4o client setup, strip_fences(), significance check, content generation, git clone+commit pattern — `register_package.py` should reuse this same Azure OpenAI client setup
- `.github/workflows/arch-content-update-reusable.yml`: already parameterized with `repo_name`, `commit_sha`, `commit_message`, `ARCH_CONTENT_FOUNDRY_KEY`, `ARCH_UPDATE_GH_TOKEN` — no changes needed to the reusable workflow itself

### Established Patterns
- All deploy workflows follow the same post-deploy job chain: `needs: [deploy-job-name]`, checkout my-website with token, do work, push
- The `arch_content_update.py` script uses `git clone --depth=1`, `jq`-equivalent Python, and `git push` — `register_package.py` should use the same `subprocess.run` + `tempfile.TemporaryDirectory` clone pattern for writing to my-website

### Integration Points
- `arch-content-update-reusable.yml` is the stable integration point — all package deploy.yml files call it
- `architecture-content.json` key = package name (must match `repo_name` input in the reusable workflow)
- Frontend reads `architecture-content.json` at build time (static import) — changes require a my-website deploy to take effect
- `MY_WEBSITE_DISPATCH_TOKEN` → `DESIGN_DOC_GH_TOKEN` rename in 4 repos affects only the workflow secret reference (not the GitHub repo secret itself — the actual secret value stays the same, just the caller-side name changes)

</code_context>

<specifics>
## Specific Ideas

- The setup script should be runnable as: `python scripts/register_package.py <package-name>` from the my-website repo root
- Script output: (1) updates `src/architecture-content.json` in-place, (2) prints YAML block to stdout with a clear "paste this into your deploy.yml" header
- The printed YAML should use `DESIGN_DOC_GH_TOKEN` and include a comment noting the `ARCH_CONTENT_FOUNDRY_KEY` secret also needs to be in the target repo
- azure-infrastructure's `deploy.yml` likely needs the `update-arch-content` job after its Bicep deployment step (not after a test step) — agent should read it before planning

</specifics>

<deferred>
## Deferred Ideas

- **BOT-02 (remove REPO_MAP from bot.py)**: Came up in todos cross-reference. Out of scope for Phase 7 — this is an ideas-bot feature, not arch pipeline work. Stays in `.planning/todos/pending/remove-repo-map-from-bot.md`.
- **Design doc check workflow generalization**: `design-doc-check.yml` follows the same reusable pattern as arch-content-update. Could be generalized similarly in a future phase.
- **Architecture page deploy badge**: If "last deploy" info is ever wanted back, it could be sourced from the GitHub API at runtime rather than a static JSON file.

</deferred>

---

*Phase: 7-arch-update-pipeline-generalization*
*Context gathered: 2026-06-07*
