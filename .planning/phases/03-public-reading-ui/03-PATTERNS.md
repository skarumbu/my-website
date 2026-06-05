# Phase 3: Public Reading UI - Pattern Map

**Mapped:** 2026-06-04
**Files analyzed:** 10 (new/modified)
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/Posts.tsx` | component (page) | request-response | `src/Ideas.tsx` | role-match (same fetch+state pattern, no auth) |
| `src/PostReader.tsx` | component (page) | request-response | `src/MomentumFinder.tsx` | role-match (single-resource fetch, env-guard, Spinner) |
| `src/styling/posts.css` | config (styles) | — | `src/styling/ideas.css` | exact (same page-shell pattern, same CSS vars) |
| `src/styling/post-reader.css` | config (styles) | — | `src/styling/ideas.css` | role-match (content column layout, prose rules) |
| `src/components/nav-bar.tsx` | component (nav) | — | `src/components/nav-bar.tsx` | exact (edit: add `<a href="/posts">` entry) |
| `src/components/DigitsNavBar.tsx` | component (nav) | — | `src/components/DigitsNavBar.tsx` | exact (edit: add entry to `NAV_LINKS` array) |
| `src/App.tsx` | component (page) | — | `src/App.tsx` | exact (edit: add `.card-writing` card + nav link) |
| `src/index.js` | config (routes) | — | `src/index.js` | exact (edit: add two route entries) |
| `src/__tests__/Posts.test.tsx` | test | — | none in codebase | no analog (see No Analog section) |
| `src/__tests__/PostReader.test.tsx` | test | — | none in codebase | no analog (see No Analog section) |

---

## Pattern Assignments

### `src/Posts.tsx` (page component, request-response)

**Analog:** `src/Ideas.tsx` + `src/MomentumFinder.tsx`

**Imports pattern** — copy structure from Ideas.tsx (lines 1-7), adjusted:
```typescript
import React, { useState, useEffect } from 'react';
import NavBar from './components/nav-bar.tsx';
import Spinner from './components/Spinner.tsx';
import './styling/posts.css';

const BASE_URL = process.env.REACT_APP_POSTS_API_BASE_URL;
```
Note: explicit `.tsx` extension on local imports matches project convention (Ideas.tsx line 2, MomentumFinder.tsx line 2).

**Interface declaration** — directly after imports:
```typescript
interface Post {
  title: string;
  slug: string;
  date: string;         // ISO date string e.g. "2026-05-30"
  description: string;
  updatedAt: string;
}
```

**State declaration pattern** — copy from Ideas.tsx lines 600-604, simplified (no auth state needed):
```typescript
function Posts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
```

**useEffect + fetch pattern** — copy env-guard from Ideas.tsx line 651, fetch chain from MomentumFinder.tsx lines 28-70 (simplified to one-shot, no polling):
```typescript
  useEffect(() => {
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
```

**Date helper** — derived from RESEARCH.md Pitfall 4 (avoids UTC off-by-one):
```typescript
function fmtDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}
```
Note: Ideas.tsx has its own `fmtDate` (lines 55-65) but that computes relative time ("3d ago"). Posts pages need absolute formatted dates — use the UTC-safe pattern from RESEARCH.md instead.

**JSX render pattern** — copy tri-state (loading / error / empty / data) structure from MomentumFinder.tsx lines 72-133:
```tsx
  return (
    <div className="posts-page">
      <NavBar />
      <div className="posts-content">
        <h1 className="posts-heading">Writing</h1>
        {loading && <Spinner />}
        {error && <p className="posts-error">{error}</p>}
        {!loading && !error && posts.length === 0 && (
          <p className="posts-empty">No posts yet. Check back soon.</p>
        )}
        {!loading && !error && posts.length > 0 && (
          <ul className="posts-list">
            {posts.map(post => (
              <li key={post.slug}>
                <a className="posts-row" href={`/posts/${post.slug}`}>
                  <span className="posts-row-title">{post.title}</span>
                  <span className="posts-row-date">{fmtDate(post.date)}</span>
                  <span className="posts-row-desc">{post.description}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Posts;
```

---

### `src/PostReader.tsx` (page component, request-response)

**Analog:** `src/MomentumFinder.tsx` (env-guard + single fetch) + `src/Ideas.tsx` (error pattern)

**Imports pattern** — adds `useParams` and `react-markdown` on top of MomentumFinder pattern:
```typescript
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Markdown from 'react-markdown';
import NavBar from './components/nav-bar.tsx';
import Spinner from './components/Spinner.tsx';
import './styling/post-reader.css';

const BASE_URL = process.env.REACT_APP_POSTS_API_BASE_URL;
```

**Interface declaration:**
```typescript
interface Post {
  title: string;
  slug: string;
  date: string;
  description: string;
  updatedAt: string;
  body: string;   // raw markdown string
}
```

**State + slug extraction:**
```typescript
function PostReader() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
```

**useEffect — slug as dependency** (differs from Posts.tsx which has empty deps array):
```typescript
  useEffect(() => {
    if (!BASE_URL) {
      setError('REACT_APP_POSTS_API_BASE_URL is not configured');
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`${BASE_URL}/api/posts/${slug}`)
      .then(res => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(setPost)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);
```

**react-markdown render — CRITICAL v10 constraint** (wrap in div, not className on Markdown):
```tsx
  return (
    <div className="post-reader-page">
      <NavBar />
      <div className="post-reader-content">
        {loading && <Spinner />}
        {error && (
          <p className="posts-error">
            Could not load this post. It may have been moved or removed.{' '}
            Return to <a href="/posts">Writing</a>.
          </p>
        )}
        {post && (
          <>
            <a className="post-reader-back" href="/posts">← Writing</a>
            <div className="post-reader-header">
              <h1 className="post-reader-title">{post.title}</h1>
              <p className="post-reader-date">{fmtDate(post.date)}</p>
              <p className="post-reader-desc">{post.description}</p>
            </div>
            {/* IMPORTANT: v10 removed className prop from <Markdown> — always wrap in div */}
            <div className="post-reader-body">
              <Markdown>{post.body}</Markdown>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PostReader;
```

---

### `src/styling/posts.css` (stylesheet)

**Analog:** `src/styling/ideas.css` lines 1-60 (page shell), `src/styling/home.css` lines 1-28 (CSS vars)

**CSS variable source** — all tokens come from `src/styling/home.css` `:root` block (lines 5-28). Do NOT redeclare `:root` in posts.css — import `home.css` vars via the existing cascade. Use only:
- `--bg-1` (#FFEFD9) — page background
- `--ink` (#3A2418) — primary text
- `--ink-2` (#6B4A3A) — description text
- `--ink-3` (#A38876) — date / muted text
- `--line` (#F0D7B6) — row dividers
- `--accent` (#E5533C) — error text / links

**Page shell pattern** — copy from ideas.css lines 23-31:
```css
.posts-page {
  min-height: 100vh;
  background: var(--bg-1);
  font-family: 'DM Sans', system-ui, sans-serif;
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
}
```

**Content column pattern** — copy from ideas.css `.ideas-content` (lines 53-60), narrowed:
```css
.posts-content {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 40px 120px;
}
```

**Page heading** — Fraunces 48px (matches ideas-heading scale at line ~90 of ideas.css):
```css
.posts-heading {
  font-family: 'Fraunces', serif;
  font-size: 48px;
  font-weight: 400;
  line-height: 0.95;
  letter-spacing: -0.03em;
  color: var(--ink);
  margin: 48px 0 32px;
}
```

**Post list rows** — new pattern (no existing analog). CSS Grid for title+date on row 1, desc spanning both columns on row 2:
```css
.posts-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.posts-row {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  padding: 20px 0;
  border-bottom: 1px solid var(--line);
  text-decoration: none;
  color: inherit;
  border-radius: 8px;
  transition: background 180ms, padding-left 180ms;
  cursor: pointer;
}

.posts-row:hover {
  background: rgba(255, 255, 255, 0.6);
  padding-left: 12px;
}

.posts-row-title {
  font-family: 'Fraunces', serif;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.25;
  color: var(--ink);
  grid-column: 1;
  grid-row: 1;
}

.posts-row-date {
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 400;
  color: var(--ink-3);
  white-space: nowrap;
  grid-column: 2;
  grid-row: 1;
  align-self: center;
  padding-left: 16px;
}

.posts-row-desc {
  font-family: 'DM Sans', sans-serif;
  font-size: 16px;
  font-weight: 400;
  color: var(--ink-2);
  line-height: 1.5;
  margin-top: 4px;
  grid-column: 1 / -1;
  grid-row: 2;
}
```

**Error / empty states** — copy from ideas.css `.ideas-error` pattern (search "ideas-error" in ideas.css):
```css
.posts-error {
  font-size: 13px;
  color: var(--accent);
  margin: 0 0 12px;
}

.posts-empty {
  font-size: 16px;
  color: var(--ink-2);
  text-align: center;
  padding: 48px 0;
}
```

---

### `src/styling/post-reader.css` (stylesheet)

**Analog:** `src/styling/ideas.css` (page shell) + UI-SPEC.md component inventory for PostReader

**Page shell** — same as posts.css:
```css
.post-reader-page {
  min-height: 100vh;
  background: var(--bg-1);
  font-family: 'DM Sans', system-ui, sans-serif;
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
}
```

**Reading column** — constrained 68ch width (D-04):
```css
.post-reader-content {
  max-width: 68ch;
  width: 100%;
  margin: 0 auto;
  padding: 48px 40px 64px;
}

@media (max-width: 640px) {
  .post-reader-content {
    padding: 24px 20px 64px;
  }
}
```

**Back link:**
```css
.post-reader-back {
  display: inline-block;
  font-size: 13px;
  color: var(--ink-3);
  text-decoration: none;
  margin-bottom: 32px;
  transition: color 180ms;
}

.post-reader-back:hover {
  color: var(--ink);
}
```

**Post header:**
```css
.post-reader-header {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--line);
}

.post-reader-title {
  font-family: 'Fraunces', serif;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.25;
  color: var(--ink);
  margin: 0 0 8px;
}

.post-reader-date {
  font-size: 13px;
  color: var(--ink-3);
  margin: 0 0 12px;
}

.post-reader-desc {
  font-size: 16px;
  color: var(--ink-2);
  line-height: 1.5;
  margin: 0;
}
```

**Prose body** — all scoped under `.post-reader-body` to target react-markdown output (D-06: no syntax highlighting):
```css
.post-reader-body p  { font-size: 16px; line-height: 1.6; color: var(--ink); margin: 0 0 16px; }
.post-reader-body h1 { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 600; line-height: 1.25; margin: 32px 0 12px; }
.post-reader-body h2 { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 600; line-height: 1.25; margin: 28px 0 12px; }
.post-reader-body h3 { font-size: 16px; font-weight: 600; line-height: 1.3; margin: 24px 0 8px; }
.post-reader-body a  { color: var(--accent); text-decoration: none; }
.post-reader-body a:hover { text-decoration: underline; }
.post-reader-body strong { font-weight: 600; color: var(--ink); }
.post-reader-body em { font-style: italic; }
.post-reader-body ul,
.post-reader-body ol { margin: 0 0 16px; padding-left: 24px; }
.post-reader-body li { margin: 0 0 4px; line-height: 1.6; }
.post-reader-body code {
  background: rgba(58, 36, 24, 0.06);
  border-radius: 4px;
  padding: 2px 6px;
  font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace;
  font-size: 13px;
  color: var(--ink);
}
.post-reader-body pre {
  background: rgba(58, 36, 24, 0.05);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 16px;
  overflow-x: auto;
  margin: 0 0 16px;
}
.post-reader-body pre code {
  background: none;
  padding: 0;
  border-radius: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ink);
}
.post-reader-body blockquote {
  border-left: 3px solid var(--line);
  padding-left: 16px;
  color: var(--ink-2);
  margin: 0 0 16px;
}
```

---

### `src/components/nav-bar.tsx` (edit — add Writing link)

**Analog:** `src/components/nav-bar.tsx` itself (lines 1-27)

**Pattern to copy** — existing link structure (lines 8-10). Add one `<a>` entry after the Learning Plan link:
```tsx
// BEFORE (nav-bar.tsx line 22-24):
<a href="/learning-plan" className="button">
  Learning Plan
</a>

// ADD AFTER (same pattern):
<a href="/posts" className="button">
  Writing
</a>
```
No other changes to nav-bar.tsx. Do not add Router imports — the nav bar uses plain `<a href>` tags throughout (existing convention confirmed at lines 8-25).

---

### `src/components/DigitsNavBar.tsx` (edit — add Writing link)

**Analog:** `src/components/DigitsNavBar.tsx` itself (lines 4-10)

**Pattern to copy** — `NAV_LINKS` array. Add one object at end of array (lines 4-10):
```typescript
// BEFORE:
const NAV_LINKS = [
  { href: '/digits',          label: 'Digits' },
  { href: '/momentum-finder', label: 'NBA Games' },
  { href: '/trail-finder',    label: 'Trail Finder' },
  { href: '/ideas',           label: 'Ideas' },
  { href: '/learning-plan',   label: 'Learning Plan' },
];

// AFTER — append Writing entry:
const NAV_LINKS = [
  { href: '/digits',          label: 'Digits' },
  { href: '/momentum-finder', label: 'NBA Games' },
  { href: '/trail-finder',    label: 'Trail Finder' },
  { href: '/ideas',           label: 'Ideas' },
  { href: '/learning-plan',   label: 'Learning Plan' },
  { href: '/posts',           label: 'Writing' },
];
```
No other changes. The render loop (lines 20-28) handles new entries automatically.

---

### `src/App.tsx` (edit — add Writing card + nav link)

**Analog:** `src/App.tsx` existing card pattern (lines 55-100) and nav (lines 16-24)

**Nav link to add** (after Learning Plan at line 23):
```tsx
// Inside .home-nav-links div, after existing links:
<a href="/posts">Writing</a>
```

**Card to add** — copy `.card-trail` structure (lines 67-77) as the closest span-3 analog:
```tsx
<a href="/posts" className="card card-writing">
  <span className="card-decor" style={{ right: 12, bottom: -8, fontSize: 110 }}>✍</span>
  <div>
    <div className="card-label">Journal</div>
    <div className="card-title">Writing</div>
    <div className="card-desc">Thoughts, notes, and project write-ups.</div>
  </div>
  <div className="arrow"><ArrowIcon /></div>
</a>
```

**CSS for card-writing to add to `src/styling/home.css`** — copy `.card-trail` variant (lines 213-218) as template:
```css
.card-writing {
  grid-column: span 3;
  background: var(--c-peach);
  color: var(--c-peach-ink);
}
.card-writing .card-decor { right: 12px; bottom: -8px; font-size: 110px; }
```

**Grid balance note:** Current grid row 2 has: `card-ideas` (span 2) + `card-learn` (span 4) = 6 columns. Adding `card-writing` (span 3) pairs naturally with either ideas (span 2+1=3? — no) or as a new row-3 entry at span 3 + an adjacent span 3. The planner should verify card order produces complete 6-column rows. RESEARCH.md open question 2 flags this explicitly.

---

### `src/index.js` (edit — add two routes)

**Analog:** `src/index.js` itself (lines 20-53)

**Pattern to copy** — existing route object structure (lines 24-52). Add two entries to the `createBrowserRouter` array:
```javascript
// Add these two imports at top with existing imports (lines 1-12 pattern):
import Posts from './Posts.tsx';
import PostReader from './PostReader.tsx';

// Add inside createBrowserRouter([...]) array, after learning-plan entry (lines 48-52):
{
  path: "/posts",
  element: <Posts />,
},
{
  path: "/posts/:slug",
  element: <PostReader />,
},
```
No changes to MSAL setup (lines 18, 57-67) — Phase 3 routes are public (no auth).

---

### `src/__tests__/Posts.test.tsx` (test)

**No direct analog** — no test files exist in the codebase yet. Use pattern from RESEARCH.md Validation Architecture section.

**Test file structure to use:**
```typescript
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Posts from '../Posts';

// Mock fetch globally
beforeEach(() => {
  global.fetch = jest.fn();
});
afterEach(() => {
  jest.resetAllMocks();
});

it('renders post list when API returns data', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({
      posts: [{ title: 'Hello', slug: 'hello', date: '2026-05-30', description: 'A post', updatedAt: '' }]
    }),
  });
  render(<MemoryRouter><Posts /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Hello')).toBeInTheDocument());
});
```

---

### `src/__tests__/PostReader.test.tsx` (test)

**No direct analog** — no test files exist. Requires react-markdown mock due to ESM-only constraint.

**Test file structure to use** — react-markdown mock is required at top of every test file that imports PostReader (RESEARCH.md Pitfall 2):
```typescript
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// REQUIRED: mock react-markdown before importing PostReader
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => (
    <div data-testid="markdown-content">{children}</div>
  ),
}));

import PostReader from '../PostReader';

beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { jest.resetAllMocks(); });

it('renders back link and post content', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({
      title: 'My Post', slug: 'my-post', date: '2026-05-30',
      description: 'Desc', updatedAt: '', body: '# Hello'
    }),
  });
  render(
    <MemoryRouter initialEntries={['/posts/my-post']}>
      <Routes><Route path="/posts/:slug" element={<PostReader />} /></Routes>
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByText('My Post')).toBeInTheDocument());
  expect(screen.getByText('← Writing')).toBeInTheDocument();
});
```

---

## Shared Patterns

### Environment Variable Guard
**Source:** `src/Ideas.tsx` line 651 / `src/MomentumFinder.tsx` lines 30-34
**Apply to:** `Posts.tsx` and `PostReader.tsx` — both fetching components
```typescript
// Pattern: check env var BEFORE setLoading, set error if missing, return early
if (!BASE_URL) {
  setError('REACT_APP_POSTS_API_BASE_URL is not configured');
  return;
}
```

### Error State Display
**Source:** `src/Ideas.tsx` line 937 / `src/styling/ideas.css` `.ideas-error`
**Apply to:** `Posts.tsx`, `PostReader.tsx`
```tsx
{error && <p className="posts-error">{error}</p>}
```
CSS class `.posts-error` mirrors `.ideas-error`: `font-size: 13px; color: var(--accent); margin: 0 0 12px;`

### Loading Spinner
**Source:** `src/components/Spinner.tsx` (lines 1-12)
**Apply to:** `Posts.tsx`, `PostReader.tsx`
```tsx
import Spinner from './components/Spinner.tsx';
// ...
{loading && <Spinner />}
```
The Spinner component wraps `PulseLoader` from `react-spinners`. No props needed — renders centered by its own `.spinner-container` class.

### CSS Variable Tokens
**Source:** `src/styling/home.css` `:root` block (lines 5-28)
**Apply to:** `src/styling/posts.css`, `src/styling/post-reader.css`
All color tokens (`--bg-1`, `--ink`, `--ink-2`, `--ink-3`, `--line`, `--accent`, `--c-peach`, `--c-peach-ink`) are already declared globally. No re-declaration needed in new CSS files.

### Google Fonts Import
**Source:** `src/styling/ideas.css` line 1 / `src/styling/home.css` line 3
**Apply to:** `src/styling/posts.css`, `src/styling/post-reader.css`
```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,400..800,100&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
```
Omit Caprasimo — not used on posts pages (home page only per UI-SPEC).

### CSS Import Order Convention
**Source:** `src/MomentumFinder.tsx` line 3 / `src/Ideas.tsx` line 3
**Apply to:** `Posts.tsx`, `PostReader.tsx`
CSS import is always **last** in the import block, after all component/hook imports.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/__tests__/Posts.test.tsx` | test | — | No test files exist in codebase; use RESEARCH.md test patterns |
| `src/__tests__/PostReader.test.tsx` | test | — | No test files exist; requires react-markdown mock (ESM-only pitfall) |

---

## Critical Anti-Patterns (from RESEARCH.md — enforce in planning)

| Anti-Pattern | Where It Would Occur | Correct Approach |
|---|---|---|
| `dangerouslySetInnerHTML` for post body | `PostReader.tsx` | Use `<Markdown>{post.body}</Markdown>` wrapped in `<div>` (SEC-01, D-11) |
| `<Markdown className="post-reader-body">` | `PostReader.tsx` | v10 removed className prop — wrap in `<div className="post-reader-body">` instead |
| Missing env var guard | `Posts.tsx`, `PostReader.tsx` | Always `if (!BASE_URL) { setError(...); return; }` before fetch |
| `.tsx` extension omitted on local imports | All new files | `import NavBar from './components/nav-bar.tsx'` — project convention requires explicit extension |

---

## Metadata

**Analog search scope:** `src/`, `src/components/`, `src/styling/`
**Files scanned:** 8 source files read directly
**Pattern extraction date:** 2026-06-04
