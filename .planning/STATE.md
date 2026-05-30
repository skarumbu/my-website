# Project State: Personal Site — Posts & Writing

**Last updated:** 2026-05-30
**Project:** Posts & Writing System (v1)

---

## Project Reference

**Core value:** A private writing space that publishes instantly to a public reading feed — write anything, share without friction.

**Current focus:** Phase 1 — Storage & Schema

---

## Current Position

| Field | Value |
|-------|-------|
| Current phase | 1 — Storage & Schema |
| Current plan | None (not started) |
| Phase status | Not started |
| Overall status | Planning complete |

**Progress:**
```
Phase 1 [          ] Not started
Phase 2 [          ] Not started
Phase 3 [          ] Not started
Phase 4 [          ] Not started
Phase 5 [          ] Not started
```

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases defined | 5 |
| Requirements mapped | 25/25 |
| Phases complete | 0/5 |
| Plans complete | 0 |

---

## Accumulated Context

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| Azure Blob Storage for posts | Simplest fit with existing Azure setup; no DB to provision |
| Reuse MSAL auth for editor | Already installed and configured; avoids a second auth system |
| Markdown with frontmatter (gray-matter) | Flexible for all content types; portable if storage changes |
| react-markdown for rendering | XSS-safe via React.createElement; never dangerouslySetInnerHTML |
| 5-phase bottom-up build order | Ships public reading before touching auth complexity |

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

**To resume:** Read ROADMAP.md for phase structure. Run `/gsd-plan-phase 1` to begin planning Phase 1.

**Next action:** `/gsd-plan-phase 1`

---

*State initialized: 2026-05-30*
