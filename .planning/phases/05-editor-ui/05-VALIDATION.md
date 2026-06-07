---
phase: 5
slug: editor-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-05
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest + React Testing Library (built into CRA — react-scripts) |
| **Config file** | none — CRA auto-detects `*.test.tsx` files |
| **Quick run command** | `npm test -- --watchAll=false --testPathPattern=Write` |
| **Full suite command** | `npm test -- --watchAll=false` |
| **Estimated runtime** | ~15 seconds (quick) / ~30 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --watchAll=false --testPathPattern=Write`
- **After every plan wave:** Run `npm test -- --watchAll=false`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | EDIT-01, EDIT-02 | T-05-01 | Unauthenticated request to /write renders login prompt, not editor | unit | `npm test -- --watchAll=false --testPathPattern=Write` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | EDIT-03 | T-05-02 | Title/description/body fields render in editor | unit | same | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | EDIT-06 | T-05-03 | Published checkbox state is reflected in save payload | unit | same | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | EDIT-04 | T-05-04 | Editor loads existing post by slug from API | unit | same | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | EDIT-05 | T-05-05 | Delete calls DELETE endpoint and navigates to /write | unit | same | ❌ W0 | ⬜ pending |
| 05-02-03 | 02 | 2 | EDIT-07, EDIT-08 | T-05-06 | localStorage written within 3s; API save called within 60s | unit (fake timers) | same | ❌ W0 | ⬜ pending |
| 05-02-04 | 02 | 2 | EDIT-09 | T-05-07 | Navigation blocked when unsaved changes exist | unit (mock useBlocker) | same | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__mocks__/@azure/msal-react.tsx` — mock module for `useMsal`, `useIsAuthenticated`, `useAccount` (required by all write tests before any component can render)
- [ ] `src/Write.test.tsx` — stubs for EDIT-01, EDIT-02, EDIT-05 (list page auth gate and delete)
- [ ] `src/WriteEditor.test.tsx` — stubs for EDIT-03, EDIT-04, EDIT-06, EDIT-07, EDIT-08, EDIT-09

Wave 0 stubs must fail RED before implementation (ImportError or render failure). Auth mock is a prerequisite for all write component tests.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Azure AD login redirect works from /write | EDIT-02 | Requires live Azure AD tenant; cannot mock in unit tests | Navigate to /write when logged out; confirm redirect to Microsoft login and return to /write after auth |
| Published post appears on /posts after save | EDIT-03, EDIT-06 | End-to-end across two pages and real blob storage | Create post with Published=true; navigate to /posts and confirm it appears |
| Autosave indicator shows "Saved" state | EDIT-08 | Requires real API and timing | Edit a post, wait 60s, confirm "Saved" indicator appears in editor toolbar |
| Unsaved changes warning on tab close | EDIT-09 | Browser beforeunload cannot be reliably automated | Edit without saving; close tab; confirm browser shows "Leave site?" dialog |
| redirectUri fix works post-deploy | EDIT-02 | Requires Azure AD App Registration update | Confirm `window.location.origin` registered in Azure AD before deploying |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
