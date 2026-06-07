---
phase: 6
slug: github-backed-content
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-06
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest |
| **Config file** | `posts-api/pytest.ini` |
| **Quick run command** | `cd C:/Users/Sriram/posts-api && python -m pytest tests/test_slugs.py tests/test_function_app.py -x -q` |
| **Full suite command** | `cd C:/Users/Sriram/posts-api && python -m pytest tests/ -v` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command above
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | GH-01 | Auth gate first before any GitHub write | unit | `pytest tests/test_function_app.py::test_create_post_success -x` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | GH-01 | Slug dedup uses 404 check not blob scan | unit | `pytest tests/test_slugs.py::test_dedup_suffix -x` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | GH-03 | Update GETs SHA before PUT | unit | `pytest tests/test_function_app.py::test_update_post_success -x` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 1 | GH-03 | Delete GETs SHA before DELETE | unit | `pytest tests/test_function_app.py::test_delete_post_success -x` | ❌ W0 | ⬜ pending |
| 06-02-03 | 02 | 1 | GH-02 | List returns published only | unit | `pytest tests/test_function_app.py::test_list_posts_returns_published_only -x` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 2 | GH-04 | azure-storage-blob absent from requirements.txt | manual | `grep azure-storage-blob posts-api/requirements.txt` → no output | — | ⬜ pending |
| 06-03-02 | 03 | 2 | GH-05 | GITHUB_TOKEN in postsapi.bicep app settings | manual | inspect Bicep | — | ⬜ pending |
| 06-03-03 | 03 | 2 | GH-02 | Design docs appear in /posts feed | manual | HTTP GET /api/posts returns design doc slugs | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/conftest.py` — remove Azurite `container_client` fixture; add `_encode_content(s: str) -> str` helper
- [ ] `tests/test_storage.py` — DELETE (Azurite integration tests replaced by mock-based tests)
- [ ] `tests/test_slugs.py` — REWRITE: Azurite-backed → `requests.get` mock-based; `generate_slug(title)` (no container_client arg)
- [ ] `tests/test_function_app.py` — REWRITE: `get_container_client` monkeypatch → `requests.get/put/delete` patch

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| azure-storage-blob absent from runtime | GH-04 | File inspection | `grep azure-storage-blob posts-api/requirements.txt` → no output |
| GITHUB_TOKEN/GITHUB_REPO in Bicep app settings | GH-05 | Infrastructure inspection | Read postsapi.bicep, verify appSettings block |
| Design docs (migrated) appear in /posts | GH-02 | E2E read path | Deploy + HTTP GET /api/posts; verify migrated slug appears |
| Editor create/edit/delete still works | GH-03 | E2E write path | Login to /write, create post, verify on /posts |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
