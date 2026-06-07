---
phase: 06-github-backed-content
plan: 03
subsystem: infra
tags: [bicep, azure-functions, github-api, yaml-frontmatter, markdown]
status: PARTIAL

# Dependency graph
requires:
  - phase: 06-github-backed-content
    plan: 01
    provides: "GitHub API helpers in slugs.py (list_posts_dir, get_file_sha, etc.)"
  - phase: 06-github-backed-content
    plan: 02
    provides: "function_app.py rewritten to use GitHub helpers; blob storage removed from Python"
provides:
  - "5 design docs migrated to posts/ directory with YAML frontmatter (published: true)"
  - "docs/design/ directory deleted from repo"
  - "postsapi.bicep updated: GITHUB_TOKEN/GITHUB_REPO app settings, no postsContainer or blobDataContributorRole"
  - "main.bicep passes githubToken and githubRepo to postsAPI module"
affects: [posts-api deployment, azure-infrastructure deploy, frontend /posts feed]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "YAML frontmatter prepended to markdown files: title, slug, date, published, description, updatedAt"
    - "Bicep @secure() param pattern for GitHub PAT (same as existing githubPat param)"

key-files:
  created:
    - posts/per-idea-status-updates.md
    - posts/dashboard-github-actions-expandable-cards.md
    - posts/running-app.md
    - posts/running-app-deployment-decisions.md
    - posts/posts-writing-system.md
  modified:
    - azure-infrastructure/modules/postsapi.bicep
    - azure-infrastructure/main.bicep
    - src/architecture-content.json
    - src/architecture-history/dashboard-api/2026-05-13-8ad2734.json
    - src/architecture-history/dashboard-api/2026-05-14-907ccf1.json
    - src/architecture-history/dashboard-api/2026-05-14-a331caf.json
    - src/architecture-history/dashboard-api/2026-05-26-b7176d7.json

key-decisions:
  - "Design docs migrated to posts/ by prepending YAML frontmatter; original body content unchanged"
  - "postsContainer and blobDataContributorRole removed from Bicep; storageAccount/blobService/storageConnectionString kept for Functions runtime"
  - "architecture-content.json and architecture-history JSON links updated from docs/design/ to posts/"

requirements-completed:
  - GH-02
  - GH-05

# Metrics
duration: ~30min
completed: 2026-06-06
---

# Phase 6 Plan 03: Content Migration & Bicep GitHub Wiring Summary

**5 design docs migrated to posts/ with YAML frontmatter; postsapi.bicep and main.bicep updated with GITHUB_TOKEN/GITHUB_REPO params and blob container removed**

**Status: PARTIAL — Tasks 1 and 2 complete. Task 3 (checkpoint:human-verify) awaiting human verification and deployment.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-06-06T18:55:00Z
- **Completed (partial):** 2026-06-06T19:24:20Z
- **Tasks completed:** 2 of 3
- **Files modified:** 9 (my-website) + 2 (azure-infrastructure)

## Accomplishments

- Created `posts/` directory with 5 migrated design docs — each has YAML frontmatter with `published: true`, correct slug, date, description, and updatedAt
- Deleted `docs/design/` directory (4 tracked files via `git rm`; 5th was untracked in main repo only)
- Updated `architecture-content.json` and 4 `architecture-history` JSON files: 8 `docs/design` href references updated to `posts/` paths
- Updated `postsapi.bicep`: removed `postsContainer` resource, `blobDataContributorRole` resource, `POSTS_STORAGE_ACCOUNT_NAME`/`POSTS_CONTAINER_NAME` app settings; added `githubToken`/`githubRepo` params and `GITHUB_TOKEN`/`GITHUB_REPO` app settings; kept `storageAccount`, `blobService`, `storageConnectionString`, `AzureWebJobsStorage`
- Updated `main.bicep`: added `githubToken` and `githubRepo` params; wired them into the `postsAPI` module call
- Bicep build (`az bicep build --file main.bicep`) exits 0 — no syntax errors (pre-existing warnings in other modules only)

## Task Commits

1. **Task 1: Migrate design docs to posts/ + delete docs/design/** — `23013ed` (feat)
   - my-website worktree: 10 files changed (5 new posts/, 4 docs/design/ renamed/deleted, src/ updated)
2. **Task 2: Update postsapi.bicep and main.bicep with GitHub params** — `0ad96c9` (feat)
   - azure-infrastructure repo: 2 files changed

## Files Created/Modified

### my-website (worktree)
- `posts/per-idea-status-updates.md` — ADR with YAML frontmatter (slug: per-idea-status-updates)
- `posts/dashboard-github-actions-expandable-cards.md` — ADR with YAML frontmatter
- `posts/running-app.md` — ADR with YAML frontmatter (slug: running-app)
- `posts/running-app-deployment-decisions.md` — ADR with YAML frontmatter
- `posts/posts-writing-system.md` — Design doc with YAML frontmatter (slug: posts-writing-system)
- `src/architecture-content.json` — Updated 4 href references from docs/design/ to posts/
- `src/architecture-history/dashboard-api/*.json` — Updated 4 refs in 4 history files
- `docs/design/` — Deleted (4 tracked files; 5th file was untracked so was not tracked in worktree)

### azure-infrastructure
- `modules/postsapi.bicep` — Added githubToken/githubRepo params, removed postsContainer/blobDataContributorRole, swapped app settings
- `main.bicep` — Added githubToken/githubRepo params, updated postsAPI module call

## Decisions Made

- Kept `storageConnectionString` var in postsapi.bicep — still referenced by `AzureWebJobsStorage` and `WEBSITE_CONTENTAZUREFILECONNECTIONSTRING` (per PATTERNS.md critical note and RESEARCH.md Pitfall 6)
- Updated `architecture-content.json` and history JSON `href` values to point to `posts/` — these will become 404s if left pointing to `docs/design/` after merge
- The 5th design doc (`2026-06-06-posts-writing-system.md`) was untracked in the main repo and not present in the worktree; it was written directly as `posts/posts-writing-system.md` using content read from the main repo file

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated architecture-content.json and history JSON href references**
- **Found during:** Task 1 (docs/design reference grep)
- **Issue:** `src/architecture-content.json` had 4 GitHub blob URLs pointing to `docs/design/` paths that would become 404s after migration. The plan said to check for references and update any found.
- **Fix:** Updated all 4 href values in `architecture-content.json` and 4 more in `src/architecture-history/dashboard-api/*.json` to use `posts/` paths.
- **Files modified:** `src/architecture-content.json`, 4 `src/architecture-history/dashboard-api/*.json` files
- **Verification:** `grep "docs/design" src/architecture-content.json` returns nothing
- **Committed in:** `23013ed` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical reference update)
**Impact on plan:** Necessary to prevent broken links in the live architecture page. No scope creep — the plan explicitly instructed grepping for references and updating any found.

## Issues Encountered

None — plan executed smoothly. The Bicep build passed cleanly on first attempt.

## User Setup Required

**External services require manual configuration before Task 3 checkpoint can be approved.**

Steps required before deployment verification:
1. Create a GitHub fine-grained PAT (skarumbu/my-website, Contents: Read and write)
2. Set `GITHUB_TOKEN` as an Azure Function app setting on posts-api
3. Deploy updated Bicep from `C:/Users/Sriram/azure-infrastructure`
4. Deploy updated posts-api code to Azure Functions
5. Verify `/api/posts` returns 5 design doc slugs

## Next Phase Readiness

Task 3 (checkpoint:human-verify) is pending. After human verification and approval:
- Phase 6 is complete
- The posts feed at `/posts` will serve migrated design docs from GitHub
- The editor at `/write` will commit new posts to `my-website/posts/` in GitHub

---
*Phase: 06-github-backed-content*
*Completed: 2026-06-06 (partial — awaiting checkpoint:human-verify)*
