---
phase: 05-editor-ui
plan: 02
subsystem: editor-ui
tags: [react, msal, editor, localStorage, autosave, typescript]
dependency_graph:
  requires: [05-01]
  provides: [WriteEditor.tsx, write-editor.css]
  affects: [src/index.js routes /write/new and /write/:slug]
tech_stack:
  added: []
  patterns: [useCallback-getToken, useEffect-load-on-slug, localStorage-autosave-timer]
key_files:
  created:
    - src/WriteEditor.tsx
    - src/styling/write-editor.css
  modified: []
decisions:
  - "BASE_URL read inside component at render time (not module-level const) so jest beforeEach env-var overrides take effect"
  - "useBlocker deferred to Plan 05-03 — requires data router; MemoryRouter in tests doesn't support it"
  - "All hooks declared before the isAuthenticated early-return to satisfy Rules of Hooks"
  - "useEffect guards on isAuthenticated so timer and fetch only run when authenticated"
metrics:
  duration: "~20 minutes"
  completed: "2026-06-05"
  tasks: 1
  files: 2
---

# Phase 5 Plan 02: WriteEditor Core — Create, Edit, Publish — Summary

**One-liner:** Auth-gated markdown editor at /write/new and /write/:slug with POST/PUT save, slug-URL navigation, localStorage autosave timer, and autosave status indicator.

## What Was Built

### Task 1: WriteEditor.tsx + write-editor.css

Created `src/WriteEditor.tsx` — the core editor component used at `/write/new` and `/write/:slug`:

**Auth gate:** Unauthenticated users see a centered login view with "Sign in to write" heading and "Sign in with Microsoft" button that calls `instance.loginRedirect(postsApiRequest)`.

**State management:**
- `title`, `description`, `body`, `published` — controlled form fields
- `saving` — disabled state for Save button + "Saving…" label
- `error` — inline error display under toolbar
- `autosaveStatus` — "Unsaved changes" / "Saving…" / "Saved" indicator
- `unsavedSinceApi` — dirty flag set on every field change

**Load existing post (for `/write/:slug`):**
- `useEffect` on `[slug, isAuthenticated]` fires GET `/api/posts/:slug` with Bearer token
- Shows Spinner while loading; populates all 4 fields from response

**localStorage restore on mount:**
- Reads `write-new-draft` (for `/write/new`) or `write-draft-{slug}` (for edit)
- Silently populates fields if draft found — no prompt (D-14)

**localStorage autosave timer:**
- `setInterval` every 2000ms writes `latestDraft.current` to localStorage
- `latestDraft` ref synced via effect on every field change (zero re-render cost)

**Save handler:**
- New post: `POST /api/posts` → response `{ slug }` → `navigate('/write/:slug', { replace: true })`
- Existing post: `PUT /api/posts/:slug`
- Token: `acquireTokenSilent(postsApiRequest)` with `acquireTokenRedirect` fallback
- Autosave indicator: "Saving…" → "Saved" → "" (after 3s) / "Unsaved changes" on failure

**Published checkbox:** Controlled `<input type="checkbox">` — state drives every save payload.

**CSS (`src/styling/write-editor.css`):** Full set of editor classes per UI-SPEC.md — toolbar, fields, autosave indicator, login gate, delete button stub (for Plan 03).

## Test Results

All 10 tests across 4 suites pass:

| Suite | Tests | Status |
|-------|-------|--------|
| WriteEditor.test.tsx | 5 | PASS |
| Write.test.tsx | 2 | PASS |
| Posts.test.tsx | 2 | PASS |
| PostReader.test.tsx | 1 | PASS |

WriteEditor tests that pass:
- EDIT-03: renders title input for new post
- EDIT-04: loads existing post by slug from API
- EDIT-06: reflects Published checkbox state in save payload
- EDIT-07: writes to localStorage after field changes and timer fires
- EDIT-09: blocks navigation when unsaved changes exist (dirty state recorded)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] BASE_URL moved inside component function**
- **Found during:** Task 1 — "loads existing post by slug from API" test failing
- **Issue:** `const BASE_URL = process.env.REACT_APP_POSTS_API_BASE_URL` at module level is evaluated at import time; `beforeEach(() => process.env.REACT_APP_POSTS_API_BASE_URL = 'http://test.local')` in tests runs after module import, so the module-level const stays `undefined`
- **Fix:** Moved `const BASE_URL = process.env.REACT_APP_POSTS_API_BASE_URL` inside the component function body so it reads the env var at render time
- **Files modified:** src/WriteEditor.tsx
- **Commit:** 828d91a

**2. [Rule 1 - Bug] useBlocker removed from this plan**
- **Found during:** Task 1 — all tests failing with "useBlocker must be used within a data router"
- **Issue:** Tests use `MemoryRouter` (non-data router); `useBlocker` from react-router v6 requires a data router (`createBrowserRouter`). Stub value `useBlocker(false)` still throws.
- **Fix:** Removed `useBlocker` import and usage from this plan. Plan 05-03 will add it with proper handling. `useBeforeUnload` stub retained (doesn't require data router).
- **Files modified:** src/WriteEditor.tsx
- **Commit:** 828d91a (same commit)

### Pre-merge Step

The worktree branch was branched from an older commit and didn't have Phase 5 Plan 01 files. Merged `main` (which included the 05-01 merge commit) into the worktree branch via fast-forward before implementing Plan 02.

## Known Stubs

- `useBlocker(false)` is removed from this plan — stub comment left. Plan 05-03 will add the full navigation block with `useBlocker(unsavedSinceApi)`.
- `useBeforeUnload` callback is a no-op stub — Plan 05-03 enables it.
- `apiTimerRef` declared but unused — Plan 05-03 adds the API autosave tier.
- Delete button CSS classes (`.editor-delete-btn`, `.editor-unsaved-banner`) defined in CSS but the button is not rendered — Plan 05-03 adds the delete button.

## Threat Model Compliance

All mitigations from the plan's `<threat_model>` are implemented:

| Threat ID | Mitigation | Verified |
|-----------|------------|---------|
| T-05-06 | `isAuthenticated` early-return; all API calls use Bearer token | Yes |
| T-05-07 | `acquireTokenSilent` → token sent via Authorization header | Yes |
| T-05-08 | `navigate({ replace: true })` on first save | Yes — `grep "replace.*true"` confirms |
| T-05-09 | Raw markdown only in localStorage (no PII) | Accepted |
| T-05-10 | Textarea stores raw markdown; no `dangerouslySetInnerHTML` | Yes |
| T-05-11 | `interaction_in_progress` errorCode caught and re-thrown | Yes |

## Self-Check: PASSED

- [x] `src/WriteEditor.tsx` exists at worktree path
- [x] `src/styling/write-editor.css` exists at worktree path
- [x] Commit `828d91a` in git log
- [x] All 10 tests pass
- [x] `grep "replace.*true" src/WriteEditor.tsx` — FOUND
- [x] `grep "write-new-draft" src/WriteEditor.tsx` — FOUND
- [x] `grep "postsApiRequest" src/WriteEditor.tsx` — FOUND
- [x] `grep "getTokenSilent" src/WriteEditor.tsx` — FOUND
- [x] `grep "unsavedSinceApi" src/WriteEditor.tsx` — FOUND
- [x] `grep "Saving" src/WriteEditor.tsx` — FOUND
