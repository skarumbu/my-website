# Feature Landscape: Custom Blog / Writing System

**Domain:** Personal writing and publishing system (solo author, public readership)
**Researched:** 2026-05-30
**Confidence:** HIGH for table stakes and anti-features (well-established patterns); MEDIUM for differentiators (UX judgment calls)

---

## Table Stakes

Features users expect. Missing = the product does not function as a writing or reading system.

### Writer Side (Editor)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Markdown editing with syntax highlighting | Baseline for any technical writing tool; raw textarea is unusable for long-form | Low | @uiw/react-md-editor covers this; ~4.6 kB gzipped, actively maintained |
| Live split preview | Writers need to see rendered output while writing; absent = constant save/reload loop | Low | Same library; render pane alongside edit pane |
| Create new post | Core CRUD action — without it there is no system | Low | New blank document with empty frontmatter |
| Edit existing post | Writing is non-linear; edits happen after initial save | Low | Load post by slug, write back to Blob Storage on save |
| Save / auto-save | Data loss on accidental close is unacceptable | Medium | Manual save button + debounced auto-save (e.g. 30s idle) |
| Publish / unpublish toggle | Draft posts must not appear in the public feed; author controls visibility | Low | `published: true/false` in frontmatter; API filters on list endpoint |
| Post metadata fields (title, date, slug) | Every post needs a machine-readable identity and sort key | Low | Title and date are required; slug auto-derived from title but overridable |
| Auth gate on editor | Private space is the entire premise; unauthenticated access breaks the product | Low | Reuse existing MSAL / `useIsAuthenticated` pattern from Dashboard and Ideas |
| Delete post | Ability to remove a post entirely; without it storage accumulates orphans | Low | Soft or hard delete from Azure Blob Storage |

### Reader Side (Public Feed and Post View)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Posts list at /posts, newest first | Discovery entrypoint for all content; absent = no way to find anything | Low | Date from frontmatter, sorted descending on list API response |
| Individual post page at /posts/:slug | Full content readable on its own URL; absent = no shareable posts | Low | Fetch single blob by slug, render markdown |
| Rendered markdown (headings, code, lists, links) | Technical writing uses all of these; raw markdown in the browser is unusable | Low | react-markdown or the same renderer used in the editor preview |
| Post title and date visible on post page | Minimal orientation for the reader; absent = post feels disconnected | Low | From frontmatter metadata |
| Post title and date visible on list | Reader needs enough signal to decide which post to open | Low | List API returns title + date + slug; no need to fetch full content |
| Only published posts appear in public feed | Drafts must be invisible to readers; violating this breaks trust | Low | API filters `published: true`; unpublished posts never served |
| Readable typography | Long-form text is unreadable with default browser styles; 50–75 char line width, 1.4–1.5 line height, 16px+ body | Low | CSS only; max-width ~70ch on the content column |

---

## Differentiators

Features that make the writing experience distinctly good. Not expected out of the box, but clearly valued once present.

### Editor Experience

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Focused / distraction-free mode | Calm, full-screen writing removes nav clutter; matches notebook feel described in requirements | Low | Hide nav and sidebar; CSS toggle; no library needed |
| Description / excerpt field | Gives the list view richer previews without rendering full post body | Low | Optional frontmatter field `description`; shown in post list card |
| Estimated read time shown in editor | Writer knows roughly how long their piece reads; motivates finishing | Low | ~200 words/min calculation on word count; purely client-side |
| Auto-generated slug with manual override | Slug-from-title is convenient; override is needed when title changes but URL must stay stable | Low | Derive slug on title input; allow manual edit field |
| Post list sidebar in editor | Jump between posts without leaving the editor; avoids round-trips to /posts | Medium | Requires a list fetch from the API while editor is open |
| Keyboard shortcut for save (Cmd/Ctrl+S) | Writers expect save-on-shortcut; clicking a button breaks flow | Low | `onKeyDown` handler; widely expected by technical writers |
| Unsaved changes warning | Prevents accidental navigation away from in-progress work | Low | `beforeunload` event + React router prompt |

### Reading Experience

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Distinct visual feel from rest of site | Reading space feels calm and focused vs the candy-themed playground; signals intentional context switch | Low | Separate CSS for /posts routes; muted palette, serif or neutral body font |
| Syntax-highlighted code blocks | Technical posts with code are unreadable without it | Low | react-syntax-highlighter or Prism.js as the react-markdown code renderer |
| "Back to posts" navigation from post page | Reader expects to return to the list after finishing; absent = dead end | Low | Simple link/button; no state needed |
| Optional post description shown in list | Brief excerpt helps readers choose; improves scannability of the feed | Low | Only shown when `description` frontmatter field is present |
| Content type label (optional) | Signals intent: "design doc" vs "short note" vs "essay"; helps reader calibrate time and depth | Low | Optional `type` field in frontmatter; rendered as a small label |

---

## Anti-Features

Things to explicitly NOT build in v1. Each has a reason and a "what to do instead."

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Comment system | Personal site, not a community; adds auth, moderation, spam complexity; out of scope per PROJECT.md | Accept no public responses in v1; revisit only if there is a real need |
| Tags / category taxonomy | Adds a filtering UI, tag management UI, tag storage, and tag pages; date ordering handles discovery adequately at small volume | Use `type` frontmatter label as an inert display field only — no filtering logic |
| SEO / sitemap / meta tags | Adds complexity (dynamic `<head>`, Open Graph, canonical URLs); not a primary goal per PROJECT.md | Plain `<title>` tag with post title is sufficient for v1 |
| Search across posts | Full-text search needs indexing; Azure Blob Storage is not a search index | Use browser Ctrl+F on the list page; revisit if post count grows beyond ~100 |
| Image upload / attachment handling | Blob Storage paths, content-type negotiation, image resizing, CDN caching — all new surface area | Markdown image links to externally hosted images are sufficient for now |
| Version history / revision tracking | Git-like diffing and blob versioning adds large complexity; Blob Storage versioning can be enabled later | Overwrite-on-save is sufficient for a solo author |
| Rich text / WYSIWYG editor | ProseMirror-based editors (Milkdown, TipTap) are larger bundles and harder to integrate with raw markdown-as-files storage | Stick with split-pane markdown; add WYSIWYG rendering only if markdown proves a barrier |
| Scheduled / future publishing | Requires a timer-triggered Azure Function and date comparison logic; publish-on-save is sufficient | Set `published: false`, then manually flip when ready |
| Multi-author or roles | Solo-author site; adding roles means a user directory, per-post ownership metadata, and scoped API auth | Single MSAL identity for the one author; no roles system |
| RSS / Atom feed | Adds an XML serialization endpoint and feed discovery `<link>` tag; not requested | Can be added in a future phase if needed; list API JSON is enough to build it later |
| Post analytics / view counts | Requires a write-path on every page load (a counter store or analytics service); privacy implications | Use Azure Static Web Apps built-in analytics or add Plausible later if desired |
| Infinite scroll / pagination | At single-author post volumes (likely < 200 posts in years), a flat list loads fast enough | Full list fetch; add pagination only when performance degrades |

---

## Feature Dependencies

```
MSAL auth (existing) → Editor auth gate
Editor auth gate → Create post, Edit post, Delete post, Publish toggle

Azure Blob Storage (to be provisioned) → All post CRUD
Azure Functions API → All post CRUD (intermediary between React app and Blob Storage)
Azure Functions list endpoint → Posts list (/posts)
Azure Functions get-by-slug endpoint → Individual post page (/posts/:slug)

Post exists with frontmatter → Published/unpublished filter
Post exists with frontmatter → Slug-based routing
Post exists with frontmatter → Date sort in list
Post exists with frontmatter → Description excerpt (optional)

Markdown renderer (react-markdown) → Post reading view
Markdown renderer (react-markdown) + Prism.js → Syntax-highlighted code blocks

Editor save → Blob Storage write → Updated public feed
```

---

## MVP Recommendation

The smallest system that fulfills "private writing space that publishes instantly to a public reading feed":

**Must ship:**

1. Auth-gated editor at `/write` with create, edit, save, publish toggle, delete
2. Markdown editing + live preview in the editor (split pane)
3. Public `/posts` list showing title and date, newest first, published only
4. Public `/posts/:slug` page rendering markdown with code highlighting
5. Readable typography on the reading side (max-width, line height, font size)

**Include with low extra cost:**

6. Auto-save (debounced) — prevents data loss, low complexity
7. Keyboard save shortcut (Cmd/Ctrl+S) — expected by technical writers
8. Unsaved changes warning — prevents lost work
9. Description/excerpt field — improves list scannability
10. "Back to posts" link on post page — prevents reader dead ends

**Defer:**

- Distraction-free mode: Nice, but not blocking any core workflow
- Post list sidebar in editor: Useful but adds a second API call to the editor load path
- Content type label: Can be added to frontmatter schema now, just not rendered in v1 UI
- Read time estimate: Low complexity but genuinely low priority for v1

---

## Sources

- [Best Markdown Editors for React Compared — Strapi Blog](https://strapi.io/blog/top-5-markdown-editors-for-react) — MEDIUM confidence
- [react-md-editor documentation](https://uiwjs.github.io/react-md-editor/) — HIGH confidence
- [Optimal Line Length for Readability — UXPin](https://www.uxpin.com/studio/blog/optimal-line-length-for-readability/) — HIGH confidence
- [Markdown Frontmatter: Metadata for Your Documents — Markdown Live View](https://markdownliveview.com/glossary/what-is-markdown-frontmatter/) — HIGH confidence
- [Inkdrop (notebook-style app) feature reference](https://www.inkdrop.app/) — MEDIUM confidence
- [Notable — Markdown note-taking features](https://notable.app/) — MEDIUM confidence
- [Feature Creep Anti-Pattern — LogRocket](https://blog.logrocket.com/product-management/what-is-feature-creep-how-to-avoid/) — MEDIUM confidence
- PROJECT.md Out of Scope section — HIGH confidence (direct project constraints)
