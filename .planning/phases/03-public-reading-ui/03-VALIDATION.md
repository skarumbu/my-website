---
phase: 3
slug: public-reading-ui
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-04
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (CRA default) |
| **Config file** | package.json (CRA built-in) |
| **Quick run command** | `CI=true npm test -- --testPathPattern="Posts"` |
| **Full suite command** | `CI=true npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `CI=true npm test -- --testPathPattern="Posts"`
- **After every plan wave:** Run `CI=true npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | READ-01 | — | N/A | unit | `CI=true npm test -- --testPathPattern="PostsList"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | READ-02 | — | N/A | unit | `CI=true npm test -- --testPathPattern="PostDetail"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | READ-03 | — | N/A | unit | `CI=true npm test -- --testPathPattern="PostDetail"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SEC-01 | T-01 | react-markdown used (no dangerouslySetInnerHTML) | unit | `CI=true npm test -- --testPathPattern="PostDetail"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/Posts.test.tsx` — stubs for READ-01, READ-02 (created by Plan 01 Task 1)
- [ ] `src/__tests__/PostReader.test.tsx` — RED stubs for READ-03, READ-04, READ-05, SEC-01 (created by Plan 01 Task 1; turned GREEN by Plan 02 Task 1)
- [ ] `src/__mocks__/react-markdown.js` — mock for ESM-only react-markdown (CRA Jest cannot transform ESM; created by Plan 01 Task 1)

*react-markdown v7+ is ESM-only and must be mocked for CRA Jest. Production webpack 5 handles ESM fine.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Markdown renders visually (headings, code blocks, lists) | READ-04 | Visual rendering cannot be asserted by unit tests | Load `/posts/:slug` in browser, verify markdown elements display correctly |
| Back-link navigates to /posts | READ-05 | Navigation UX | Click "← Back to posts" link, confirm route change |
| CORS does not block API calls in dev | — | Environment-specific | Run dev server with `REACT_APP_API_BASE_URL` set, verify network tab shows 200 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
