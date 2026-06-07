# Phase 5: Editor UI - Research

**Researched:** 2026-06-05
**Domain:** React/TypeScript SPA — MSAL authentication, react-router-dom v6, localStorage autosave, controlled form state
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `/write` is a post list page — shows all posts (published + drafts), sorted newest first. Has a "+ New Post" button at the top.
- **D-02:** Editor lives at `/write/new` (blank form) and `/write/:slug` (edit existing post). Both use the same editor component.
- **D-03:** After the first save of a new post, the URL updates from `/write/new` to `/write/{slug}` — user stays in the editor (no redirect to list).
- **D-04:** All `/write*` routes are auth-gated — same MSAL pattern as Dashboard/Ideas: check `isAuthenticated`, show a login prompt if not.
- **D-05:** Each row in the post list shows: title, description, published/draft status badge, date — all four fields.
- **D-06:** Delete is available on the list row (icon/button per row) in addition to the editor toolbar. Both require a confirm dialog before calling `DELETE /api/posts/:slug`.
- **D-07:** After deletion (from list or editor), navigate to `/write` (the list).
- **D-08:** Editor fields: Title (text input), Description (text input), Body (textarea, markdown), Published (checkbox/toggle).
- **D-09:** Controls layout: a single "Save" button + a "Published" checkbox above or beside it. Clicking Save commits whatever state the toggle is in.
- **D-10:** A Delete button is also in the editor toolbar (with confirm dialog).
- **D-11:** Autosave respects the current Published toggle state.
- **D-12:** No split-pane preview in v1 — deferred to v2 (EDIT-V2-01). Editor is single-pane textarea only.
- **D-13:** Two-tier autosave: localStorage every 2-3 seconds + API save every 30-60 seconds. Both respect D-11.
- **D-14:** On load, if localStorage has a newer draft than the saved post (or if editing `/write/new`), restore from localStorage silently — no prompt needed.
- **D-15:** Show an unsaved-changes warning when navigating away with changes not yet sent to the API.
- **D-16:** Add a `postsApiRequest` to `src/authConfig.js` with scope `api://825b77cb-1492-406f-9072-923aa536b328/.default`.
- **D-17:** Fix `redirectUri` in `authConfig.js` from the hardcoded `/dashboard` suffix to `window.location.origin`.
- **D-18:** Token acquisition pattern: `acquireTokenSilent(postsApiRequest)` → catch `InteractionRequiredAuthError` → `acquireTokenRedirect(postsApiRequest)`. Gate behind `inProgress === InteractionStatus.None`.
- **D-19:** Token is sent as `Authorization: Bearer {accessToken}` header on all mutating requests (POST/PUT/DELETE).

### Claude's Discretion

- **Component files:** `src/Write.tsx` (list at `/write`) and `src/WriteEditor.tsx` (editor at `/write/new` + `/write/:slug`). CSS: `src/styling/write.css` and `src/styling/write-editor.css`.
- **Route registration:** Add `/write`, `/write/new`, `/write/:slug` in `src/index.js` — all wrapped with the same auth-gating pattern used for Dashboard/Ideas.
- **Nav link for Write:** Only show a "Write" nav link if the user is authenticated (using `useIsAuthenticated`). Not visible to public readers.
- **localStorage key scheme:** `write-new-draft` for a new unsaved post; `write-draft-{slug}` for an existing post being edited.
- **API base URL:** Use existing `REACT_APP_POSTS_API_BASE_URL` env var.
- **Spinner:** Reuse `src/components/Spinner.tsx` for loading states.
- **Error display:** Inline `<p className="write-error">` pattern, matching Ideas/MomentumFinder.

### Deferred Ideas (OUT OF SCOPE)

- Split-pane live preview (markdown left, rendered right) — EDIT-V2-01
- Cmd/Ctrl+S keyboard shortcut to save — EDIT-V2-02
- Post list in editor sidebar — EDIT-V2-03
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EDIT-01 | Authenticated user can access the editor at `/write` | Auth-gate pattern from Dashboard/Ideas: `useIsAuthenticated()` guard; show login prompt when false |
| EDIT-02 | Editor is gated behind Azure AD login (reusing existing MSAL setup) | `postsApiRequest` added to `authConfig.js`; D-16/D-17/D-18 cover all required changes |
| EDIT-03 | User can create a new post with title, description, and markdown body | `/write/new` route → `WriteEditor.tsx`; POST `/api/posts`; URL update after first save (Focus Area 4) |
| EDIT-04 | User can edit an existing post from the editor | `/write/:slug` route → `WriteEditor.tsx`; GET `/api/posts/:slug` on mount; PUT `/api/posts/:slug` on save |
| EDIT-05 | User can delete a post from the editor | Editor toolbar Delete button; `window.confirm()`; DELETE `/api/posts/:slug`; 204 handling (Focus Area 7); navigate to `/write` |
| EDIT-06 | User can toggle a post between published and draft | Published checkbox in editor toolbar; state drives both manual Save and autosave API calls |
| EDIT-07 | Editor autosaves to localStorage every 2-3 seconds | Two-tier localStorage tier: `useRef` interval; `write-new-draft` / `write-draft-{slug}` keys (Focus Area 3) |
| EDIT-08 | Editor saves to API every 30-60 seconds | Two-tier API tier: second `useRef` interval; requires token acquisition; respects Published toggle |
| EDIT-09 | User sees unsaved-changes warning before navigating away | `useBlocker` for in-app navigation + `useBeforeUnload` for tab close (Focus Area 2) |
</phase_requirements>

---

## Summary

Phase 5 adds two authenticated React pages — a post list (`/write`) and a markdown editor (`/write/new`, `/write/:slug`) — on top of an already-complete API layer from Phase 4. The code challenge is not UI complexity (no component library, no split-pane, no rich editor) but the coordination of four separate stateful concerns: MSAL token acquisition gating, react-router navigation blocking, two-tier autosave timers, and URL mutation after first save. Every one of these concerns has a project-local reference implementation to follow.

The codebase already has everything required: `@azure/msal-browser` v5.7.0 and `@azure/msal-react` v5.3.0 are installed; `react-router-dom` v6.30.0 is installed (with `useBlocker` and `useBeforeUnload` confirmed present); `react-markdown` is installed for the public reading UI. No new packages are needed for this phase.

**Primary recommendation:** Model `WriteEditor.tsx` closely on `Ideas.tsx` (MSAL token acquisition, `useCallback getToken`, loading/error state) and add the two-tier autosave on top using `useRef` timers cleaned up on unmount.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Auth gating (`/write*` routes) | Browser/Client | — | `useIsAuthenticated()` guards render; no SSR in CRA |
| Token acquisition for API calls | Browser/Client | — | MSAL runs entirely client-side; `acquireTokenSilent` → redirect flow |
| Post list (`/write`) | Browser/Client | API (GET /api/posts) | Client fetches, renders. No server-side route concept in CRA |
| Editor form state | Browser/Client | — | `useState` per field; no global store needed |
| localStorage autosave (tier 1) | Browser/Client | — | Pure browser API; no API involvement |
| API autosave (tier 2) | Browser/Client + API | — | Client drives timer; API persists |
| URL update after first save | Browser/Client | — | `useNavigate` with `replace: true`; no server involvement |
| Navigation blocking (EDIT-09) | Browser/Client | — | `useBlocker` (react-router) + `useBeforeUnload` (browser event) |
| DELETE 204 handling | Browser/Client | — | `fetch` response handling; don't call `.json()` on 204 |

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Installed Version | Purpose | Note |
|---------|------------------|---------|------|
| `react` | 18.2.0 | UI rendering | [VERIFIED: npm list] |
| `react-router-dom` | 6.30.0 | Routing, `useBlocker`, `useBeforeUnload`, `useNavigate` | [VERIFIED: npm list] |
| `@azure/msal-browser` | 5.7.0 | Token acquisition, `InteractionStatus`, `InteractionRequiredAuthError` | [VERIFIED: npm list] |
| `@azure/msal-react` | 5.3.0 | `useMsal`, `useIsAuthenticated` hooks; `inProgress` from context | [VERIFIED: npm list] |
| `react-spinners` | 0.14.1 | `Spinner.tsx` already wraps this | [VERIFIED: npm list] |

### No new packages required

This phase is pure integration of existing capabilities. The `react-markdown` package (already installed at v10.1.0) is not used in the editor — the textarea body is raw markdown text. It is used in `PostReader.tsx` (reading side) only.

**Installation:** None required.

---

## Package Legitimacy Audit

> No new packages are being installed in this phase. All libraries used are already present in `node_modules` and were previously audited during earlier phases.

| Package | Registry | Status |
|---------|----------|--------|
| `react-router-dom` | npm | Already installed — no audit needed |
| `@azure/msal-browser` | npm | Already installed — no audit needed |
| `@azure/msal-react` | npm | Already installed — no audit needed |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
User browser
     │
     ▼
[NavBar] ──── useIsAuthenticated() ────► show/hide "Write" link
     │
     ├─► /write         ──► [Write.tsx]
     │                         │ GET /api/posts (with Bearer token)
     │                         │ renders list rows
     │                         └─► click row → /write/:slug
     │                             click delete → confirm → DELETE /api/posts/:slug → /write
     │                             click "+ New Post" → /write/new
     │
     └─► /write/new     ──► [WriteEditor.tsx] (mode: "new")
     └─► /write/:slug   ──► [WriteEditor.tsx] (mode: "edit")
                               │
                               │ On mount (edit mode): GET /api/posts/:slug → populate fields
                               │ On mount: check localStorage write-new-draft / write-draft-{slug}
                               │
                               ├─── useRef localTimer (2-3s)  ──► localStorage.setItem(key, json)
                               ├─── useRef apiTimer  (30-60s) ──► POST or PUT /api/posts/:slug
                               │
                               │ useBlocker(hasUnsavedChanges) ──► inline banner if "blocked"
                               │ useBeforeUnload(cb)           ──► browser tab-close dialog
                               │
                               │ Save button clicked:
                               │   POST (new) → gets slug → navigate(/write/:slug, replace:true)
                               │   PUT  (existing) → no navigation
                               │
                               └─── Delete: confirm → DELETE /api/posts/:slug → navigate(/write)
```

### Recommended Project Structure

```
src/
├── Write.tsx              # /write — post list page
├── WriteEditor.tsx        # /write/new + /write/:slug — editor
├── styling/
│   ├── write.css          # styles for Write.tsx
│   └── write-editor.css   # styles for WriteEditor.tsx
├── authConfig.js          # add postsApiRequest; fix redirectUri
├── index.js               # add 3 new route entries
└── components/
    └── nav-bar.tsx        # add conditional "Write" link
```

### Pattern 1: MSAL Token Acquisition (confirmed from Ideas.tsx + Dashboard.tsx + msal-react type definitions)

**What:** Wrap `acquireTokenSilent` in a `useCallback getToken` function. Catch errors and redirect for interactive auth. Guard interactive auth behind `inProgress === InteractionStatus.None` to avoid concurrent interaction crashes.

**When to use:** All API calls in `Write.tsx` and `WriteEditor.tsx` that require auth.

**Reference in codebase:** `src/Ideas.tsx` lines 614-633 (`getToken` and `getTokenSilent` callbacks).

**Correct pattern for this project:**

```typescript
// Source: src/Ideas.tsx (verified pattern) + CONTEXT.md D-18
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus, InteractionRequiredAuthError } from '@azure/msal-browser';
import { postsApiRequest } from './authConfig.js';

function WriteEditor() {
  const { instance, inProgress, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const getToken = useCallback(async (): Promise<string> => {
    // Guard: never start interactive auth if another interaction is in progress
    if (inProgress !== InteractionStatus.None) {
      throw new Error('Auth interaction in progress');
    }
    try {
      const response = await instance.acquireTokenSilent({
        ...postsApiRequest,
        account: accounts[0],
      });
      return response.accessToken;
    } catch (e) {
      if (e instanceof InteractionRequiredAuthError) {
        // Redirect for interactive sign-in; specify redirectUri so we return to editor
        instance.acquireTokenRedirect({
          ...postsApiRequest,
          redirectUri: window.location.origin + '/write',
        });
      }
      throw e;
    }
  }, [instance, inProgress, accounts]);
```

**Key difference from Dashboard.tsx:** Dashboard uses a plain `.catch(() => acquireTokenRedirect())` without the `InteractionStatus.None` guard or the `InteractionRequiredAuthError` instanceof check. The `inProgress` guard is required for the editor because autosave timers can trigger `getToken()` concurrently — without the guard, a second `acquireTokenRedirect` fires while the first redirect is still in-flight. Ideas.tsx handles this with `if (e?.errorCode === 'interaction_in_progress') throw e;` (line 619) — the equivalent pattern. Either approach works; the `instanceof InteractionRequiredAuthError` variant from D-18 is cleaner.

**Confirmed from type definitions:**
- `useMsal()` returns `{ instance, inProgress, accounts, logger }` — `inProgress: InteractionStatus` is confirmed present [VERIFIED: `node_modules/@azure/msal-react/dist/MsalContext.d.ts`]
- `InteractionStatus.None === 'none'` [VERIFIED: runtime check against installed package]
- `InteractionRequiredAuthError` is exported from `@azure/msal-browser` [VERIFIED: runtime check]

### Pattern 2: Auth Gate (existing pages pattern)

**What:** Check `useIsAuthenticated()`. If false, render a login prompt instead of the page content. Do not use a `<PrivateRoute>` wrapper — existing project uses inline guards.

**Reference:** `src/Ideas.tsx` lines 850-863, `src/Dashboard.tsx` line 296.

```typescript
// Source: Ideas.tsx lines 850-863 (verified)
if (!isAuthenticated) {
  return (
    <div className="write-page">
      <NavBar />
      <div className="write-login-view">
        <h1>Sign in to write</h1>
        <p>This area is private. Sign in with your Microsoft account to access the editor.</p>
        <button onClick={() => instance.loginRedirect({
          ...postsApiRequest,
          redirectUri: window.location.origin + '/write',
        })}>
          Sign in with Microsoft
        </button>
      </div>
    </div>
  );
}
```

**No `<PrivateRoute>` wrapper is needed.** The existing project uses inline early-return guards, not wrapper components. This keeps consistency and avoids adding a new pattern.

### Pattern 3: Route Registration (confirmed from src/index.js)

**What:** Add three entries to `createBrowserRouter` in `src/index.js`. No nested routes, no `<Outlet>`, no layout route — each page is self-contained (matching the project's existing flat route structure).

```typescript
// Source: src/index.js (verified pattern)
{
  path: "/write",
  element: <Write />,
},
{
  path: "/write/new",
  element: <WriteEditor />,
},
{
  path: "/write/:slug",
  element: <WriteEditor />,
},
```

Auth gating is handled **inside** each component, not at the route level. This is the established pattern.

### Pattern 4: react-router-dom v6 Navigation Blocking (EDIT-09)

**What:** `Prompt` was removed in react-router-dom v6. The v6 replacement is `useBlocker` (for in-app navigation) + `useBeforeUnload` (for tab-close / browser navigation).

**Confirmed exports in installed v6.30.0:** `useBlocker`, `useBeforeUnload`, `unstable_usePrompt` — all three verified present [VERIFIED: runtime module inspection].

**`useBlocker` return shape:**
```
{ state: "unblocked" | "blocked" | "proceeding", proceed: () => void, reset: () => void, location: Location }
```
[VERIFIED: `node_modules/@remix-run/router/dist/router.umd.js` — `IDLE_BLOCKER` constant]

**Correct pattern for EDIT-09:**

```typescript
// Source: verified from installed react-router-dom v6.30.0 source
import { useBlocker, useBeforeUnload } from 'react-router-dom';

// In WriteEditor:
const hasUnsaved = /* bool: form changed since last API save */;

// 1. Block in-app navigation (react-router Link/navigate calls)
const blocker = useBlocker(hasUnsaved);

// 2. Block browser tab-close / address-bar navigation
useBeforeUnload(
  useCallback(
    (e: BeforeUnloadEvent) => {
      if (hasUnsaved) e.preventDefault();
    },
    [hasUnsaved]
  )
);

// 3. Render inline banner when blocker fires
{blocker.state === 'blocked' && (
  <div className="editor-unsaved-banner">
    You have unsaved changes.
    <button onClick={() => blocker.proceed?.()}>Leave anyway</button>
    <button onClick={() => blocker.reset?.()}>Stay</button>
  </div>
)}
```

**Critical requirement:** `useBlocker` ONLY works when the component is rendered inside a data router (`createBrowserRouter`). The project already uses `createBrowserRouter` in `src/index.js` — this requirement is already satisfied. [VERIFIED: source confirms "must be used within a data router"]

**`useBeforeUnload` signature (verified):**
```typescript
useBeforeUnload(callback: (event: BeforeUnloadEvent) => void, options?: { capture?: boolean }): void
```
The callback is attached/detached via `useEffect` internally. The caller should wrap the callback in `useCallback` to avoid re-registering on every render.

### Pattern 5: Two-Tier Autosave with useRef Timers (EDIT-07, EDIT-08)

**What:** Two independent `setInterval` timers managed via `useRef`. `useRef` (not `useState`) is correct for timer IDs because updating a ref does not trigger re-renders.

```typescript
// Verified pattern — aligns with React documentation
const localTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
const apiTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

// editorState: { title, description, body, published } — single state object
// or four separate useState calls — both work

useEffect(() => {
  // Tier 1: localStorage every 2s
  localTimerRef.current = setInterval(() => {
    const key = slug ? `write-draft-${slug}` : 'write-new-draft';
    localStorage.setItem(key, JSON.stringify({
      title, description, body, published,
      savedAt: Date.now(),
    }));
  }, 2000);

  // Tier 2: API save every 45s
  apiTimerRef.current = setInterval(() => {
    if (!hasUnsavedApiChanges) return; // skip if already in sync
    saveToApi(); // calls getToken() → POST or PUT
  }, 45000);

  return () => {
    if (localTimerRef.current) clearInterval(localTimerRef.current);
    if (apiTimerRef.current)   clearInterval(apiTimerRef.current);
  };
}, [/* deps: title, description, body, published, slug */]);
```

**Pitfall — stale closure:** If the timer callback closes over state values directly, it captures the stale value from when the effect ran. Two solutions:
1. Use `useRef` to mirror the current field values (a "latest ref") that the timer callback reads from.
2. Include all field values in the effect dependency array — this restarts both timers on every keystroke (acceptable for localStorage, poor for API).

**Recommended approach:** Use a single `latestDraft` ref that is updated on every onChange event. Timer callbacks read from `latestDraft.current`, not from state directly. This prevents stale closures without restarting timers on every keystroke.

```typescript
const latestDraft = useRef({ title, description, body, published });
// Update ref on every change (no re-render cost)
useEffect(() => {
  latestDraft.current = { title, description, body, published };
}, [title, description, body, published]);

// Timer callback reads latestDraft.current — always current
```

### Pattern 6: localStorage Restore on Mount (D-14)

**What:** On mount, check localStorage for a saved draft. If found and `savedAt` is newer than the post's `updatedAt` (or if on `/write/new`), silently restore without prompting.

```typescript
useEffect(() => {
  const key = slug ? `write-draft-${slug}` : 'write-new-draft';
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      const draft = JSON.parse(raw);
      // For new posts: always restore
      // For existing posts: only restore if draft is newer
      const shouldRestore = !slug || (draft.savedAt > /* post.updatedAt ms */ 0);
      if (shouldRestore) {
        setTitle(draft.title ?? '');
        setDescription(draft.description ?? '');
        setBody(draft.body ?? '');
        setPublished(draft.published ?? false);
      }
    } catch {
      // Corrupt localStorage — ignore
    }
  }
}, []); // Run once on mount only
```

### Pattern 7: URL Update After First Save (D-03)

**What:** After a POST to `/api/posts` returns `{ slug }`, call `navigate` with `replace: true` to update the URL from `/write/new` to `/write/{slug}` without adding a history entry (so the back button goes to the list, not back to `/write/new`).

```typescript
// Source: react-router-dom v6 useNavigate API [ASSUMED — documented pattern]
import { useNavigate, useParams } from 'react-router-dom';

const navigate = useNavigate();
const { slug } = useParams<{ slug: string }>();

const handleSave = async () => {
  const token = await getToken();
  if (!slug) {
    // New post — POST
    const resp = await fetch(`${BASE_URL}/api/posts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, body, published }),
    });
    if (!resp.ok) throw new Error(`${resp.status}`);
    const { slug: newSlug } = await resp.json();
    // Update URL without pushing a new history entry
    navigate(`/write/${newSlug}`, { replace: true });
    // After navigate, the component re-renders with the new slug param
    // The localStorage key should also be migrated: write-new-draft → write-draft-{newSlug}
    localStorage.removeItem('write-new-draft');
  } else {
    // Existing post — PUT
    await fetch(`${BASE_URL}/api/posts/${slug}`, { method: 'PUT', ... });
  }
};
```

**localStorage key migration:** After the first save, the `write-new-draft` key becomes stale. Remove it and let the timer create `write-draft-{newSlug}` on the next tick.

### Pattern 8: DELETE returning 204 (EDIT-05)

**What:** `DELETE /api/posts/:slug` returns HTTP 204 with no response body. Calling `.json()` on a 204 response throws a SyntaxError ("Unexpected end of input").

**Correct handling** (already modeled in Ideas.tsx line 369):
```typescript
// Source: Ideas.tsx handleDeleteUpdate, line 369 (verified)
const resp = await fetch(`${BASE_URL}/api/posts/${slug}`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${token}` },
});
if (resp.ok || resp.status === 204) {
  // Success — no body to parse
  navigate('/write');
} else {
  throw new Error(`${resp.status}`);
}
// NEVER call resp.json() on a DELETE response — it will throw on 204
```

**Note:** `resp.ok` is `true` for any 2xx status, so `resp.ok` alone covers 204. The `|| resp.status === 204` is defensive but redundant. The key rule is: do not chain `.json()`.

### Pattern 9: Controlled Textarea for Markdown Body (EDIT-03, EDIT-04)

**What:** Standard React controlled textarea. `value` + `onChange` — identical to the body textarea already in `Ideas.tsx` Composer (lines 186-193).

```typescript
// Source: Ideas.tsx Composer component, lines 186-193 (verified)
<textarea
  className="editor-field-body"
  value={body}
  onChange={e => setBody(e.target.value)}
  placeholder="Write in markdown…"
  rows={12}
  style={{ minHeight: '320px', resize: 'vertical' }}
/>
```

No rich editor library is used. The textarea is plain text input of markdown. `react-markdown` is only used on the reading side (`PostReader.tsx`).

### Pattern 10: Conditional Nav Link (Claude's Discretion)

**What:** Add "Write" to `src/components/nav-bar.tsx` visible only when authenticated. The nav-bar currently has no MSAL imports — they need to be added.

```typescript
// nav-bar.tsx needs MSAL import added
import { useIsAuthenticated } from '@azure/msal-react';

const NavBar: React.FC = () => {
  const isAuthenticated = useIsAuthenticated();
  return (
    <nav className="nav-bar">
      {/* existing links */}
      <a href="/posts" className="button">Writing</a>
      {isAuthenticated && (
        <a href="/write" className="button">Write</a>
      )}
    </nav>
  );
};
```

Same change needed in `src/components/DigitsNavBar.tsx` if it exists. [VERIFIED: `nav-bar.tsx` currently has no MSAL imports — confirmed by reading file]

### Pattern 11: authConfig.js Changes (D-16, D-17)

**Current state** (verified by reading file):
```javascript
redirectUri: window.location.origin + "/dashboard",  // BUG: hardcoded path
// Only dashboardApiRequest and ideasApiRequest exist — no postsApiRequest
```

**Required changes:**
```javascript
export const msalConfig = {
  auth: {
    clientId: process.env.REACT_APP_AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.REACT_APP_AZURE_TENANT_ID}`,
    redirectUri: window.location.origin,  // FIX: no path suffix
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

// ADD:
export const postsApiRequest = {
  scopes: ['api://825b77cb-1492-406f-9072-923aa536b328/.default'],
};
```

**Scope format note:** Existing `ideasApiRequest` uses `access_as_user` suffix; `postsApiRequest` uses `.default` as specified in D-16. Both are valid AAD scope formats — `.default` grants all static permissions granted to the app.

**Impact of `redirectUri` fix:** Changing from `/dashboard` to no path means MSAL will redirect back to whatever page triggered the login. This is the correct behavior for a multi-page SPA. The Azure AD App Registration must have `window.location.origin` in its Redirect URIs list — this is a prerequisite (noted in STATE.md as a known open question resolved before Phase 5).

### Anti-Patterns to Avoid

- **Calling `.json()` on DELETE responses:** DELETE returns 204 with no body. `.json()` throws "Unexpected end of input". Check `resp.ok` only.
- **Missing `inProgress === InteractionStatus.None` guard:** Without this guard, autosave timers can trigger concurrent `acquireTokenRedirect` calls, crashing MSAL. Dashboard.tsx skips this guard and gets away with it because it has no background timers — `WriteEditor.tsx` has two.
- **Using `useState` for timer IDs:** Timer IDs stored in `useRef`, not `useState`, to avoid re-renders on interval assignment.
- **Stale closure in interval callbacks:** Timer callbacks capture state at effect creation time. Use a `latestDraft` ref to always read current values.
- **Using `Prompt` from react-router-dom:** `Prompt` was removed in v6. Use `useBlocker` + `useBeforeUnload` instead.
- **Pushing a history entry on first save:** `navigate('/write/:slug', { replace: true })` — if you omit `replace: true`, the back button creates a confusing history stack (new → /write/slug → new → /write/slug ...).
- **Hardcoded client ID in scope:** The scope for `postsApiRequest` uses the posts-api App Registration client ID (`825b77cb-1492-406f-9072-923aa536b328`), not the SPA's own client ID. These are different App Registrations.
- **Showing autosave indicator on initial clean load:** The autosave status indicator should start hidden. Only show "Unsaved changes" after the first edit.
- **nav-bar.tsx currently imports no MSAL hooks:** `useIsAuthenticated` must be imported before it can be used. The file currently has only `React` and two CSS imports.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token acquisition | Custom OAuth flow | `acquireTokenSilent` → `acquireTokenRedirect` | MSAL handles PKCE, token caching, refresh, expiry |
| Navigation blocking | Custom history listener | `useBlocker` (react-router-dom v6) | Data router manages history; direct history manipulation breaks router state |
| Tab-close warning | `window.addEventListener('beforeunload', ...)` in component body | `useBeforeUnload` hook | Handles cleanup (removeEventListener) automatically via useEffect |
| Markdown rendering (reading) | `dangerouslySetInnerHTML` | `react-markdown` (already used in PostReader.tsx) | XSS prevention — SEC-01 requirement |

---

## Common Pitfalls

### Pitfall 1: Concurrent MSAL Interaction Crash

**What goes wrong:** Two simultaneous calls to `acquireTokenRedirect` (or `loginRedirect`) crash MSAL with an "interaction_in_progress" error. This is most likely when autosave timers call `getToken()` at the same time a user-triggered action also calls `getToken()` while a redirect is pending.

**Why it happens:** MSAL stores interaction state in `sessionStorage`. A second interactive call before the first completes corrupts this state.

**How to avoid:** Gate all interactive auth behind `inProgress === InteractionStatus.None`. In background timers (localStorage/API autosave), use a silent-only token fetch that returns `null` on failure instead of redirecting (see `getTokenSilent` pattern in Ideas.tsx lines 626-633).

**Warning signs:** Console error "interaction_in_progress" or "Another interaction is already in progress".

### Pitfall 2: `useBlocker` Requires Data Router Context

**What goes wrong:** `useBlocker` throws "must be used within a data router" if called in a component rendered outside `createBrowserRouter`.

**Why it happens:** `useBlocker` relies on the data router's blocker registry, which only exists in `createBrowserRouter` (not the legacy `BrowserRouter`).

**How to avoid:** The project already uses `createBrowserRouter` — this pitfall is already avoided. No action needed. But do not test with a standalone `BrowserRouter` in unit tests without mocking the data router context.

**Warning signs:** Runtime error: "useBlocker must be used within a data router."

### Pitfall 3: Stale Closure in setInterval Callbacks

**What goes wrong:** Autosave timer saves the initial (empty) values of `title`, `description`, `body` because the closure captured them at effect creation time.

**Why it happens:** `setInterval` callback is created once when the `useEffect` runs. If state changes later, the closure still holds the original values.

**How to avoid:** Use a `latestDraft` ref that is updated on every state change. Timer callbacks read from `latestDraft.current`.

**Warning signs:** Autosave consistently saves blank/initial content despite the user typing. Hard to notice without checking localStorage.

### Pitfall 4: History Stack Pollution on First Save

**What goes wrong:** After a first save, the user navigates from `/write/new` to `/write/abc`. If `replace: false` (the default), the browser history becomes: `[..., /write/new, /write/abc]`. Clicking back goes to `/write/new`, which now loads an empty form with no slug, confusing the user.

**Why it happens:** `navigate(path)` defaults to `replace: false`, pushing a new history entry.

**How to avoid:** Always use `navigate(`/write/${newSlug}`, { replace: true })` on first save. The existing URL becomes the slug URL; no new history entry is created.

**Warning signs:** Back button from editor goes to `/write/new` instead of `/write`.

### Pitfall 5: Calling `.json()` on 204 Response

**What goes wrong:** `await resp.json()` on a DELETE 204 response throws `SyntaxError: Unexpected end of input`.

**Why it happens:** 204 No Content has an empty body. `JSON.parse('')` throws.

**How to avoid:** For DELETE operations, check `resp.ok` only and do not call `.json()`. See Ideas.tsx line 369 for the exact pattern already used in this codebase.

**Warning signs:** Unhandled rejection with SyntaxError after a successful delete.

### Pitfall 6: `redirectUri` Mismatch After authConfig.js Fix

**What goes wrong:** After changing `redirectUri` from `window.location.origin + "/dashboard"` to `window.location.origin`, any Azure AD App Registration that doesn't have the origin-only URI in its allowed redirect URIs list will reject the login with AADSTS50011.

**Why it happens:** Azure AD validates the `redirectUri` in the auth request against the list configured in the App Registration.

**How to avoid:** Ensure `window.location.origin` (e.g., `https://wonderful-forest-07c56ed03.azurestaticapps.net`) is in the App Registration's Redirect URIs. This is a pre-deployment check, not a code change.

**Warning signs:** Login redirect returns AADSTS50011 "The reply URL does not match".

---

## Code Examples

### authConfig.js final state

```javascript
// Source: src/authConfig.js (current) + D-16, D-17 changes
export const msalConfig = {
  auth: {
    clientId: process.env.REACT_APP_AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.REACT_APP_AZURE_TENANT_ID}`,
    redirectUri: window.location.origin, // Fixed: no /dashboard suffix
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

export const dashboardApiRequest = {
  scopes: [`api://${process.env.REACT_APP_AZURE_CLIENT_ID}/access_as_user`],
};

export const ideasApiRequest = {
  scopes: ['api://e70038a1-6f98-4008-b10a-a5926ec6a861/access_as_user'],
};

// NEW:
export const postsApiRequest = {
  scopes: ['api://825b77cb-1492-406f-9072-923aa536b328/.default'],
};
```

### WriteEditor.tsx skeleton structure

```typescript
// File: src/WriteEditor.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useBlocker, useBeforeUnload } from 'react-router-dom';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus, InteractionRequiredAuthError } from '@azure/msal-browser';
import { postsApiRequest } from './authConfig.js';
import NavBar from './components/nav-bar.tsx';
import Spinner from './components/Spinner.tsx';
import './styling/write-editor.css';

const BASE_URL = process.env.REACT_APP_POSTS_API_BASE_URL;

function WriteEditor() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { instance, inProgress, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [body, setBody] = useState('');
  const [published, setPublished] = useState(false);

  // UI state
  const [loading, setLoading] = useState(!!slug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState('');
  const [lastApiSave, setLastApiSave] = useState<number>(Date.now());

  // Ref for timer IDs
  const localTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const apiTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ref for current values (avoids stale closure in timers)
  const latestDraft = useRef({ title, description, body, published });
  useEffect(() => {
    latestDraft.current = { title, description, body, published };
  }, [title, description, body, published]);

  // Track whether there are unsaved changes since last API save
  const [unsavedSinceApi, setUnsavedSinceApi] = useState(false);

  // Token acquisition
  const getToken = useCallback(async (): Promise<string> => {
    if (inProgress !== InteractionStatus.None) throw new Error('Auth in progress');
    try {
      const resp = await instance.acquireTokenSilent({ ...postsApiRequest, account: accounts[0] });
      return resp.accessToken;
    } catch (e) {
      if (e instanceof InteractionRequiredAuthError) {
        instance.acquireTokenRedirect({
          ...postsApiRequest,
          redirectUri: window.location.origin + (slug ? `/write/${slug}` : '/write/new'),
        });
      }
      throw e;
    }
  }, [instance, inProgress, accounts, slug]);

  // Silent-only token (for background autosave — never redirects)
  const getTokenSilent = useCallback(async (): Promise<string | null> => {
    try {
      const resp = await instance.acquireTokenSilent({ ...postsApiRequest, account: accounts[0] });
      return resp.accessToken;
    } catch { return null; }
  }, [instance, accounts]);

  // Auth gate
  if (!isAuthenticated) { /* login prompt */ }

  // Load existing post on mount (edit mode)
  useEffect(() => {
    if (!slug) { /* restore from localStorage only */ return; }
    // fetch GET /api/posts/:slug then restore from localStorage if newer
  }, [slug]);

  // Two-tier autosave timers
  useEffect(() => {
    const lsKey = slug ? `write-draft-${slug}` : 'write-new-draft';
    localTimerRef.current = setInterval(() => {
      localStorage.setItem(lsKey, JSON.stringify({ ...latestDraft.current, savedAt: Date.now() }));
    }, 2000);
    apiTimerRef.current = setInterval(async () => {
      if (!unsavedSinceApi) return;
      const token = await getTokenSilent();
      if (!token) return;
      // POST or PUT depending on whether slug exists
    }, 45000);
    return () => {
      if (localTimerRef.current) clearInterval(localTimerRef.current);
      if (apiTimerRef.current) clearInterval(apiTimerRef.current);
    };
  }, [slug, getTokenSilent, unsavedSinceApi]);

  // Navigation blocking (EDIT-09)
  const blocker = useBlocker(unsavedSinceApi);
  useBeforeUnload(useCallback((e: BeforeUnloadEvent) => {
    if (unsavedSinceApi) e.preventDefault();
  }, [unsavedSinceApi]));

  // ... render
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-----------------|--------------|--------|
| `<Prompt>` component for navigation blocking | `useBlocker` hook | react-router-dom v6.0 (2021) | `Prompt` removed entirely; `useBlocker` is the stable replacement as of v6.4+ |
| `BrowserRouter` + `useHistory` | `createBrowserRouter` + `useNavigate` | react-router-dom v6.0 | `useHistory` removed; project already uses v6 patterns |
| MSAL v1/v2 `acquireTokenSilent` returns token string | MSAL v3+ returns `AuthenticationResult` object; access `.accessToken` | MSAL v3 | The project uses MSAL v5 — always use `.accessToken` property, not the return value directly |

**Deprecated/outdated:**
- `Prompt` (react-router-dom): Removed in v6. Do not import. `unstable_usePrompt` exists but is explicitly marked unstable and has browser compatibility issues per the source code comment.
- `useHistory` (react-router-dom): Removed in v6. Use `useNavigate` instead.
- `acquireTokenPopup`: Works but not used in this project — all existing pages use redirect flow. Stay consistent.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `navigate(path, { replace: true })` is the correct v6 API for replacing history entries | Pattern 7 | Low risk — this is the documented v6 useNavigate API; confirmed by reading the react-router-dom type definition |
| A2 | The posts-api App Registration (825b77cb-...) accepts `.default` scope and returns tokens that the Python Functions backend validates | authConfig.js pattern | Medium — if the backend expects `access_as_user` scope instead of `.default`, token validation will fail. This scope was specified in D-16 by the user who owns the App Registration. |
| A3 | `window.location.origin` is already registered as a Redirect URI in the Azure AD App Registration | Pitfall 6 | Medium — if not registered, login from any non-/dashboard URL will fail with AADSTS50011. This requires a manual check in the Azure portal. |

---

## Open Questions

1. **Azure AD App Registration Redirect URI**
   - What we know: `redirectUri` fix changes it from `origin + "/dashboard"` to `origin` only
   - What's unclear: Whether `origin` (without path) is already in the App Registration's allowed redirect URIs list
   - Recommendation: Planner should add a task "Verify/add `window.location.origin` to Azure AD App Registration Redirect URIs" as a prerequisite check before the auth integration task

2. **API autosave on `/write/new` before first manual save**
   - What we know: The API autosave timer runs every 45s; for a new post, there is no slug yet, so PUT is impossible
   - What's unclear: Should the API autosave on a new post trigger a POST (creating a draft) automatically, or wait for the first manual Save click?
   - Recommendation: Per D-13, the API tier autosaves too — but D-03 says URL update happens after the "first save". The simplest interpretation: API autosave on `/write/new` also calls POST and then updates the URL. Planner should confirm this interpretation is consistent with D-03.

3. **`unsavedSinceApi` tracking precision**
   - What we know: The blocker and beforeunload should fire only when there are changes not yet in the API
   - What's unclear: Whether to track unsaved state per-field or as a single dirty flag reset on each API save
   - Recommendation: Single boolean `unsavedSinceApi`, set to `true` on any field change, reset to `false` after successful API save. Simple and sufficient for v1.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `react-router-dom` | Routing, `useBlocker` | Yes | 6.30.0 (installed) | — |
| `@azure/msal-browser` | Token acquisition | Yes | 5.7.0 (installed) | — |
| `@azure/msal-react` | `useMsal`, `useIsAuthenticated` | Yes | 5.3.0 (installed) | — |
| `REACT_APP_POSTS_API_BASE_URL` | All API calls | Yes (in CI secrets from Phase 3) | — | App shows error message if unset |
| Azure posts-api (Phase 4) | Save/load/delete operations | Yes (Phase 4 complete) | — | — |

**Missing dependencies with no fallback:** none

**Missing dependencies with fallback:** `REACT_APP_POSTS_API_BASE_URL` — if not set locally, the app renders an error message (same as `Posts.tsx` pattern). Development still works for auth-gating and UI layout.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | react-scripts (Jest + React Testing Library, built into CRA) |
| Config file | none — CRA auto-detects test files |
| Quick run command | `npm test -- --watchAll=false --testPathPattern=Write` |
| Full suite command | `npm test -- --watchAll=false` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EDIT-01 | `/write` renders login prompt when unauthenticated | unit | `npm test -- --watchAll=false --testPathPattern=Write` | No — Wave 0 |
| EDIT-02 | Auth-gated — MSAL `useIsAuthenticated` false renders login | unit | same | No — Wave 0 |
| EDIT-03 | `WriteEditor` renders title/description/body fields | unit | same | No — Wave 0 |
| EDIT-04 | `WriteEditor` loads existing post by slug | unit | same | No — Wave 0 |
| EDIT-05 | Delete calls DELETE endpoint, navigates to /write | unit | same | No — Wave 0 |
| EDIT-06 | Published checkbox state is reflected in save payload | unit | same | No — Wave 0 |
| EDIT-07 | localStorage is written within 3s of field change | unit (fake timers) | same | No — Wave 0 |
| EDIT-08 | API save is called within 60s of field change | unit (fake timers) | same | No — Wave 0 |
| EDIT-09 | Navigation blocked when unsaved changes exist | unit (mock useBlocker) | same | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- --watchAll=false --testPathPattern=Write`
- **Per wave merge:** `npm test -- --watchAll=false`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/Write.test.tsx` — covers EDIT-01, EDIT-02, EDIT-05
- [ ] `src/WriteEditor.test.tsx` — covers EDIT-03, EDIT-04, EDIT-06, EDIT-07, EDIT-08, EDIT-09
- [ ] `src/__mocks__/@azure/msal-react.tsx` — mock for `useMsal`, `useIsAuthenticated` (needed for all write tests)

---

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | MSAL — Azure AD; no custom auth |
| V3 Session Management | Yes | MSAL sessionStorage token cache; tokens expire per AAD policy |
| V4 Access Control | Yes | API validates Bearer token server-side (Phase 4, SEC-02 complete); client shows login gate |
| V5 Input Validation | Yes | No sanitization in textarea (raw markdown is stored as-is); XSS risk is on the reading side, handled by `react-markdown` (SEC-01) |
| V6 Cryptography | No | No custom crypto; TLS via Azure SWA |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via rendered markdown | Spoofing/Tampering | `react-markdown` on reading side (SEC-01). Editor stores raw markdown — no rendering in editor. |
| Token in browser storage | Information Disclosure | MSAL uses sessionStorage (closes on tab close). `storeAuthStateInCookie: false`. This is the project's established choice. |
| CSRF on API calls | Tampering | Bearer token in Authorization header (not cookie). Fetch API does not auto-include cookies. CSRF not applicable to Bearer auth. |
| Unauthorized API access | Elevation of Privilege | Server validates Bearer token on all POST/PUT/DELETE (Phase 4, SEC-02 complete). Client-side auth gate is UX only, not security boundary. |

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 5 |
|-----------|------------------|
| `npm start` uses `WATCHPACK_POLLING=true` | No impact — dev server config unchanged |
| `npm run build` → `/build` | WriteEditor and Write must import correctly (no missing deps) |
| `npm test` — interactive watch mode | Use `--watchAll=false` in CI/plan verification |
| `npx eslint src/` | New files must pass ESLint; `CI=false` suppresses warnings-as-errors |
| CRA TypeScript/JSX architecture | All new files: `.tsx` extension, typed props/state |
| Client-side routing via react-router-dom | All 3 new routes added to `createBrowserRouter` in `src/index.js` |
| SPA routing on Azure: `staticwebapp.config.json` rewrites all navigation to `index.html` | `/write`, `/write/new`, `/write/:slug` deep links will work correctly without any config changes |
| Digits feature uses stub data in development | No impact on Write pages |
| MomentumFinder uses `REACT_APP_API_BASE_URL` | Unrelated; Write uses `REACT_APP_POSTS_API_BASE_URL` |
| Styling: each major view has a corresponding CSS file in `src/styling/` | `write.css` and `write-editor.css` must be created |
| Reusable UI in `src/components/` | Reuse `Spinner.tsx` for loading states |

---

## Sources

### Primary (HIGH confidence)

- `src/Ideas.tsx` — MSAL token acquisition pattern, getToken/getTokenSilent pattern, DELETE handling, useCallback pattern, auth gate early-return pattern — read in full
- `src/Dashboard.tsx` — secondary auth pattern reference (simpler, no inProgress guard)
- `src/authConfig.js` — current state (missing postsApiRequest, redirectUri bug confirmed)
- `src/index.js` — router registration pattern (createBrowserRouter, flat routes)
- `src/components/nav-bar.tsx` — current state (no MSAL imports, needs useIsAuthenticated)
- `node_modules/react-router-dom/dist/umd/react-router-dom.development.js` — useBlocker and useBeforeUnload implementations, unstable_usePrompt comment, IDLE_BLOCKER shape
- `node_modules/@remix-run/router/dist/router.umd.js` — IDLE_BLOCKER = `{ state: "unblocked", proceed, reset, location }`
- `node_modules/@azure/msal-react/dist/MsalContext.d.ts` — `inProgress: InteractionStatus` confirmed in useMsal() return type
- Runtime `node -e` checks — InteractionStatus.None === 'none', InteractionRequiredAuthError export, useBlocker/useBeforeUnload/unstable_usePrompt presence all confirmed
- `package.json` — installed versions of all dependencies

### Secondary (MEDIUM confidence)

- `.planning/phases/05-editor-ui/05-CONTEXT.md` — locked decisions and scope
- `.planning/phases/05-editor-ui/05-UI-SPEC.md` — component names, CSS class names, autosave status display logic
- `.planning/REQUIREMENTS.md` — EDIT-01 through EDIT-09 definitions

### Tertiary (LOW confidence)

- None — all key claims verified against installed package source or project files

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against installed node_modules
- Architecture patterns: HIGH — all patterns verified against existing codebase files
- react-router-dom useBlocker: HIGH — verified against installed v6.30.0 source
- MSAL patterns: HIGH — verified against installed v5.7.0 / v5.3.0 source and type definitions
- Pitfalls: HIGH — all derived from verified source code reading or explicit codebase patterns

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (stable ecosystem — no fast-moving dependencies)
