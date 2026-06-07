# Phase 4: Write API - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 4-write-api
**Areas discussed:** Request/response contract, Authentication approach

---

## Request Body Contract (POST)

| Option | Description | Selected |
|--------|-------------|----------|
| JSON with fields | `{ title, description, body, published }` — API builds frontmatter | ✓ |
| Raw markdown blob | Editor sends full .md with frontmatter; API stores directly | |

**User's choice:** JSON with fields (recommended)
**Notes:** API uses `schema.py::build_post()` to assemble the frontmatter blob; slug auto-generated from title via `generate_slug()`.

---

## Request Body Contract (PUT)

| Option | Description | Selected |
|--------|-------------|----------|
| Full replacement | Same JSON shape as POST; API rewrites entire blob | ✓ |
| Partial fields | Only changed fields sent; API merges with existing blob | |

**User's choice:** Full replacement (recommended)
**Notes:** Slug is immutable (from URL). `updatedAt` always auto-set by backend (Phase 1 decision D-02). `published` field in PUT controls published/draft toggle — no separate endpoint needed.

---

## Authentication Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Enable Easy Auth on posts-api | Follow ideas-api pattern; platform validates Bearer token, injects `X-MS-CLIENT-PRINCIPAL` | ✓ |
| Validate JWT in-handler | Parse `Authorization: Bearer` header manually using PyJWT | |

**User's choice:** Enable Easy Auth (recommended)
**Notes:** Copy `require_auth()` from `ideas-api/auth.py` into posts-api. Enable Azure AD authentication on the posts-api Function App (via Bicep or portal).

---

## Claude's Discretion

- CORS / OPTIONS preflight: configure at Function App level (not manual handler)
- 400/404/500 error response format: follow existing `{"error": "..."}` pattern from read routes
- DELETE returns 204 No Content
- Slug conflict on POST: handled by `generate_slug()` deduplication already

## Deferred Ideas

None — discussion stayed within phase scope.
