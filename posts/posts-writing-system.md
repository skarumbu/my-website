---
title: "Design Doc: Posts & Writing System (v1.0)"
slug: posts-writing-system
date: "2026-06-06T00:00:00+00:00"
published: true
description: "Full system design for the posts and writing system: storage, API, UI, auth, and GitHub-backed content."
updatedAt: "2026-06-06T00:00:00+00:00"
---
# Design Doc: Posts & Writing System (v1.0)

**Date:** 2026-06-06
**Status:** Shipped
**Repos:** my-website · posts-api · azure-infrastructure
**Phases:** 5 (storage schema → read API → read UI → write API → editor UI)

---

## What Was Built

A private writing space that publishes instantly to a public reading feed. The author writes posts in a notebook-style editor at `/write`; anyone can read them at `/posts`. Posts are full markdown with frontmatter metadata — suitable for design docs, essays, project write-ups, or short notes.

---

## Architecture Overview

```
Browser (React SPA — my-website)
  ├── /posts, /posts/:slug   — public reading UI (no auth)
  └── /write, /write/:slug   — private editor (MSAL auth required)
        ↓ Bearer token (MSAL → posts-api App Registration)
Azure Functions (posts-api — Python v2, Consumption plan)
  ├── GET  /api/posts          — list all posts (public)
  ├── GET  /api/posts/:slug    — read single post (public)
  ├── POST /api/posts          — create post (auth required)
  ├── PUT  /api/posts/:slug    — update post (auth required)
  └── DELETE /api/posts/:slug  — delete post (auth required)
        ↓
Azure Blob Storage (private container)
  └── {slug}.md               — one file per post, markdown + YAML frontmatter
```

---

## Decision 1: Azure Blob Storage as post store

**Options considered:** Azure Table Storage, Cosmos DB, Azure SQL, Blob Storage, GitHub repo as CMS.

**Decision:** Blob Storage — one markdown file per post, named `{slug}.md`.

**Why:** Simplest fit with the existing Azure setup. No new database service to provision or manage. Blob content is portable (plain markdown files). Reads are cheap at personal-use traffic levels. The content format (markdown + frontmatter) is independent of storage — migrating later is a file copy.

**Frontmatter schema** (established in Phase 1):
```yaml
---
title: "Post title — always double-quoted to prevent YAML corruption"
slug: my-post-title
date: "2026-06-06"
published: true
description: One-sentence summary shown in list views
updatedAt: "2026-06-06T12:00:00Z"
---
```

**Container:** `posts` (private). All access goes through Azure Functions — the blob container is never exposed directly to the browser.

**Index strategy:** The list endpoint scans all blobs in the container and reads their frontmatter. Acceptable under ~50 posts. If volume grows, a `_index.json` blob can cache the index without changing the API contract.

---

## Decision 2: Reuse existing MSAL / Azure AD auth for the write surface

**Options considered:** New auth system, hardcoded token, SWA Easy Auth, reuse existing MSAL.

**Decision:** Reuse the existing `@azure/msal-react` setup already in place for Dashboard and Ideas.

**Why:** Already installed and configured. No second auth system. Users (just me) already have an active session. The editor auth uses the same `useMsal` / `useIsAuthenticated` hooks as Dashboard/Ideas — no new patterns introduced.

**Auth flow:**
1. `/write` route checks `isAuthenticated` — if false, shows a "Sign in with Microsoft" prompt
2. Login calls `instance.loginRedirect(postsApiRequest)` — redirects to Microsoft, returns to the page that initiated login
3. For API calls, token is acquired via `acquireTokenSilent(postsApiRequest)` → catch `InteractionRequiredAuthError` → `acquireTokenRedirect(postsApiRequest)`
4. Token is sent as `Authorization: Bearer {accessToken}` on all mutating requests (POST/PUT/DELETE)
5. All hooks are gated behind `inProgress === InteractionStatus.None` to prevent concurrent interaction crashes (a known MSAL pitfall)

**posts-api App Registration:** `825b77cb-1492-406f-9072-923aa536b328`, scope `api://825b77cb-1492-406f-9072-923aa536b328/.default`

**redirectUri fix:** `authConfig.js` was changed from `window.location.origin + "/dashboard"` to `window.location.origin` (bare origin) so that login initiated from `/write` or `/write/new` returns to the correct page instead of `/dashboard`.

**Write API auth:** The posts-api uses Azure SWA Easy Auth (`X-MS-CLIENT-PRINCIPAL` header) to validate the caller's identity server-side, keeping public reads open without a token while requiring auth for writes.

---

## Decision 3: Python Azure Functions for posts-api (sibling repo pattern)

**Decision:** `posts-api` is a standalone Python Azure Functions v2 app deployed on a Consumption plan, following the same pattern as `ideas-api` and `dashboard_api`.

**Key implementation details:**
- `gray-matter` equivalent in Python: `python-frontmatter` (pip) for reading/writing YAML frontmatter
- Slug generation: `python-slugify` — imported as `from slugify import slugify` (not `python_slugify`)
- Python version: 3.12 (3.11 not installed locally; 3.12 is compatible)
- `POSTS_STORAGE_CONNECTION_STRING` and `POSTS_CONTAINER_NAME` as Azure App Settings

---

## Decision 4: React SPA pages following the established page pattern

**New pages:**
- `src/Posts.tsx` + `src/styling/posts.css` — public post list at `/posts`
- `src/PostReader.tsx` + `src/styling/post-reader.css` — public post detail at `/posts/:slug`
- `src/Write.tsx` + `src/styling/write.css` — auth-gated post list at `/write`
- `src/WriteEditor.tsx` + `src/styling/write-editor.css` — auth-gated editor at `/write/new` and `/write/:slug`

**Routing:** Three new routes added to `createBrowserRouter` in `src/index.js`. Write routes are auth-gated at the route level (same pattern as Dashboard/Ideas).

**XSS:** Posts are rendered with `react-markdown` — never `dangerouslySetInnerHTML`. The existing `LearningPlan.tsx` uses `dangerouslySetInnerHTML`; this pattern was explicitly not repeated.

---

## Decision 5: Editor feature set for v1

**Fields:** Title (text input), Description (text input), Body (textarea, markdown), Published (checkbox).

**Save model:** A single "Save" button commits all fields including the current Published state. The Published checkbox is the authoritative toggle — autosave also respects its current state.

**Two-tier autosave:**
- Tier 1: localStorage every 2 seconds — crash recovery, no API call
  - Uses a `latestDraft` React ref (updated on every keystroke via `useEffect`) so the interval callback always reads current values without stale closure issues
  - Keys: `write-new-draft` (new post) / `write-draft-{slug}` (existing)
- Tier 2: API save every 45 seconds — uses `getTokenSilent` only (never calls `acquireTokenRedirect` from a background timer — would interrupt the user)
  - On mount, if localStorage has a draft, it's restored silently (no prompt)

**Navigation guard:** `useBlocker(unsavedSinceApi)` shows an inline "You have unsaved changes / Leave anyway / Stay" banner for in-app navigation. `useBeforeUnload` triggers the browser's native "Leave site?" dialog on tab close. Both require `unsavedSinceApi` to be true (reset on every successful save).

**URL update after first save:** When a new post is first saved (`POST /api/posts` → returns `{ slug }`), the URL updates from `/write/new` to `/write/{slug}` via `navigate('/write/' + slug, { replace: true })` — no history pollution.

**Delete:** Available both from the list row (trash icon) and the editor toolbar ("Delete Post" button). Both require `window.confirm` before calling `DELETE /api/posts/:slug`. The DELETE response is 204 No Content — `resp.json()` is never called on it.

**No split-pane preview in v1:** Editor is a single textarea. Live markdown preview is deferred to v2.

---

## Decision 6: Visual design — calm editor, candy list

The write pages use the same warm cream `#FFEFD9` background as the rest of the site but omit the animated dot-grid texture (the `::before` gradient + `::after` dot-grid pseudo-elements from `.main`). This creates a visually focused editing surface without introducing a new color palette. Nav, fonts, and CSS variables are shared.

Typography: Fraunces for post titles (matching the public `/posts` page), DM Sans for all UI text. The title input field is 16px/600 — body size at semibold weight — so it feels editorial without requiring a new size token.

---

## Key Pitfalls Encountered

| Pitfall | Resolution |
|---------|------------|
| MSAL crash when autosave timer calls `acquireTokenRedirect` | Background autosave uses `getTokenSilent` only — returns null on failure, never redirects |
| Stale closure in `setInterval` reading old state | `latestDraft` ref updated on every field change; timer reads `latestDraft.current` |
| DELETE 204 — `.json()` throws SyntaxError on empty body | `resp.ok` check only; no `resp.json()` call on DELETE |
| YAML frontmatter corruption on post titles with colons | Always double-quote `title` values in frontmatter; use `python-frontmatter` for serialization |
| `useBlocker` requires data router | Project uses `createBrowserRouter` in production; tests use `jest.mock` to return `{ state: 'idle' }` |
| `slugify` import name | `from slugify import slugify` (package is `python-slugify`, import name is `slugify`) |
| `redirectUri` returning to `/dashboard` from `/write` | Changed to `window.location.origin` (bare origin); Azure AD App Registration must have this registered |

---

## Relevant Files

| File | Role |
|------|------|
| `src/Write.tsx` | Auth-gated post list — fetch, list, delete from row |
| `src/WriteEditor.tsx` | Auth-gated editor — create, edit, publish, delete, autosave |
| `src/Posts.tsx` | Public post list |
| `src/PostReader.tsx` | Public post detail with react-markdown rendering |
| `src/authConfig.js` | MSAL config — added `postsApiRequest`, fixed `redirectUri` |
| `src/index.js` | Route registrations for all write/read routes |
| `src/components/nav-bar.tsx` | Conditional "Write" link (auth-gated) |
| `src/components/DigitsNavBar.tsx` | Conditional "Write" link (auth-gated) |
| `src/styling/write.css` | List page styles |
| `src/styling/write-editor.css` | Editor styles |
| `src/__mocks__/@azure/msal-react.tsx` | Jest mock for MSAL hooks |
| `posts-api/function_app.py` | Python Azure Functions v2 CRUD handlers |
