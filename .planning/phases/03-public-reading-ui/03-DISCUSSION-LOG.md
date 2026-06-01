# Phase 3: Public Reading UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 3-public-reading-ui
**Areas discussed:** Reading page layout, Nav & site integration, Post list style

---

## Reading page layout

| Option | Description | Selected |
|--------|-------------|----------|
| Constrained column (~68ch) | Classic reading width, centered, comfortable for prose and code | ✓ |
| Full-width | Edge-to-edge content | |
| You decide | Claude picks | |

**User's choice:** Constrained column (~68ch)
**Notes:** Matches the "calm, focused" feel from PROJECT.md.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Title + date + description | All three frontmatter fields shown above body | ✓ |
| Title + date only | Minimal header | |
| Title only | Cleanest — body starts immediately | |

**User's choice:** Title + date + description
**Notes:** —

---

| Option | Description | Selected |
|--------|-------------|----------|
| Styled but unsyntax-highlighted | Monospace font, darker background, good padding — no highlighter library | ✓ |
| Plain browser default | No custom styling | |
| You decide | Claude picks | |

**User's choice:** Styled but unsyntax-highlighted
**Notes:** Syntax highlighting deferred to v2 (READ-V2-01).

---

## Nav & site integration

| Option | Description | Selected |
|--------|-------------|----------|
| Add to nav-bar.tsx alongside existing links | Consistent with all other features | ✓ |
| Skip the nav bar — link from home page only | Posts reachable from home card only | |
| You decide | Claude decides | |

**User's choice:** Add to nav-bar.tsx alongside existing links
**Notes:** —

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, add a Posts card | Consistent with how other features appear | ✓ |
| No, nav bar link is enough | Skip the home page card | |
| You decide | Claude decides | |

**User's choice:** Yes, add a Posts card
**Notes:** —

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, include the standard nav bar | Consistent with all other pages | ✓ |
| No nav bar — just a back link | Distraction-free reading | |
| You decide | Claude decides | |

**User's choice:** Yes, include the standard nav bar
**Notes:** —

---

## Post list style

| Option | Description | Selected |
|--------|-------------|----------|
| Vertical list — full-width rows | Title left, date right, description below. Editorial feel. | ✓ |
| Card grid — reuse home page style | Matches candy-themed grid in App.tsx | |
| You decide | Claude picks | |

**User's choice:** Vertical list — full-width rows
**Notes:** Intentionally different from the home page card grid — calmer, editorial.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — simple 'Writing' or 'Posts' heading | H1 at top, styled to match site palette | ✓ |
| No header — jump straight to the list | List starts immediately | |

**User's choice:** Yes — page heading at the top
**Notes:** —

---

| Option | Description | Selected |
|--------|-------------|----------|
| Writing | More personal, matches project framing | ✓ |
| Posts | Standard, matches route /posts | |

**User's choice:** "Writing" — used as both the nav link label and page heading
**Notes:** Deliberate preference for the personal framing over a generic blog label.

---

## Claude's Discretion

- **API integration:** `REACT_APP_POSTS_API_BASE_URL` env var following existing pattern; graceful error state if absent (like MomentumFinder); no stub data since Phase 2 API is deployed.
- **Loading/error states:** Reuse `Spinner` component and inline error `<p>` pattern from other pages.
- **react-markdown installation:** `npm install react-markdown` — not yet in package.json.

## Deferred Ideas

None — discussion stayed within phase scope.
