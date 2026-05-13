# ADR: Per-Idea Status Updates

**Date:** 2026-05-12
**Status:** Accepted
**Repos:** ideas-api · my-website

---

## Context

The Ideas board let users track feature ideas but had no way to log progress notes or commentary against an idea over time. The ideas-bot was already writing back `bot_status` / `bot_pr_url` fields directly onto the idea entity, mixing human workflow state with machine status in a single mutable record.

A dedicated updates channel was needed to:

- Let humans post progress notes (e.g. "started implementation", "blocked on X")
- Let the bot post structured status messages without clobbering idea fields
- Provide an ordered, attributed audit trail per idea

---

## Decision

**Backend (ideas-api):**

- New `updates` Azure Table Storage table with `PartitionKey = idea_id`, `RowKey = UUID`. Declared in `ideasapi.bicep` — not created lazily in Python, consistent with infrastructure conventions.
- Three endpoints under `/api/ideas/{id}/updates`:
  - `GET` — list updates oldest-first (EasyAuth or write key)
  - `POST` — create an update; author resolved from EasyAuth display name/email, or set to `"bot"` when authenticated with the write key
  - `DELETE /{update_id}` — remove an update (EasyAuth only; no machine delete)

**Frontend (my-website):**

- Clicking an idea card now opens a **detail slide-over panel** instead of directly opening the edit Composer. The detail panel shows the idea body, bot status chip, and a threaded updates list.
- An **Edit** button in the panel header opens the existing Composer for field-level edits.
- Users post updates via a textarea with a ⌘↵ keyboard shortcut. Each update displays the author name, a relative timestamp, and a delete button.

---

## Alternatives Considered

| Alternative | Reason rejected |
|---|---|
| Append updates to the idea `body` field | Lossy — overwrites history; no authorship or timestamps |
| Store updates as JSON strings inside the idea entity | Hard to query; Azure Table Storage entity size limits apply |
| Separate document store (Cosmos DB) | Over-engineering — Table Storage already in use and sufficient for an append-only log |
| Add updates inside the existing Composer slide-over | Mixing edit fields with a live comment thread in one form creates confusing UX; a dedicated read/comment panel separates intent clearly |

---

## Consequences

**Positive:**

- Clean per-idea audit trail with authorship and timestamps.
- Bot can post updates without mutating idea fields (`bot_status` etc. can eventually be deprecated in favour of structured updates).
- No schema migration needed — new table; existing ideas are completely unaffected.
- EasyAuth-only delete preserves audit trail integrity; the bot cannot silently erase its own updates.

**Trade-offs:**

- Opening an idea now issues an additional fetch (`GET /api/ideas/{id}/updates`) on panel open. Acceptable given the Ideas board is a low-traffic internal tool.
- The detail panel adds a new interaction layer (click card → panel → Edit button) where previously clicking a card went straight to editing. The trade-off is more discoverable updates vs. one extra tap to edit.

---

## Relevant Code

| File | Notes |
|---|---|
| `ideas-api/updates.py` | Table Storage CRUD: `list_updates`, `create_update`, `delete_update` |
| `ideas-api/function_app.py` | Route handlers: `get_idea_updates`, `post_idea_update`, `delete_idea_update` |
| `my-website/src/Ideas.tsx` | `IdeaDetailPanel` component — updates thread UI, post/delete flows |
| `azure-infrastructure/modules/ideasapi.bicep` | `updates` table declaration |
