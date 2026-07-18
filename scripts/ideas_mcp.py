#!/usr/bin/env python3
"""Ideas MCP server — gives Claude Code direct access to the ideas backlog."""

import asyncio
import json
import os
import sys
from pathlib import Path

import msal
import requests
from mcp.server import Server
from mcp.server.stdio import stdio_server
import mcp.types as types

# ── Constants ─────────────────────────────────────────────────────────────────

CLIENT_ID = "a235bf75-0ece-4d47-bbcd-40d6c5c80da1"
SCOPES = ["api://e70038a1-6f98-4008-b10a-a5926ec6a861/access_as_user"]
TOKEN_CACHE_PATH = Path.home() / ".ideas-mcp" / "token_cache.json"

# ── Auth ──────────────────────────────────────────────────────────────────────

def _load_cache() -> msal.SerializableTokenCache:
    cache = msal.SerializableTokenCache()
    if TOKEN_CACHE_PATH.exists():
        cache.deserialize(TOKEN_CACHE_PATH.read_text())
    return cache


def _save_cache(cache: msal.SerializableTokenCache) -> None:
    if cache.has_state_changed:
        TOKEN_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        TOKEN_CACHE_PATH.write_text(cache.serialize())


def acquire_token(tenant_id: str) -> str:
    cache = _load_cache()
    app = msal.PublicClientApplication(
        CLIENT_ID,
        authority=f"https://login.microsoftonline.com/{tenant_id}",
        token_cache=cache,
    )
    accounts = app.get_accounts()
    result = None
    if accounts:
        result = app.acquire_token_silent(SCOPES, account=accounts[0])
    if not result:
        flow = app.initiate_device_flow(scopes=SCOPES)
        print(flow["message"], file=sys.stderr, flush=True)
        result = app.acquire_token_by_device_flow(flow)
    _save_cache(cache)
    if "access_token" not in result:
        raise RuntimeError(f"Auth failed: {result.get('error_description', result)}")
    return result["access_token"]


# ── API helpers ───────────────────────────────────────────────────────────────

def api_get(base_url: str, tenant_id: str, path: str) -> dict:
    token = acquire_token(tenant_id)
    resp = requests.get(
        f"{base_url}{path}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    if not resp.ok:
        raise RuntimeError(f"API error {resp.status_code}: {resp.text[:200]}")
    return resp.json()


def api_patch(base_url: str, tenant_id: str, path: str, body: dict) -> dict:
    token = acquire_token(tenant_id)
    resp = requests.patch(
        f"{base_url}{path}",
        json=body,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        timeout=15,
    )
    if not resp.ok:
        raise RuntimeError(f"API error {resp.status_code}: {resp.text[:200]}")
    return resp.json()


def api_post(base_url: str, tenant_id: str, path: str, body: dict) -> dict:
    token = acquire_token(tenant_id)
    resp = requests.post(
        f"{base_url}{path}",
        json=body,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        timeout=15,
    )
    if not resp.ok:
        raise RuntimeError(f"API error {resp.status_code}: {resp.text[:200]}")
    return resp.json()


# ── MCP server ────────────────────────────────────────────────────────────────

server = Server("ideas")


@server.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="list_ideas",
            description=(
                "List ideas from the backlog. Defaults to open ideas. "
                "Filter by status ('open', 'done', 'dismissed', 'all') "
                "and/or project name (case-insensitive substring)."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "enum": ["open", "done", "dismissed", "all"],
                        "description": "Filter by status. Default: 'open'.",
                    },
                    "project": {
                        "type": "string",
                        "description": "Case-insensitive substring filter on project name.",
                    },
                },
            },
        ),
        types.Tool(
            name="get_idea",
            description="Fetch a single idea by its ID.",
            inputSchema={
                "type": "object",
                "properties": {"id": {"type": "string", "description": "Idea UUID"}},
                "required": ["id"],
            },
        ),
        types.Tool(
            name="update_idea_status",
            description="Change the status of an idea to 'open', 'done', or 'dismissed'.",
            inputSchema={
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Idea UUID"},
                    "status": {
                        "type": "string",
                        "enum": ["open", "done", "dismissed"],
                    },
                },
                "required": ["id", "status"],
            },
        ),
        types.Tool(
            name="add_update",
            description="Post a progress note to an idea (e.g. 'Implemented in PR #42').",
            inputSchema={
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Idea UUID"},
                    "content": {"type": "string", "description": "The update text"},
                },
                "required": ["id", "content"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    base_url = os.environ.get("IDEAS_API_BASE_URL", "").rstrip("/")
    tenant_id = os.environ.get("AZURE_TENANT_ID", "")
    try:
        if name == "list_ideas":
            data = api_get(base_url, tenant_id, "/api/ideas")
            ideas = data.get("ideas", [])
            status_filter = arguments.get("status", "open")
            project_filter = (arguments.get("project") or "").lower()
            if status_filter != "all":
                ideas = [i for i in ideas if i.get("status") == status_filter]
            if project_filter:
                ideas = [i for i in ideas if project_filter in i.get("project", "").lower()]
            return [types.TextContent(type="text", text=json.dumps(ideas, indent=2))]

        elif name == "get_idea":
            data = api_get(base_url, tenant_id, f"/api/ideas/{arguments['id']}")
            return [types.TextContent(type="text", text=json.dumps(data, indent=2))]

        elif name == "update_idea_status":
            data = api_patch(
                base_url, tenant_id,
                f"/api/ideas/{arguments['id']}",
                {"status": arguments["status"]},
            )
            return [types.TextContent(type="text", text=json.dumps(data, indent=2))]

        elif name == "add_update":
            data = api_post(
                base_url, tenant_id,
                f"/api/ideas/{arguments['id']}/updates",
                {"content": arguments["content"]},
            )
            return [types.TextContent(type="text", text=json.dumps(data, indent=2))]

        else:
            return [types.TextContent(type="text", text=f"Unknown tool: {name}")]

    except Exception as e:
        return [types.TextContent(type="text", text=f"Error: {e}")]


async def _main() -> None:
    base_url = os.environ.get("IDEAS_API_BASE_URL", "").rstrip("/")
    tenant_id = os.environ.get("AZURE_TENANT_ID", "")
    if not base_url:
        sys.exit("ERROR: IDEAS_API_BASE_URL is not set")
    if not tenant_id:
        sys.exit("ERROR: AZURE_TENANT_ID is not set")

    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


if __name__ == "__main__":
    asyncio.run(_main())
