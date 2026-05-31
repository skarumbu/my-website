---
phase: 01-storage-schema
plan: 03
status: complete
subsystem: azure-infrastructure-bicep
tags: [bicep, azure, storage, rbac, github]
key-files:
  created:
    - C:/Users/Sriram/azure-infrastructure/modules/postsapi.bicep
  modified:
    - C:/Users/Sriram/azure-infrastructure/main.bicep
commits:
  - repo: azure-infrastructure
    hash: c2cedd3
    message: "feat(01-03): add postsapi.bicep — private blob container + RBAC"
  - repo: azure-infrastructure
    hash: 7bc4970
    message: "feat(01-03): wire postsAPI module into main.bicep"
deviations: []
---

## What Was Built

`postsapi.bicep` Bicep module provisions the full Azure infrastructure for the posts storage pipeline:

- **Storage account** `postsapihwbxtkz6lsfoq` — StandardLRS/StorageV2 with `allowBlobPublicAccess: false`, `minimumTlsVersion: TLS1_2`, `supportsHttpsTrafficOnly: true`
- **Blob container** `posts` with `publicAccess: 'None'` (verified: `az storage container show` returns null)
- **Function App** `posts-api-prod-hwbxtkz6lsfoq` with SystemAssigned managed identity, Python 3.11, `httpsOnly: true`
- **RBAC role assignment** — Storage Blob Data Contributor (`ba92f5b4-2d11-453d-a403-e96b0029c9fe`) scoped to storage account, principal = Function App managed identity
- **App settings** include `POSTS_STORAGE_CONNECTION_STRING` and `POSTS_CONTAINER_NAME: posts`

`main.bicep` updated with `module postsAPI 'modules/postsapi.bicep'` block and `postsAPIUrl` / `postsAPIAppName` outputs. `deploy.sh` unchanged (no new secret params).

**GitHub repo** `skarumbu/posts-api` (private) created and pushed. `POSTS_API_APP_NAME` secret set to `posts-api-prod-hwbxtkz6lsfoq`.

## Verification

- `az bicep build` passes for both `postsapi.bicep` and `main.bicep`
- RBAC role ID `ba92f5b4-2d11-453d-a403-e96b0029c9fe` confirmed via `az role definition list` — matches postsapi.bicep
- Container `posts` public access: `null` (private) — confirmed via `az storage container show`
- azure-infrastructure pushed to GitHub (origin/master) — CI/CD deployment triggered

## Self-Check: PASSED
