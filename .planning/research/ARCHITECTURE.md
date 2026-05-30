# Architecture Patterns: Posts Feature

**Domain:** Custom blog/writing system on Azure React SPA
**Researched:** 2026-05-30
**Confidence:** HIGH — all major components match verified Azure SDK docs and existing codebase patterns

---

## Recommended Architecture

The posts feature follows the same layered pattern the site already uses — one Azure Functions app for the API, one React page component per route — but adds a new storage layer (Azure Blob Storage) and a new auth-gated write path.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                            User Browser                                   │
│                        (React SPA on Azure SWA)                          │
└──────────────────────────┬───────────────────────────────────────────────┘
                           │  react-router-dom
          ┌────────────────┼────────────────────────┐
          ▼                ▼                         ▼
   Posts.tsx          PostReader.tsx           Write.tsx
   /posts             /posts/:slug             /write
   (public)           (public)                 (MSAL-gated)
          │                │                         │
          └────────────────┼─────────────────────────┘
                           │  REACT_APP_POSTS_API_BASE_URL
                           ▼
              ┌─────────────────────────┐
              │   posts-api             │
              │   Azure Functions       │
              │   (Node.js)             │
              │                         │
              │  GET  /api/posts        │  (public)
              │  GET  /api/posts/:slug  │  (public)
              │  POST /api/posts        │  (MSAL Bearer token required)
              │  PUT  /api/posts/:slug  │  (MSAL Bearer token required)
              │  DELETE /api/posts/:slug│  (MSAL Bearer token required)
              └────────────┬────────────┘
                           │  @azure/storage-blob SDK
                           ▼
              ┌─────────────────────────┐
              │   Azure Blob Storage    │
              │   Container: "posts"    │
              │                         │
              │  {slug}.md  (per post)  │
              │  (YAML frontmatter      │
              │   + markdown body)      │
              └─────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With | Auth |
|-----------|---------------|-------------------|------|
| `Posts.tsx` | Fetch and render post list (title, date, excerpt), newest-first | posts-api `GET /api/posts` | None — public |
| `PostReader.tsx` | Fetch single post by slug, render markdown with frontmatter metadata | posts-api `GET /api/posts/:slug` | None — public |
| `Write.tsx` | Auth-gated markdown editor with live preview, create/edit/delete posts | posts-api (all write endpoints) | MSAL Bearer token |
| `posts-api` (Azure Functions) | All post CRUD, blob read/write, token validation on write endpoints | Azure Blob Storage container | Validates Bearer on writes |
| Azure Blob Storage `posts` container | Persists all posts as `{slug}.md` files | posts-api only | Storage connection string (server-side) |
| `authConfig.js` | Adds `postsApiRequest` scope definition | `Write.tsx`, `src/index.js` | — |

**Boundary rules:**
- The React SPA never touches Blob Storage directly — all storage access goes through posts-api
- posts-api never calls back to the SPA — responses are purely data (JSON for lists/metadata, markdown text for post body)
- `Write.tsx` reuses `useMsal` / `instance.acquireTokenSilent()` identically to how `Dashboard.tsx` and `Ideas.tsx` do it — no new auth plumbing

---

## File Format: Blob Storage Layout

Each post is stored as a single `.md` file. The blob name is the slug, which makes lookups O(1) — `containerClient.getBlobClient(`${slug}.md`)`.

```
posts/
  my-first-post.md
  design-doc-for-feature-x.md
  short-note-on-thing.md
```

File structure (each `.md` file):

```markdown
---
title: "My First Post"
date: "2026-05-30"
published: true
excerpt: "A short summary shown on the list page."
---

Full markdown body here...
```

**Frontmatter fields (minimum viable set):**
- `title` — display title
- `date` — ISO date string, used for sort order
- `published` — boolean; controls visibility on public list
- `excerpt` — optional short summary for list view; falls back to first 150 chars of body if absent

**Why slug-as-blob-name:** Avoids a separate index or metadata store. The list endpoint calls `listBlobsFlat({ includeMetadata: false })` and reads frontmatter by downloading each blob — acceptable at personal-blog scale (tens to low hundreds of posts). There is no server-side filter on metadata values in the @azure/storage-blob SDK (confirmed: [GitHub issue #7162](https://github.com/Azure/azure-sdk-for-js/issues/7162)), so all published filtering happens in the Function after reading each blob's frontmatter.

---

## Data Flow

### Public list (`GET /posts`)

```
1. Posts.tsx mounts
   → useEffect → fetch(`${POSTS_API}/api/posts`)

2. posts-api ListPosts function:
   a. containerClient.listBlobsFlat() — iterates all .md blobs
   b. For each blob: download content, parse YAML frontmatter with gray-matter
   c. Filter: published === true
   d. Sort: date descending
   e. Return: JSON array of { slug, title, date, excerpt }

3. Posts.tsx receives array → renders post-card list
```

### Public reader (`GET /posts/:slug`)

```
1. PostReader.tsx mounts, reads useParams().slug
   → useEffect → fetch(`${POSTS_API}/api/posts/${slug}`)

2. posts-api GetPost function:
   a. containerClient.getBlobClient(`${slug}.md`).download()
   b. Parse frontmatter with gray-matter → { data, content }
   c. If published === false → 404 response
   d. Return: JSON { title, date, body (markdown string) }

3. PostReader.tsx receives body
   → <ReactMarkdown> with remark-gfm + rehype-highlight renders to HTML
```

### Auth-gated write (create/edit/delete)

```
1. Write.tsx mounts → useIsAuthenticated() check
   → If false: render MSAL login prompt (same pattern as Dashboard.tsx)
   → If true: render editor

2. User fills editor, clicks Save/Publish
   → instance.acquireTokenSilent(postsApiRequest) → token
   → fetch(`${POSTS_API}/api/posts`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: { slug, title, date, published, body } })

3. posts-api CreatePost / UpdatePost function:
   a. Extract Bearer token from Authorization header
   b. Validate token (azure-jwt-verify or validate-azure-ad-token library)
      → If invalid: 401 response
   c. Assemble .md content: serialize frontmatter + body
   d. containerClient.getBlockBlobClient(`${slug}.md`).upload(content)
   e. Return: 200 { slug }

4. Write.tsx navigates to /posts/${slug} on success
```

### Delete flow

```
1. Write.tsx delete button → confirm dialog
   → fetch(`${POSTS_API}/api/posts/${slug}`, { method: 'DELETE', Authorization: Bearer })

2. posts-api DeletePost function:
   a. Validate token (same as above)
   b. containerClient.getBlobClient(`${slug}.md`).delete()
   c. Return: 204

3. Write.tsx navigates to /posts on success
```

---

## MSAL Auth Wiring

The `authConfig.js` needs a new scope added for the posts API. Pattern matches how `ideasApiRequest` is already defined:

```javascript
// src/authConfig.js  (additive change only)
export const postsApiRequest = {
  scopes: [`api://${process.env.REACT_APP_POSTS_API_CLIENT_ID}/access_as_user`]
};
```

`Write.tsx` imports `postsApiRequest` and calls `instance.acquireTokenSilent(postsApiRequest)` before every write operation — identical to `Dashboard.tsx:143-148` and `Ideas.tsx` pattern.

The posts-api Azure Functions app must be registered as a separate App Registration in Azure AD (or reuse an existing one), with the scope `access_as_user` exposed.

---

## React Component Breakdown

```
src/
  Posts.tsx              ← page component; list view; no auth
  PostReader.tsx         ← page component; single post; no auth
  Write.tsx              ← page component; editor; MSAL-gated
  components/
    PostCard.tsx         ← presentational; { title, date, excerpt, slug } → card
    MarkdownRenderer.tsx ← presentational; { body: string } → rendered HTML
                            wraps react-markdown + plugins, centralizes config
  styling/
    Posts.css
    PostReader.css
    Write.css
```

`MarkdownRenderer.tsx` is the only new shared component worth extracting. It encapsulates:
- `react-markdown` with `remark-gfm` (GitHub Flavored Markdown tables/strikethrough)
- `rehype-highlight` for fenced code blocks
- Any custom component overrides (e.g., styled `<a>` to open external links in new tab)

The editor in `Write.tsx` uses a split-pane layout: left textarea for raw markdown input, right pane reuses `<MarkdownRenderer>` for live preview.

---

## New Route Registration

Two public routes and one auth-gated route added to `src/index.js`:

```javascript
{ path: "/posts", element: <Posts /> },
{ path: "/posts/:slug", element: <PostReader /> },
{ path: "/write", element: <Write /> },
```

No changes to `staticwebapp.config.json` are needed — the existing navigation fallback to `index.html` already covers these new paths.

---

## New Environment Variable

One new `REACT_APP_*` var needed:

```
REACT_APP_POSTS_API_BASE_URL   — base URL for posts-api Azure Function App
```

Add to GitHub Secrets and inject in `.github/workflows/azure-static-web-apps.yml`, matching the existing pattern for all other `REACT_APP_*` vars.

---

## Anti-Patterns to Avoid

### Storing metadata separately in Table Storage
**What:** Split frontmatter into Azure Table Storage and keep only body in Blob Storage (the pattern used by some Azure blog examples).
**Why avoid:** At personal-blog scale this adds infrastructure complexity — a second storage resource, a second SDK, two sources of truth. Frontmatter-in-blob is the simpler and more portable approach.

### Client-side Blob Storage access
**What:** Direct `@azure/storage-blob` calls from the React app using a SAS token or connection string.
**Why avoid:** Connection strings cannot be safely embedded in a browser bundle; SAS tokens are hard to rotate and scope correctly. All Blob access stays server-side in Azure Functions.

### Fetching full post body on the list page
**What:** Downloading all `.md` files fully just to render the list.
**Why avoid:** Expensive — each list request reads every blob. The list endpoint should only return frontmatter fields (title, date, excerpt), not the body. Parse frontmatter in the Function and strip body before returning.

### Building a slug from the title client-side without sanitization
**What:** Auto-generating slug from title string in the browser without sanitizing.
**Why avoid:** Blob names with spaces or special characters break URL routing and SDK lookups. Slugify on the server (or validate on save) to enforce `[a-z0-9-]` format.

### Monolithic `Write.tsx` without a `MarkdownRenderer` component
**What:** Duplicating the markdown rendering logic between PostReader and the editor preview pane.
**Why avoid:** Creates two copies of plugin config to keep in sync. Extract once into `MarkdownRenderer.tsx`.

---

## Suggested Build Order

Dependencies flow bottom-up: storage before API, API before UI, public UI before auth-gated UI.

```
Step 1 — Storage
  Provision Azure Blob Storage container "posts"
  Manual smoke test: upload a .md file, download it

Step 2 — posts-api Functions (read endpoints first)
  GET /api/posts    (list, public)
  GET /api/posts/:slug  (single, public)
  Deploy and smoke test with real blob data

Step 3 — React read UI (no auth needed)
  Add /posts route → Posts.tsx (list)
  Add /posts/:slug route → PostReader.tsx (reader)
  MarkdownRenderer.tsx component
  Wire to posts-api
  All public functionality working end-to-end

Step 4 — posts-api write endpoints (auth required)
  POST /api/posts
  PUT  /api/posts/:slug
  DELETE /api/posts/:slug
  Token validation middleware
  Deploy and smoke test with Bearer token from Postman/curl

Step 5 — React write UI
  Add /write route → Write.tsx with MSAL gate
  Split-pane editor using MarkdownRenderer for preview
  Create / edit / delete flows
  authConfig.js postsApiRequest scope

Step 6 — Polish and integration
  Slug sanitization/validation
  Published/unpublished toggle
  Edit link on PostReader for authenticated user
  NavBar entry for /posts
```

**Why this order:**
- Steps 1-2 unblock manual content creation (blobs can be uploaded directly) before the UI exists
- Steps 2-3 deliver the public reading experience independently of auth complexity
- Step 4 isolates token validation work before any React auth wiring
- Step 5 builds on a working API, so editor feedback is real rather than mocked
- Step 6 finishes the experience without blocking earlier steps

---

## Scalability Considerations

| Concern | At current scale (< 100 posts) | If scale grows (1000+ posts) |
|---------|-------------------------------|------------------------------|
| List endpoint reads all blobs | Fine — sequential download + parse is fast | Slow — consider caching a `posts-index.json` blob, updated on write |
| Markdown parse on every list request | Fine | Pre-render frontmatter to index blob at write time |
| No CDN on posts-api responses | Fine for personal blog | Add Azure Front Door or cache-control headers |
| Single blob container | Fine | No changes needed — Blob Storage scales horizontally |

The personal blog use case never reaches the "slow" threshold, but the `posts-index.json` pattern is a clean escape hatch if needed.

---

## Sources

- Azure Blob Storage list blobs (JavaScript SDK): https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blobs-list-javascript
- Azure Blob Storage metadata: https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-properties-metadata-javascript
- Blob metadata filtering limitation (SDK issue): https://github.com/Azure/azure-sdk-for-js/issues/7162
- Azure Functions + MSAL auth pattern: https://medium.com/@smartdeveloper/azure-functions-rest-api-security-with-msal-and-azure-ad-c9cd75d3316e
- validate-azure-ad-token (npm): https://www.npmjs.com/package/validate-azure-ad-token
- react-markdown (GitHub): https://github.com/remarkjs/react-markdown
- gray-matter for frontmatter parsing: referenced in react-markdown ecosystem docs
- Serverless blog on Azure Functions (reference implementation): https://blog.hueppauff.com/Post/Building-a-serverless-blog-on-Azure-Functions
- Naming blobs: https://learn.microsoft.com/en-us/rest/api/storageservices/naming-and-referencing-containers--blobs--and-metadata

---

*Architecture research: 2026-05-30*
