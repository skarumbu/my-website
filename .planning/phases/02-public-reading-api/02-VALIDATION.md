---
phase: 2
slug: public-reading-api
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-31
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (configured in Phase 1) |
| **Config file** | `C:\Users\Sriram\posts-api\pytest.ini` |
| **Quick run command** | `cd C:\Users\Sriram\posts-api && .venv\Scripts\python -m pytest tests/test_function_app.py -x -q` |
| **Full suite command** | `cd C:\Users\Sriram\posts-api && .venv\Scripts\python -m pytest -q` |
| **Local blob emulation** | Azurite (already set up in Phase 1 conftest.py) |

---

## Sampling Rate

- **After every task commit:** `pytest tests/test_function_app.py -q`
- **After every plan wave:** `pytest -q` (full suite including schema, slugs, storage tests)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| API-01-list | 02-01 | 1 | API-01 | Returns only published posts, sorted newest-first | Integration (Azurite) | `pytest tests/test_function_app.py::test_list_posts_returns_published_only -x` | ❌ W0 | ⬜ pending |
| API-01-excludes | 02-01 | 1 | API-01 | Excludes drafts from response | Integration (Azurite) | `pytest tests/test_function_app.py::test_list_posts_excludes_drafts -x` | ❌ W0 | ⬜ pending |
| API-01-sorted | 02-01 | 1 | API-01 | Returns sorted newest-first | Integration (Azurite) | `pytest tests/test_function_app.py::test_list_posts_sorted_by_date -x` | ❌ W0 | ⬜ pending |
| API-01-empty | 02-01 | 1 | API-01 | Empty container returns empty list | Unit (mock) | `pytest tests/test_function_app.py::test_list_posts_empty -x` | ❌ W0 | ⬜ pending |
| API-02-published | 02-01 | 1 | API-02 | Returns 200 with body for valid published slug | Integration (Azurite) | `pytest tests/test_function_app.py::test_get_post_published -x` | ❌ W0 | ⬜ pending |
| API-02-missing | 02-01 | 1 | API-02 | Returns 404 for missing slug | Unit (mock) | `pytest tests/test_function_app.py::test_get_post_not_found -x` | ❌ W0 | ⬜ pending |
| API-02-draft | 02-01 | 1 | API-02 | Returns 404 for unpublished post | Integration (Azurite) | `pytest tests/test_function_app.py::test_get_post_draft_returns_404 -x` | ❌ W0 | ⬜ pending |
| SEC-03-private | 02-02 | 2 | SEC-03 | Direct blob URL returns 403 | Manual smoke test | `curl -I https://{account}.blob.core.windows.net/posts/test.md` | Manual only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_function_app.py` — all 7 API-01 and API-02 test cases listed above

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Blob container private — direct URL returns 403 | SEC-03 | Requires deployed Azure infrastructure | `curl -I https://{storageAccountName}.blob.core.windows.net/posts/test.md` — expect HTTP 403 |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
