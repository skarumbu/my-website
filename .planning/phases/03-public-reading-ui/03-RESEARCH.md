# Phase 3: Public Reading UI - Research

**Researched:** 2026-06-04
**Domain:** React (CRA/TypeScript) UI — react-markdown, routing, CSS, API integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Post list layout is a vertical list of full-width rows (not a card grid). Each row: title left-aligned, date right-aligned, description below.
- **D-02:** Page has a simple "Writing" heading (H1) at the top before the list.
- **D-03:** Nav link label and page heading both use "Writing" (not "Posts").
- **D-04:** Content renders in a constrained reading column (~68ch wide), centered with padding on wide screens.
- **D-05:** Post header shows title + date + description above the markdown body.
- **D-06:** Code blocks are styled but NOT syntax-highlighted — monospace font, slightly darker background, good padding. Syntax highlighting is v2 (READ-V2-01).
- **D-07:** Standard nav bar is included on the reader page.
- **D-08:** A "back to posts" link is required (READ-05) — placed at top of the post, links back to `/posts`. Back link text: "← Writing".
- **D-09:** Add a "Writing" link to `src/components/nav-bar.tsx` AND `src/components/DigitsNavBar.tsx`.
- **D-10:** Add a Posts card to `src/App.tsx` home page projects grid.
- **D-11:** Post content MUST be rendered via `react-markdown` — no `dangerouslySetInnerHTML` for post content (SEC-01).

### Claude's Discretion

- **API env var:** `REACT_APP_POSTS_API_BASE_URL` — follow existing `REACT_APP_*` pattern; injected via CI secrets. If absent, show inline error (like MomentumFinder), no stubbing.
- **Loading state:** Reuse existing `Spinner` component (`src/components/Spinner.tsx`).
- **Error state:** Inline `<p className="posts-error">` pattern, matching Ideas.tsx.
- **react-markdown install:** `npm install react-markdown` — not yet in package.json; must be added this phase.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| READ-01 | User can view a list of all published posts at `/posts`, sorted newest first | Confirmed API response `{posts: [...]}` from `GET /api/posts`; local sort by `date` field descending |
| READ-02 | Each post in the list shows title, date, and excerpt/description | API returns `title`, `date` (ISO string), `description` per post object |
| READ-03 | User can click a post to read the full article at `/posts/:slug` | react-router-dom v6 `useParams()` for slug extraction; `GET /api/posts/:slug` returns `{..., body: string}` |
| READ-04 | Post content is rendered from markdown (headings, bold, italic, links, lists, code blocks) | react-markdown v10.1.0 handles all standard CommonMark elements natively via `<Markdown>` default import |
| READ-05 | Post pages have a "back to posts" link | Anchor `<a href="/posts">← Writing</a>` at top of `.post-reader-content` column |
| SEC-01 | Post content rendered using `react-markdown` (not `dangerouslySetInnerHTML`) — prevents XSS | react-markdown uses `React.createElement` internally — never emits raw HTML; XSS-safe by design |

</phase_requirements>

---

## Summary

Phase 3 adds two new React pages (`Posts.tsx` and `PostReader.tsx`) wired to the already-deployed Phase 2 API. The domain is straightforward: fetch JSON from a public REST endpoint, render a list, and render markdown. No auth, no mutations.

The only new external dependency is `react-markdown` v10.1.0 — a well-established library (created 2015, maintained under the `remarkjs` org) that renders markdown safely via `React.createElement`. The library is ESM-only from v7 onward, which works fine with CRA v5's webpack 5 production builds but causes Jest test failures without a workaround. The recommended test strategy is to mock react-markdown in unit tests rather than fight the ESM transformation configuration.

All other patterns in this phase are direct extensions of the existing codebase: the `useEffect`+`useState`+`fetch` data-fetching pattern, the `Spinner` component for loading states, the `NavBar` component, CSS variables from `home.css`/`ideas.css`, and the `createBrowserRouter` route array in `src/index.js`.

**Primary recommendation:** Install `react-markdown@latest`, create `Posts.tsx` and `PostReader.tsx` following the `Ideas.tsx` data-fetching pattern, apply CSS from the UI-SPEC, add two routes to `src/index.js`, add nav links to both nav components, add the Writing card to `App.tsx`, and add the env var to the GitHub Actions workflow.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Post list display (`/posts`) | Browser/Client (React SPA) | — | Pure read UI; no SSR; CRA generates static bundle |
| Post reader display (`/posts/:slug`) | Browser/Client (React SPA) | — | Same — slug extracted via `useParams()`, data fetched client-side |
| Markdown rendering | Browser/Client | — | `react-markdown` runs entirely in the browser; converts string to React elements |
| Data fetching (list + post) | Browser/Client → API | Azure Functions (Phase 2) | Client calls `REACT_APP_POSTS_API_BASE_URL/api/posts` and `/api/posts/:slug` |
| Routing (`/posts`, `/posts/:slug`) | Browser/Client (react-router-dom) | Azure SWA rewrite rule | SPA routing; `staticwebapp.config.json` rewrites all paths to `index.html` |
| Navigation update | Browser/Client | — | Both `NavBar` and `DigitsNavBar` get a "Writing" link |
| Home page card | Browser/Client (`App.tsx`) | — | Static card added to the project grid |
| XSS protection (SEC-01) | Browser/Client (react-markdown) | — | Library uses `React.createElement` — never emits raw HTML |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-markdown | 10.1.0 | Render markdown string to React elements | XSS-safe (no dangerouslySetInnerHTML); project decision D-11, SEC-01; 10+ year history under remarkjs org |
| react-router-dom | ^6.22.1 (already installed) | Route `/posts` and `/posts/:slug`, `useParams()` | Already in project; v6 is current standard |
| react (CRA/TypeScript) | ^18.2.0 (already installed) | Component model | Project foundation |

### Supporting (already in project, no install needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-spinners (PulseLoader) | ^0.14.1 | Loading spinner via `Spinner.tsx` wrapper | During `loading === true` state |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-markdown | marked + dangerouslySetInnerHTML | Forbidden — SEC-01 and project decision D-11 explicitly prohibit this |
| react-markdown | @uiw/react-md-editor | Overkill — editor not needed in Phase 3; adds weight |
| Plain `<a>` for nav | react-router-dom `<Link>` | `<a href>` matches existing nav-bar.tsx pattern exactly; `Link` is fine but changes no behavior on a SPA that already handles routing |

**Installation:**
```bash
npm install react-markdown
```

**Version verification (confirmed):**
```
react-markdown  10.1.0  (published 2025-02-20, created 2015-05-09)
                        registry: npmjs.com/package/react-markdown
                        repo: github.com/remarkjs/react-markdown
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| react-markdown | npm | 11 yrs (2015-05-09) | High (major ecosystem library) | github.com/remarkjs/react-markdown | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

`react-markdown` postinstall script: none detected. [VERIFIED: npm registry + official GitHub]

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
  │
  ├─ /posts  ─────────────────────────────────────────────────────────────┐
  │   Posts.tsx                                                            │
  │   useEffect → fetch(REACT_APP_POSTS_API_BASE_URL + "/api/posts")      │
  │              ┌─────────────┐                                           │
  │              │  loading?   │──→ <Spinner />                            │
  │              │  error?     │──→ <p.posts-error>                        │
  │              │  empty?     │──→ <p.posts-empty>                        │
  │              │  posts[]    │──→ <ul.posts-list>                        │
  │              └─────────────┘        │                                  │
  │                                     └─ <a href="/posts/:slug">         │
  │                                           .posts-row (title/date/desc) │
  │                                                                         │
  ├─ /posts/:slug  ────────────────────────────────────────────────────────┤
  │   PostReader.tsx                                                        │
  │   useParams() → slug                                                   │
  │   useEffect → fetch(BASE_URL + "/api/posts/" + slug)                   │
  │              ┌─────────────┐                                           │
  │              │  loading?   │──→ <Spinner />                            │
  │              │  error?     │──→ <p.posts-error> with /posts link       │
  │              │  post{}     │──→ .post-reader-content                   │
  │              └─────────────┘        │                                  │
  │                                     ├─ <a.post-reader-back> ← Writing  │
  │                                     ├─ .post-reader-header             │
  │                                     │    title / date / description    │
  │                                     └─ <Markdown className-wrapper>    │
  │                                           .post-reader-body            │
  │                                           (react-markdown renders body)│
  │                                                                         │
  └─ External: Azure Functions (Phase 2, already deployed)  ───────────────┘
       GET /api/posts       → { posts: [{title, slug, date, description}] }
       GET /api/posts/:slug → { title, slug, date, description, body }
       CORS: origin = https://www.quixotry.me
```

### Recommended Project Structure

```
src/
├── Posts.tsx               # /posts list page (new)
├── PostReader.tsx          # /posts/:slug reader page (new)
├── styling/
│   ├── posts.css           # styles for Posts.tsx (new)
│   └── post-reader.css     # styles for PostReader.tsx (new)
├── components/
│   ├── nav-bar.tsx         # add "Writing" link (edit)
│   └── DigitsNavBar.tsx    # add "Writing" to NAV_LINKS array (edit)
├── App.tsx                 # add Writing card to projects grid (edit)
└── index.js                # add /posts and /posts/:slug routes (edit)
.github/workflows/
└── azure-static-web-apps.yml  # add REACT_APP_POSTS_API_BASE_URL (edit)
```

### Pattern 1: Data Fetching (matches existing Ideas.tsx / MomentumFinder.tsx)

**What:** `useEffect` + `useState` with native `fetch`; no axios, no global state.
**When to use:** Every page component that loads remote data.

```typescript
// Source: established pattern from src/Ideas.tsx and src/MomentumFinder.tsx
const BASE_URL = process.env.REACT_APP_POSTS_API_BASE_URL;

interface Post {
  title: string;
  slug: string;
  date: string;         // ISO date string e.g. "2026-05-30"
  description: string;
  updatedAt: string;
}

function Posts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  // ...
}
```

### Pattern 2: react-markdown v10 Usage (SEC-01 compliant)

**What:** Render markdown string to React elements. Default import in v10 is `Markdown`.
**When to use:** PostReader.tsx — render `post.body`.

```typescript
// Source: github.com/remarkjs/react-markdown (verified 2026-06-04)
// CRITICAL: wrap <Markdown> in a div with className — v10 removed className prop from the component itself
import Markdown from 'react-markdown';

// In render:
<div className="post-reader-body">
  <Markdown>{post.body}</Markdown>
</div>
```

**v10 breaking change:** The `className` prop was removed from `<Markdown>` itself. Always wrap in a `<div>` with the CSS class. Do NOT write `<Markdown className="post-reader-body">` — this prop no longer exists in v10.

### Pattern 3: Route Registration (react-router-dom v6)

```typescript
// Source: src/index.js pattern
import Posts from './Posts.tsx';
import PostReader from './PostReader.tsx';

// Inside createBrowserRouter([...]):
{
  path: "/posts",
  element: <Posts />,
},
{
  path: "/posts/:slug",
  element: <PostReader />,
},
```

### Pattern 4: useParams in PostReader

```typescript
// Source: react-router-dom v6 docs
import { useParams } from 'react-router-dom';

function PostReader() {
  const { slug } = useParams<{ slug: string }>();
  // slug is the value from the URL, e.g. "my-first-post"
  // ...
}
```

### Pattern 5: Nav Link Addition — DigitsNavBar.tsx

The `DigitsNavBar` uses a `NAV_LINKS` constant array. Add one entry:

```typescript
// Source: src/components/DigitsNavBar.tsx — existing pattern
const NAV_LINKS = [
  { href: '/digits',          label: 'Digits' },
  { href: '/momentum-finder', label: 'NBA Games' },
  { href: '/trail-finder',    label: 'Trail Finder' },
  { href: '/ideas',           label: 'Ideas' },
  { href: '/learning-plan',   label: 'Learning Plan' },
  { href: '/posts',           label: 'Writing' },   // ADD THIS
];
```

### Pattern 6: Home Page Card (App.tsx)

```tsx
// Source: src/App.tsx + src/styling/home.css — existing card pattern
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

CSS for `card-writing` (in `home.css`):
```css
.card-writing {
  grid-column: span 3;
  background: var(--c-peach);
  color: var(--c-peach-ink);
}
.card-writing .card-decor { right: 12px; bottom: -8px; font-size: 110px; }
```

### Anti-Patterns to Avoid

- **`dangerouslySetInnerHTML` for post body:** Strictly forbidden — SEC-01, STATE.md pitfall, and `LearningPlan.tsx` is the explicit do-not-repeat example.
- **`<Markdown className="...">` in v10:** The `className` prop was removed in v10. Wrap in a `<div>` instead.
- **Hardcoded API URL:** Always read from `process.env.REACT_APP_POSTS_API_BASE_URL`. Never hardcode `quixotry.me` domain or function app URL.
- **Fetching in both pages without checking env var:** Check `if (!BASE_URL)` before every fetch call — same guard as MomentumFinder and Ideas.
- **Using `<Link>` instead of `<a>` in nav-bar.tsx:** The existing nav bar uses plain `<a href>` tags. Mixing `<Link>` would require adding a Router context that nav-bar currently doesn't need.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown to HTML | Custom parser, regex replacement, or `marked` + innerHTML | `react-markdown` | Handles all CommonMark edge cases; XSS-safe; images/links sanitized by default `urlTransform` |
| Loading spinner | Custom CSS spinner animation | `Spinner.tsx` (wraps `PulseLoader`) | Already exists; consistent with all other pages |
| Route param extraction | Manual `window.location.pathname.split('/')` | `useParams()` from react-router-dom | Already installed; handles encoding, nested routes correctly |

**Key insight:** react-markdown's default `urlTransform` sanitizes dangerous URLs (javascript:, data:) automatically — this is part of why it is the required choice for SEC-01, not just a library preference.

---

## Common Pitfalls

### Pitfall 1: react-markdown v10 className prop removed

**What goes wrong:** Writing `<Markdown className="post-reader-body">{body}</Markdown>` — TypeScript will error, or it silently does nothing.
**Why it happens:** v10 (released 2025-02-20) removed the `className` prop from the `Markdown` component. It was the only API change in v10.
**How to avoid:** Always wrap `<Markdown>` in a `<div className="post-reader-body">` container.
**Warning signs:** TypeScript type error on className prop, or CSS rules on `.post-reader-body` elements not applying.

### Pitfall 2: Jest fails to import react-markdown (ESM-only)

**What goes wrong:** `npm test` throws `SyntaxError: Cannot use import statement in a module` or `ERR_REQUIRE_ESM` when any test file imports a component that uses react-markdown.
**Why it happens:** react-markdown v7+ is ESM-only. CRA's Jest config uses CommonJS by default and does not transform node_modules.
**How to avoid:** Mock react-markdown in test files. Do not attempt to run PostReader component tests that render the actual Markdown component — mock it.

```typescript
// In test files that import PostReader:
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));
```

**Warning signs:** Tests pass in isolation but fail when importing a component that uses react-markdown.

### Pitfall 3: CORS mismatch in local development

**What goes wrong:** API calls succeed in production but fail locally with CORS errors.
**Why it happens:** The Azure Functions CORS header is hardcoded to `https://www.quixotry.me` in `function_app.py`. `localhost:3000` is not in the allowed origins.
**How to avoid:** In `development` mode, consider using the Azure Functions local emulator or add a CRA proxy in `package.json`. For Phase 3 the simplest workaround is to test against the deployed API using a production-like `REACT_APP_POSTS_API_BASE_URL` in a `.env.local` file, acknowledging CORS will block `localhost` calls. Alternatively, add `http://localhost:3000` to allowed origins in the dev function config.
**Warning signs:** Browser console shows `Access-Control-Allow-Origin` error when running `npm start`.

### Pitfall 4: Date display formatting

**What goes wrong:** Dates display as raw ISO strings like `2026-05-30T00:00:00` or parse incorrectly due to timezone offset.
**Why it happens:** `new Date("2026-05-30")` (date-only string) is treated as UTC midnight; displaying with `toLocaleDateString()` without explicit timezone can shift the displayed day by one in UTC-behind timezones.
**How to avoid:** Use explicit formatting that avoids timezone shifts:
```typescript
function fmtDate(iso: string): string {
  // Use UTC methods to avoid off-by-one-day due to timezone
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}
```
**Warning signs:** Date shows one day earlier than expected when accessed from UTC-behind timezone.

### Pitfall 5: Missing env var not caught early

**What goes wrong:** Component renders empty/blank with no error message because `BASE_URL` is undefined and the fetch call is silently skipped.
**Why it happens:** `if (!BASE_URL) return` without setting an error state means the user sees an empty page with no feedback.
**How to avoid:** Always set an error message when the env var is missing — same pattern as `Ideas.tsx`:
```typescript
if (!BASE_URL) {
  setError('REACT_APP_POSTS_API_BASE_URL is not configured');
  return;
}
```

---

## Code Examples

### API Response Shapes (confirmed from `posts-api/function_app.py`)

```typescript
// Source: C:\Users\Sriram\posts-api\function_app.py (verified 2026-06-04)

// GET /api/posts response
interface ListPostsResponse {
  posts: {
    title: string;
    slug: string;
    date: string;       // ISO date string, e.g. "2026-05-30"
    description: string;
    updatedAt: string;  // ISO date string or empty string
  }[];
}

// GET /api/posts/:slug response
interface GetPostResponse {
  title: string;
  slug: string;
  date: string;
  description: string;
  updatedAt: string;
  body: string;         // Raw markdown string
}

// Error response (4xx/5xx)
interface ErrorResponse {
  error: string;
}
```

### Full PostReader.tsx Skeleton

```typescript
// Source: derived from Ideas.tsx + MomentumFinder.tsx patterns + react-markdown v10 docs
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Markdown from 'react-markdown';
import NavBar from './components/nav-bar.tsx';
import Spinner from './components/Spinner.tsx';
import './styling/post-reader.css';

const BASE_URL = process.env.REACT_APP_POSTS_API_BASE_URL;

interface Post {
  title: string;
  slug: string;
  date: string;
  description: string;
  body: string;
}

function PostReader() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!BASE_URL) { setError('REACT_APP_POSTS_API_BASE_URL is not configured'); return; }
    setLoading(true);
    setError(null);
    fetch(`${BASE_URL}/api/posts/${slug}`)
      .then(res => { if (!res.ok) throw new Error(`${res.status}`); return res.json(); })
      .then(setPost)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="post-reader-page">
      <NavBar />
      <div className="post-reader-content">
        {loading && <Spinner />}
        {error && <p className="posts-error">{error}</p>}
        {post && (
          <>
            <a className="post-reader-back" href="/posts">← Writing</a>
            <div className="post-reader-header">
              <h1 className="post-reader-title">{post.title}</h1>
              <p className="post-reader-date">{fmtDate(post.date)}</p>
              <p className="post-reader-desc">{post.description}</p>
            </div>
            {/* IMPORTANT: wrap <Markdown> in div — v10 removed className prop */}
            <div className="post-reader-body">
              <Markdown>{post.body}</Markdown>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<ReactMarkdown>` default import (v6-v8) | `import Markdown from 'react-markdown'` (default export renamed) | v9+ | Must use `Markdown` not `ReactMarkdown` as component name |
| `<Markdown className="...">` | Wrap in `<div className="..."><Markdown>` | v10 (2025-02-20) | className prop removed from Markdown component itself |
| CommonJS (`require('react-markdown')`) | ESM only (`import Markdown from 'react-markdown'`) | v7 (2022) | CRA production build works; Jest tests require mocking |

**Deprecated/outdated:**
- `react-markdown` v6: Last CommonJS version. Do not pin to v6 — v10 is current, well-supported.
- `<ReactMarkdown>` component name: Renamed to `Markdown` (default export). Old name still works as an alias in some versions but v10 official docs use `Markdown`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `REACT_APP_POSTS_API_BASE_URL` naming convention follows existing `REACT_APP_*` pattern and will be accepted by Azure SWA build step | Standard Stack / CI | Minor — env var would just need renaming if convention differs |
| A2 | CORS allows `localhost:3000` for local dev testing (or devs will test against deployed API) | Pitfall 3 | Local development friction — API calls blocked by CORS |
| A3 | The Azure Functions API is deployed and accessible at production URL for CI smoke testing | Validation Architecture | CI tests may skip integration checks if URL is unavailable |

**If this table is empty:** Not applicable — 3 assumptions logged above.

---

## Open Questions

1. **CORS for local development**
   - What we know: `function_app.py` sets `ALLOWED_ORIGIN = "https://www.quixotry.me"` — a single hardcoded origin.
   - What's unclear: Is there a dev environment override or a `local.settings.json` with `*` origins?
   - Recommendation: Check `C:\Users\Sriram\posts-api\local.settings.json` during Wave 0. If `localhost` isn't allowed, document the local dev workaround (e.g., CORS browser extension or proxy).

2. **Home page card grid span balance**
   - What we know: Current grid has Digits (span 3, span 2), NBA (span 3), Trail (span 3), Ideas (span 2), Learn (span 4) = fits a 6-column grid across 2 rows.
   - What's unclear: Adding a `span 3` Writing card may leave an orphaned partial row depending on order.
   - Recommendation: The planner should verify card order produces a complete grid row. UI-SPEC says `span 3` for Writing — pair it with an adjacent `span 3` card or adjust to `span 2` + `span 4` if layout demands it.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install, CRA build | Yes | v24.15.0 | — |
| npm | Package install | Yes | bundled with Node | — |
| react-scripts | CRA build/test | Yes | ^5.0.1 (in package.json) | — |
| REACT_APP_POSTS_API_BASE_URL | Posts API calls | Not set locally | — | Show error message (designed behavior) |
| Azure Functions (posts-api) | Runtime API calls | Yes (deployed Phase 2) | — | — |

**Missing dependencies with no fallback:** none — all tooling present.

**Missing dependencies with fallback:** `REACT_APP_POSTS_API_BASE_URL` is not set in `.env.local` — this is expected; components show a configured error message when absent.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (via react-scripts test) — CRA built-in |
| Config file | none — `react-scripts test` uses built-in Jest config |
| Quick run command | `npm test -- --watchAll=false --testPathPattern="Posts"` |
| Full suite command | `npm test -- --watchAll=false` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| READ-01 | `/posts` page renders post list when API returns data | unit (mocked fetch) | `npm test -- --watchAll=false --testPathPattern="Posts.test"` | No — Wave 0 |
| READ-02 | Each list row shows title, date, description | unit (mocked fetch) | `npm test -- --watchAll=false --testPathPattern="Posts.test"` | No — Wave 0 |
| READ-03 | PostReader fetches correct slug from URL params | unit (mocked fetch + useParams) | `npm test -- --watchAll=false --testPathPattern="PostReader.test"` | No — Wave 0 |
| READ-04 | Markdown renders `#`, `**`, `_`, links, lists, code | unit (mock react-markdown, verify children passed) | `npm test -- --watchAll=false --testPathPattern="PostReader.test"` | No — Wave 0 |
| READ-05 | "← Writing" link appears on reader page, href="/posts" | unit | `npm test -- --watchAll=false --testPathPattern="PostReader.test"` | No — Wave 0 |
| SEC-01 | `dangerouslySetInnerHTML` not used in Posts/PostReader | static (grep) | `npx eslint src/Posts.tsx src/PostReader.tsx` or `grep -r dangerouslySetInnerHTML src/Posts.tsx src/PostReader.tsx` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- --watchAll=false --testPathPattern="Posts"`
- **Per wave merge:** `npm test -- --watchAll=false`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/Posts.test.tsx` — covers READ-01, READ-02 (mocked fetch)
- [ ] `src/PostReader.test.tsx` — covers READ-03, READ-04, READ-05 (mocked fetch + mocked react-markdown)
- [ ] react-markdown mock setup in each test file (see Pitfall 2 for mock pattern)

**react-markdown Jest mock (required in every test that imports PostReader):**
```typescript
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => (
    <div data-testid="markdown-content">{children}</div>
  ),
}));
```

---

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase 3 is read-only public — no auth |
| V3 Session Management | No | No sessions in this phase |
| V4 Access Control | No | All content is public |
| V5 Input Validation | Partial | URL params (slug) not user-submitted; no forms in Phase 3 |
| V6 Cryptography | No | No crypto operations |
| V7 Error Handling | Yes | Error messages must not expose internal details — use generic messages |

### Known Threat Patterns for React SPA + Markdown Rendering

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via markdown body | Spoofing/Tampering | react-markdown uses React.createElement — never emits raw HTML; no mitigation needed beyond using the library |
| XSS via `dangerouslySetInnerHTML` | Tampering | Explicitly forbidden (SEC-01, D-11) — do not use for post content |
| Open redirect via markdown links | Spoofing | react-markdown's default `urlTransform` blocks `javascript:` and `data:` URLs [CITED: github.com/remarkjs/react-markdown#readme] |
| API key exposure in client bundle | Information Disclosure | `REACT_APP_POSTS_API_BASE_URL` is a URL, not a key; posts API is public (no auth required for reads) — low risk |
| Injected script tags in markdown | Tampering | react-markdown ignores raw HTML by default (`skipHtml` is false but HTML is sanitized through rehype) — verify by not passing `rehypePlugins={[rehypeRaw]}` which would re-enable raw HTML |

**SEC-01 implementation note:** The project-level prohibition on `dangerouslySetInnerHTML` for post content is a hard requirement, not a recommendation. The CI plan should include a grep step verifying absence of `dangerouslySetInnerHTML` in `Posts.tsx` and `PostReader.tsx`.

---

## Sources

### Primary (HIGH confidence)

- `C:\Users\Sriram\posts-api\function_app.py` — API response shape for `/api/posts` and `/api/posts/:slug` confirmed by direct code read
- `github.com/remarkjs/react-markdown` README — import syntax, props, v10 breaking change (className removal), `urlTransform` default behavior [VERIFIED: official GitHub]
- `github.com/remarkjs/react-markdown` CHANGELOG — v10 breaking change confirmed: className prop removed 2025-02-20 [VERIFIED: official GitHub]
- `src/index.js`, `src/App.tsx`, `src/Ideas.tsx`, `src/components/nav-bar.tsx`, `src/components/DigitsNavBar.tsx` — existing patterns confirmed by direct codebase read
- `src/styling/home.css`, `src/styling/ideas.css`, `src/styling/main.css` — CSS variable definitions and layout patterns confirmed by direct read
- `.planning/phases/03-public-reading-ui/03-UI-SPEC.md` — full visual/interaction contract
- `.planning/phases/03-public-reading-ui/03-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)

- npm registry (`npm view react-markdown`) — version 10.1.0, created 2015-05-09, repo confirmed [VERIFIED: npm registry + official GitHub]
- slopcheck output — react-markdown rated [OK] (no hallucination signal)
- github.com/facebook/create-react-app/issues/11946 — CRA v5 + react-markdown ESM test failure confirmed as known issue

### Tertiary (LOW confidence)

- WebSearch results on CRA ESM Jest workarounds — multiple community sources confirm mocking as the practical solution for CRA projects; specific transformIgnorePatterns regex varies by react-markdown version

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — react-markdown confirmed via npm registry + official GitHub; all other dependencies already in project
- Architecture: HIGH — directly derived from existing codebase patterns and confirmed API shape
- Pitfalls: HIGH for ESM/className issues (confirmed via official changelog + open GitHub issues); MEDIUM for CORS/date formatting (reasoned from code, not live-tested)
- Security: HIGH — react-markdown XSS safety confirmed via official docs; SEC-01 is a locked project decision

**Research date:** 2026-06-04
**Valid until:** 2026-09-04 (react-markdown is stable; CRA deprecation trajectory doesn't affect this phase)
