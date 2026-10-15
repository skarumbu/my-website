"""apply_wiki_manifest tests. Every HTTP call is mocked — no test here ever
contacts a real host."""

import json
import os

from unittest.mock import MagicMock, patch

import pytest

import apply_wiki_manifest as awm

_FAKE_URL = "https://history-api.invalid/api"
_FAKE_KEY = "test-write-key"


@pytest.fixture
def preview_dir(tmp_path):
    d = tmp_path / "wiki-preview"
    d.mkdir()
    (d / "my-website.json").write_text('{"key": "my-website"}\n', encoding="utf-8")
    (d / "digits.json").write_text('{"key": "digits"}\n', encoding="utf-8")
    return str(d)


def _manifest_path(tmp_path, entries):
    p = tmp_path / "manifest.json"
    p.write_text(json.dumps(entries), encoding="utf-8")
    return str(p)


def test_load_preview_content_reads_verbatim(preview_dir):
    assert awm.load_preview_content(preview_dir, "my-website") == '{"key": "my-website"}\n'


def test_apply_entry_happy_path_no_expected_version(preview_dir):
    entry = {"key": "my-website", "base_version_id": "", "message": "m"}
    with patch("apply_wiki_manifest.requests.post") as mock_post:
        mock_post.return_value = MagicMock(status_code=201, json=MagicMock(return_value={"version_id": "v1"}))
        ok = awm.apply_entry(_FAKE_URL, _FAKE_KEY, preview_dir, entry)

    assert ok is True
    _, kwargs = mock_post.call_args
    assert kwargs["json"]["content"] == '{"key": "my-website"}\n'
    assert kwargs["json"]["message"] == "m"
    assert "expected_version_id" not in kwargs["json"]
    assert kwargs["headers"] == {"X-History-Key": _FAKE_KEY}


def test_apply_entry_sends_expected_version_id_when_present(preview_dir):
    entry = {"key": "my-website", "base_version_id": "v0", "message": "m"}
    with patch("apply_wiki_manifest.requests.post") as mock_post:
        mock_post.return_value = MagicMock(status_code=201, json=MagicMock(return_value={"version_id": "v1"}))
        awm.apply_entry(_FAKE_URL, _FAKE_KEY, preview_dir, entry)

    _, kwargs = mock_post.call_args
    assert kwargs["json"]["expected_version_id"] == "v0"


def test_409_retries_once_with_refreshed_version_and_succeeds(preview_dir):
    entry = {"key": "my-website", "base_version_id": "stale", "message": "m"}
    conflict = MagicMock(status_code=409)
    ok_resp = MagicMock(status_code=201, json=MagicMock(return_value={"version_id": "v2"}))
    with patch("apply_wiki_manifest.requests.post") as mock_post, \
         patch("apply_wiki_manifest.requests.get") as mock_get:
        mock_post.side_effect = [conflict, ok_resp]
        mock_get.return_value = MagicMock(status_code=200, json=MagicMock(return_value={"version_id": "v1"}))
        ok = awm.apply_entry(_FAKE_URL, _FAKE_KEY, preview_dir, entry)

    assert ok is True
    assert mock_post.call_count == 2
    second_call_kwargs = mock_post.call_args_list[1][1]
    assert second_call_kwargs["json"]["expected_version_id"] == "v1"


def test_second_409_fails_just_that_page(preview_dir):
    entry = {"key": "my-website", "base_version_id": "stale", "message": "m"}
    conflict = MagicMock(status_code=409)
    with patch("apply_wiki_manifest.requests.post") as mock_post, \
         patch("apply_wiki_manifest.requests.get") as mock_get:
        mock_post.side_effect = [conflict, conflict]
        mock_get.return_value = MagicMock(status_code=200, json=MagicMock(return_value={"version_id": "v1"}))
        ok = awm.apply_entry(_FAKE_URL, _FAKE_KEY, preview_dir, entry)

    assert ok is False
    assert mock_post.call_count == 2


def test_latest_version_id_treats_401_and_404_as_missing():
    with patch("apply_wiki_manifest.requests.get") as mock_get:
        mock_get.return_value = MagicMock(status_code=401)
        assert awm._latest_version_id(_FAKE_URL, "nope") == ""
        mock_get.return_value = MagicMock(status_code=404)
        assert awm._latest_version_id(_FAKE_URL, "nope") == ""


def test_run_manifest_multi_page_one_failure_does_not_roll_back_others(preview_dir):
    manifest = [
        {"key": "my-website", "base_version_id": "v0", "message": "a"},
        {"key": "digits", "base_version_id": "v0", "message": "b"},
    ]
    ok_resp = MagicMock(status_code=201, json=MagicMock(return_value={"version_id": "v9"}))
    failing = MagicMock(status_code=500)
    failing.raise_for_status.side_effect = Exception("boom")
    with patch("apply_wiki_manifest.requests.post") as mock_post:
        mock_post.side_effect = [ok_resp, failing]
        result = awm.run_manifest(manifest, _FAKE_URL, _FAKE_KEY, preview_dir)

    assert result == {"applied": 1, "failed": 1}
    assert mock_post.call_count == 2


def test_main_missing_manifest_is_a_noop(tmp_path, monkeypatch):
    monkeypatch.delenv("HISTORY_API_URL", raising=False)
    monkeypatch.delenv("HISTORY_WRITE_KEY", raising=False)
    rc = awm.main(["--manifest", str(tmp_path / "does-not-exist.json")])
    assert rc == 0


def test_main_empty_manifest_is_a_noop(tmp_path, monkeypatch):
    monkeypatch.delenv("HISTORY_API_URL", raising=False)
    monkeypatch.delenv("HISTORY_WRITE_KEY", raising=False)
    path = _manifest_path(tmp_path, [])
    rc = awm.main(["--manifest", path])
    assert rc == 0


def test_main_happy_path_returns_0(tmp_path, preview_dir, monkeypatch):
    monkeypatch.setenv("HISTORY_API_URL", _FAKE_URL + "/")
    monkeypatch.setenv("HISTORY_WRITE_KEY", _FAKE_KEY)
    path = _manifest_path(tmp_path, [{"key": "my-website", "base_version_id": "", "message": "m"}])
    with patch("apply_wiki_manifest.requests.post") as mock_post:
        mock_post.return_value = MagicMock(status_code=201, json=MagicMock(return_value={"version_id": "v1"}))
        rc = awm.main(["--manifest", path, "--preview-dir", preview_dir])
    assert rc == 0
    called_url = mock_post.call_args[0][0]
    assert called_url.startswith("https://history-api.invalid/api/documents/architecture::")


def test_main_happy_path_multi_failure_returns_1(tmp_path, preview_dir, monkeypatch):
    monkeypatch.setenv("HISTORY_API_URL", _FAKE_URL)
    monkeypatch.setenv("HISTORY_WRITE_KEY", _FAKE_KEY)
    path = _manifest_path(tmp_path, [{"key": "my-website", "base_version_id": "", "message": "m"}])
    failing = MagicMock(status_code=500)
    failing.raise_for_status.side_effect = Exception("boom")
    with patch("apply_wiki_manifest.requests.post") as mock_post:
        mock_post.return_value = failing
        rc = awm.main(["--manifest", path, "--preview-dir", preview_dir])
    assert rc == 1
