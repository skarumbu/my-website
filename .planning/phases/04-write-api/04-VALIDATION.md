---
phase: 4
slug: write-api
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-05
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.0.3 |
| **Config file** | `C:\Users\Sriram\posts-api\pytest.ini` |
| **Quick run command** | `cd C:\Users\Sriram\posts-api && .venv\Scripts\pytest tests\test_function_app.py -x -q` |
| **Full suite command** | `cd C:\Users\Sriram\posts-api && .venv\Scripts\pytest -x -q` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd C:\Users\Sriram\posts-api && .venv\Scripts\pytest tests\test_function_app.py -x -q`
- **After every plan wave:** Run `cd C:\Users\Sriram\posts-api && .venv\Scripts\pytest -x -q`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | SEC-02 | auth-bypass | require_auth() raises ValueError if X-MS-CLIENT-PRINCIPAL absent | unit | `pytest tests/test_function_app.py -k "requires_auth" -x` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 1 | API-03 | input-validation | POST creates blob + returns {slug} 201; missing fields → 400 | unit+integration | `pytest tests/test_function_app.py -k "create_post" -x` | ❌ W0 | ⬜ pending |
| 4-01-03 | 01 | 1 | API-04 | input-validation | PUT updates blob + returns 200; missing slug → 404; preserves date | unit+integration | `pytest tests/test_function_app.py -k "update_post" -x` | ❌ W0 | ⬜ pending |
| 4-01-04 | 01 | 1 | API-05 | — | DELETE removes blob + returns 204; missing slug → 404 | unit+integration | `pytest tests/test_function_app.py -k "delete_post" -x` | ❌ W0 | ⬜ pending |
| 4-02-01 | 02 | 2 | SEC-02 | auth-bypass | POST/PUT/DELETE without auth return 401; no mutation occurs | unit | `pytest tests/test_function_app.py -k "requires_auth" -x` | ❌ W0 | ⬜ pending |
| 4-03-01 | 03 | 3 | SEC-02 | infra | Easy Auth enabled on posts-api Function App | manual | Azure portal / Bicep deploy confirmation | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_function_app.py` — add write handler test stubs (API-03, API-04, API-05, SEC-02 scenarios)
- [ ] `auth.py` — must exist in posts-api before write handler tests can import it (copy from ideas-api)

*No new config files needed — `pytest.ini` and `conftest.py` cover write tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Easy Auth enabled on posts-api Function App | SEC-02 | Requires Azure portal / Bicep deploy; cannot be unit-tested | After Bicep deploy: GET /api/posts should return 200; POST /api/posts with no Bearer token should return 401 |
| CORS configured for https://www.quixotry.me | API-03/04/05 | Requires browser OPTIONS preflight from live origin | Open browser DevTools on quixotry.me, attempt fetch() to posts-api — no CORS error |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
