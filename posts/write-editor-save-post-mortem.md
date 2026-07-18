---
author_email: karumbunathan@gmail.com
date: '2026-07-18T03:04:12.224426+00:00'
description: Four compounding failures that made "Save" silently break for weeks
published: true
slug: write-editor-save-post-mortem
title: Write Editor Save — Post-Mortem
updatedAt: '2026-07-18T03:04:12.224449+00:00'
---

Saving a post from the write editor was broken from the start. This documents what went wrong, why it was hard to find, and what we fixed.

## What the user saw

Click Save → prompted to sign in with Google → sign in → editor shows "Saving…" indefinitely. Or: sign in successfully → "Save failed. Your work is preserved locally — try again." No useful error detail either way.

## Root causes

### 1. Wrong Google client ID on the API

The frontend authenticates with Google using client ID. The posts-api verifies the token's `aud` claim against an allowlist in the `GOOGLE_CLIENT_ID` environment variable. That client ID was never added to the allowlist, so every save attempt returned 401.

**Fix:** Added the frontend client ID to `GOOGLE_CLIENT_ID` on the posts-api Function App.

### 2. UX showed "Saving…" forever after a 401

When a save returned 401, the editor cleared the token and prompted re-auth — correct. But the `autosaveStatus` state was set to `'Saving…'` at the start of `handleSave` and never reset in the 401 early-return path. After signing back in, the editor showed "Saving…" with no way to proceed.

**Fix:** Changed both 401 handlers in `handleSave` to call `setAutosaveStatus('Unsaved changes')` instead of leaving it as `'Saving…'`. Also added a `loadedSlugRef` guard to prevent the post body from being wiped on re-auth.

### 3. API rejected saves with no description

After fixing the client ID, saves still returned 400. The posts-api required both `title` and `description` to be non-empty. The editor sends an empty string for description when the user hasn't filled it in yet — a reasonable state for a draft. The API rejected it every time.

**Fix:** Made `description` optional. Only `title` is now required to save.

### 4. Errors were invisible on the dashboard

None of the above showed up in the dashboard error log because:

- All five Function Apps were missing `APPLICATIONINSIGHTS_CONNECTION_STRING`, so no telemetry was being shipped to Application Insights at all.
- The dashboard's error query targeted `AppExceptions`, but the logging middleware writes structured JSON to `AppTraces` via `logger.info()`.

Without observable errors, diagnosing the save failure required manually querying Log Analytics — and even then, only after connecting App Insights to the Function Apps first.

**Fix:** Connected all Function Apps to Application Insights and updated the KQL query to read from `AppTraces` with JSON content filtering.

## Why it took so long

The failures compounded in a way that made each one invisible:

1. The 401 was hidden by the "Saving…" UX freeze — the user just saw a stuck spinner, not an auth error.
2. The 400 only appeared after fixing the 401, so it looked like fixing the client ID hadn't worked.
3. The dashboard showed no errors throughout, so there was no signal that anything was failing at all until we manually queried the logs.

Each fix revealed the next problem. With working error logging from the start, the 401 and 400 would have been visible on the dashboard the first time anyone tried to save.

## What changed

- Frontend: `autosaveStatus` reset on 401; `loadedSlugRef` prevents post reload on re-auth
- posts-api: `GOOGLE_CLIENT_ID` includes all three OAuth client IDs; `description` no longer required
- Infrastructure: All Function Apps connected to Application Insights
- Dashboard: Error query reads from `AppTraces` with structured log filtering


## Options to move forward

### 1. Alert rule on error rate (recommended first)

Set up an Application Insights alert that fires when posts-api returns 4xx/5xx errors above a threshold. The dashboard now surfaces errors, but only if someone checks it — an alert closes that gap and would have flagged the 401s and 400s immediately rather than days later.

### 2. Post-deployment smoke test

A GitHub Actions step that runs after every posts-api deployment and makes a real authenticated save call. If it fails, the deploy is flagged before anyone hits it in the browser. This would have caught the client ID mismatch the moment it was introduced.

### 3. API contract test

A test that exercises the editor's actual request shape against the API — specifically, "POST with title but no description should succeed." The mismatch between what the editor sends and what the API required wasn't caught because nothing tested the two together.

The alert rule is the fastest to implement and protects against the whole class of "silent API failure" issues. The smoke test closes the deployment gap. The contract test is good hygiene but lower urgency now that the description validation is fixed.