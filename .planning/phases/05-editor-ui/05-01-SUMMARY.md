---
phase: 05-editor-ui
plan: "01"
subsystem: ui
tags: [react, msal, azure-ad, typescript, jest, react-router]

requires:
  - phase: 04-write-api
    provides: "POST/PUT/DELETE /api/posts API endpoints; REACT_APP_POSTS_API_BASE_URL env var"
  - phase: 03-public-reading-ui
    provides: "Posts.tsx fetch pattern, Spinner component, NavBar component, CSS variable system"

provides:
  - "MSAL manual mock at src/__mocks__/@azure/msal-react.tsx for all Write component tests"
  - "Wave 0 RED test stubs for EDIT-03 through EDIT-09 in WriteEditor.test.tsx"
  - "src/authConfig.js: postsApiRequest export + corrected redirectUri (no /dashboard suffix)"
  - "Routes /write, /write/new, /write/:slug registered in createBrowserRouter"
  - "Conditional Write nav link visible only when isAuthenticated"
  - "src/Write.tsx: auth-gated post list at /write with delete functionality"
  - "src/styling/write.css: flat-background write page styles"

affects:
  - 05-editor-ui-plans-02-03
  - write-editor
  - msal-auth-pattern

tech-stack:
  added: []
  patterns:
    - "MSAL manual mock in src/__mocks__/@azure/ for scoped package mocking"
    - "Auth gate early-return pattern (useIsAuthenticated + early return, no PrivateRoute wrapper)"
    - "postsApiRequest with acquireTokenSilent -> acquireTokenRedirect fallback"
    - "DELETE 204 handling: check resp.ok only, never call .json() on DELETE response"
    - "testRegex in jest.config.js instead of testMatch to avoid Windows worktree path dot-escaping bug"

key-files:
  created:
    - "src/__mocks__/@azure/msal-react.tsx"
    - "src/Write.test.tsx"
    - "src/WriteEditor.test.tsx"
    - "src/Write.tsx"
    - "src/styling/write.css"
  modified:
    - "src/authConfig.js"
    - "src/index.js"
    - "src/components/nav-bar.tsx"
    - "jest.config.js"

key-decisions:
  - "postsApiRequest scope is api://825b77cb-1492-406f-9072-923aa536b328/.default (posts-api App Registration)"
  - "redirectUri fixed to window.location.origin with no path suffix to prevent redirect failures from /write"
  - "Auth gate is client-side only (early-return on useIsAuthenticated); server validates token on all API calls"
  - "Write.tsx uses inline auth check, not a PrivateRoute wrapper, matching Ideas.tsx pattern"
  - "Delete handler never calls .json() on DELETE response (204 No Content has no body)"
  - "jest.config.js changed from testMatch to testRegex to fix Windows worktree path glob issue"

patterns-established:
  - "MSAL mock pattern: src/__mocks__/@azure/msal-react.tsx with jest.fn() exports overridable per test"
  - "Write component auth gate: if (!isAuthenticated) return login prompt before main render"
  - "Token acquisition: acquireTokenSilent -> catch -> acquireTokenRedirect with postsApiRequest"

requirements-completed:
  - EDIT-01
  - EDIT-02

duration: 35min
completed: 2026-06-05
---

# Phase 5 Plan 01: Auth Foundation + Write List Page Summary

**MSAL manual mock + Write.tsx post list with auth gate, delete, and Wave 0 RED stubs for editor (EDIT-03 through EDIT-09)**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-05T21:51:00Z
- **Completed:** 2026-06-05T22:26:38Z
- **Tasks:** 2 (both complete)
- **Files modified:** 9 (5 created, 4 modified)

## Accomplishments
- MSAL manual mock enables all Write/WriteEditor tests to run without a real Azure AD connection
- Write.test.tsx passes 2 tests: unauthenticated shows login prompt, authenticated shows "Your posts" heading
- WriteEditor.test.tsx has 4 stub tests failing RED (module not found - expected until WriteEditor.tsx is created)
- authConfig.js has postsApiRequest with correct scope and redirectUri fixed (no /dashboard suffix)
- Three new routes registered in createBrowserRouter; Write and WriteEditor imported
- NavBar shows "Write" link conditionally (isAuthenticated only)
- Write.tsx renders auth gate or post list with delete, empty state, loading/error states

## Task Commits

1. **Task 1: Wave 0 MSAL mock + test stubs + authConfig + routes + nav** - `2854976` (feat)
2. **Task 2: Write.tsx auth-gated post list page with delete** - `e3644db` (feat)

## Files Created/Modified
- `src/__mocks__/@azure/msal-react.tsx` - Manual Jest mock for MSAL hooks (useIsAuthenticated, useMsal, MsalProvider)
- `src/Write.test.tsx` - 2 passing tests: auth gate + authenticated list render
- `src/WriteEditor.test.tsx` - 4 RED stub tests for EDIT-03 through EDIT-09 (expected failures)
- `src/authConfig.js` - Added postsApiRequest export; fixed redirectUri to window.location.origin
- `src/index.js` - Added Write/WriteEditor imports + 3 new routes
- `src/components/nav-bar.tsx` - Added useIsAuthenticated import + conditional Write link
- `src/Write.tsx` - Auth-gated post list page with fetch, delete, empty/loading/error states
- `src/styling/write.css` - Flat-background write page styles matching posts.css analog
- `jest.config.js` - Changed testMatch to testRegex (Windows worktree path fix)

## Decisions Made
- Kept auth gate as early-return in Write.tsx component (not a PrivateRoute wrapper), matching Ideas.tsx pattern
- Delete handler checks `resp.ok || resp.status === 204` and never calls `.json()` on the response
- getToken useCallback deps: `[instance, accounts]` (no getToken in useEffect deps to avoid reload loop)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed getByText ambiguity in Write.test.tsx**
- **Found during:** Task 1 (running Write.test.tsx)
- **Issue:** `getByText(/sign in/i)` found multiple elements ("Sign in to write" heading + "Sign in with Microsoft" button)
- **Fix:** Changed to `getByRole('heading', { name: /sign in to write/i })` for precise targeting
- **Files modified:** src/Write.test.tsx
- **Verification:** Test passes
- **Committed in:** 2854976 (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed jest.config.js testMatch for Windows worktree path**
- **Found during:** Task 1 (running npm test)
- **Issue:** Jest testMatch patterns expand `<rootDir>` which contains `.claude/` — the dot gets escaped as `\.` in the glob, breaking micromatch on Windows. All tests showed "0 matches".
- **Fix:** Changed `testMatch` to `testRegex` using a standard regex pattern that matches both `__tests__/` subdirectory tests and `*.test.tsx` files anywhere in `src/`
- **Files modified:** jest.config.js
- **Verification:** All 4 test suites now found; npx jest runs correctly
- **Committed in:** 2854976 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep. The jest.config.js change is a worktree-specific infrastructure fix; it should also be merged to main to benefit future development.

## Issues Encountered
- `npm test` (react-scripts test) still doesn't find test files due to CRA's embedded jest config having the same Windows path issue. Workaround: use `npx jest` which picks up jest.config.js. The testMatch->testRegex fix in jest.config.js only affects direct jest runs, not react-scripts. This is a known limitation of CRA's embedded configuration.

## Known Stubs
- `src/WriteEditor.test.tsx` — 4 stub tests fail RED (WriteEditor.tsx not yet created). This is intentional Wave 0 state; WriteEditor.tsx is the deliverable of plan 05-02 or 05-03.

## Threat Flags
None - no new security-relevant surface beyond what the plan's threat model covers.

## Next Phase Readiness
- Auth infrastructure (postsApiRequest, redirectUri fix, MSAL mock) is ready for WriteEditor.tsx
- Routes are registered; WriteEditor.tsx just needs to be created at the correct path
- Write.test.tsx 2 tests pass; WriteEditor.test.tsx tests will auto-pass once WriteEditor.tsx is created

---
*Phase: 05-editor-ui*
*Completed: 2026-06-05*
