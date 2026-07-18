#!/usr/bin/env python3
"""Ideas MCP server — gives Claude Code direct access to the ideas backlog."""

import json
import os
import sys
from pathlib import Path

import msal
import requests

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


# ── MCP server (added in Task 2) ──────────────────────────────────────────────

if __name__ == "__main__":
    print("Task 2 not yet implemented", file=sys.stderr)
    sys.exit(1)
