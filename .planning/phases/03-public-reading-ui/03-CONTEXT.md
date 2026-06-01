# Phase 3: Public Reading UI - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Two new React pages wired to the Phase 2 public API: a `/posts` list showing all published posts sorted newest first, and a `/posts/:slug` reader rendering the full post as markdown. No auth, no mutations — purely a read path. Also includes site integration: a "Writing" nav link and a home page card.

</domain>

<decisions>
## Implementation Decisions

### Post List (/posts)
- **D-01:** Layout is a **vertical list of full-width rows** — not a card grid. Each row: title left-aligned, date right-aligned, description below. New pattern for this site, suited to reading-focused content.
- **D-02:** Page has a simple **"Writing" heading** (H1) at the top before the list.
- **D-03:** The nav link label and page heading both use **"Writing"** (not "Posts") — more personal, matches the project's private-writing-space framing.

### Post Reader (/posts/:slug)
- **D-04:** Content renders in a **constrained reading column (~68ch wide)**, centered with padding on wide screens.
- **D-05:** Post header shows **title + date + description** above the markdown body.
- **D-06:** Code blocks are **styled but not syntax-highlighted** — monospace font, slightly darker background, good padding. Syntax highlighting is a v2 concern (READ-V2-01).
- **D-07:** Standard **nav bar is included** on the reader page (consistent with all other pages).
- **D-08:** A **"back to posts" link** is required (READ-05) — placed at top or bottom of the post, links back to `/posts`.

### Navigation & Site Integration
- **D-09:** Add a **"Writing" link to `src/components/nav-bar.tsx`** (and `src/components/DigitsNavBar.tsx` per the site's convention of updating both nav bars).
- **D-10:** Add a **Posts card to `src/App.tsx`** home page projects grid.

### Security
- **D-11:** Post content MUST be rendered via **`react-markdown`** — no `dangerouslySetInnerHTML` for post content (SEC-01, carried forward from STATE.md pitfall note about `LearningPlan.tsx`).

### Claude's Discretion
- **API env var:** Follow the existing pattern — `REACT_APP_POSTS_API_BASE_URL` env var, injected via CI secrets like all other backend URLs. If the env var is absent, show an inline error message (like MomentumFinder does) rather than stubbing data — the real API is already deployed.
- **Loading state:** Use the existing `Spinner` component (`src/components/Spinner.tsx`) during API fetch.
- **Error state:** Inline `<p className="posts-error">` pattern, matching how other pages handle API errors.
- **react-markdown install:** `npm install react-markdown` — not yet in `package.json`; must be added in this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Scope & Requirements
- `.planning/PROJECT.md` — Core constraints: React 18 + TypeScript + react-router-dom, Azure SWA deployment, no framework changes
- `.planning/REQUIREMENTS.md` — READ-01 through READ-05, SEC-01 (the 6 requirements this phase must satisfy)
- `.planning/ROADMAP.md` §Phase 3 — Success criteria and phase goal

### Prior Phase Decisions
- `.planning/phases/01-storage-schema/01-CONTEXT.md` §Implementation Decisions — Frontmatter schema (title, slug, date, published, description, updatedAt); blob file naming `{slug}.md`
- `.planning/STATE.md` §Known Pitfalls — XSS pitfall (`LearningPlan.tsx` uses `dangerouslySetInnerHTML` — do NOT repeat for posts); MSAL pitfall notes (not relevant to Phase 3 but document for awareness)

### Codebase Integration Points
- `src/index.js` — Add `/posts` and `/posts/:slug` route entries here (react-router-dom v6)
- `src/components/nav-bar.tsx` — Add "Writing" link here
- `src/components/DigitsNavBar.tsx` — Also add "Writing" link (site convention: update both nav bars)
- `src/App.tsx` — Add Posts card to home page projects grid
- `src/authConfig.js` — Reference for env var naming pattern (`REACT_APP_*`) — no auth changes needed in Phase 3
- `.github/workflows/azure-static-web-apps.yml` — Add `REACT_APP_POSTS_API_BASE_URL` env var under `env:` in build step

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/Spinner.tsx` — Loading spinner (PulseLoader) used by MomentumFinder, Ideas — reuse for posts list and reader loading states
- `src/components/nav-bar.tsx` — Add "Writing" link following the existing nav link pattern
- `src/styling/main.css` — `.main` layout wrapper used across all pages — use as base layout for posts pages

### Established Patterns
- **Page component pattern:** Create `src/Posts.tsx` and `src/PostReader.tsx` (PascalCase, matching route name convention). Co-locate CSS at `src/styling/posts.css` and `src/styling/post-reader.css`.
- **Data fetching:** `useEffect` + `useState` with `fetch` (not axios) — matching MomentumFinder, Dashboard, Ideas patterns. Store `posts`, `loading`, `error` state.
- **Error display:** `const [error, setError] = useState<string | null>(null)` → `<p className="posts-error">{error}</p>` — matches the pattern in Ideas.tsx.
- **Route definition:** Add entries in `src/index.js` inside the existing `<Routes>` block.
- **No global state:** All state is local `useState` — no Redux/Zustand/Context needed.
- **Import conventions:** Explicit `.tsx` extensions in local component imports; CSS import last in each component file.

### Integration Points
- `src/index.js` — Route registration (two new routes: `/posts` and `/posts/:slug`)
- `src/App.tsx` — Home page card grid gets a new card for Writing/Posts
- `src/components/nav-bar.tsx` + `DigitsNavBar.tsx` — Nav link addition
- `.github/workflows/azure-static-web-apps.yml` — New `REACT_APP_POSTS_API_BASE_URL` env var

</code_context>

<specifics>
## Specific Ideas

- The "Writing" label (vs "Posts") was a deliberate choice — matches the framing of the project as a personal writing space rather than a generic blog.
- The vertical list layout is intentionally different from the candy card grid on the home page — the reading section should feel calmer and more editorial.
- Code blocks on the reader page should look clean and readable for design docs and project write-ups, even without syntax highlighting.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-public-reading-ui*
*Context gathered: 2026-05-31*
