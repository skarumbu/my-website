# Phase 1: Storage & Schema - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Provision the Azure Blob Storage container for posts and lock the post file format — no API endpoints, no UI, no auth. Deliverables: a provisioned private blob container that Azure Functions can write `.md` files to, a documented and validated frontmatter schema, and a slug generation function with deduplication logic.

</domain>

<decisions>
## Implementation Decisions

### Frontmatter Schema
- **D-01:** Schema has **6 fields**: `title`, `slug`, `date`, `published`, `description`, `updatedAt`. No additional fields in v1.
- **D-02:** `updatedAt` is set automatically by the backend **on every write** (create and update). No manual control needed — always reflects current file state.
- **D-03:** Field types: `title` (string), `slug` (string, URL-safe), `date` (ISO 8601 string), `published` (boolean), `description` (string), `updatedAt` (ISO 8601 string).

### Claude's Discretion
- **Container provisioning approach:** Use the existing Bicep repo (`C:\Users\Sriram\azure-infrastructure\`) if it already manages the storage account; otherwise provision via Azure CLI during this phase. Prefer IaC over manual portal clicks.
- **Slug generation:** Auto-derive from `title` (lowercase, hyphenated, strip special chars). Deduplication: append `-2`, `-3` suffix (check existing blobs before writing). Slug can be overridden manually in later phases (editor UI) — for now, derive only.
- **Blob file naming:** `{slug}.md` — simple, direct lookup by slug with no date prefix needed. The `date` field in frontmatter carries the post date.
- **Frontmatter serialization:** Use `gray-matter` (Python: `python-frontmatter`) for parsing and serializing — consistent with the STATE.md pitfall note about YAML corruption requiring double-quoting of `title` values.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Scope & Constraints
- `.planning/PROJECT.md` — Core constraints: Python Azure Functions backend (`posts-api` repo at `C:\Users\Sriram\posts-api\`), Bicep infrastructure at `C:\Users\Sriram\azure-infrastructure\`, no new database services
- `.planning/REQUIREMENTS.md` — STOR-01, STOR-02, STOR-03 requirements (the three requirements this phase must satisfy)
- `.planning/STATE.md` §Known Pitfalls — YAML corruption pitfall (always double-quote `title` in frontmatter); blob privacy requirement (container MUST be private)

### Sibling Repos (backend and infra work happens here)
- `C:\Users\Sriram\posts-api\` — Python Azure Functions repo where slug function and schema validation go
- `C:\Users\Sriram\azure-infrastructure\` — Bicep repo where container provisioning goes

No external ADRs or design docs referenced during discussion.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/authConfig.js` — Reference for the `postsApiRequest` scope pattern (Phase 4 will add this; don't touch in Phase 1)
- `src/styling/` — Not relevant to Phase 1 (no UI)

### Established Patterns
- Auth-gated Azure Functions: Dashboard and Ideas APIs use Bearer token + `acquireTokenSilent`. The posts write API (Phase 4) will follow the same pattern — understand it now so schema decisions don't conflict.
- Per-feature Azure Function App: Each backend feature has its own Function App (`digits-api`, `ideas-api`, `dashboard-api`). `posts-api` follows the same pattern.

### Integration Points
- Phase 1 output (container + schema) is consumed by Phase 2 (read API) and Phase 4 (write API) — both live in `C:\Users\Sriram\posts-api\`
- The blob container name chosen here must match what Phase 2–4 Functions reference

</code_context>

<specifics>
## Specific Ideas

- STATE.md explicitly warns: always double-quote `title` values in frontmatter YAML to prevent gray-matter corruption. The slug function and any test fixtures must follow this.
- STATE.md notes: blob-scan is fine under ~50 posts; consider `_index.json` if volume grows — Phase 1 does NOT need to implement this, but the schema should not preclude it.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-storage-schema*
*Context gathered: 2026-05-30*
