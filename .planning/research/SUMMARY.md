# Research Summary — Posts & Writing System

**Date:** 2026-05-30
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## Executive Summary

This project adds a private markdown writing space and a public reading feed to the existing React/Azure SPA. The pattern is well-understood: an auth-gated editor at `/write`, a public post list at `/posts`, and a public post reader at `/posts/:slug`, all backed by Azure Blob Storage (one `.md` file per post with YAML frontmatter) accessed exclusively through Azure Functions.

The recommended stack builds entirely on existing infrastructure — MSAL auth, Azure Functions, Azure Static Web Apps — with additive frontend libraries (`@uiw/react-md-editor@4.1.1` for editing, `react-markdown@10.1.0` for rendering) and server-side additions (`gray-matter`, `@azure/storage-blob`, `slugify`) requiring no build system changes or new services.

The recommended approach is **bottom-up**: provision storage first → read-only API → public reading UI → write API → auth-gated editor. The public reading experience ships before auth complexity is touched, and each layer is independently testable.

---

## Stack

**Recommended additions (all HIGH confidence, npm-verified):**

| Library | Version | Purpose |
|---------|---------|---------|
| `@uiw/react-md-editor` | 4.1.1 | Split-pane markdown editor; 4.6 kB gzipped, React 18 native |
| `react-markdown` | 10.1.0 | XSS-safe renderer via `React.createElement`, not `dangerouslySetInnerHTML` |
| `remark-gfm` | 4.0.1 | GitHub Flavored Markdown (tables, strikethrough, task lists) |
| `rehype-highlight` | 7.0.2 | Syntax highlighting for code blocks |
| `rehype-slug` | 6.0.0 | Auto-IDs on headings for anchor links |
| `gray-matter` | 4.0.3 | Frontmatter parsing in Functions; zero deps |
| `@azure/storage-blob` | 12.31.0 | Blob CRUD from Azure Functions |
| `@azure/identity` | 4.13.1 | Managed Identity (no connection string secrets in prod) |
| `slugify` | 1.6.9 | URL-safe slug generation with Unicode handling |

**Do NOT use:**
- `react-simplemde` — abandoned (3+ years no updates)
- ProseMirror-based editors (Milkdown, TipTap) — overengineered for markdown-as-files
- `dangerouslySetInnerHTML` for rendering — XSS risk
- Direct browser access to Blob Storage — exposes drafts, bypasses `published` filter

---

## Features

**Table stakes (must ship in v1):**
- Auth-gated editor: create, edit, save, publish/unpublish, delete
- Live split-preview in the editor
- Public post list (published only, newest first)
- Public post reader with rendered markdown + code highlighting
- Readable typography (70ch max-width, 1.5 line-height)

**Low-cost additions worth including in v1:**
- Autosave with unsaved-changes warning
- Cmd/Ctrl+S keyboard shortcut to save
- `description` excerpt field in frontmatter
- "Back to posts" link on reader

**Defer to v2+:**
Comments, tags/taxonomy, SEO/sitemap, full-text search, image uploads, version history, WYSIWYG editor, scheduled publishing, RSS, analytics, pagination.

---

## Architecture

**Three new React routes:**
- `/posts` → `PostList.tsx` — public, fetches published posts from Functions API
- `/posts/:slug` → `PostReader.tsx` — public, renders single post
- `/write` → `Write.tsx` — auth-gated, editor with create/edit flows

**One shared component:** `MarkdownRenderer.tsx` (wraps `react-markdown` + plugins). Used in both `PostReader.tsx` and the preview pane of `Write.tsx`.

**Five Azure Functions:**
- `GET /api/posts` — public list (published only, sorted by date)
- `GET /api/posts/:slug` — public reader
- `POST /api/posts` — create (MSAL-gated)
- `PUT /api/posts/:slug` — update (MSAL-gated)
- `DELETE /api/posts/:slug` — delete (MSAL-gated)

**Storage model:** One blob per post, named `{slug}.md`, containing YAML frontmatter + markdown body. Container stays private — all access goes through Functions.

**Frontmatter schema:**
```yaml
---
title: "Post Title"
slug: "post-title"
date: "2026-05-30"
published: true
description: "One-line excerpt"
---
```

**Auth reuse:** `Write.tsx` uses `instance.acquireTokenSilent(postsApiRequest)` — the same pattern as `Dashboard.tsx` and `Ideas.tsx`. One new scope entry in `authConfig.js`.

**Build order:** Storage → Read API → Read UI → Write API → Write UI (see Roadmap Implications).

---

## Top Pitfalls

1. **XSS via markdown** — `LearningPlan.tsx` already uses `dangerouslySetInnerHTML` without sanitization. Same pattern on a public post page = stored XSS. Use `react-markdown` + `rehype-sanitize` — never `dangerouslySetInnerHTML` for post content.

2. **MSAL scope misconfiguration** — `ideasApiRequest` has a hardcoded GUID (flagged in CONCERNS.md). Define `postsApiRequest` using env-var-derived scope. Validate `aud` claim in Functions.

3. **`interaction_in_progress` MSAL crash** — concurrent token requests crash the editor. Centralize token acquisition in a single `usePostsToken()` hook; gate interactive auth behind `inProgress === InteractionStatus.None`.

4. **Draft data loss** — Two-tier autosave: localStorage every 2-3 seconds (crash recovery), API save every 30-60 seconds. Restore from localStorage on editor mount. `beforeunload` warning as minimum safety net.

5. **YAML frontmatter corruption** — Titles with colons (`On React: Why`) corrupt the parse. Always double-quote the `title` value. Use `gray-matter` for serialization — never hand-roll YAML strings.

6. **Blob Storage CORS / direct browser access** — Never expose the container to the browser. Route all reads through Functions. Container privacy enforces the `published` filter and prevents draft enumeration.

---

## Roadmap Implications

**Suggested 5 phases:**

| Phase | Name | What it delivers |
|-------|------|-----------------|
| 1 | Storage & Schema | Blob container, frontmatter schema, slug algorithm locked — prevents data migration later |
| 2 | Read-Only API | `GET /api/posts` + `GET /api/posts/:slug`; no auth complexity; CORS architecture established |
| 3 | Public Reading UI | `/posts` + `/posts/:slug` with XSS-safe `MarkdownRenderer.tsx`; public blog ships before auth |
| 4 | Write API | `POST/PUT/DELETE` with Bearer token validation; auth bugs isolated server-side first |
| 5 | Editor UI | `Write.tsx` with MSAL gate, split-pane editor, autosave, create/edit/delete |

**Research flag:** Phase 4 token validation library needs targeted research during planning (verify maintenance status of `validate-azure-ad-token` vs alternatives for Functions v4 Node.js 18/20).

---

## Confidence

| Area | Level |
|------|-------|
| Stack | HIGH — all versions npm-verified |
| Features | HIGH (table stakes), MEDIUM (differentiators) |
| Architecture | HIGH — matches existing codebase patterns |
| Pitfalls | HIGH — several grounded in live vulnerabilities in existing code |

**Overall: HIGH**

**Open gaps:**
- Token validation library for Phase 4 — resolve during phase planning
- `redirectUri` fix (hardcoded to `/dashboard`) requires Azure AD App Registration access before Phase 5
- Posts index vs full-blob-scan — fine under ~50 posts; if more expected, build `_index.json` in Phase 2
