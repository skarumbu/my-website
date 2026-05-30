# External Integrations

**Analysis Date:** 2026-05-30

## APIs & External Services

**Digits Puzzle API (Azure Functions):**
- Service: Custom Azure Function App
- Endpoint: `https://digits-api-prod-hwbxtkz6lsfoq.azurewebsites.net/api/DigitsGetter`
- Used in: `src/Digits.tsx`
- Auth: None (public endpoint, GET request)
- Client: `axios` (`axios.request`)
- Fallback: Hardcoded stub data used in `development` mode — no real requests made locally

**NBA Games / MomentumFinder API:**
- Service: Custom backend (URL configurable)
- Endpoint: `${REACT_APP_API_BASE_URL}/get-current-games`
- Used in: `src/MomentumFinder.tsx`
- Auth: None
- Client: Native `fetch`
- Polling: Every 30 seconds (`POLL_INTERVAL_MS = 30_000`)

**Dashboard API (Azure Functions, authenticated):**
- Service: Custom Azure Function App
- Endpoints:
  - `${REACT_APP_DASHBOARD_API_BASE_URL}/api/DashboardGetter` — health, metrics, errors, costs, GitHub Actions
  - `${REACT_APP_DASHBOARD_API_BASE_URL}/api/discover` — Azure resource discovery
  - `${REACT_APP_DASHBOARD_API_BASE_URL}/api/apps` — app registration CRUD
- Used in: `src/Dashboard.tsx`
- Auth: Azure AD Bearer token acquired via MSAL (`dashboardApiRequest` scopes)
- Client: Native `fetch` with `Authorization: Bearer <token>` header
- Polling: Every 60 seconds

**Ideas API (Azure Functions, authenticated):**
- Service: Custom Azure Function App
- Base URL: `REACT_APP_IDEAS_API_BASE_URL`
- Endpoints:
  - `GET /api/ideas` — list all ideas
  - `POST /api/ideas` — create idea
  - `PATCH /api/ideas/:id` — update idea (status, fields)
  - `DELETE /api/ideas/:id` — delete idea
  - `GET /api/ideas/:id/updates` — list updates for an idea
  - `POST /api/ideas/:id/updates` — post an update
  - `DELETE /api/ideas/:id/updates/:updateId` — delete an update
  - `POST /api/ideas/:id/run-bot` — trigger AI bot to implement the idea
  - `GET /api/projects` — list projects
  - `POST /api/projects` — create project
- Used in: `src/Ideas.tsx`
- Auth: Azure AD Bearer token via MSAL (`ideasApiRequest` scopes, fixed client ID `e70038a1-6f98-4008-b10a-a5926ec6a861`)
- Client: Native `fetch`
- Bot polling: Every 10 seconds while any idea has `bot_status === 'queued'` or `'running'`

**TrailFinder API:**
- Service: Custom backend (URL configurable)
- Endpoint: `${REACT_APP_TRAIL_FINDER_API_BASE_URL}/get-trail-recommendations?location=<encoded>`
- Used in: `src/TrailFinder.tsx`
- Auth: None
- Client: Native `fetch`

**LearningPlan API (authenticated):**
- Service: Custom backend (URL configurable)
- Base URL: `REACT_APP_LEARNING_PLAN_API_BASE_URL`
- Endpoints:
  - `GET /api/plans` — list user plans
  - `POST /api/plans` — save a plan
  - `GET /api/plans/:id` — fetch full plan
  - `DELETE /api/plans/:id` — delete plan
  - `POST /api/plans/generate` — generate an AI learning plan
- Used in: `src/LearningPlan.tsx`
- Auth: Google Identity Services JWT (passed as Bearer token)
- Client: Native `fetch`

## Data Storage

**Databases:**
- None in the frontend — all persistence is handled by the backend APIs above

**File Storage:**
- Not applicable to frontend

**Caching:**
- Browser sessionStorage — used for:
  - MSAL token caching (`cacheLocation: 'sessionStorage'` in `src/authConfig.js`)
  - LearningPlan Google JWT token (`lp_google_token` key in `src/LearningPlan.tsx`)

## Authentication & Identity

**Microsoft Entra ID (Azure AD) — MSAL:**
- SDK: `@azure/msal-browser` + `@azure/msal-react`
- Config: `src/authConfig.js`
  - Client ID: `process.env.REACT_APP_AZURE_CLIENT_ID`
  - Authority: `https://login.microsoftonline.com/${REACT_APP_AZURE_TENANT_ID}`
  - Redirect URI: `window.location.origin + "/dashboard"`
  - Token cache: `sessionStorage`
- Scopes defined:
  - `dashboardApiRequest` — `api://<AZURE_CLIENT_ID>/access_as_user` (Dashboard)
  - `ideasApiRequest` — `api://e70038a1-6f98-4008-b10a-a5926ec6a861/access_as_user` (Ideas, hardcoded)
- Used by: `src/Dashboard.tsx`, `src/Ideas.tsx`
- Flow: Silent token acquisition with redirect fallback (`acquireTokenSilent` → `acquireTokenRedirect`)
- App entry: `<MsalProvider instance={msalInstance}>` wraps entire app in `src/index.js`

**Google Identity Services (One Tap / GIS):**
- Script: `https://accounts.google.com/gsi/client` (loaded dynamically)
- Client ID: `process.env.REACT_APP_GOOGLE_CLIENT_ID`
- Used by: `src/LearningPlan.tsx`
- Flow: One-tap sign-in renders a button into `googleBtnRef`; credential JWT decoded client-side and stored in sessionStorage
- Token verification: Client-side only (JWT expiry check via `decodeJwtPayload`); server-side verification expected on the backend

**Auth0:**
- SDK: `@auth0/auth0-react` installed but not wired to any route or component

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, or similar)

**Logs:**
- `console.log` / `console.error` used in catch blocks (e.g., `src/Digits.tsx`)
- `web-vitals` — `reportWebVitals()` called in `src/index.js`; metrics not forwarded to any analytics endpoint in the frontend code

## CI/CD & Deployment

**Hosting:**
- Azure Static Web Apps
- SPA routing handled by `public/staticwebapp.config.json` (navigation fallback → `index.html`)

**CI Pipeline:**
- GitHub Actions: `.github/workflows/azure-static-web-apps.yml`
- Trigger: push to `main` or PR targeting `main`
- Action: `Azure/static-web-apps-deploy@v1`
- Secrets injected at build time: all `REACT_APP_*` vars from GitHub repository secrets
- `CI=false` set to prevent ESLint warnings from failing the build

## Environment Configuration

**Required env vars (all set as GitHub Secrets, injected at build):**
- `REACT_APP_API_BASE_URL` — MomentumFinder API
- `REACT_APP_TRAIL_FINDER_API_BASE_URL` — TrailFinder API
- `REACT_APP_GOOGLE_MAPS_API_KEY` — Google Maps Places autocomplete
- `REACT_APP_DASHBOARD_API_BASE_URL` — Dashboard API
- `REACT_APP_AZURE_CLIENT_ID` — MSAL app registration
- `REACT_APP_AZURE_TENANT_ID` — Azure AD tenant
- `REACT_APP_IDEAS_API_BASE_URL` — Ideas API
- `REACT_APP_LEARNING_PLAN_API_BASE_URL` — LearningPlan API
- `REACT_APP_GOOGLE_CLIENT_ID` — Google Identity Services

**Secrets location:** GitHub repository secrets (not committed). No `.env` file present in repo.

## Webhooks & Callbacks

**Incoming:**
- None — the SPA does not expose any webhook endpoints

**Outgoing:**
- GitHub Actions workflow status is consumed by the Dashboard at runtime (via `REACT_APP_DASHBOARD_API_BASE_URL`, not a direct GitHub API call from the frontend)

## External Script Loads (Runtime)

**Google Maps JavaScript API:**
- Loaded dynamically in `src/TrailFinder.tsx` when `REACT_APP_GOOGLE_MAPS_API_KEY` is set
- Script: `https://maps.googleapis.com/maps/api/js?key=<key>&libraries=places`
- Used for: city autocomplete via `google.maps.places.AutocompleteService`

**Google Identity Services:**
- Loaded dynamically in `src/LearningPlan.tsx` when auth state is `unauthenticated`
- Script: `https://accounts.google.com/gsi/client`

---

*Integration audit: 2026-05-30*
