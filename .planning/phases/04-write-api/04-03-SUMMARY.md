---
phase: 04-write-api
plan: 03
subsystem: infra
tags: [azure, bicep, easy-auth, azure-ad, function-app, auth]

# Dependency graph
requires:
  - phase: 04-01
    provides: create_post handler with require_auth() that reads X-MS-CLIENT-PRINCIPAL
  - phase: 04-02
    provides: update_post + delete_post handlers with require_auth()
provides:
  - Azure App Service Easy Auth (authsettingsV2) on posts-api Function App
  - requireAuthentication: false + AllowAnonymous so GET /api/posts remains public
  - X-MS-CLIENT-PRINCIPAL header injected for authenticated requests to write endpoints
  - POSTS_CLIENT_SECRET app setting wiring from postsApiClientSecret Bicep param
affects:
  - 05-editor-ui (MSAL token acquisition scope matches postsApiClientId audience)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bicep authsettingsV2 child resource pattern: parent: functionApp, requireAuthentication: false + AllowAnonymous for mixed public/protected route sets"
    - "@secure() param for client secret — ARM never logs secure param values; stored as encrypted app setting"

key-files:
  created: []
  modified:
    - C:\Users\Sriram\azure-infrastructure\modules\postsapi.bicep
    - C:\Users\Sriram\azure-infrastructure\main.bicep

key-decisions:
  - "requireAuthentication: false + AllowAnonymous (not true + Return401) — keeps GET /api/posts public while injecting X-MS-CLIENT-PRINCIPAL for authenticated write requests"
  - "POSTS_CLIENT_SECRET stored as @secure() Bicep param, surfaced as encrypted Function App app setting — not in source code"
  - "Separate App Registration per API (posts-api vs ideas-api) — audience validation in allowedAudiences prevents cross-service token acceptance"

patterns-established:
  - "Easy Auth for mixed-auth APIs: use requireAuthentication: false + AllowAnonymous at the platform level; individual handlers call require_auth() for write routes"

requirements-completed: [SEC-02]

# Metrics
duration: checkpoint-gated (human deploy + verification)
completed: 2026-06-05
---

# Phase 4 Plan 03: Easy Auth Infrastructure Summary

**Azure App Service Easy Auth deployed on posts-api via Bicep authsettingsV2, with requireAuthentication: false + AllowAnonymous keeping GET public while POST/PUT/DELETE return 401 without a Bearer token**

## Performance

- **Duration:** checkpoint-gated (Tasks 1-2 automated; deploy + verify required human action)
- **Started:** 2026-06-05
- **Completed:** 2026-06-05
- **Tasks:** 2 automated + 1 human-verify checkpoint
- **Files modified:** 2 (postsapi.bicep, main.bicep in azure-infrastructure repo)

## Accomplishments

- Added authsettingsV2 child resource to postsapi.bicep with requireAuthentication: false + AllowAnonymous — platform injects X-MS-CLIENT-PRINCIPAL for authenticated requests without blocking public GETs
- Added three new params (azureTenantId, postsApiClientId, @secure() postsApiClientSecret) to postsapi.bicep and wired them through main.bicep
- Added POSTS_CLIENT_SECRET app setting in functionApp.siteConfig.appSettings, sourced from postsApiClientSecret param
- Deployed to my-website-prod-rg (centralus) and verified: GET /api/posts → 200, POST /api/posts with no auth → 401

## Task Commits

Each task was committed atomically in the azure-infrastructure repo:

1. **Task 1: Add Easy Auth params and authsettingsV2 to postsapi.bicep** - `0f58560` (feat)
2. **Task 2: Wire new postsapi params in main.bicep** - `f0f28d5` (feat)
3. **Task 3: Human-verify checkpoint** — deploy confirmed by human; GET 200 + POST 401 verified live

## Files Created/Modified

- `C:\Users\Sriram\azure-infrastructure\modules\postsapi.bicep` — Added 3 params (azureTenantId, postsApiClientId, @secure() postsApiClientSecret), POSTS_CLIENT_SECRET app setting, and authsettingsV2 resource
- `C:\Users\Sriram\azure-infrastructure\main.bicep` — Added postsApiClientId and postsApiClientSecret top-level params; wired all three Easy Auth params into postsAPI module call

## Decisions Made

- Used requireAuthentication: false + AllowAnonymous (not the ideas-api pattern of true + Return401) — this keeps GET /api/posts public for the reading UI while still injecting X-MS-CLIENT-PRINCIPAL for authenticated requests; write handlers enforce auth via require_auth()
- Kept POSTS_CLIENT_SECRET as an app setting sourced from an @secure() Bicep param so the secret never appears in source code or ARM logs
- Created a separate App Registration for posts-api (distinct from ideas-api) — the allowedAudiences validation in authsettingsV2 ensures ideas-api tokens cannot be replayed against posts-api

## Deviations from Plan

None — plan executed exactly as written. The Bicep additions matched the specified structure, both files built cleanly with az bicep build, and the live deploy confirmed all success criteria.

## Issues Encountered

None — the checkpoint was resolved after human completed the Azure App Registration setup and ran the Bicep deploy command scoped to my-website-prod-rg.

## User Setup Required

The following one-time setup was completed by the human before deployment:

- Azure Portal: Created App Registration named "posts-api" in Microsoft Entra ID
- Exposed an API scope (api://<clientId>) on the App Registration
- Created a client secret (24-month expiry); value stored as postsApiClientSecret deploy param
- azureTenantId reused from existing ideas-api tenant (same directory)
- Ran: `az deployment group create --resource-group my-website-prod-rg --template-file postsapi.bicep --parameters ...`

## Next Phase Readiness

- Easy Auth is live: X-MS-CLIENT-PRINCIPAL is now injected by the platform for authenticated requests to posts-api
- GET /api/posts remains fully public (200 with no token)
- POST/PUT/DELETE /api/posts correctly return 401 when no Bearer token is present
- Phase 5 (Editor UI) can proceed: MSAL must acquire tokens with scope `api://<postsApiClientId>/.default` and attach them as Bearer tokens to write requests

---
*Phase: 04-write-api*
*Completed: 2026-06-05*
