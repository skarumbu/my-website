"""Backfill tests. Every HTTP call is mocked — no test here ever contacts a
real host.
"""

import os
from unittest.mock import MagicMock, patch

import pytest

import backfill_arch_history as bf

_FAKE_URL = "https://history-api.invalid/api"
_FAKE_KEY = "test-write-key"


@pytest.fixture(scope="module")
def real_pages():
    overlays = bf.load_overlays()
    templates = bf.load_templates()
    return bf.build_pages(overlays, templates)


def test_build_pages_covers_every_overlay_key(real_pages):
    overlays = bf.load_overlays()
    assert [k for k, _, _ in real_pages] == list(overlays)
    for _, content, nbytes in real_pages:
        assert content.endswith("\n")
        assert nbytes == len(content.encode("utf-8"))


def test_size_guard_passes_for_current_pages(real_pages):
    # No exception.
    bf.assert_within_size_limit(real_pages)
    assert all(n <= bf.MAX_CONTENT_BYTES for _, _, n in real_pages)


def test_size_guard_aborts_whole_run_before_any_post():
    pages = [
        ("ok-page", "{}\n", 3),
        ("huge-page", "x", bf.MAX_CONTENT_BYTES + 1),
    ]
    with patch("backfill_arch_history.requests.post") as mock_post, \
         patch("backfill_arch_history.requests.get") as mock_get:
        with pytest.raises(SystemExit) as exc:
            bf.assert_within_size_limit(pages)
        assert "huge-page" in str(exc.value)
        mock_post.assert_not_called()
        mock_get.assert_not_called()


def test_dry_run_makes_no_http_calls(real_pages):
    with patch("backfill_arch_history.requests.get") as mock_get, \
         patch("backfill_arch_history.requests.post") as mock_post:
        result = bf.run_backfill(real_pages, "", "", dry_run=True)
    mock_get.assert_not_called()
    mock_post.assert_not_called()
    assert result == {"imported": len(real_pages), "skipped": 0, "failed": 0}


def test_imports_new_documents(real_pages):
    with patch("backfill_arch_history.requests.get") as mock_get, \
         patch("backfill_arch_history.requests.post") as mock_post:
        mock_get.return_value = MagicMock(status_code=404)
        mock_post.return_value = MagicMock(
            status_code=201, json=MagicMock(return_value={"version_id": "v-1"})
        )
        result = bf.run_backfill(real_pages, _FAKE_URL, _FAKE_KEY)

    assert result == {"imported": len(real_pages), "skipped": 0, "failed": 0}
    assert mock_post.call_count == len(real_pages)
    _, kwargs = mock_post.call_args
    assert kwargs["json"]["content_type"] == "json"
    assert kwargs["json"]["message"] == "backfill: initial import"
    assert "expected_version_id" not in kwargs["json"]
    assert kwargs["headers"] == {"X-History-Key": _FAKE_KEY}


def test_second_run_is_all_skips(real_pages):
    """Idempotency: a re-run after everything already landed POSTs nothing."""
    with patch("backfill_arch_history.requests.get") as mock_get, \
         patch("backfill_arch_history.requests.post") as mock_post:
        mock_get.return_value = MagicMock(status_code=200)
        result = bf.run_backfill(real_pages, _FAKE_URL, _FAKE_KEY)

    mock_post.assert_not_called()
    assert result == {"imported": 0, "skipped": len(real_pages), "failed": 0}


def test_force_reimports_without_existence_check(real_pages):
    with patch("backfill_arch_history.requests.get") as mock_get, \
         patch("backfill_arch_history.requests.post") as mock_post:
        mock_post.return_value = MagicMock(
            status_code=201, json=MagicMock(return_value={"version_id": "v-2"})
        )
        result = bf.run_backfill(real_pages, _FAKE_URL, _FAKE_KEY, force=True)

    mock_get.assert_not_called()
    assert mock_post.call_count == len(real_pages)
    assert result["imported"] == len(real_pages)


def test_post_failure_does_not_abort_run_and_main_returns_1():
    pages = [("a", "{}\n", 3), ("b", "{}\n", 3)]
    failing = MagicMock(status_code=500)
    failing.raise_for_status.side_effect = Exception("boom")
    ok = MagicMock(status_code=201, json=MagicMock(return_value={"version_id": "v"}))

    with patch("backfill_arch_history.requests.get") as mock_get, \
         patch("backfill_arch_history.requests.post") as mock_post:
        mock_get.return_value = MagicMock(status_code=404)
        mock_post.side_effect = [failing, ok]
        result = bf.run_backfill(pages, _FAKE_URL, _FAKE_KEY)

    assert mock_post.call_count == 2
    assert result == {"imported": 1, "skipped": 0, "failed": 1}


def test_main_dry_run_needs_no_env(monkeypatch):
    monkeypatch.delenv("HISTORY_API_URL", raising=False)
    monkeypatch.delenv("HISTORY_WRITE_KEY", raising=False)
    with patch("backfill_arch_history.requests.get") as mock_get, \
         patch("backfill_arch_history.requests.post") as mock_post:
        rc = bf.main(["--dry-run"])
    assert rc == 0
    mock_get.assert_not_called()
    mock_post.assert_not_called()


def test_main_requires_env_for_real_run(monkeypatch):
    monkeypatch.delenv("HISTORY_API_URL", raising=False)
    monkeypatch.delenv("HISTORY_WRITE_KEY", raising=False)
    with pytest.raises(SystemExit):
        bf.main([])


def test_main_happy_path_returns_0(monkeypatch):
    monkeypatch.setenv("HISTORY_API_URL", _FAKE_URL + "/")
    monkeypatch.setenv("HISTORY_WRITE_KEY", _FAKE_KEY)
    with patch("backfill_arch_history.requests.get") as mock_get, \
         patch("backfill_arch_history.requests.post") as mock_post:
        mock_get.return_value = MagicMock(status_code=404)
        mock_post.return_value = MagicMock(
            status_code=201, json=MagicMock(return_value={"version_id": "v-1"})
        )
        rc = bf.main([])
    assert rc == 0
    # URL trailing slash stripped -> no "//documents"
    called_url = mock_post.call_args[0][0]
    assert called_url.startswith("https://history-api.invalid/api/documents/architecture::")
