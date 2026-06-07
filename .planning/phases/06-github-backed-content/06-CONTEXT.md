# Phase 6: GitHub-Backed Content — Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace Azure Blob Storage with GitHub as the post content store. All posts (editor-created and design docs) live as committed `.md` files in the `my-website` repo under a new `posts/` directory. The posts-api is rewritten to proxy the GitHub Contents API. The frontend (React SPA) is **unchanged** — the API contract stays identical.

**What changes:** posts-api storage backend, Azure Bicep app settings, design doc file locations.
**What stays the same:** All five React pages (`Posts.tsx`, `PostReader.tsx`, `Write.tsx`, `WriteEditor.tsx`, `src/index.js`), the REST API contract, and the frontend auth flow.

</domain>

<decisions>
## Implementation Decisions

### Content Directory

- **D-01:** A unified `posts/` directory lives at the repo root. All content (editor-created posts and design docs) lives here.
- **D-02:** Existing design docs move from `docs/design/` to `posts/` as part of this phase. The `docs/design/` directory is removed after migration.
- **D-03:** Editor-created posts use filename `{slug}.md` (e.g., `my-post-title.md`). No date prefix in the filename.

### Frontmatter

- **D-04:** All `.md` files in `posts/` must have YAML frontmatter. The existing design docs are migrated with frontmatter added (one-time edit) when they are moved to `posts/`. After migration, posts-api uses a single code path for all files.
- **D-05:** Frontmatter schema is unchanged from Phases 1–5: `title`, `slug`, `date`, `published`, `description`, `updatedAt` (optional).
- **D-06:** For the migrated design docs, `published: true` and the `date` value is taken from the existing `**Date:** YYYY-MM-DD` field in the doc body.

### Slug Format

- **D-07:** For design docs whose filename starts with a date prefix (`YYYY-MM-DD-`), the slug strips the date prefix. Example: `2026-05-25-running-app-deployment-decisions.md` → slug `running-app-deployment-decisions`. The slug is set explicitly in the frontmatter.
- **D-08:** Editor-created posts use title-derived slugs (unchanged from current behavior — `python-slugify` from the post title).

### posts-api Rewrite

- **D-09:** posts-api replaces `azure-storage-blob` with GitHub Contents API calls via the `requests` library (sync, simpler than httpx).
- **D-10:** Authentication: a GitHub Personal Access Token (PAT) with `repo` scope stored as the `GITHUB_TOKEN` Azure Function app setting. The PAT authenticates all write operations (create, update, delete).
- **D-11:** Repository is identified by a `GITHUB_REPO` app setting in the format `owner/repo` (e.g., `skarumbu/my-website`). Posts live at path `posts/{slug}.md` within that repo.
- **D-12:** `POSTS_DIR` constant is `"posts"` (hardcoded, not configurable).
- **D-13:** List handler fetches the `posts/` directory listing (one GitHub API call) then fetches each file's content to parse frontmatter. At personal scale (< 50 posts), this N+1 read pattern is acceptable.
- **D-14:** Update and delete operations require the file's current SHA. posts-api must GET the file first to obtain the SHA, then PUT/DELETE with that SHA. This is a GitHub Contents API requirement.
- **D-15:** Slug deduplication on create: GET the target file path before writing. If a 200 is returned, the slug already exists — append `-2`, `-3`, etc. until a 404 is returned.

### Azure Infrastructure

- **D-16:** Remove `POSTS_STORAGE_CONNECTION_STRING` and `POSTS_CONTAINER_NAME` from `postsapi.bicep` app settings.
- **D-17:** Add `GITHUB_TOKEN` and `GITHUB_REPO` as Azure Function app settings in `postsapi.bicep`.
- **D-18:** The Azure Blob Storage account used for posts is decommissioned (app settings removed from Bicep). The `posts` container definition is removed from the storage Bicep module.

### Decommission

- **D-19:** `slugs.py` — remove `get_container_client()` and all `azure-storage-blob` imports. Replace with GitHub API helpers (`get_file_sha`, `list_posts_dir`, etc.).
- **D-20:** `requirements.txt` — remove `azure-storage-blob`; add `requests`.
- **D-21:** All existing tests reference the old blob client. Tests must be rewritten to mock GitHub API calls (using `unittest.mock.patch` on `requests.get/put/delete`).

### Claude's Discretion

- **GitHub API base URL:** `https://api.github.com/repos/{GITHUB_REPO}/contents/posts`
- **Authorization header:** `Authorization: token {GITHUB_TOKEN}` (classic PAT format)
- **Content encoding:** GitHub API returns file content base64-encoded; posts-api must decode/encode.
- **list_posts_dir implementation:** call `GET /repos/{repo}/contents/posts` → returns JSON array of file objects; for each `.md` file, call `GET /repos/{repo}/contents/posts/{filename}` to get content. Parse frontmatter. Return only `published: true` files for public read endpoints.
- **Error mapping:** GitHub 404 → HTTP 404; GitHub 422 (SHA conflict) → HTTP 409 or retry; any GitHub 5xx → HTTP 502.
- **No `_index.json` cache in v1** — straightforward N+1 is fine. Cache can be added in v2 if list latency is noticeable.
- **Commit messages:** When creating/updating via GitHub API, use message like `"post: add {slug}"` / `"post: update {slug}"` / `"post: delete {slug}"`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Scope & Requirements
- `.planning/REQUIREMENTS.md` — GH-01 through GH-05 (the 5 requirements this phase satisfies)
- `.planning/ROADMAP.md` §Phase 6 — Success criteria and phase goal

### Prior Phase Artifacts
- `.planning/phases/01-storage-schema/01-CONTEXT.md` — Frontmatter schema definition (title, slug, date, published, description, updatedAt)
- `docs/design/2026-06-06-posts-writing-system.md` — Full system design doc; Decisions 1–6 document the current architecture being replaced/extended
- `.planning/STATE.md` §Key Decisions — Prior decisions about auth, API contracts, slug generation

### Codebase Integration Points
- `posts-api/function_app.py` — All 5 route handlers; storage calls being replaced
- `posts-api/slugs.py` — `get_container_client()`, `generate_slug()` — both need rewriting
- `posts-api/schema.py` — `parse_post()`, `build_post()`, `serialize_post()` — reuse mostly unchanged
- `posts-api/requirements.txt` — Dependency change: remove `azure-storage-blob`, add `requests`
- `azure-infrastructure/postsapi.bicep` — App settings update (remove storage, add GitHub)
- `docs/design/` — 5 files to migrate to `posts/` with frontmatter added

### API Contract (unchanged — frontend reads this)
- `GET /api/posts` → `{posts: [{title, slug, date, description, published}]}` — all published posts
- `GET /api/posts/:slug` → `{post: {title, slug, date, description, published, body}}` — single post
- `POST /api/posts` → 201 `{slug}` — create (MSAL-gated)
- `PUT /api/posts/:slug` → 200 — update (MSAL-gated)
- `DELETE /api/posts/:slug` → 204 — delete (MSAL-gated)

</canonical_refs>

<code_context>
## Existing Code Insights

### What Stays the Same (Do Not Modify)
- `src/Posts.tsx`, `src/PostReader.tsx` — public reading UI
- `src/Write.tsx`, `src/WriteEditor.tsx` — editor UI
- `src/index.js`, `src/authConfig.js` — routing and auth config
- `src/components/nav-bar.tsx`, `src/components/DigitsNavBar.tsx` — nav (already has Write link)
- `posts-api/auth.py` — MSAL token validation (unchanged)
- `posts-api/schema.py` — Post data model (mostly unchanged)

### What Changes
- `posts-api/function_app.py` — Replace all blob storage calls with GitHub API calls
- `posts-api/slugs.py` — Remove blob container logic; add GitHub API helpers
- `posts-api/requirements.txt` — Swap azure-storage-blob for requests
- `posts-api/tests/` — Rewrite tests to mock GitHub API responses
- `azure-infrastructure/postsapi.bicep` — Swap storage app settings for GitHub app settings
- `azure-infrastructure/main.bicep` — Update param wiring if storage account ref removed

### File Migration
The following 5 files move from `docs/design/` to `posts/` with frontmatter added:
1. `2026-05-12-per-idea-status-updates.md` → slug: `per-idea-status-updates`
2. `2026-05-12-dashboard-github-actions-expandable-cards.md` → slug: `dashboard-github-actions-expandable-cards`
3. `2026-05-23-running-app.md` → slug: `running-app`
4. `2026-05-25-running-app-deployment-decisions.md` → slug: `running-app-deployment-decisions`
5. `2026-06-06-posts-writing-system.md` → slug: `posts-writing-system`

All get `published: true` and dates from their existing `**Date:** YYYY-MM-DD` fields.

</code_context>

<deferred>
## Deferred Ideas

- `_index.json` blob cache for list performance — defer to v2 if N+1 list latency is noticeable
- `docs/incidents/` directory inclusion in the feed — empty now; include when first incident doc is written, after this phase
- GitHub webhook to invalidate a CDN cache or trigger a re-index — out of scope for v1
- Migrating any existing Azure Blob posts — no live posts exist; migration is a no-op

</deferred>

---

*Phase: 6-github-backed-content*
*Context gathered: 2026-06-06*
