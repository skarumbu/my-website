# ADR: Running App — Deployment & Auth Decisions

**Date:** 2026-05-25
**Status:** Accepted
**Repos:** running-app · azure-infrastructure
**Supersedes (partially):** `2026-05-23-running-app.md` (updates auth and infrastructure sections)

---

## Context

During deployment of the running app, several decisions in the original ADR turned out to be unworkable in practice. This document records what was discovered, what was changed, and why.

---

## Decision 1: Google Identity Services instead of Azure SWA built-in auth

**Original plan:** Use Azure SWA built-in auth with Google as the provider, reading user identity from the `X-MS-CLIENT-PRINCIPAL` header injected by the SWA runtime.

**What happened:** The SWA built-in auth redirected users to a Microsoft login page rather than directly to Google, even after configuring a real Google OAuth client. Azure SWA's auth flow routes through Microsoft's identity broker regardless of the configured provider; it does not offer a direct Google sign-in button.

**Decision:** Replace SWA built-in auth entirely with [Google Identity Services (GIS)](https://developers.google.com/identity/gsi/web), the same pattern used by the `learning-plan` feature in `my-website`.

**Implementation:**
- The GIS client library (`accounts.google.com/gsi/client`) is loaded client-side and renders a native "Sign in with Google" button.
- On sign-in, GIS returns a Google ID token (JWT). The token is stored in `sessionStorage` under `run_google_token` and sent as `Authorization: Bearer {token}` on every API request.
- Session is restored on page load by reading the stored token and checking its expiry via `decodeJwtPayload`.
- The Python API verifies the token by calling `oauth2.googleapis.com/tokeninfo?id_token={token}` and checking the `aud` claim against `GOOGLE_CLIENT_ID`.
- `staticwebapp.config.json` was stripped to just the SPA navigation fallback — all Azure SWA auth configuration was removed.

**Consequences:**
- Google token expiry (~1 hour) means users are silently signed out after ~1 hour if they don't trigger a new sign-in. Acceptable for a personal app.
- No server-side session management — entirely stateless; no refresh token flow.
- `GOOGLE_CLIENT_ID` must be set both as an Azure App Setting (for API token verification) and baked into the React bundle at build time (`REACT_APP_GOOGLE_CLIENT_ID` via `.env.production`).
- The SWA origin (`https://polite-sea-04fd3f210.7.azurestaticapps.net`) must be listed under **Authorized JavaScript origins** in the Google Cloud Console OAuth client — not Authorized Redirect URIs (which are for server-side flows).

---

## Decision 2: Standalone Azure Functions app instead of SWA managed functions

**Original plan:** Deploy the Python API as SWA managed functions (`api_location: api` in the deploy action).

**What happened:** Azure SWA **Free tier managed functions only support JavaScript/TypeScript**. Python managed functions require the Standard tier. After upgrading to Standard tier, the functions still returned 404 — the SWA runtime silently failed to load the Python function app with no observable error, and the `/api/*` routes were never registered.

**Decision:** Provision a standalone Azure Functions app on a Consumption (Y1) plan and link it to the SWA as a user-provided backend.

**Implementation:**
- `azure-infrastructure/modules/runningapp.bicep` was updated to add:
  - Storage Account (Standard LRS) — required by Azure Functions runtime
  - App Service Plan (Y1 Dynamic, Linux, `reserved: true`)
  - Function App (`running-app-prod-api`, Python 3.11, `functionapp,linux` kind) with `DATABASE_URL` and `GOOGLE_CLIENT_ID` app settings
- The Function App name `running-app-prod-api` is deterministic (no `uniqueString` suffix) for predictable reference in CI/CD.
- The GitHub Actions workflow (`deploy.yml`) was updated to:
  - Set `skip_api_build: true` on the SWA deploy step (no managed functions)
  - Add `Azure/functions-action@v1` step to deploy the `api/` folder to `running-app-prod-api`
  - Use `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` GitHub secret (publish profile downloaded from Azure after Bicep deploy)

**SWA routing:** The SWA `userProvidedFunctionApps` Bicep resource links the Function App to the SWA at the parent resource level. However, the SWA build environment requires the link at the build/environment level, which must be done via the REST API after first deploy. Because this is fiddly and brittle, the frontend was updated to call the Function App URL directly (`https://running-app-prod-api.azurewebsites.net`) rather than relying on the SWA proxy.

**CORS:** The Function App is configured to allow requests from the SWA origin only.

**Consequences:**
- Additional cost: ~$1/month for Storage Account; Function App itself is ~$0 on Consumption plan at personal-use traffic levels.
- SWA Standard tier: ~$9/month (required for user-provided function apps feature and was attempted for Python managed functions).
- The frontend uses `REACT_APP_API_URL=https://running-app-prod-api.azurewebsites.net` (baked in via `.env.production`) so all `apiFetch` calls go directly to the Function App. This is simpler than the SWA proxy approach.
- Deployment requires two secrets: `AZURE_STATIC_WEB_APPS_API_TOKEN` (frontend) and `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` (API).

---

## Decision 3: pgcrypto extension removed

`api/schema.sql` originally included `CREATE EXTENSION IF NOT EXISTS "pgcrypto"` for UUID generation. Azure Database for PostgreSQL Flexible Server does not allow-list pgcrypto. It was removed because PostgreSQL 16 provides `gen_random_uuid()` as a built-in function with no extension required.

---

## Alternatives Considered

| Alternative | Reason rejected |
|---|---|
| Keep Azure SWA built-in auth, fix Google redirect | Azure's auth broker always routes through Microsoft identity; no way to get a direct Google button without SWA built-in auth customisation that isn't supported |
| Add a `/login` redirect in Azure auth config | Still goes through Microsoft broker; users saw a Microsoft account page |
| Python managed functions on SWA Standard tier | Tried — functions silently fail to register; no useful error surfaced; root cause unknown |
| Rewrite API in TypeScript for SWA managed functions | Would have worked but discards working Python code; higher ongoing maintenance cost |
| Azure API Management as proxy | Over-engineered for a personal app |

---

## Relevant Files

| File | Change |
|---|---|
| `running-app/src/AuthContext.tsx` | Full rewrite: GIS auth, token storage, `apiFetch` helper |
| `running-app/src/Layout.tsx` | Replaced login button with GIS-rendered `div` via `googleBtnRef` |
| `running-app/staticwebapp.config.json` | Stripped to SPA fallback only |
| `running-app/api/function_app.py` | `require_auth()` rewritten to verify Google Bearer JWT via tokeninfo |
| `running-app/.env.production` | `REACT_APP_GOOGLE_CLIENT_ID` and `REACT_APP_API_URL` |
| `running-app/.github/workflows/deploy.yml` | Added Functions deploy step; `skip_api_build: true` on SWA step |
| `azure-infrastructure/modules/runningapp.bicep` | Added Storage Account, Consumption Plan, Function App, linked backend |
