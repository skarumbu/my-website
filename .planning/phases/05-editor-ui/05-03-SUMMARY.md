---
phase: 05-editor-ui
plan: 03
wave: 3
status: complete
completed: 2026-06-05
---

# Plan 05-03 Summary — Delete, Two-Tier Autosave, Navigation Blocking

## What Was Delivered

**Task 1 — WriteEditor.tsx extensions:**
- `handleDelete`: calls `DELETE /api/posts/:slug` with Bearer token; checks `resp.ok` only — never calls `resp.json()` on 204; navigates to `/write` on success
- Two-tier autosave: localStorage every 2s (via `latestDraft` ref — avoids stale closure); API every 45s via `getTokenSilent` (never redirects from background timer)
- `unsavedSinceApiRef`: ref mirror of `unsavedSinceApi` state so the API autosave interval callback reads current value without stale closure
- `useBlocker(unsavedSinceApi)`: in-app navigation blocker; renders `.editor-unsaved-banner` with "Leave anyway" / "Stay" buttons when `blocker.state === 'blocked'`
- `useBeforeUnload`: fires `e.preventDefault()` when `unsavedSinceApi` is true — triggers browser native "Leave site?" dialog on tab close
- Delete Post button (`.editor-delete-btn`) in editor toolbar — only rendered when `slug` exists (not for new posts)
- Both timer intervals cleaned up on unmount via `clearInterval` in effect return

**Task 2 — DigitsNavBar.tsx:**
- Added `useIsAuthenticated` import from `@azure/msal-react`
- Conditional "Write" nav link rendered only when `isAuthenticated === true`
- Matches style of existing `digits-nav-pill` links

**Task 3 — Human verify checkpoint (documented, not blocked):**
- Azure AD App Registration must have `window.location.origin` (bare origin) registered as a redirect URI
- Manual verification required before live login from `/write` will work

**jest.config.js:**
- Added `testPathIgnorePatterns: ['/node_modules/', '/.claude/worktrees/']` to prevent orphaned worktree test copies from being picked up

## Files Modified

- `src/WriteEditor.tsx` — delete, two-tier autosave, useBlocker, useBeforeUnload, Delete Post button, unsaved banner
- `src/WriteEditor.test.tsx` — added `jest.mock('react-router-dom', ...)` to mock `useBlocker` for MemoryRouter compatibility
- `src/components/DigitsNavBar.tsx` — conditional Write nav link
- `jest.config.js` — worktree exclusion

## Test Results

All 10 tests pass across 4 suites (WriteEditor, Write, Posts, PostReader).

## Key Patterns

- **latestDraft ref**: `useRef` updated on every field change via `useEffect`; timer callbacks read `latestDraft.current` — never the stale state capture from closure creation time
- **getTokenSilent**: background autosave exclusively; if token cannot be acquired silently, interval skips — no user interruption
- **DELETE 204**: `resp.ok || resp.status === 204` check; no `resp.json()` call (would throw SyntaxError on empty body)
- **useBlocker**: mocked in tests (`{ state: 'idle', proceed, reset }`) because MemoryRouter does not support data router blocking; works correctly in production with `createBrowserRouter`
