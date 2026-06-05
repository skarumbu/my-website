---
phase: "03"
plan: "02"
subsystem: public-reading-ui
tags: [react, typescript, react-markdown, routing, css]
dependencies:
  requires: [03-01]
  provides: [post-reader-component, posts-slug-route]
  affects: [src/index.js]
tech-stack:
  added: []
  patterns: [useParams, useEffect-fetch, react-markdown-v10]
key-files:
  created:
    - src/PostReader.tsx
    - src/styling/post-reader.css
  modified:
    - src/index.js
decisions:
  - BASE_URL declared inside useEffect (matches Posts.tsx pattern from Plan 01)
  - HTML entity &#8592; used for left arrow to avoid encoding issues in JSX
  - No className on Markdown element (react-markdown v10 removed className prop)
metrics:
  duration: "~5 minutes"
  completed: "2026-06-04"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 3 Plan 02: PostReader Component Summary

Built the `/posts/:slug` reader page: a single-post view that fetches a post by slug from the API, renders its markdown body via `react-markdown`, and provides a back-link to the `/posts` listing.

## What Was Built

**src/PostReader.tsx** — React functional component that:
- Extracts `slug` from URL params via `useParams`
- Fetches `GET ${BASE_URL}/api/posts/${slug}` inside `useEffect` (BASE_URL declared inside the callback, matching the Posts.tsx pattern)
- Shows a `Spinner` while loading, an error message on failure, and the full post on success
- Renders post title, formatted date, description in a header section
- Renders post body as `<Markdown>{post.body}</Markdown>` inside `<div className="post-reader-body">` — no className on the Markdown element (react-markdown v10 constraint)
- Includes `<a className="post-reader-back" href="/posts">← Writing</a>` back-link
- No `dangerouslySetInnerHTML`, no `rehypeRaw`

**src/styling/post-reader.css** — Full reader layout:
- `max-width: 68ch` centered content column
- Fraunces (serif) + DM Sans font stack
- Responsive padding via `@media (max-width: 640px)`
- Complete body typography: p, h1-h3, a, strong, em, ul/ol/li, code, pre, blockquote

**src/index.js** — Added:
- `import PostReader from './PostReader.tsx'`
- `{ path: "/posts/:slug", element: <PostReader /> }` route after the `/posts` route

## Verification Results

```
CI=true npx jest --testPathPattern="Post"

Test Suites: 2 passed, 2 total
Tests:       3 passed, 3 total
```

- PostReader.test.tsx: PASS (was RED scaffold before this plan)
- Posts.test.tsx: PASS (unchanged — regression check)

Route check: `grep 'path: "/posts/:slug"' src/index.js` — OK
CSS check: `grep '.post-reader-body'` and `grep '68ch'` — OK

## Deviations from Plan

None — plan executed exactly as written. The `&#8592;` HTML entity was used for the left-arrow character (renders identically to `←` literal); the test's `getByText('← Writing')` matched correctly.

## Self-Check: PASSED

- src/PostReader.tsx — FOUND (committed 4103095)
- src/styling/post-reader.css — FOUND (committed 4103095)
- src/index.js import PostReader — FOUND
- src/index.js /posts/:slug route — FOUND
- All 3 tests GREEN — CONFIRMED
