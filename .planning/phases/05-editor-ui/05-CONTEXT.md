# Phase 5: Editor UI - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Two new authenticated React pages at `/write` (post list) and `/write/new` + `/write/:slug` (editor). The authenticated user can create, edit, publish/unpublish, and delete posts. Auth is gated via existing MSAL setup — no new auth system. The public reading UI (`/posts`) is already shipped; this phase only adds the private write surface.

</domain>

<decisions>
## Implementation Decisions

### Page Structure & Routing

- **D-01:** `/write` is a **post list page** — shows all posts (published + drafts), sorted newest first. Has a **"+ New Post"** button at the top.
- **D-02:** The editor lives at **`/write/new`** (blank form) and **`/write/:slug`** (edit existing post). Both use the same editor component.
- **D-03:** After the **first save of a new post**, the URL updates from `/write/new` to `/write/{slug}` — user stays in the editor (no redirect to list).
- **D-04:** All `/write*` routes are **auth-gated** — same MSAL pattern as Dashboard/Ideas: check `isAuthenticated`, show a login prompt if not.

### Post List (`/write`)

- **D-05:** Each row in the post list shows: **title, description, published/draft status badge, date** — all four fields.
- **D-06:** Delete is available **on the list row** (icon/button per row) in addition to the editor toolbar. Both require a confirm dialog before calling `DELETE /api/posts/:slug`.
- **D-07:** After deletion (from list or editor), navigate to **`/write`** (the list).

### Editor (`/write/new`, `/write/:slug`)

- **D-08:** Editor fields: **Title** (text input), **Description** (text input), **Body** (textarea, markdown), **Published** (checkbox/toggle).
- **D-09:** Controls layout: a **single "Save" button** + a **"Published" checkbox** above or beside it. Clicking Save commits whatever state the toggle is in.
- **D-10:** A **Delete button** is also in the editor toolbar (with confirm dialog), in addition to the list-row delete (D-06).
- **D-11:** **Autosave respects the current Published toggle state** — if the toggle is checked when autosave fires, the post is saved as published. Users control published state explicitly.
- **D-12:** No split-pane preview in v1 — deferred to v2 (EDIT-V2-01). Editor is single-pane textarea only.

### Autosave

- **D-13:** Two-tier autosave: **localStorage every 2-3 seconds** (crash recovery, no API call) + **API save every 30-60 seconds** (syncs to storage). Both respect D-11.
- **D-14:** On load, if localStorage has a newer draft than the saved post (or if editing `/write/new`), **restore from localStorage silently** — no prompt needed.
- **D-15:** Show an **unsaved-changes warning** when navigating away with changes not yet sent to the API (`beforeunload` + react-router navigation block via `useBeforeUnload` / Prompt, whichever is available in react-router-dom v6).

### Auth

- **D-16:** Add a **`postsApiRequest`** to `src/authConfig.js` with scope `api://825b77cb-1492-406f-9072-923aa536b328/.default` (the posts-api App Registration).
- **D-17:** Fix `redirectUri` in `authConfig.js` from the hardcoded `/dashboard` suffix to `window.location.origin` (no path) — avoids redirect failures when logging in from `/write`.
- **D-18:** Token acquisition pattern: `acquireTokenSilent(postsApiRequest)` → catch `InteractionRequiredAuthError` → `acquireTokenRedirect(postsApiRequest)`. Gate behind `inProgress === InteractionStatus.None` to prevent concurrent interaction crashes.
- **D-19:** Token is sent as `Authorization: Bearer {accessToken}` header on all mutating requests (POST/PUT/DELETE).

### Claude's Discretion

- **Component files:** `src/Write.tsx` (list at `/write`) and `src/WriteEditor.tsx` (editor at `/write/new` + `/write/:slug`). CSS: `src/styling/write.css` and `src/styling/write-editor.css`.
- **Route registration:** Add `/write`, `/write/new`, `/write/:slug` in `src/index.js` — all wrapped with the same auth-gating pattern used for Dashboard/Ideas.
- **Nav link for Write:** Only show a "Write" nav link if the user is authenticated (using `useIsAuthenticated`). Not visible to public readers.
- **localStorage key scheme:** `write-new-draft` for a new unsaved post; `write-draft-{slug}` for an existing post being edited.
- **API base URL:** Use existing `REACT_APP_POSTS_API_BASE_URL` env var (already in CI secrets from Phase 3).
- **Spinner:** Reuse `src/components/Spinner.tsx` for loading states (fetching post list, loading existing post).
- **Error display:** Inline `<p className="write-error">` pattern, matching Ideas/MomentumFinder.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Scope & Requirements
- `.planning/PROJECT.md` — Core constraints: React 18 + TypeScript + react-router-dom, Azure SWA, MSAL reuse, no new auth system
- `.planning/REQUIREMENTS.md` — EDIT-01 through EDIT-09, SEC-01 (the 10 requirements this phase must satisfy)
- `.planning/ROADMAP.md` §Phase 5 — Success criteria and phase goal

### Prior Phase Decisions
- `.planning/phases/01-storage-schema/01-CONTEXT.md` — Frontmatter schema (title, slug, date, published, description, updatedAt); blob file naming `{slug}.md`
- `.planning/phases/03-public-reading-ui/03-CONTEXT.md` — Established React page patterns (component naming, CSS co-location, fetch pattern, error state)
- `.planning/STATE.md` §Known Pitfalls — XSS pitfall, MSAL crash (InteractionStatus.None guard), YAML corruption, autosave two-tier pattern

### Auth Integration Points
- `src/authConfig.js` — Add `postsApiRequest`; fix `redirectUri` to `window.location.origin`
- `src/index.js` — Auth-gate all `/write*` routes (same pattern as Dashboard/Ideas)
- posts-api App Registration clientId: `825b77cb-1492-406f-9072-923aa536b328`

### Codebase Integration Points
- `src/index.js` — Add `/write`, `/write/new`, `/write/:slug` route entries
- `src/components/nav-bar.tsx` + `src/components/DigitsNavBar.tsx` — Add "Write" link (visible only when `isAuthenticated`)
- `.github/workflows/azure-static-web-apps.yml` — `REACT_APP_POSTS_API_BASE_URL` already present from Phase 3; no new env vars needed

### Posts API Contracts
- `POST /api/posts` — body: `{title, description, body, published}` → 201 `{slug}`
- `PUT /api/posts/:slug` — body: `{title, description, body, published}` → 200
- `DELETE /api/posts/:slug` → 204
- `GET /api/posts` — returns `{posts: [...]}` (list for `/write` page, same endpoint as public reader)
- `GET /api/posts/:slug` — returns `{post: {...}}` (load existing post into editor)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/Spinner.tsx` — Loading spinner (PulseLoader) — reuse during post list load and editor load
- `src/components/nav-bar.tsx` — Add "Write" link (conditional on `useIsAuthenticated`)
- `src/styling/main.css` — `.main` layout wrapper — base layout for write pages
- `src/authConfig.js` — Extend with `postsApiRequest`; fix `redirectUri`
- `src/Ideas.tsx` — Reference implementation for MSAL token acquisition pattern (`acquireTokenSilent` → `acquireTokenRedirect`)

### Established Patterns
- **Page component:** PascalCase, `src/Write.tsx` and `src/WriteEditor.tsx`. CSS alongside in `src/styling/`.
- **Data fetching:** `useEffect` + `useState` with `fetch` — matching existing pages. `loading`, `error`, `data` state.
- **Auth gating:** Check `useIsAuthenticated()`. If false, show "Please log in" with `instance.loginRedirect()` — matching Dashboard/Ideas.
- **Token header:** `acquireTokenSilent(postsApiRequest).then(res => fetch(..., { headers: { Authorization: 'Bearer ' + res.accessToken } }))`.
- **Route definition:** Add in `src/index.js` inside existing `<Routes>` block.
- **No global state:** Local `useState` only.

### Integration Points
- `src/index.js` — Three new route registrations
- `src/authConfig.js` — `postsApiRequest` addition + `redirectUri` fix
- `src/components/nav-bar.tsx` + `DigitsNavBar.tsx` — Conditional "Write" nav link

</code_context>

<deferred>
## Deferred Ideas

- Split-pane live preview (markdown left, rendered right) — deferred to v2 as EDIT-V2-01
- Cmd/Ctrl+S shortcut to save — deferred to v2 as EDIT-V2-02
- Post list in editor sidebar — already addressed by the `/write` list page (D-01); full sidebar is EDIT-V2-03

</deferred>

---

*Phase: 5-editor-ui*
*Context gathered: 2026-06-05*
