---
author_email: karumbunathan@gmail.com
date: '2026-07-18T02:40:50.086045+00:00'
description: ''
published: true
slug: ideas-mcp-server-design-spec-2
title: Ideas MCP Server — Design Spec
updatedAt: '2026-07-18T02:40:54.197303+00:00'
---

## Background

The Ideas board (`/ideas`) is the central backlog for this project — a place to capture feature ideas across different areas (Digits, Trail Finder, Dashboard, etc.) and track their status from open through to done.

There is already an Ideas Bot that can read and act on ideas, but it is still a work in progress — it runs on lower-capability models and its harness is more limited than Claude Code's, lacking the same agentic tooling, context management, and code execution environment.

The missing piece is giving Claude Code — which has the best models and the most capable harness — direct access to the backlog. Today that requires a manual handoff: open the browser, find an idea, copy its details, switch to the terminal, and separately come back afterward to mark it done. There's no connection between the backlog and the coding environment.

The MCP server closes that loop. Claude Code can query the backlog directly mid-session, read full idea context, implement it, post a progress note, and mark it done — all without switching context. It combines the Ideas Bot's backlog access with Claude Code's execution capability.

## Overview

A stdio MCP server that exposes the Ideas API to Claude Code, allowing it to list, inspect, and update feature ideas directly during a coding session — without leaving the terminal.

## File Layout

| Path | Purpose |
|---|---|
| `scripts/ideas_mcp.py` | The MCP server (single file) |
| `~/.ideas-mcp/token_cache.json` | MSAL token cache (created at runtime, gitignored) |

The server is registered in `.claude/settings.json` under `mcpServers` so Claude Code loads it automatically when this project is open.

## Environment Variables

Set inside `.claude/settings.json` alongside the server registration (never in the shell):

| Variable | Description |
|---|---|
| `IDEAS_API_BASE_URL` | Base URL of the ideas API |
| `AZURE_TENANT_ID` | Azure AD tenant ID (same value as `REACT_APP_AZURE_TENANT_ID`) |

The Azure AD app client ID (`e70038a1-6f98-4008-b10a-a5926ec6a861`) is hardcoded as a constant — it matches the value in `src/authConfig.js`.

## Auth Flow

MSAL's `PublicClientApplication` with a `SerializableTokenCache` backed by `~/.ideas-mcp/token_cache.json`.

Before every API call:
1. Try `acquire_token_silent()` using the cached account.
2. If that fails (first run or refresh token expired), fall back to `acquire_token_by_device_flow()`.
3. The device flow prints one line to stderr — visible in Claude Code's MCP output pane:
   ```
   To sign in, visit https://microsoft.com/devicelogin and enter code XXXX-XXXX
   ```
4. After browser sign-in completes, the token is cached and the original tool call proceeds.
5. Subsequent calls are silent for ~90 days (until the Azure AD refresh token expires).

## MCP Tools

### `list_ideas`
Fetch ideas, optionally filtered.

**Parameters:**
- `status` (string, optional) — `"open"` | `"done"` | `"dismissed"` | `"all"`. Default: `"open"`.
- `project` (string, optional) — filter by project name (case-insensitive substring match, client-side).

**Returns:** JSON array of ideas with fields: `id`, `title`, `project`, `status`, `body`, `created_at`.

**API call:** `GET /api/ideas`

---

### `get_idea`
Fetch a single idea by ID.

**Parameters:**
- `id` (string, required)

**Returns:** Full idea JSON object.

**API call:** `GET /api/ideas/{id}`

---

### `update_idea_status`
Change the status of an idea.

**Parameters:**
- `id` (string, required)
- `status` (string, required) — `"open"` | `"done"` | `"dismissed"`

**Returns:** Updated idea JSON.

**API call:** `PATCH /api/ideas/{id}` with body `{"status": "..."}`

---

### `add_update`
Post a progress note to an idea (e.g. "Implemented in PR #42").

**Parameters:**
- `id` (string, required)
- `content` (string, required)

**Returns:** The created update object.

**API call:** `POST /api/ideas/{id}/updates` with body `{"content": "..."}`

---

## Error Handling

- Missing required env vars → server exits at startup with a clear message.
- API returns non-2xx → tool returns a readable error string (does not crash the server).
- Auth device flow interrupted → tool returns error; next call retries auth.

## Dependencies

```
mcp>=1.0
msal>=1.20
requests>=2.28
```

Installed via `pip install mcp msal requests` — no changes to `package.json`.

## Registration in `.claude/settings.json`

```json
{
  "mcpServers": {
    "ideas": {
      "command": "python",
      "args": ["scripts/ideas_mcp.py"],
      "env": {
        "IDEAS_API_BASE_URL": "<your-ideas-api-base-url>",
        "AZURE_TENANT_ID": "<your-tenant-id>"
      }
    }
  }
}
```