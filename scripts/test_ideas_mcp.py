import json
import pytest
from unittest.mock import MagicMock, patch, mock_open


# ── acquire_token ──────────────────────────────────────────────────────────

def test_acquire_token_silent_path():
    """Uses cached token when account exists and silent acquire succeeds."""
    mock_app = MagicMock()
    mock_app.get_accounts.return_value = [{"username": "user@example.com"}]
    mock_app.acquire_token_silent.return_value = {"access_token": "silent-token"}
    mock_cache = MagicMock()
    mock_cache.has_state_changed = False

    with patch("ideas_mcp.msal.PublicClientApplication", return_value=mock_app), \
         patch("ideas_mcp.msal.SerializableTokenCache", return_value=mock_cache), \
         patch("ideas_mcp.TOKEN_CACHE_PATH") as mock_path:
        mock_path.exists.return_value = False
        from ideas_mcp import acquire_token
        token = acquire_token("tenant-id")

    assert token == "silent-token"
    mock_app.acquire_token_silent.assert_called_once()
    mock_app.initiate_device_flow.assert_not_called()


def test_acquire_token_device_flow_fallback():
    """Falls back to device flow when no cached account."""
    mock_app = MagicMock()
    mock_app.get_accounts.return_value = []
    mock_app.initiate_device_flow.return_value = {"message": "Go to https://microsoft.com/devicelogin"}
    mock_app.acquire_token_by_device_flow.return_value = {"access_token": "device-token"}
    mock_cache = MagicMock()
    mock_cache.has_state_changed = False

    with patch("ideas_mcp.msal.PublicClientApplication", return_value=mock_app), \
         patch("ideas_mcp.msal.SerializableTokenCache", return_value=mock_cache), \
         patch("ideas_mcp.TOKEN_CACHE_PATH") as mock_path:
        mock_path.exists.return_value = False
        from ideas_mcp import acquire_token
        token = acquire_token("tenant-id")

    assert token == "device-token"
    mock_app.initiate_device_flow.assert_called_once()


def test_acquire_token_raises_on_auth_failure():
    """Raises RuntimeError when auth returns no access_token."""
    mock_app = MagicMock()
    mock_app.get_accounts.return_value = []
    mock_app.initiate_device_flow.return_value = {"message": "Go sign in"}
    mock_app.acquire_token_by_device_flow.return_value = {
        "error": "access_denied",
        "error_description": "User denied consent",
    }
    mock_cache = MagicMock()
    mock_cache.has_state_changed = False

    with patch("ideas_mcp.msal.PublicClientApplication", return_value=mock_app), \
         patch("ideas_mcp.msal.SerializableTokenCache", return_value=mock_cache), \
         patch("ideas_mcp.TOKEN_CACHE_PATH") as mock_path:
        mock_path.exists.return_value = False
        from ideas_mcp import acquire_token
        with pytest.raises(RuntimeError, match="Auth failed"):
            acquire_token("tenant-id")


# ── API helpers ────────────────────────────────────────────────────────────

def test_api_get_returns_json():
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"ideas": []}

    with patch("ideas_mcp.acquire_token", return_value="tok"), \
         patch("ideas_mcp.requests.get", return_value=mock_resp) as mock_get:
        from ideas_mcp import api_get
        result = api_get("https://api.example.com", "tenant", "/api/ideas")

    assert result == {"ideas": []}
    mock_get.assert_called_once_with(
        "https://api.example.com/api/ideas",
        headers={"Authorization": "Bearer tok"},
        timeout=15,
    )


def test_api_get_raises_on_non_2xx():
    mock_resp = MagicMock()
    mock_resp.ok = False
    mock_resp.status_code = 403
    mock_resp.text = "Forbidden"

    with patch("ideas_mcp.acquire_token", return_value="tok"), \
         patch("ideas_mcp.requests.get", return_value=mock_resp):
        from ideas_mcp import api_get
        with pytest.raises(RuntimeError, match="403"):
            api_get("https://api.example.com", "tenant", "/api/ideas")


def test_api_patch_sends_json_body():
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"id": "1", "status": "done"}

    with patch("ideas_mcp.acquire_token", return_value="tok"), \
         patch("ideas_mcp.requests.patch", return_value=mock_resp) as mock_patch:
        from ideas_mcp import api_patch
        result = api_patch("https://api.example.com", "tenant", "/api/ideas/1", {"status": "done"})

    assert result == {"id": "1", "status": "done"}
    mock_patch.assert_called_once_with(
        "https://api.example.com/api/ideas/1",
        json={"status": "done"},
        headers={"Authorization": "Bearer tok", "Content-Type": "application/json"},
        timeout=15,
    )


def test_api_post_sends_json_body():
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"id": "upd-1", "content": "shipped"}

    with patch("ideas_mcp.acquire_token", return_value="tok"), \
         patch("ideas_mcp.requests.post", return_value=mock_resp) as mock_post:
        from ideas_mcp import api_post
        result = api_post("https://api.example.com", "tenant", "/api/ideas/1/updates", {"content": "shipped"})

    assert result == {"id": "upd-1", "content": "shipped"}
    mock_post.assert_called_once_with(
        "https://api.example.com/api/ideas/1/updates",
        json={"content": "shipped"},
        headers={"Authorization": "Bearer tok", "Content-Type": "application/json"},
        timeout=15,
    )


# ── Tool handler tests ─────────────────────────────────────────────────────────

import asyncio
import importlib


def _reload():
    """Reload module so patched globals take effect."""
    import ideas_mcp
    importlib.reload(ideas_mcp)
    return ideas_mcp


@pytest.fixture(autouse=True)
def set_env(monkeypatch):
    monkeypatch.setenv("IDEAS_API_BASE_URL", "https://api.example.com")
    monkeypatch.setenv("AZURE_TENANT_ID", "tenant-123")


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_list_ideas_default_status_open():
    all_ideas = [
        {"id": "1", "title": "A", "status": "open", "project": "Digits"},
        {"id": "2", "title": "B", "status": "done", "project": "Digits"},
    ]
    mod = _reload()
    with patch.object(mod, "api_get", return_value={"ideas": all_ideas}):
        result = _run(mod.call_tool("list_ideas", {}))
    data = json.loads(result[0].text)
    assert len(data) == 1
    assert data[0]["id"] == "1"


def test_list_ideas_status_all():
    all_ideas = [
        {"id": "1", "title": "A", "status": "open", "project": "X"},
        {"id": "2", "title": "B", "status": "done", "project": "Y"},
    ]
    mod = _reload()
    with patch.object(mod, "api_get", return_value={"ideas": all_ideas}):
        result = _run(mod.call_tool("list_ideas", {"status": "all"}))
    data = json.loads(result[0].text)
    assert len(data) == 2


def test_list_ideas_project_filter():
    all_ideas = [
        {"id": "1", "title": "A", "status": "open", "project": "Digits"},
        {"id": "2", "title": "B", "status": "open", "project": "NBA Games"},
    ]
    mod = _reload()
    with patch.object(mod, "api_get", return_value={"ideas": all_ideas}):
        result = _run(mod.call_tool("list_ideas", {"project": "digits"}))
    data = json.loads(result[0].text)
    assert len(data) == 1
    assert data[0]["project"] == "Digits"


def test_get_idea():
    idea = {"id": "abc", "title": "My idea", "status": "open"}
    mod = _reload()
    with patch.object(mod, "api_get", return_value=idea):
        result = _run(mod.call_tool("get_idea", {"id": "abc"}))
    data = json.loads(result[0].text)
    assert data["id"] == "abc"


def test_update_idea_status():
    updated = {"id": "abc", "status": "done"}
    mod = _reload()
    with patch.object(mod, "api_patch", return_value=updated):
        result = _run(mod.call_tool("update_idea_status", {"id": "abc", "status": "done"}))
    data = json.loads(result[0].text)
    assert data["status"] == "done"


def test_add_update():
    created = {"id": "upd-1", "content": "Shipped in PR #5"}
    mod = _reload()
    with patch.object(mod, "api_post", return_value=created):
        result = _run(mod.call_tool("add_update", {"id": "abc", "content": "Shipped in PR #5"}))
    data = json.loads(result[0].text)
    assert data["content"] == "Shipped in PR #5"


def test_tool_api_error_returns_error_string():
    mod = _reload()
    with patch.object(mod, "api_get", side_effect=RuntimeError("API error 403: Forbidden")):
        result = _run(mod.call_tool("list_ideas", {}))
    assert "Error" in result[0].text
    assert "403" in result[0].text


def test_unknown_tool_returns_error_string():
    mod = _reload()
    result = _run(mod.call_tool("nonexistent_tool", {}))
    assert "Unknown tool" in result[0].text
