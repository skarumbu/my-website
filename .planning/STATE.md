---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Phase 05 complete
last_updated: "2026-06-06T18:53:15.756Z"
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 17
  completed_plans: 14
  percent: 82
---

# Project State: Personal Site — Posts & Writing

**Last updated:** 2026-06-05
**Project:** Posts & Writing System (v1)

---

## Project Reference

**Core value:** A private writing space that publishes instantly to a public reading feed — write anything, share without friction.

**Current focus:** Phase 05 — editor-ui

---

## Current Position

Phase: 05 — COMPLETE
| Field | Value |
|-------|-------|
| Current phase | 5 — Editor UI |
| Current plan | 2 of 3 complete |
| Phase status | In progress |
| Overall status | In Progress |

**Progress:**

[███████░░░] 70%
Phase 1 [██████████] 3/3 plans complete ✓
Phase 2 [██████████] 2/2 plans complete ✓
Phase 3 [██████████] 3/3 plans complete ✓
Phase 4 [██████████] Complete (skipped — Write API already in sibling repo)
Phase 5 [██████░░░░] 2/3 plans complete (in progress)

```

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases defined | 5 |
| Requirements mapped | 25/25 |
| Phases complete | 0/5 |
| Plans complete | 1 |
| Phase 01-storage-schema P01 | 15 min | 2 tasks | 12 files |

---
| Phase 01 P02 | 25 | 3 tasks | 7 files |
| Phase 02-public-reading-api P01 | 15 | 2 tasks | 2 files |
| Phase 03-public-reading-ui P01 | 25 | 3 tasks | 10 files |
| Phase 05-editor-ui P01 | 35 | 2 tasks | 9 files |
| Phase 05-editor-ui P02 | 20 | 1 task | 2 files |

## Accumulated Context

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| Azure Blob Storage for posts | Simplest fit with existing Azure setup; no DB to provision |
| Reuse MSAL auth for editor | Already installed and configured; avoids a second auth system |
| postsApiRequest scope uses .default | posts-api App Registration uses /.default scope format (vs access_as_user for ideas) |
| redirectUri fixed to window.location.origin | Prevents Azure AD redirect failures when logging in from /write |
| Auth gate is early-return in component | No PrivateRoute wrapper; matches Ideas.tsx pattern established in Phase 3 |
| BASE_URL read inside component (not module-level) | Module-level const evaluated at import time; jest beforeEach env-var overrides won't apply |
| useBlocker deferred to Plan 05-03 | useBlocker requires data router; MemoryRouter in tests throws; stub removed from Plan 02 |
| DELETE 204 never calls .json() | 204 No Content has no body; .json() throws SyntaxError — check resp.ok only |
| jest.config.js uses testRegex not testMatch | Windows worktree path with .claude/ causes testMatch glob escaping bug |
| Markdown with frontmatter (gray-matter) | Flexible for all content types; portable if storage changes |
| react-markdown for rendering | XSS-safe via React.createElement; never dangerouslySetInnerHTML |
| 5-phase bottom-up build order | Ships public reading before touching auth complexity |
| Used py -3.12 for posts-api venv | Python 3.11 not installed; 3.12 works for Phase 1 pure-Python code |
| slugify imports as 'slugify' not 'python_slugify' | Use `from slugify import slugify` in Plan 02 implementation |

### Known Pitfalls (from research)

- XSS: `LearningPlan.tsx` already uses `dangerouslySetInnerHTML` — do NOT repeat this pattern for posts
- MSAL: Define `postsApiRequest` using env-var-derived scope, not hardcoded GUIDs
- MSAL crash: Gate interactive auth behind `inProgress === InteractionStatus.None`
- YAML corruption: Always double-quote `title` values; use gray-matter for serialization
- Blob privacy: Container must stay private; all access through Functions only
- Autosave: Two-tier (localStorage every 2-3s + API every 30-60s)

### Open Questions

- Token validation library for Phase 4: verify `validate-azure-ad-token` vs alternatives for Functions v4 Node.js 18/20 (resolve during Phase 4 planning)
- `redirectUri` fix (currently hardcoded to `/dashboard`): needs Azure AD App Registration access before Phase 5
- Posts index strategy: blob-scan is fine under ~50 posts; consider `_index.json` if volume grows

### Todos

- None yet

### Blockers

- None

---

## Session Continuity

**Stopped at:** Phase 05 Plan 02 complete. WriteEditor.tsx editor component done.

**Next action:** Phase 05 Plan 03 — autosave timers, delete button, navigation blocking

---

*State initialized: 2026-05-30*

## Decisions

- [Phase ?]: SDK pinned
- [Phase ?]: Azurite conftest
