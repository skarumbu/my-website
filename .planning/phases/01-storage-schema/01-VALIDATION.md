---
phase: 1
slug: storage-schema
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-30
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.0.3 (Python 3.12) |
| **Config file** | `C:\Users\Sriram\posts-api\pytest.ini` or `pyproject.toml` (Wave 0 installs) |
| **Quick run command** | `pytest tests/ -q` |
| **Full suite command** | `pytest tests/ -v` |
| **Estimated runtime** | ~5 seconds |
| **Local blob emulation** | Azurite 3.35.0 — `UseDevelopmentStorage=true` connection string |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/ -q`
- **After every plan wave:** Run `pytest tests/ -v`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| STOR-01 | 01 | 1 | STOR-01 | — | Container `publicAccess: None` + `allowBlobPublicAccess: false` | integration | `pytest tests/test_storage.py::test_container_exists -q` | ❌ W0 | ⬜ pending |
| STOR-02 | 01 | 1 | STOR-02 | — | Frontmatter round-trips without corruption | unit | `pytest tests/test_schema.py -q` | ❌ W0 | ⬜ pending |
| STOR-03 | 01 | 1 | STOR-03 | — | Slug deduplication appends -2/-3 on collision | unit | `pytest tests/test_slug.py -q` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_slug.py` — stubs for STOR-03 (slug generation + deduplication)
- [ ] `tests/test_schema.py` — stubs for STOR-02 (frontmatter parse/serialize round-trip)
- [ ] `tests/test_storage.py` — stubs for STOR-01 (container write/read via Azurite)
- [ ] `tests/conftest.py` — Azurite fixture (`UseDevelopmentStorage=true` blob service client)
- [ ] `pytest` install — `pip install pytest pytest-asyncio`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Azure container private access confirmed in portal | STOR-01 | Requires real Azure subscription + `az storage container show` | Run `az storage container show --name posts --account-name <account>` and verify `publicAccess` is `off` |
| Bicep deployment succeeds in real Azure | STOR-01 | Requires Azure subscription, can't be run in CI without secrets | Run `az deployment group create` against dev resource group; verify no errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
