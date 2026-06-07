# Personal Site — Posts & Writing

## What This Is

A personal website with interactive features (Digits puzzle, NBA live games, ideas tracker) that is getting a custom-built writing and reading system. You write posts in a private notebook-style editor; anyone can read them on the public site. Posts cover anything — design docs, essays, project write-ups, short notes — all organized by date.

## Core Value

A private writing space that publishes instantly to a public reading feed — so you can write anything and share it without friction.

## Requirements

### Validated

(Existing features — already shipped)

- ✓ Landing page at `/` with candy-themed playground layout — existing
- ✓ Digits number puzzle game at `/digits` with Azure Functions backend — existing
- ✓ MomentumFinder live NBA games view at `/momentum-finder` — existing
- ✓ Azure AD (MSAL) auth — installed and working for Dashboard + Ideas — existing
- ✓ Azure Static Web Apps deployment via GitHub Actions CI/CD — existing

### Active

(Posts feature — building now)

- [ ] Public posts list at `/posts` — all posts, newest first
- [ ] Individual post page at `/posts/:slug` — full article rendered from markdown
- [ ] Private notebook-style editor at `/write` — authenticated, markdown with live preview
- [ ] Posts saved to Azure Blob Storage as markdown files with frontmatter metadata
- [x] Azure Functions API for post CRUD (create, read, update, delete, list) — Validated in Phase 04: write-api
- [ ] Editor protected by Azure AD login (existing MSAL setup reused)
- [ ] Support for varied content types: design docs, essays, project write-ups, short notes
- [ ] New post, edit existing post, and publish/unpublish from the editor

### Out of Scope

- Comments or social features — personal site, not a community
- Tags or categories — date ordering is enough for now
- SEO / sitemap generation — not a primary goal for v1
- Multi-author support — solo author only
- Scheduled publishing — publish-on-save is sufficient

## Context

**Existing site:** React 18 SPA (Create React App + TypeScript), deployed on Azure Static Web Apps. Client-side routing via react-router-dom. Each feature has its own Azure Functions backend.

**Auth pattern:** The site already uses MSAL (Azure AD) for the Dashboard and Ideas pages. The editor will reuse this — same `useMsal` / `useIsAuthenticated` hooks, same `authConfig.js` setup, no new auth system needed.

**Storage decision:** Azure Blob Storage for posts (JSON frontmatter + Markdown body, one file per post). Simple, cheap, no database to provision. Consistent with the lightweight Azure Functions approach used elsewhere.

**Design language:** The site has a warm candy-themed visual style (recent redesign). The notebook-feel editor should feel distinct — calm, focused — while not clashing with the overall palette.

**Existing docs:** `docs/design/` and `docs/incidents/` already contain ADRs and design docs that will be candidates for importing or reposting once the system is live.

## Constraints

- **Tech stack**: React + TypeScript + react-router-dom — no framework changes
- **Auth**: Must reuse existing MSAL / Azure AD setup — no second auth system
- **Hosting**: Azure Static Web Apps (SPA) + Azure Functions — backend stays in Functions
- **Storage**: Azure Blob Storage — no new database services
- **Build**: Create React App (react-scripts) — no ejecting or build system changes
- **Repo structure**: Backend API lives in `C:\Users\Sriram\posts-api\` (sibling repo, Python Azure Functions — matches `ideas-api`, `dashboard_api` pattern). Infrastructure provisioned in `C:\Users\Sriram\azure-infrastructure\` (existing Bicep repo).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Azure Blob Storage for posts | Simplest fit with existing Azure setup; no DB to provision | ✓ Validated (phases 01–04) |
| Reuse MSAL auth for editor | Already installed and configured; avoids a second auth system | — Pending (Phase 05) |
| Markdown with frontmatter | Flexible for all content types; portable if storage changes later | ✓ Validated (phases 01–04) |
| Date-ordered feed (no tags) | Keeps v1 simple; can add filtering later | — Pending |
| Easy Auth (X-MS-CLIENT-PRINCIPAL) for write API | Platform injects auth header; handler validates it; keeps public reads open | ✓ Validated (Phase 04) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-05 — Phase 04 (write-api) complete*
