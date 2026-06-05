---
phase: 03-public-reading-ui
plan: "01"
subsystem: frontend
tags: [react, typescript, posts, routing, testing]
dependency_graph:
  requires: []
  provides: [posts-list-page, react-markdown-installed, wave-0-test-scaffolds]
  affects: [src/index.js, src/Posts.tsx, src/styling/posts.css]
tech_stack:
  added: [react-markdown@^10.1.0, babel.config.js, jest.config.js]
  patterns: [tri-state-render, fetch-in-useEffect, CSS-Grid-row-layout]
key_files:
  created:
    - src/Posts.tsx
    - src/styling/posts.css
    - src/__tests__/Posts.test.tsx
    - src/__tests__/PostReader.test.tsx
    - src/__mocks__/fileMock.js
    - babel.config.js
    - jest.config.js
  modified:
    - package.json
    - package-lock.json
    - src/index.js
decisions:
  - "Read REACT_APP_POSTS_API_BASE_URL inside useEffect (not at module scope) to allow test beforeEach to set env var before the fetch guard runs"
  - "Added babel.config.js + jest.config.js so CI=true npx jest works directly without react-scripts, required for transformIgnorePatterns on react-markdown ESM deps"
  - "CSS imports stubbed via src/__mocks__/fileMock.js for direct jest runs"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-04"
  tasks_completed: 3
  tasks_total: 3
  files_created: 7
  files_modified: 3
---

# Phase 3 Plan 01: Posts List Page Summary

**One-liner:** React /posts list page with CSS Grid rows, fetch from REACT_APP_POSTS_API_BASE_URL, and jest+TypeScript configured for both npm test and npx jest.

## What Was Built

**Task 1 — Install react-markdown and Wave 0 test scaffolds:**
- Installed `react-markdown@^10.1.0` (approved in RESEARCH.md Package Legitimacy Audit)
- Created `src/__tests__/Posts.test.tsx` with two tests: post list rows (READ-01) and empty-state message (READ-02)
- Created `src/__tests__/PostReader.test.tsx` scaffold with `jest.mock('react-markdown', ...)` ESM mock before PostReader import; intentionally RED until Plan 02 creates PostReader.tsx

**Task 2 — Build Posts.tsx and posts.css:**
- `src/Posts.tsx`: function component with tri-state (loading/error/data) fetch pattern, `fmtDate()` using local-time Date constructor to avoid UTC off-by-one, CSS Grid row list, no `dangerouslySetInnerHTML`
- `src/styling/posts.css`: Fraunces/DM Sans typography, CSS Grid `.posts-row` layout with hover state, global CSS variable tokens (`--bg-1`, `--ink`, `--ink-2`, `--ink-3`, `--line`, `--accent`)
- Added `babel.config.js`, `jest.config.js`, `src/__mocks__/fileMock.js` to enable `npx jest` to work with TypeScript and ESM react-markdown dependencies

**Task 3 — Register /posts route:**
- Added `import Posts from './Posts.tsx'` and `{ path: "/posts", element: <Posts /> }` to `src/index.js`
- MSAL block and existing routes unchanged
- PostReader not added (Plan 02 concern)

## Verification Results

All acceptance criteria met:

- `node -e "require('./package.json').dependencies['react-markdown'] || process.exit(1)"` — PASS
- `CI=true npx jest --testPathPattern="Posts.test"` — PASS (2/2 green)
- `grep -q 'path: "/posts"' src/index.js && grep -q "import Posts from './Posts.tsx'"` — PASS
- `grep dangerouslySetInnerHTML src/Posts.tsx` — no match (PASS)
- `.posts-row { display: grid; }` present in posts.css — PASS

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] BASE_URL module-scope capture prevented test env var from taking effect**
- **Found during:** Task 2, first test run
- **Issue:** `const BASE_URL = process.env.REACT_APP_POSTS_API_BASE_URL` at module scope captures `undefined` at module load time; the test `beforeEach` sets the env var after module load, so `BASE_URL` was always `undefined` during tests causing the error-state to render instead of the fetch path
- **Fix:** Moved `const BASE_URL = process.env.REACT_APP_POSTS_API_BASE_URL` inside the `useEffect` callback so it's read fresh on each render cycle
- **Files modified:** src/Posts.tsx
- **Commit:** d999a7e

**2. [Rule 3 - Blocking] npx jest failed due to missing TypeScript and CSS transforms**
- **Found during:** Task 2 verification (acceptance criteria requires `CI=true npx jest --testPathPattern="Posts.test"` exits 0)
- **Issue:** `npx jest` runs jest directly without CRA's `react-scripts test` wrapper, which configures babel-jest with TypeScript support via `config/jest/babelTransform.js`. Direct jest used default babel without TypeScript preset, causing parse error on `as` type cast. CSS imports also failed without a CSS transform.
- **Fix:** Created `babel.config.js` using `babel-preset-react-app` so babel-jest picks up TypeScript support; created `jest.config.js` with `moduleNameMapper` to stub CSS imports, `transformIgnorePatterns` to allow react-markdown ESM deps to be transformed, and `setupFilesAfterEnv` pointing to existing `setupTests.js`. Added `src/__mocks__/fileMock.js` as the CSS stub.
- **Files modified:** babel.config.js (new), jest.config.js (new), src/__mocks__/fileMock.js (new)
- **Commit:** d999a7e

## Known Stubs

None - Posts.tsx reads from a live API env var with no hardcoded stub data in the component itself.

## Threat Flags

None - all API fields (title, date, description) are rendered as JSX text children; React escapes them by default. No `dangerouslySetInnerHTML` used (verified by grep gate).

## Self-Check: PASSED

- src/Posts.tsx: exists
- src/styling/posts.css: exists
- src/__tests__/Posts.test.tsx: exists
- src/__tests__/PostReader.test.tsx: exists
- src/index.js: contains Posts import and /posts route
- Commits 7b51602, d999a7e, e8e248e: all present in git log
- `CI=true npx jest --testPathPattern="Posts.test"`: exits 0
