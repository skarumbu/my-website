# Phase 1: Storage & Schema - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 01-storage-schema
**Areas discussed:** Frontmatter schema extras

---

## Frontmatter Schema Extras

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add updatedAt | Small cost now, saves a future file-format migration if ever showing last-edited dates | ✓ |
| No — strict 5 fields only | YAGNI. Keep schema minimal; add updatedAt in a future phase if actually needed | |

**User's choice:** Yes — add updatedAt (Recommended)
**Notes:** No additional rationale provided beyond selecting the recommended option.

---

| Option | Description | Selected |
|--------|-------------|----------|
| None — 6 fields is the right stop | title, slug, date, published, description, updatedAt. Clean and minimal. | ✓ |
| Add tags field (empty array) | tags are out of scope for v1 but adding an empty array now means no migration later | |
| You decide | Claude picks what makes sense given the solo-author, v1-scope constraints | |

**User's choice:** None — 6 fields is the right stop (Recommended)
**Notes:** User confirmed 6 fields as the stopping point. No tags, no author field.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Every write | Backend always stamps updatedAt on save. Simple, predictable. | ✓ |
| Only post-publish edits | updatedAt stays null until post is published and later edited. More logic. | |

**User's choice:** Every write (Recommended)
**Notes:** updatedAt reflects current file state on every create and update operation.

---

## Claude's Discretion

- **Container provisioning approach** — Not discussed. Claude will prefer Bicep IaC (existing `azure-infrastructure` repo) over manual portal steps.
- **Slug generation** — Not discussed. Auto-derived from title; deduplication via `-2`, `-3` suffix by checking existing blobs.
- **Blob file naming** — Not discussed. `{slug}.md` format chosen for simplicity.
- **Frontmatter serialization library** — Not discussed. `python-frontmatter` (Python backend) for parsing/serialization, per established gray-matter pattern.

## Deferred Ideas

None — discussion stayed within phase scope.
