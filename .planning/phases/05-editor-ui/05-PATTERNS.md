# Phase 5: Editor UI - Pattern Map

**Mapped:** 2026-06-05
**Files analyzed:** 10 (6 create, 4 modify)
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/authConfig.js` | config | request-response | `src/authConfig.js` (self) | exact — extend in place |
| `src/index.js` | route | request-response | `src/index.js` (self) | exact — extend in place |
| `src/Write.tsx` | component (list page) | CRUD / request-response | `src/Posts.tsx` | exact — same fetch pattern, same API, adds auth |
| `src/WriteEditor.tsx` | component (editor) | CRUD / event-driven | `src/Ideas.tsx` | exact — MSAL token acquisition, getToken/getTokenSilent, auth gate, delete 204 |
| `src/styling/write.css` | config (CSS) | — | `src/styling/posts.css` | exact — same page-shell pattern |
| `src/styling/write-editor.css` | config (CSS) | — | `src/styling/ideas.css` | role-match — same CSS var system and layout conventions |
| `src/components/nav-bar.tsx` | component | — | `src/components/nav-bar.tsx` (self) | exact — add one conditional link |
| `src/__mocks__/@azure/msal-react.tsx` | test mock | — | `src/__mocks__/fileMock.js` + `src/__tests__/PostReader.test.tsx` (inline mock) | partial — mock file pattern present, no existing MSAL mock |
| `src/Write.test.tsx` | test | — | `src/__tests__/Posts.test.tsx` | exact — identical test scaffolding |
| `src/WriteEditor.test.tsx` | test | — | `src/__tests__/PostReader.test.tsx` | role-match — slug param test pattern |

---

## Pattern Assignments

### `src/authConfig.js` (config, modify)

**Analog:** `src/authConfig.js` (current state, read in full)

**Current state** (`src/authConfig.js` lines 1-19):
```javascript
export const msalConfig = {
  auth: {
    clientId: process.env.REACT_APP_AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.REACT_APP_AZURE_TENANT_ID}`,
    redirectUri: window.location.origin + "/dashboard",  // BUG: hardcoded path
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
```

**Two changes required:**
1. Fix `redirectUri`: remove `+ "/dashboard"` suffix — change to `window.location.origin` only (D-17)
2. Add `postsApiRequest` export after `ideasApiRequest` (D-16):
```javascript
export const postsApiRequest = {
  scopes: ['api://825b77cb-1492-406f-9072-923aa536b328/.default'],
};
```

**Scope format note:** `ideasApiRequest` uses `access_as_user`; `postsApiRequest` uses `.default` — both are valid AAD scope formats, the difference is intentional per D-16.

---

### `src/index.js` (route, modify)

**Analog:** `src/index.js` (current state, lines 22-63)

**Imports pattern** (`src/index.js` lines 1-18): All page components imported at the top of the file as named imports from their `.tsx` paths. Add `Write` and `WriteEditor` to this import block:
```javascript
import Write from './Write.tsx';
import WriteEditor from './WriteEditor.tsx';
```

**Route registration pattern** (`src/index.js` lines 22-63): Flat entries inside `createBrowserRouter([...])` — no nested routes, no `<Outlet>`. Auth gating is done inside each component, NOT at the route level. Add three entries following the `/posts` and `/posts/:slug` entries:
```javascript
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

**Critical:** `createBrowserRouter` is already in use (confirmed, line 15). `useBlocker` in `WriteEditor` requires a data router context — this is already satisfied.

---

### `src/Write.tsx` (component, create — post list page at `/write`)

**Analog:** `src/Posts.tsx` (read in full, 72 lines)

**Imports pattern** (`src/Posts.tsx` lines 1-4, extended for auth):
```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { postsApiRequest } from './authConfig.js';
import NavBar from './components/nav-bar.tsx';
import Spinner from './components/Spinner.tsx';
import './styling/write.css';
```

**State pattern** (`src/Posts.tsx` lines 22-24 — extend with auth state):
```typescript
const [posts, setPosts] = useState<Post[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

**Fetch pattern** (`src/Posts.tsx` lines 26-42 — adapt with Bearer token):
```typescript
// Posts.tsx unauthenticated fetch (the base pattern):
useEffect(() => {
  const BASE_URL = process.env.REACT_APP_POSTS_API_BASE_URL;
  if (!BASE_URL) {
    setError('REACT_APP_POSTS_API_BASE_URL is not configured');
    return;
  }
  setLoading(true);
  setError(null);
  fetch(`${BASE_URL}/api/posts`)
    .then(res => {
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.json();
    })
    .then(json => setPosts(json.posts ?? []))
    .catch(e => setError(e.message))
    .finally(() => setLoading(false));
}, []);

// Write.tsx adds Authorization header via getToken() — see getToken pattern below
```

**Auth gate pattern** (`src/Ideas.tsx` lines 850-863):
```typescript
if (!isAuthenticated) {
  return (
    <div className="write-page">
      <NavBar />
      <div className="write-login-view">
        <h1>Sign in to write</h1>
        <p>This area is private. Sign in with your Microsoft account.</p>
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

**Render pattern** (`src/Posts.tsx` lines 44-69 — same structure, add status badge and delete button per row):
```typescript
return (
  <div className="write-page">
    <NavBar />
    <div className="write-content">
      <h1 className="write-heading">Posts</h1>
      {loading && <Spinner />}
      {error && <p className="write-error">{error}</p>}
      {!loading && !error && posts.length === 0 && (
        <p className="write-empty">No posts yet.</p>
      )}
      {!loading && !error && posts.length > 0 && (
        <ul className="write-list">
          {posts.map(post => (
            <li key={post.slug} className="write-row">
              {/* title, description, status badge, date, delete button */}
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);
```

**Delete pattern** (`src/Ideas.tsx` lines 776-783 and 361-370 — DELETE 204 without .json()):
```typescript
const handleDelete = async (slug: string) => {
  if (!window.confirm(`Delete this post?`)) return;
  const token = await getToken();
  const resp = await fetch(`${BASE_URL}/api/posts/${slug}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (resp.ok || resp.status === 204) {
    setPosts(prev => prev.filter(p => p.slug !== slug));
    // if deleting from editor, navigate('/write')
  } else {
    setError(`Delete failed: ${resp.status}`);
  }
  // NEVER call resp.json() on DELETE — throws SyntaxError on 204
};
```

---

### `src/WriteEditor.tsx` (component, create — editor at `/write/new` + `/write/:slug`)

**Analog:** `src/Ideas.tsx` (primary — MSAL patterns, auth gate, delete 204)

**Imports pattern** (`src/Ideas.tsx` lines 1-6, extended):
```typescript
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useBlocker, useBeforeUnload } from 'react-router-dom';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus, InteractionRequiredAuthError } from '@azure/msal-browser';
import { postsApiRequest } from './authConfig.js';
import NavBar from './components/nav-bar.tsx';
import Spinner from './components/Spinner.tsx';
import './styling/write-editor.css';

const BASE_URL = process.env.REACT_APP_POSTS_API_BASE_URL;
```

**useMsal destructure pattern** (`src/Ideas.tsx` line 597):
```typescript
// Ideas.tsx uses: const { instance, accounts } = useMsal();
// WriteEditor needs inProgress too (for autosave timer guard):
const { instance, inProgress, accounts } = useMsal();
const isAuthenticated = useIsAuthenticated();
```

**getToken pattern** (`src/Ideas.tsx` lines 614-623 — the canonical codebase version):
```typescript
// src/Ideas.tsx lines 614-623
const getToken = useCallback(async (): Promise<string> => {
  try {
    const response = await instance.acquireTokenSilent({ ...ideasApiRequest, account: accounts[0] });
    return response.accessToken;
  } catch (e: any) {
    if (e?.errorCode === 'interaction_in_progress') throw e;
    instance.acquireTokenRedirect({ ...ideasApiRequest, redirectUri: window.location.origin + '/ideas' });
    throw new Error('Redirecting for auth...');
  }
}, [instance, accounts]);
```

**Adapt for WriteEditor** (D-18 — adds `inProgress` guard and `InteractionRequiredAuthError` check):
```typescript
const getToken = useCallback(async (): Promise<string> => {
  if (inProgress !== InteractionStatus.None) throw new Error('Auth in progress');
  try {
    const response = await instance.acquireTokenSilent({ ...postsApiRequest, account: accounts[0] });
    return response.accessToken;
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
```

**getTokenSilent pattern** (`src/Ideas.tsx` lines 626-633 — for background autosave timers):
```typescript
// src/Ideas.tsx lines 626-633
const getTokenSilent = useCallback(async (): Promise<string | null> => {
  try {
    const response = await instance.acquireTokenSilent({ ...ideasApiRequest, account: accounts[0] });
    return response.accessToken;
  } catch {
    return null;
  }
}, [instance, accounts]);
```

**Auth gate pattern** (`src/Ideas.tsx` lines 718-720 for loginRedirect, lines 850-863 for gate render):
```typescript
const handleLogin = () => {
  instance.loginRedirect({ ...postsApiRequest, redirectUri: window.location.origin + '/write' });
};

if (!isAuthenticated) {
  return (
    <div className="write-editor-page">
      <NavBar />
      <div className="write-editor-login-view">
        <h1>Sign in to write</h1>
        <button className="write-editor-login-btn" onClick={handleLogin}>
          Sign in with Microsoft
        </button>
      </div>
    </div>
  );
}
```

**Fetch existing post pattern** (adapt from `src/Posts.tsx` lines 26-42 + Bearer token):
```typescript
useEffect(() => {
  if (!slug) return; // new post — no fetch
  setLoading(true);
  getToken().then(token =>
    fetch(`${BASE_URL}/api/posts/${slug}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).then(res => {
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  }).then(json => {
    const post = json.post ?? json;
    setTitle(post.title ?? '');
    setDescription(post.description ?? '');
    setBody(post.body ?? '');
    setPublished(post.published ?? false);
  }).catch(e => setError(e.message))
    .finally(() => setLoading(false));
}, [slug]); // eslint-disable-line react-hooks/exhaustive-deps
```

**Controlled textarea pattern** (`src/Ideas.tsx` Composer component, lines ~186-193):
```typescript
<textarea
  className="editor-field-body"
  value={body}
  onChange={e => { setBody(e.target.value); setUnsavedSinceApi(true); }}
  placeholder="Write in markdown..."
  rows={12}
  style={{ minHeight: '320px', resize: 'vertical' }}
/>
```

**useRef timer pattern** (from RESEARCH.md Pattern 5 — no existing codebase analog, React standard):
```typescript
const localTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
const apiTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
const latestDraft   = useRef({ title, description, body, published });

// Keep latestDraft in sync with state (no re-render cost):
useEffect(() => {
  latestDraft.current = { title, description, body, published };
}, [title, description, body, published]);

useEffect(() => {
  const lsKey = slug ? `write-draft-${slug}` : 'write-new-draft';
  localTimerRef.current = setInterval(() => {
    localStorage.setItem(lsKey, JSON.stringify({ ...latestDraft.current, savedAt: Date.now() }));
  }, 2000);
  apiTimerRef.current = setInterval(async () => {
    if (!unsavedSinceApi) return;
    const token = await getTokenSilent();
    if (!token) return;
    // POST or PUT
  }, 45000);
  return () => {
    if (localTimerRef.current) clearInterval(localTimerRef.current);
    if (apiTimerRef.current)   clearInterval(apiTimerRef.current);
  };
}, [slug, getTokenSilent]); // unsavedSinceApi read via latestDraft pattern
```

**Navigation blocking pattern** (from RESEARCH.md Pattern 4 — verified against installed v6.30.0):
```typescript
const blocker = useBlocker(unsavedSinceApi);
useBeforeUnload(useCallback((e: BeforeUnloadEvent) => {
  if (unsavedSinceApi) e.preventDefault();
}, [unsavedSinceApi]));

// In JSX:
{blocker.state === 'blocked' && (
  <div className="editor-unsaved-banner">
    You have unsaved changes.
    <button onClick={() => blocker.proceed?.()}>Leave anyway</button>
    <button onClick={() => blocker.reset?.()}>Stay</button>
  </div>
)}
```

**URL update after first save** (from RESEARCH.md Pattern 7 — `useNavigate` with `replace: true`):
```typescript
const navigate = useNavigate();

const handleSave = async () => {
  const token = await getToken();
  if (!slug) {
    const resp = await fetch(`${BASE_URL}/api/posts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, body, published }),
    });
    if (!resp.ok) throw new Error(`${resp.status}`);
    const { slug: newSlug } = await resp.json();
    localStorage.removeItem('write-new-draft');
    navigate(`/write/${newSlug}`, { replace: true }); // replace: true — no history stack pollution
  } else {
    await fetch(`${BASE_URL}/api/posts/${slug}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, body, published }),
    });
  }
  setUnsavedSinceApi(false);
};
```

**DELETE 204 pattern** (`src/Ideas.tsx` — line 369 area, handleDeleteUpdate):
```typescript
const handleDelete = async () => {
  if (!slug || !window.confirm('Delete this post?')) return;
  const token = await getToken();
  const resp = await fetch(`${BASE_URL}/api/posts/${slug}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (resp.ok || resp.status === 204) {
    navigate('/write'); // navigate to list after delete
  } else {
    setError(`Delete failed: ${resp.status}`);
  }
  // Do NOT call resp.json() on DELETE — 204 has no body, .json() throws SyntaxError
};
```

---

### `src/styling/write.css` (CSS, create)

**Analog:** `src/styling/posts.css` (read in full, 96 lines)

**CSS variable system** (`src/styling/posts.css` lines 1, 3-8 — uses global CSS vars from main.css):
```css
/* posts.css uses var(--bg-1), var(--ink), var(--ink-2), var(--ink-3), var(--line), var(--accent) */
/* write.css should use the same var names — no hardcoded colors */
```

**Page shell pattern** (`src/styling/posts.css` lines 3-15):
```css
.write-page {
  min-height: 100vh;
  background: var(--bg-1);
  font-family: 'DM Sans', system-ui, sans-serif;
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
}

.write-content {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 40px 120px;
}
```

**List row pattern** (`src/styling/posts.css` lines 32-82 — extend with status badge and delete button columns):
```css
/* posts.css uses grid-template-columns: 1fr auto for title/date */
/* write.css extends to: grid-template-columns: 1fr auto auto for title/date/delete-btn */
.write-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  grid-template-rows: auto auto;
  padding: 20px 0;
  border-bottom: 1px solid var(--line);
}
```

**Error pattern** (`src/styling/posts.css` lines 84-88):
```css
.write-error {
  font-size: 13px;
  color: var(--accent);
  margin: 0 0 12px;
}
```

---

### `src/styling/write-editor.css` (CSS, create)

**Analog:** `src/styling/ideas.css` (lines 1-60 read)

**CSS var and font import pattern** (`src/styling/ideas.css` lines 1-20):
```css
/* ideas.css imports DM Sans + Fraunces from Google Fonts */
/* write-editor.css should use the same font stack — no new font imports needed
   since posts.css already imports them. Use @import only if write-editor.css
   is the first file in the bundle to need these fonts (check existing imports). */

/* Reuse same CSS custom property names as ideas.css and posts.css:
   var(--bg-1), var(--ink), var(--ink-2), var(--ink-3), var(--line),
   var(--accent), var(--accent-dk) */
```

**Page shell pattern** (`src/styling/ideas.css` lines 23-31 — simplified, no texture overlay needed):
```css
.write-editor-page {
  min-height: 100vh;
  background: var(--bg-1);
  font-family: 'DM Sans', system-ui, sans-serif;
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
}

.write-editor-content {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 40px 120px;
  position: relative;
}
```

**Error class pattern** (same across ideas.css, posts.css):
```css
.write-editor-error {
  font-size: 13px;
  color: var(--accent);
  margin: 0 0 12px;
}
```

---

### `src/components/nav-bar.tsx` (component, modify)

**Analog:** `src/components/nav-bar.tsx` (self — read in full, 30 lines)

**Current state** (`src/components/nav-bar.tsx` lines 1-30):
```typescript
import React from "react";
import "../styling/nav-bar.css";
import "../styling/button.css";

const NavBar: React.FC = () => {
  return (
    <nav className="nav-bar">
      <a href="/digits" className="button">Digits</a>
      <a href="/momentum-finder" className="button">NBA Games</a>
      <a href="/trail-finder" className="button">Trail Finder</a>
      <a href="/ideas" className="button">Ideas</a>
      <a href="/learning-plan" className="button">Learning Plan</a>
      <a href="/posts" className="button">Writing</a>
    </nav>
  );
};

export default NavBar;
```

**Two changes required:**
1. Add MSAL import (currently absent — file has no MSAL imports):
```typescript
import { useIsAuthenticated } from '@azure/msal-react';
```
2. Add hook call inside component and conditional link:
```typescript
const NavBar: React.FC = () => {
  const isAuthenticated = useIsAuthenticated();
  return (
    <nav className="nav-bar">
      {/* ... existing links unchanged ... */}
      <a href="/posts" className="button">Writing</a>
      {isAuthenticated && (
        <a href="/write" className="button">Write</a>
      )}
    </nav>
  );
};
```

---

### `src/__mocks__/@azure/msal-react.tsx` (test mock, create)

**Analog:** `src/__tests__/PostReader.test.tsx` lines 5-12 (inline jest.mock pattern)

**No existing `@azure/msal-react` mock exists.** The existing mock file (`src/__mocks__/fileMock.js`) only handles static assets. PostReader uses an inline `jest.mock('react-markdown', ...)` — follow the same inline mock approach but as a manual mock file:

**Pattern to follow** (`src/__tests__/PostReader.test.tsx` lines 5-12 — inline style, adapted to file-level):
```typescript
// src/__mocks__/@azure/msal-react.tsx
// Manual mock — Jest auto-discovers files in __mocks__ next to node_modules
// Provides defaults that can be overridden per-test with jest.spyOn or mockReturnValue

import React from 'react';

export const useIsAuthenticated = jest.fn(() => false);

export const useMsal = jest.fn(() => ({
  instance: {
    acquireTokenSilent: jest.fn(),
    acquireTokenRedirect: jest.fn(),
    loginRedirect: jest.fn(),
  },
  inProgress: 'none',  // InteractionStatus.None === 'none'
  accounts: [{ username: 'test@example.com' }],
}));

export const MsalProvider: React.FC<{ children: React.ReactNode; instance: any }> = ({ children }) =>
  <>{children}</>;
```

**Mock location note:** This file lives at `src/__mocks__/@azure/msal-react.tsx`. Jest resolves manual mocks for `node_modules` packages by looking for `src/__mocks__/<package-name>` when `automock` is false (the CRA default). The `@azure/` scoped package requires the `@azure/` subdirectory inside `__mocks__/`.

---

### `src/Write.test.tsx` (test, create)

**Analog:** `src/__tests__/Posts.test.tsx` (read in full, 36 lines — exact match for scaffolding)

**Test file structure** (`src/__tests__/Posts.test.tsx` lines 1-36):
```typescript
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Posts from '../Posts';

beforeEach(() => {
  process.env.REACT_APP_POSTS_API_BASE_URL = 'http://test.local';
  global.fetch = jest.fn();
});
afterEach(() => {
  jest.resetAllMocks();
});
```

**Adapt for Write.tsx** — same scaffolding, plus MSAL mock setup. The `src/__mocks__/@azure/msal-react.tsx` mock will auto-apply; tests can override `useIsAuthenticated` return value per test:

```typescript
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import Write from '../Write';

// The __mocks__/@azure/msal-react.tsx mock auto-applies.
// Override useIsAuthenticated per test:

beforeEach(() => {
  process.env.REACT_APP_POSTS_API_BASE_URL = 'http://test.local';
  global.fetch = jest.fn();
});
afterEach(() => {
  jest.resetAllMocks();
});

it('shows login prompt when unauthenticated', () => {
  (useIsAuthenticated as jest.Mock).mockReturnValue(false);
  render(<MemoryRouter><Write /></MemoryRouter>);
  expect(screen.getByText(/sign in/i)).toBeInTheDocument();
});

it('renders post list when authenticated', async () => {
  (useIsAuthenticated as jest.Mock).mockReturnValue(true);
  (useMsal as jest.Mock).mockReturnValue({
    instance: { acquireTokenSilent: jest.fn().mockResolvedValue({ accessToken: 'tok' }) },
    inProgress: 'none',
    accounts: [{}],
  });
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ posts: [{ title: 'Hello', slug: 'hello', date: '2026-05-01', description: 'Desc', published: true, updatedAt: '' }] }),
  });
  render(<MemoryRouter><Write /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Hello')).toBeInTheDocument());
});
```

---

### `src/WriteEditor.test.tsx` (test, create)

**Analog:** `src/__tests__/PostReader.test.tsx` (read in full, 39 lines — slug param test pattern)

**Test file structure with slug** (`src/__tests__/PostReader.test.tsx` lines 22-39):
```typescript
render(
  <MemoryRouter initialEntries={['/posts/my-post']}>
    <Routes><Route path="/posts/:slug" element={<PostReader />} /></Routes>
  </MemoryRouter>
);
```

**Adapt for WriteEditor** — uses same `MemoryRouter` + `Routes` + `Route` pattern for slug param, plus fake timers for autosave tests:

```typescript
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import WriteEditor from '../WriteEditor';

// Authenticated mock setup helper
function renderEditor(path: string, initialEntry: string) {
  (useIsAuthenticated as jest.Mock).mockReturnValue(true);
  (useMsal as jest.Mock).mockReturnValue({
    instance: { acquireTokenSilent: jest.fn().mockResolvedValue({ accessToken: 'tok' }),
                acquireTokenRedirect: jest.fn(), loginRedirect: jest.fn() },
    inProgress: 'none',
    accounts: [{}],
  });
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes><Route path={path} element={<WriteEditor />} /></Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  process.env.REACT_APP_POSTS_API_BASE_URL = 'http://test.local';
  global.fetch = jest.fn();
  jest.useFakeTimers(); // for autosave timer tests (EDIT-07, EDIT-08)
});
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.resetAllMocks();
});

it('renders editor fields for new post', () => {
  renderEditor('/write/new', '/write/new');
  expect(screen.getByPlaceholderText(/title/i)).toBeInTheDocument();
});
```

---

## Shared Patterns

### MSAL Token Acquisition
**Source:** `src/Ideas.tsx` lines 614-633
**Apply to:** `src/Write.tsx`, `src/WriteEditor.tsx`

Two functions per component:
- `getToken` (interactive fallback) — for user-triggered actions (save, delete, initial load)
- `getTokenSilent` (background only, returns null on failure) — for autosave timer callbacks

```typescript
// getToken — src/Ideas.tsx lines 614-623 (project canonical pattern)
const getToken = useCallback(async (): Promise<string> => {
  try {
    const response = await instance.acquireTokenSilent({ ...postsApiRequest, account: accounts[0] });
    return response.accessToken;
  } catch (e: any) {
    if (e?.errorCode === 'interaction_in_progress') throw e;
    instance.acquireTokenRedirect({ ...postsApiRequest, redirectUri: window.location.origin + '/write' });
    throw new Error('Redirecting for auth...');
  }
}, [instance, accounts]);

// getTokenSilent — src/Ideas.tsx lines 626-633 (background timer variant)
const getTokenSilent = useCallback(async (): Promise<string | null> => {
  try {
    const response = await instance.acquireTokenSilent({ ...postsApiRequest, account: accounts[0] });
    return response.accessToken;
  } catch {
    return null;
  }
}, [instance, accounts]);
```

### Auth Gate (Unauthenticated Early Return)
**Source:** `src/Ideas.tsx` lines 850-863
**Apply to:** `src/Write.tsx`, `src/WriteEditor.tsx`

Early return before the main render — no `<PrivateRoute>` wrapper. Shows a login button that calls `instance.loginRedirect(...)`.

### Error Display
**Source:** `src/Posts.tsx` line 51 + `src/styling/posts.css` lines 84-88
**Apply to:** `src/Write.tsx`, `src/WriteEditor.tsx`

```typescript
{error && <p className="write-error">{error}</p>}
```
```css
.write-error { font-size: 13px; color: var(--accent); margin: 0 0 12px; }
```

### Loading Spinner
**Source:** `src/Posts.tsx` line 49 — `import Spinner from './components/Spinner.tsx'`
**Apply to:** `src/Write.tsx` (list load), `src/WriteEditor.tsx` (existing post load)

```typescript
{loading && <Spinner />}
```

### Authorization Header
**Source:** `src/Ideas.tsx` line 323 (and throughout)
**Apply to:** All fetch calls in `Write.tsx` and `WriteEditor.tsx`

```typescript
headers: { Authorization: `Bearer ${token}` }
// POST/PUT add: 'Content-Type': 'application/json'
```

### DELETE 204 Handling (Do Not Call .json())
**Source:** `src/Ideas.tsx` handleDeleteUpdate pattern
**Apply to:** Delete handlers in `Write.tsx` and `WriteEditor.tsx`

```typescript
if (resp.ok || resp.status === 204) {
  // success — no body to parse
} else {
  throw new Error(`${resp.status}`);
}
// NEVER chain .json() after a DELETE
```

### Test MSAL Mock
**Source:** No existing file — new `src/__mocks__/@azure/msal-react.tsx`
**Apply to:** `src/Write.test.tsx`, `src/WriteEditor.test.tsx`

Both test files import from `@azure/msal-react` and call `(useIsAuthenticated as jest.Mock).mockReturnValue(...)` to control auth state per test.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Two-tier autosave (`useRef` timers) | pattern within WriteEditor | event-driven | No timer-based autosave exists in codebase; RESEARCH.md Pattern 5 covers this with React standard `useRef`/`setInterval` |
| `useBlocker` / `useBeforeUnload` | pattern within WriteEditor | event-driven | No navigation blocking exists in codebase; RESEARCH.md Pattern 4 covers this — confirmed against installed react-router-dom v6.30.0 source |
| `src/__mocks__/@azure/msal-react.tsx` | test mock | — | No MSAL mock file exists; only `src/__mocks__/fileMock.js` (asset mock). Structure pattern borrowed from inline `jest.mock` in PostReader.test.tsx |

---

## Metadata

**Analog search scope:** `src/`, `src/components/`, `src/styling/`, `src/__tests__/`, `src/__mocks__/`
**Files scanned:** Ideas.tsx, Posts.tsx, PostReader.tsx (via test), authConfig.js, index.js, nav-bar.tsx, posts.css, ideas.css, Posts.test.tsx, PostReader.test.tsx, fileMock.js
**Pattern extraction date:** 2026-06-05
