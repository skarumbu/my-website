# Codebase Concerns

**Analysis Date:** 2026-05-30

## Tech Debt

**Unused dependencies shipped to production:**
- Issue: `@auth0/auth0-react`, `@aws-sdk/client-secrets-manager`, and `react-native-web` are listed in `dependencies` (not `devDependencies`) but are never imported anywhere in `src/`. They are bundled into the production build, increasing bundle size.
- Files: `package.json`
- Impact: Larger bundle sent to users; potential security surface from unmaintained transitive packages; misleading to future contributors.
- Fix approach: Remove all three from `package.json` and run `npm install`.

**Mixed HTTP clients (axios + fetch):**
- Issue: `Digits.tsx` uses `axios` for its single API call, while every other file (`MomentumFinder.tsx`, `Dashboard.tsx`, `Ideas.tsx`, `TrailFinder.tsx`, `LearningPlan.tsx`) uses the native `fetch` API. There is no shared API abstraction layer.
- Files: `src/Digits.tsx` (line 2, 100), all other data-fetching files.
- Impact: Two HTTP libraries in the bundle; inconsistent error handling; new contributors must know which to use.
- Fix approach: Replace the `axios.request()` call in `Digits.tsx` with `fetch`, then remove `axios` from `package.json`.

**Hardcoded production API URL in source:**
- Issue: The Digits production endpoint `https://digits-api-prod-hwbxtkz6lsfoq.azurewebsites.net/api/DigitsGetter` is embedded directly in `Digits.tsx` (line 93). All other features pull their URLs from environment variables.
- Files: `src/Digits.tsx` (line 93)
- Impact: Cannot change the URL without a code change and redeploy; URL leaks the Azure resource name publicly in source code.
- Fix approach: Add `REACT_APP_DIGITS_API_URL` to `.github/workflows/azure-static-web-apps.yml` secrets and replace the hardcoded string with `process.env.REACT_APP_DIGITS_API_URL`.

**Hardcoded OAuth scope GUID in authConfig:**
- Issue: `ideasApiRequest` in `src/authConfig.js` (line 18) uses a hardcoded Azure app registration GUID (`e70038a1-6f98-4008-b10a-a5926ec6a861`) instead of deriving it from `process.env.REACT_APP_AZURE_CLIENT_ID` the way `dashboardApiRequest` does.
- Files: `src/authConfig.js` (line 18)
- Impact: The Ideas API's client ID is effectively public. If the app registration changes (e.g. tenant migration, rotation) a code change is required.
- Fix approach: Replace the literal GUID with an env var reference: `` `api://${process.env.REACT_APP_IDEAS_CLIENT_ID}/access_as_user` `` and add the corresponding secret.

**Route definition missing leading slash:**
- Issue: In `src/index.js` (line 30), the `MomentumFinder` route is defined as `path: "momentum-finder"` (no leading `/`), while every other route uses an absolute path (`/digits`, `/architecture`, etc.).
- Files: `src/index.js` (line 30)
- Impact: In React Router v6 a relative path under the root layout works in practice, but it is inconsistent and breaks predictability if a nested router is ever added. Direct navigation to `/momentum-finder` continues to work today only because of the Azure SWA `navigationFallback` rewrite rule.
- Fix approach: Change to `path: "/momentum-finder"` for consistency.

**`CI: false` suppresses ESLint errors in CI:**
- Issue: `.github/workflows/azure-static-web-apps.yml` (line 34) sets `CI: false`, which prevents Create React App from treating ESLint warnings as build errors. Real lint issues will never fail the build.
- Files: `.github/workflows/azure-static-web-apps.yml` (line 34)
- Impact: Lint regressions silently reach production.
- Fix approach: Remove `CI: false` and fix any pre-existing lint warnings, or add a dedicated `npx eslint src/` step with a failure threshold.

**`package.json` uses `npm start` with Linux-only env-var syntax on a Windows dev machine:**
- Issue: The `"start"` script uses `WATCHPACK_POLLING=true react-scripts start` which requires a Unix shell. On Windows this only works via Git Bash, WSL, or a cross-env wrapper.
- Files: `package.json` (scripts.start)
- Impact: Running `npm start` from a standard Windows command prompt or PowerShell fails without Git Bash.
- Fix approach: Add `cross-env` as a dev dependency and prefix with `cross-env WATCHPACK_POLLING=true ...` for portability, or document the Git Bash requirement explicitly.

**Stale stub data in Digits development mode:**
- Issue: The `development` branch in `Digits.tsx` uses three fixed puzzles with hardcoded numbers, targets, and solutions. As the production API evolves (new puzzle formats, difficulty labels, additional fields), the stub can drift out of sync.
- Files: `src/Digits.tsx` (lines 50–87)
- Impact: Local development may hide bugs that only appear against the real API response shape.
- Fix approach: Store the stub in a versioned JSON fixture file (`src/__fixtures__/digits-stub.json`) so it is easy to update when the API contract changes.

---

## Known Bugs

**`helpMe` hint uses stale closure over `numbersList`:**
- Symptoms: The `helpMe` function in `Digits.tsx` (line 145) reads `numbersList` from the outer closure but the inner `setPendingMove` callbacks run asynchronously after state updates. If the user modifies the board while hints are animating, the animation targets the pre-update `numbersList` snapshot.
- Files: `src/Digits.tsx` (lines 145–191)
- Trigger: Click "Help me!" while rapidly tapping number buttons during hint animation.
- Workaround: `isAnimating.current` partially guards this, but does not prevent the initial `helpMe` call from capturing a stale state snapshot.

**`LearningPlan` `eslint-disable-line` on hooks dependency array:**
- Symptoms: Line 254 of `LearningPlan.tsx` suppresses the exhaustive-deps lint rule to include `googleBtnRef.current` in a `useEffect` dependency array. `ref.current` is not a valid dependency — React does not track changes to `.current`, so the effect may silently not re-run when the DOM element mounts.
- Files: `src/LearningPlan.tsx` (line 254)
- Trigger: The Google Sign-In button can fail to render if the component re-renders before the Google Identity Services script loads.
- Workaround: The separate `useEffect` at line 226 partially compensates.

---

## Security Considerations

**`dangerouslySetInnerHTML` renders AI-generated content without sanitisation:**
- Risk: `LearningPlan.tsx` renders AI-generated plan markdown through a custom `renderMarkdown` function that passes output through `applyInline()` and then into `dangerouslySetInnerHTML`. The `applyInline` function constructs raw HTML strings via regex but performs no HTML-entity escaping or sanitisation.
- Files: `src/LearningPlan.tsx` (lines 46, 56, 82; `applyInline` function lines 91–96)
- Current mitigation: The content originates from the `learning-plan-api` which uses Claude; the API is authenticated via Google OAuth. Cross-user injection is unlikely but if the API were ever compromised or a user found a prompt-injection path, arbitrary HTML including `<script>` tags could be rendered.
- Recommendations: Pass all rendered strings through a library such as `DOMPurify` before injecting, or use a proper markdown library (`react-markdown` with `rehype-sanitize`).

**Google Maps API key exposed client-side:**
- Risk: `REACT_APP_GOOGLE_MAPS_API_KEY` is injected into the JS bundle at build time and visible in the browser. The key is used to load the Google Maps Places autocomplete script with no domain restriction mentioned in code.
- Files: `src/TrailFinder.tsx` (line 62)
- Current mitigation: Google allows API key restrictions by HTTP referrer. If the key is restricted to the production domain it is low risk.
- Recommendations: Confirm the key has HTTP referrer restrictions set in Google Cloud Console. Consider restricting the key to only the Places API.

**Google Sign-In token stored unencrypted in `sessionStorage`:**
- Risk: `LearningPlan.tsx` persists the raw Google ID token (a JWT) to `sessionStorage` (lines 218–219). `sessionStorage` is accessible to any JS executing in the same tab, including injected scripts from browser extensions or XSS.
- Files: `src/LearningPlan.tsx` (lines 218–219)
- Current mitigation: `sessionStorage` is tab-scoped and cleared on tab close; the token is passed as a `Bearer` header for every API call.
- Recommendations: Avoid persisting raw tokens; instead rely on the Google Identity Services one-tap flow to re-authenticate silently on load, removing the need to persist the token at all.

**`/architecture` route is publicly accessible with no auth gate:**
- Risk: The `/architecture` page exposes detailed internal system topology, service names, Azure resource naming conventions, API endpoint patterns, CI/CD pipeline structure, and deploy metadata — all without authentication.
- Files: `src/Architecture.tsx`, `src/index.js` (line 34)
- Current mitigation: The page is not linked from the navigation bar (`src/components/nav-bar.tsx`) or home page (`src/App.tsx`), providing security by obscurity.
- Recommendations: Either add MSAL authentication gating (same pattern as `/dashboard`) or explicitly accept the risk and document it.

---

## Performance Bottlenecks

**MomentumFinder polls on every 30-second tick regardless of page visibility:**
- Problem: The `setInterval(fetchGames, 30_000)` in `MomentumFinder.tsx` continues firing even when the browser tab is in the background.
- Files: `src/MomentumFinder.tsx` (lines 68–69)
- Cause: No `document.visibilityState` check before fetching.
- Improvement path: Wrap the fetch in `if (document.visibilityState === 'visible')` or use the Page Visibility API to pause/resume the interval.

**Dashboard polls every 60 seconds and re-renders full data tree:**
- Problem: `Dashboard.tsx` replaces the entire `data` state object on every poll (line 163), causing all child components to re-render even when nothing changed.
- Files: `src/Dashboard.tsx` (lines 289–294)
- Cause: No memoisation or differential update logic.
- Improvement path: Wrap stable sub-sections in `React.memo` or use `useMemo` to derive display values from `data`.

**Ideas bot-status polling fetches the full ideas list every 10 seconds:**
- Problem: While any idea has `bot_status === 'queued' | 'running'`, `Ideas.tsx` polls `/api/ideas` (the full list endpoint) every 10 seconds to detect status changes.
- Files: `src/Ideas.tsx` (lines 697–716)
- Cause: No dedicated status endpoint; full list refresh used as a proxy.
- Improvement path: Add a `GET /api/ideas/{id}` single-idea endpoint and poll only that, or use a `GET /api/ideas?bot_pending=true` filtered endpoint.

---

## Fragile Areas

**`Digits.tsx` — multi-step async hint animation via chained `useEffect` + state transitions:**
- Files: `src/Digits.tsx` (lines 211–248)
- Why fragile: The hint system advances through `step: 'number1' → 'sign' → 'number2'` by writing to `pendingMove` state and reacting in three separate `useEffect` hooks. Each step fires `selectNumber`/`selectSign` which themselves call `setNumbersList`/`setSigns`. Any state update that rerenders between steps can cause the effects to fire out of order or with stale captures.
- Safe modification: Always set `isAnimating.current = true` before starting a hint sequence and reset it only after step 'number2' completes. Avoid adding new state writes inside the three pendingMove effects.
- Test coverage: No tests exist for this interaction path.

**`LearningPlan.tsx` — custom markdown renderer with `dangerouslySetInnerHTML`:**
- Files: `src/LearningPlan.tsx` (lines 34–96)
- Why fragile: The `renderMarkdown` function is a hand-rolled line parser. It handles `##`, `###`, bullet lists, ordered lists, and inline `**bold**`/`*italic*`/`` `code` `` but nothing else (no tables, no block quotes, no nested lists). If the AI starts producing markdown the parser doesn't handle, it silently falls back to rendering the raw markdown text inside `<p>` tags.
- Safe modification: Test any change against actual AI-generated plan output. Consider replacing with `react-markdown`.
- Test coverage: None.

**`Dashboard.tsx` — 13 independent loading/error state variables:**
- Files: `src/Dashboard.tsx` (lines 122–141)
- Why fragile: The component manages `loading`, `error`, `discoverLoading`, `discoverError`, `registerLoading`, `registerError`, `editLoading`, `editSaving`, `editError` and more as individual `useState` calls. Adding new operations requires carefully tracking which loading/error pair belongs to which action.
- Safe modification: Introduce a `useReducer` or extract sub-features (discover, register, edit) into custom hooks before adding new dashboard operations.
- Test coverage: None.

**`Ideas.tsx` — many empty `catch {}` blocks silently discard errors:**
- Files: `src/Ideas.tsx` (lines 329, 356, 372, 711)
- Why fragile: Several async operations (`loadUpdates`, `handlePost`, `handleDeleteUpdate`, and bot poll) swallow all errors with empty catch blocks. Failures are invisible to the user and developer.
- Safe modification: At minimum log to `console.error` or surface via the existing `setError` state to aid debugging.
- Test coverage: None.

---

## Scaling Limits

**Static JSON files for architecture data grow unboundedly:**
- Current capacity: `src/architecture-history/` contains snapshots from each backend deploy commit. At roughly 3–5 deployments per service per month, the number of JSON files in `src/architecture-history/` compounds rapidly.
- Limit: All JSON is bundled into the React build artefact. A few hundred snapshot files would meaningfully increase the build output size.
- Scaling path: Prune history files older than N days or cap the number of snapshots kept per service. Alternatively, move historical data to an API endpoint and lazy-load it.

---

## Dependencies at Risk

**`react-scripts` (Create React App) is effectively unmaintained:**
- Risk: CRA has not had a significant release since 2022 and the underlying project is considered deprecated by the React team. `react-scripts@5.0.1` bundles Webpack 5, Babel, and ESLint versions that are increasingly out of date.
- Impact: No upgrade path for bundler features; accumulating transitive CVEs; incompatible with React 19 features (React compiler, server components).
- Migration plan: Migrate to Vite (`npm create vite@latest`) which is the current React ecosystem standard. The migration is mechanical but requires replacing CRA's `process.env.REACT_APP_*` convention with Vite's `import.meta.env.VITE_*`.

**`@testing-library/react` at v13, latest is v16:**
- Risk: Three major versions behind. v13 targets React 18 but lacks the concurrent-mode testing improvements in v14+.
- Impact: Upgrade is non-trivial alongside a Vite migration.
- Migration plan: Upgrade as part of the CRA → Vite migration.

**Multiple unused dependencies (`@auth0/auth0-react`, `@aws-sdk/client-secrets-manager`):**
- Risk: Both packages are stale (Auth0 SDK is 14 minor versions behind at 2.3.0 vs 2.17.0; AWS SDK is 1000+ patch versions behind). They contribute transitive dependencies with potential CVEs despite never being used.
- Impact: Attack surface via unused code in the bundle.
- Migration plan: Remove immediately (see Tech Debt section above).

---

## Missing Critical Features

**No error boundary anywhere in the component tree:**
- Problem: If any component throws during render (e.g. malformed API response, null dereference), React will unmount the entire application and display a blank screen with no user-facing message.
- Blocks: User recovery, graceful degradation.
- Files to add: A top-level `ErrorBoundary` component wrapping `<RouterProvider>` in `src/index.js`.

**No loading skeleton or route-level code splitting:**
- Problem: All routes are imported eagerly in `src/index.js`. The full bundle (including `@xyflow/react` graph library used only on `/architecture`, and `@fireworks-js/react` used only on the Digits win screen) is loaded on every page visit.
- Blocks: Performance on initial load, especially on mobile.
- Files: `src/index.js`
- Fix approach: Replace eager imports with `React.lazy()` and wrap routes in `<Suspense>`.

---

## Test Coverage Gaps

**Zero component or integration tests exist:**
- What's not tested: Every route component (`App.tsx`, `Digits.tsx`, `MomentumFinder.tsx`, `Dashboard.tsx`, `Ideas.tsx`, `TrailFinder.tsx`, `LearningPlan.tsx`, `Architecture.tsx`), all sub-components, all utility functions (`applyOperation`, `helpMe`, `renderMarkdown`, `applyInline`, `relTime`, `cardRot`), and all API interaction flows.
- Files: `src/setupTests.js` exists (testing library configured) but there are no `*.test.*` or `*.spec.*` files anywhere in `src/`.
- Risk: Any refactor or API shape change can break production silently. The hint animation logic in `Digits.tsx` and markdown renderer in `LearningPlan.tsx` are especially risky to modify without tests.
- Priority: High — `applyOperation` (core game logic), `renderMarkdown` (XSS-adjacent), and `getToken`/auth flows are the highest-value first targets.

---

*Concerns audit: 2026-05-30*
