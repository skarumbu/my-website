<!-- refreshed: 2026-05-30 -->
# Architecture

**Analysis Date:** 2026-05-30

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         User Browser                                     │
│                    (React SPA via Azure SWA)                             │
└────────────────────────────┬────────────────────────────────────────────┘
                             │  client-side routing (react-router-dom v6)
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Route Layer  `src/index.js`                       │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬───────┤
│  App.tsx │Digits.tsx│Momentum  │TrailFinder│Dashboard │ Ideas.tsx│Learning│
│    /     │ /digits  │Finder.tsx│   .tsx   │  .tsx    │  /ideas  │Plan.tsx│
│          │          │/momentum │/trail-   │/dashboard│          │/learn- │
│          │          │-finder   │finder    │          │          │ing-plan│
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴───────┘
         │                  │           │          │          │
         │ (no API)    Azure Fn     Container  Azure Fn   Azure Fn
         │             digits API   Apps API   dashboard  ideas-api
         ▼                  ▼           ▼       -api       + ideas-bot
┌─────────────────────────────────────────────────────────────────────────┐
│                     External Backend Services                            │
│  digits-api-prod-hwbxtkz6lsfoq.azurewebsites.net (Azure Functions)      │
│  REACT_APP_API_BASE_URL/get-current-games   (Azure Container App)        │
│  REACT_APP_TRAIL_FINDER_API_BASE_URL        (Azure Container App)        │
│  REACT_APP_DASHBOARD_API_BASE_URL           (Azure Functions)            │
│  REACT_APP_IDEAS_API_BASE_URL               (Azure Functions)            │
│  REACT_APP_LEARNING_PLAN_API_BASE_URL       (Azure Functions)            │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Router + MSAL bootstrap | App entry — initializes MSAL, defines all routes, mounts RouterProvider | `src/index.js` |
| App (Home) | Landing page — navigation cards, no API calls | `src/App.tsx` |
| Digits | Math puzzle game — fetches puzzles, manages all game state locally | `src/Digits.tsx` |
| MomentumFinder | Live NBA scoreboard — polls backend every 30s, flashes score changes | `src/MomentumFinder.tsx` |
| TrailFinder | Trail search — Google Maps autocomplete + backend trail results | `src/TrailFinder.tsx` |
| Dashboard | Ops dashboard — MSAL-auth-gated, polls backend every 60s | `src/Dashboard.tsx` |
| Ideas | Ideas board — MSAL-auth-gated, CRUD + bot-trigger via ideas-api | `src/Ideas.tsx` |
| LearningPlan | AI learning plans — Google OAuth auth, create/view plans | `src/LearningPlan.tsx` |
| Architecture | System architecture reference page — internal, not in nav | `src/Architecture.tsx` |
| NavBar | Shared navigation bar used by most pages | `src/components/nav-bar.tsx` |
| DigitsNavBar | Digits-specific branded nav bar | `src/components/DigitsNavBar.tsx` |
| ArchDiagram | Interactive ReactFlow graph of system architecture | `src/architecture/ArchDiagram.tsx` |
| PackageDetail | Drilldown panel for individual packages in Architecture view | `src/architecture/PackageDetail.tsx` |
| DigitCircle | Candy-colored interactive number button (Digits game) | `src/components/buttons/DigitCircle.tsx` |
| RetryCircle | Animated retry/reset button (Digits game) | `src/components/buttons/RetryCircle.tsx` |
| SignCircle | Operator button (+, -, ×, ÷) for Digits game | `src/components/SignCircle.tsx` |
| TargetDisplay | Displays target number in Digits game | `src/components/TargetDisplay.tsx` |
| FireworksComponent | Full-screen fireworks animation (Digits win state) | `src/components/FireworksComponent.tsx` |
| Spinner | Loading spinner (PulseLoader) | `src/components/Spinner.tsx` |

## Pattern Overview

**Overall:** Feature-per-file SPA (monolithic page components with co-located state)

**Key Characteristics:**
- Each route maps 1:1 to a single large `.tsx` file in `src/` — all data fetching, state, and rendering co-located
- No shared state management library (no Redux, no Zustand) — each page is fully isolated
- MSAL (`@azure/msal-react`) provides auth context at the root level (`src/index.js`) for auth-gated pages (Dashboard, Ideas, LearningPlan)
- Reusable UI pieces are pure presentational components in `src/components/`; they receive data via props and emit callbacks

## Layers

**Entry / Bootstrap Layer:**
- Purpose: Initialize MSAL, define routes, mount React root
- Location: `src/index.js`
- Contains: Router config, MSAL instance creation and initialization
- Depends on: All page components, `authConfig.js`
- Used by: Browser (single entry point)

**Page / Route Layer:**
- Purpose: Own all feature logic — data fetching, state, and rendering
- Location: `src/*.tsx` (App, Digits, MomentumFinder, TrailFinder, Dashboard, Ideas, LearningPlan, Architecture)
- Contains: `useEffect` for API calls, `useState` for all local state, full JSX render
- Depends on: `src/components/`, `src/styling/`, external APIs
- Used by: React Router (each page is a router element)

**Component Layer:**
- Purpose: Reusable presentational UI elements
- Location: `src/components/` and `src/components/buttons/`
- Contains: Pure functional components accepting props; no direct API calls
- Depends on: `src/styling/`, `src/images/`
- Used by: Page components

**Architecture Visualization Sub-Layer:**
- Purpose: Interactive system diagram and package detail view for `/architecture`
- Location: `src/architecture/`
- Contains: ReactFlow graph data (`arch-graph-data.ts`), `ArchDiagram.tsx`, `ServiceNode.tsx`, `ServicePanel.tsx`, `PackageDetail.tsx`
- Depends on: `@xyflow/react`, JSON data files (`architecture-content.json`, `architecture-metadata.json`, `architecture-history-index.json`)
- Used by: `src/Architecture.tsx`

**Static Data Layer:**
- Purpose: Build-time architecture metadata injected by CI from backend repos
- Location: `src/architecture-content.json`, `src/architecture-metadata.json`, `src/architecture-history-index.json`, `src/architecture-history/`
- Contains: AI-generated package summaries, last deploy SHAs, historical snapshots
- Depends on: Nothing (static JSON)
- Used by: `Architecture.tsx`, `PackageDetail.tsx`

**Auth Config Layer:**
- Purpose: Centralize MSAL config and OAuth scope definitions
- Location: `src/authConfig.js`
- Contains: `msalConfig`, `dashboardApiRequest`, `ideasApiRequest`
- Depends on: `REACT_APP_AZURE_CLIENT_ID`, `REACT_APP_AZURE_TENANT_ID` env vars
- Used by: `src/index.js`, `Dashboard.tsx`, `Ideas.tsx`

**Styling Layer:**
- Purpose: CSS scoped to pages and components
- Location: `src/styling/` (page-level CSS), alongside components (`src/Row.css`)
- Contains: One CSS file per major view/component
- Depends on: Nothing
- Used by: All page and component files

## Data Flow

### Digits Puzzle (development mode)

1. `Digits.tsx` mounts → `useEffect` triggers `fetchData()` (`src/Digits.tsx:46`)
2. `NODE_ENV === 'development'` check → hardcoded stub data set directly into state (`src/Digits.tsx:48-88`)
3. State update → re-render with puzzle grid rendered from `numbersList` state

### Digits Puzzle (production mode)

1. `Digits.tsx` mounts → `useEffect` triggers `fetchData()` (`src/Digits.tsx:46`)
2. `axios.get` to `https://digits-api-prod-hwbxtkz6lsfoq.azurewebsites.net/api/DigitsGetter` (`src/Digits.tsx:92-94`)
3. Response parsed: `goalList`, `solutionList`, `matrixList`, `difficultyList` extracted and sorted by difficulty (`src/Digits.tsx:101-133`)
4. State set → re-render with sorted puzzles

### MomentumFinder Polling Flow

1. `MomentumFinder.tsx` mounts → immediate `fetchGames()` then `setInterval` every 30s (`src/MomentumFinder.tsx:68-69`)
2. `fetch(${API_BASE_URL}/get-current-games)` → JSON parsed as `Game[]` (`src/MomentumFinder.tsx:37-39`)
3. Score diff detection vs `prevScoresRef` → flashing highlight for changed scores, cleared after 1s (`src/MomentumFinder.tsx:42-56`)
4. `setGames(data.games)` → re-render with game cards

### Dashboard Auth-Gated Flow

1. `Dashboard.tsx` mounts → `useIsAuthenticated()` check (`src/Dashboard.tsx:296`)
2. If not authenticated → renders login screen with `instance.loginRedirect()` button
3. If authenticated → `fetchData()` called, token acquired silently via `instance.acquireTokenSilent()` (`src/Dashboard.tsx:143-148`)
4. Bearer token attached to `fetch(DASHBOARD_URL)` → response populates `DashboardData` state
5. `setInterval(fetchData, 60_000)` keeps data fresh (`src/Dashboard.tsx:292`)

### Ideas Auth + Bot Flow

1. `Ideas.tsx` mounts → MSAL token acquired, `GET /api/ideas` and `GET /api/projects` fetched
2. User clicks "Assign Bot" → `POST /api/ideas/{id}/run-bot` via ideas-api
3. ideas-api triggers ideas-bot Container App Job externally (bot clones repo, runs GPT-4o loop, opens draft PR)

### TrailFinder Search Flow

1. `TrailFinder.tsx` mounts → `useEffect` dynamically loads Google Maps JS SDK (`src/TrailFinder.tsx:61-70`)
2. User types location → 300ms debounced `AutocompleteService.getPlacePredictions` call (browser-side)
3. User selects suggestion and submits → `fetch(${API_BASE_URL}/trails?location=...)` to trail-finder API
4. Response `Trail[]` rendered as cards with suitability/rating sort and condition tag filters

**State Management:**
- All state is component-local `useState` — no global store
- `useRef` used for animation guard (`isAnimating` in Digits) and previous score tracking (`prevScoresRef` in MomentumFinder)
- MSAL auth state flows down via `MsalProvider` context (root-level)

## Key Abstractions

**Page Component (monolithic feature module):**
- Purpose: Self-contained unit combining data fetching, business logic, and rendering
- Examples: `src/Digits.tsx`, `src/Dashboard.tsx`, `src/MomentumFinder.tsx`
- Pattern: Single `React.FC` with multiple `useState` + `useEffect` hooks, returns full page JSX

**Presentational Component:**
- Purpose: Reusable UI with no side effects; receives all data via props
- Examples: `src/components/buttons/DigitCircle.tsx`, `src/components/TargetDisplay.tsx`, `src/components/nav-bar.tsx`
- Pattern: `React.FC<Props>` accepting typed props, emitting typed callback props

**Auth-Gated Page:**
- Purpose: Pages that require MSAL login before showing content
- Examples: `src/Dashboard.tsx` (Azure AD), `src/Ideas.tsx` (Azure AD), `src/LearningPlan.tsx` (Google OAuth)
- Pattern: Check `useIsAuthenticated()` or local auth state at render top; render login prompt otherwise

**Architecture JSON Snapshot:**
- Purpose: Build-time-injected metadata from backend CI pipelines; read as static JSON at bundle time
- Examples: `src/architecture-metadata.json`, `src/architecture-content.json`
- Pattern: Imported directly as modules, typed with `as Record<string, T>` cast

## Entry Points

**Application Bootstrap:**
- Location: `src/index.js`
- Triggers: Browser loads `index.html` → CRA bootstraps → `msalInstance.initialize()` resolves → `ReactDOM.createRoot(...).render()`
- Responsibilities: MSAL init, route definitions, wrapping app with `MsalProvider` and `RouterProvider`

**SPA Deep Link Fallback:**
- Location: `public/staticwebapp.config.json`
- Triggers: Any navigation request on Azure SWA that doesn't match a static asset
- Responsibilities: Rewrites to `/index.html` so client-side router handles the path

**CI/CD Build:**
- Location: `.github/workflows/azure-static-web-apps.yml`
- Triggers: Push to `main` or PR opened/updated against `main`
- Responsibilities: `npm run build` with all `REACT_APP_*` secrets injected, deploy to Azure SWA via `Azure/static-web-apps-deploy@v1`

## Architectural Constraints

- **Threading:** Single-threaded browser JS — no Web Workers used
- **Global state:** `msalInstance` is a module-level singleton created in `src/index.js`; all other state is component-local
- **Circular imports:** None detected
- **Env vars at build time:** All `REACT_APP_*` values are baked into the bundle at `npm run build` — changing them requires a redeploy
- **API base URLs:** Each backend service has its own env var (`REACT_APP_API_BASE_URL`, `REACT_APP_TRAIL_FINDER_API_BASE_URL`, etc.); missing vars cause the page to show an error rather than crash silently in most cases
- **Development mode stub:** `Digits.tsx` uses `process.env.NODE_ENV === 'development'` to serve hardcoded data — no local backend needed for that feature

## Anti-Patterns

### Monolithic page components

**What happens:** All data-fetching, business logic, and rendering live in single large files (`Digits.tsx` is 441 lines, `Dashboard.tsx` is 683 lines)
**Why it's wrong:** Hard to test business logic in isolation; difficult to reuse data-fetching logic; renders must be traced through large files
**Do this instead:** Extract API calls into a `src/services/` or `src/hooks/` layer (e.g., `useDigitsPuzzles()` hook in `src/hooks/useDigitsPuzzles.ts`) and pass data down to sub-components

### Duplicate NavBar implementations

**What happens:** `src/components/nav-bar.tsx` and `src/components/DigitsNavBar.tsx` both render the same set of nav links with different styling
**Why it's wrong:** Nav link list must be kept in sync in two places; adding a new route requires editing both files
**Do this instead:** Maintain a single `NAV_LINKS` constant (as `DigitsNavBar.tsx` already does) and share it; have `NavBar` accept a `variant` prop or use the same data source

### Inline styles mixed with CSS classes

**What happens:** Throughout page components, layout concerns are split between CSS class files and inline `style={{}}` props (e.g., `Dashboard.tsx` lines 379, 449, 500+)
**Why it's wrong:** Styles are harder to find and override; breaks design token consistency
**Do this instead:** Define all styles in the corresponding CSS file in `src/styling/`; use BEM-style class names for variants

## Error Handling

**Strategy:** Optimistic render — show loading state, catch errors, set `error` string in state, render error message in UI.

**Patterns:**
- `try/catch` wrapping `fetch` / `axios.request` inside `useEffect` async functions
- Error stored as `string | null` in `useState`; shown via `<p className="...--error">Error: {error}</p>` pattern
- Missing env vars checked explicitly before fetch (e.g., `if (!API_BASE_URL) { setError('Missing ...'); return; }`)
- No global error boundary component is present

## Cross-Cutting Concerns

**Logging:** `console.log(error)` used in catch blocks (e.g., `Digits.tsx:135`); no structured logging or external error tracking
**Validation:** No client-side form validation library; validation done ad-hoc with disabled button states
**Authentication:** MSAL (`@azure/msal-react`) for Dashboard and Ideas (Azure AD); Google OAuth via `REACT_APP_GOOGLE_CLIENT_ID` for LearningPlan; no auth on Digits, MomentumFinder, TrailFinder, or Home

---

*Architecture analysis: 2026-05-30*
