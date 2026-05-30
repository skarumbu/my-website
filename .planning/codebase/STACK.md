# Technology Stack

**Analysis Date:** 2026-05-30

## Languages

**Primary:**
- TypeScript/TSX — all feature pages and components (`src/*.tsx`, `src/components/**/*.tsx`)
- JavaScript/JSX — entry point and auth config (`src/index.js`, `src/authConfig.js`)

**Secondary:**
- CSS — styling per view and per component (`src/styling/*.css`, `src/Row.css`)

## Runtime

**Environment:**
- Node.js (LTS) — CRA dev server and build toolchain

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present, committed)

## Frameworks

**Core:**
- React 18.2.0 — SPA rendering, all UI (`src/index.js` bootstraps via `ReactDOM.createRoot`)
- react-router-dom 6.22.1 — client-side routing; routes declared in `src/index.js`

**Build/Dev:**
- react-scripts 5.0.1 (Create React App) — webpack bundling, dev server, test runner
  - Dev server start: `WATCHPACK_POLLING=true react-scripts start` (Windows compatibility flag)
  - Production build output: `/build`

**Testing:**
- @testing-library/react 13.4.0 — component rendering
- @testing-library/jest-dom 5.17.0 — DOM matchers
- @testing-library/user-event 13.5.0 — user interaction simulation
- Jest (bundled in react-scripts)

## Key Dependencies

**UI & Animation:**
- framer-motion 11.11.8 — motion/animation primitives (imported but available)
- @fireworks-js/react 2.10.8 — win celebration effect (`src/components/FireworksComponent.tsx`)
- react-spinners 0.14.1 — loading spinner (`src/components/Spinner.tsx`)
- @xyflow/react 12.10.2 — node-graph rendering (`src/architecture/ArchDiagram.tsx`)

**HTTP:**
- axios 1.7.2 — used in `src/Digits.tsx` for the production API fetch
- Native `fetch` — used in `src/MomentumFinder.tsx`, `src/Dashboard.tsx`, `src/TrailFinder.tsx`, `src/Ideas.tsx`, `src/LearningPlan.tsx`

**Authentication:**
- @azure/msal-browser 5.7.0 — MSAL core; initialized in `src/index.js`
- @azure/msal-react 5.3.0 — React hooks (`useMsal`, `useIsAuthenticated`); wraps the whole app via `<MsalProvider>`
- @auth0/auth0-react 2.2.2 — installed but not actively used in any route
- @aws-sdk/client-secrets-manager 3.441.0 — installed but not invoked in frontend code

**Mobile:**
- react-native-web 0.19.9 — installed (likely a leftover dependency; not actively referenced in source)

**Monitoring:**
- web-vitals 2.2.4 — `reportWebVitals()` called from `src/index.js`

## Configuration

**Environment variables (all `REACT_APP_` prefixed, baked in at build time):**
- `REACT_APP_API_BASE_URL` — MomentumFinder backend base URL
- `REACT_APP_TRAIL_FINDER_API_BASE_URL` — TrailFinder backend base URL
- `REACT_APP_GOOGLE_MAPS_API_KEY` — Google Maps JS API key (TrailFinder autocomplete)
- `REACT_APP_DASHBOARD_API_BASE_URL` — Dashboard backend base URL
- `REACT_APP_AZURE_CLIENT_ID` — MSAL app client ID (Dashboard + Ideas auth)
- `REACT_APP_AZURE_TENANT_ID` — Azure AD tenant (MSAL authority URL)
- `REACT_APP_IDEAS_API_BASE_URL` — Ideas backend base URL
- `REACT_APP_LEARNING_PLAN_API_BASE_URL` — LearningPlan backend base URL
- `REACT_APP_GOOGLE_CLIENT_ID` — Google Identity Services client ID (LearningPlan auth)

**Build:**
- `eslint.config.mjs` — flat ESLint config (TypeScript ESLint + React plugin)
- `public/staticwebapp.config.json` — Azure SWA navigation fallback to `index.html`
- `.github/workflows/azure-static-web-apps.yml` — CI/CD, injects all env vars from GitHub secrets

**Note:** No `tsconfig.json` found at repo root — TypeScript transpilation is handled entirely by react-scripts (CRA default tsconfig).

## Platform Requirements

**Development:**
- Node.js LTS
- `WATCHPACK_POLLING=true` required on Windows for hot reload (`npm start`)
- No backend setup needed locally — `Digits.tsx` stubs API data when `NODE_ENV === 'development'`; other features degrade gracefully when env vars are absent

**Production:**
- Azure Static Web Apps (auto-deploy from `main` branch via GitHub Actions)
- All `REACT_APP_*` secrets stored as GitHub repository secrets, injected during CI build

---

*Stack analysis: 2026-05-30*
