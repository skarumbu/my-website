# Roadmap: Personal Site — Posts & Writing

**Milestone:** Posts & Writing System (v1)
**Defined:** 2026-05-30
**Granularity:** standard
**Mode:** mvp
**Coverage:** 25/25 requirements mapped

---

## Phases

- [x] **Phase 1: Storage & Schema** — Blob container provisioned, frontmatter spec locked, slug algorithm implemented (completed 2026-05-31)
- [x] **Phase 2: Public Reading API** — Read-only Azure Functions endpoints serving published posts (completed 2026-05-31)
- [ ] **Phase 3: Public Reading UI** — Public `/posts` list and `/posts/:slug` reader live on site
- [ ] **Phase 4: Write API** — Authenticated create/update/delete endpoints with Bearer token validation
- [ ] **Phase 5: Editor UI** — Auth-gated `/write` editor with full create/edit/publish/delete flows and autosave

---

## Phase Details

### Phase 1: Storage & Schema

**Goal:** Blob storage container is provisioned and the post data model is locked — no file format migrations needed later.
**Mode:** mvp
**Depends on:** Nothing
**Requirements:** STOR-01, STOR-02, STOR-03
**Success Criteria**:

  1. An Azure Blob Storage container exists and accepts `.md` file writes from Azure Functions
  2. A documented frontmatter schema (`title`, `slug`, `date`, `published`, `description`) is in place and validated against a sample post
  3. A slug generation function produces URL-safe slugs and rejects or deduplicates any slug collision

**Plans:** 3/3 plans complete
**Wave 1**

- [x] 01-01-PLAN.md — Scaffold posts-api repo: git init, config files, venv, package install, pytest config, Azurite fixture, stub tests

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Implement schema.py + slugs.py with 13 passing pytest tests (Azurite-backed blob round-trip)
- [x] 01-03-PLAN.md — Write postsapi.bicep + wire into main.bicep + create GitHub repo + deploy to Azure

### Phase 2: Public Reading API

**Goal:** Public readers can retrieve published posts through Azure Functions endpoints — no auth complexity, storage access confirmed end-to-end.
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** API-01, API-02, SEC-03
**Success Criteria**:

  1. `GET /api/posts` returns a JSON array of published posts sorted newest first; drafts are excluded
  2. `GET /api/posts/:slug` returns the full post body and frontmatter for a valid published slug
  3. Requests hitting the Blob container directly (bypassing Functions) are rejected — the container is private

**Plans:** 1/2 plans executed

**Wave 1**

- [x] 02-01-PLAN.md — Implement list_posts + get_post handlers in function_app.py with full test suite (7 tests, Azurite + unit)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 02-02-PLAN.md — SEC-03 smoke-test checkpoint: verify direct blob URL returns 403

### Phase 3: Public Reading UI

**Goal:** Anyone can browse and read published posts on the live site with readable, XSS-safe markdown rendering.
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** READ-01, READ-02, READ-03, READ-04, READ-05, SEC-01
**Success Criteria**:

  1. Visiting `/posts` shows a list of all published posts sorted newest first, each showing title, date, and description
  2. Clicking a post navigates to `/posts/:slug` and renders the full article
  3. Post bodies render markdown correctly: headings, bold, italic, links, lists, and code blocks all display as expected
  4. Post content is rendered via `react-markdown` — no `dangerouslySetInnerHTML` is used for post content
  5. A "back to posts" link on each post page returns the reader to `/posts`

**Plans:** 3 plans
**UI hint**: yes

**Wave 1**

- [ ] 03-01-PLAN.md — Install react-markdown + Wave 0 test scaffolds; build `/posts` list page (Posts.tsx + posts.css) and register route (READ-01, READ-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 03-02-PLAN.md — Build `/posts/:slug` reader (PostReader.tsx + post-reader.css) with react-markdown rendering; register route (READ-03, READ-04, READ-05, SEC-01)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 03-03-PLAN.md — Site integration: Writing nav links + home card + CI env var; human-verify live read path (D-09, D-10)

### Phase 4: Write API

**Goal:** Authenticated write operations (create, update, delete) are available through Azure Functions with token validation enforced before any mutation.
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** API-03, API-04, API-05, SEC-02
**Success Criteria**:

  1. `POST /api/posts` with a valid Bearer token creates a new `.md` blob in storage and returns the new post's slug
  2. `PUT /api/posts/:slug` with a valid Bearer token updates the existing blob and persists the changes
  3. `DELETE /api/posts/:slug` with a valid Bearer token removes the blob from storage
  4. Any write request without a valid Bearer token is rejected with a 401 response — no mutation occurs

**Plans**: TBD

### Phase 5: Editor UI

**Goal:** The authenticated author can create, edit, publish, unpublish, and delete posts from a private editor at `/write` with autosave protection against data loss.
**Mode:** mvp
**Depends on:** Phase 3, Phase 4
**Requirements:** EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, EDIT-07, EDIT-08, EDIT-09
**Success Criteria**:

  1. Navigating to `/write` without an Azure AD session redirects to login; authenticated users land on the editor
  2. A logged-in user can create a new post (title, description, body) and see it appear on `/posts` after publishing
  3. A logged-in user can open an existing post, edit it, save, and see the updated content on the public reader
  4. A logged-in user can delete a post from the editor and confirm it is removed from `/posts`
  5. A logged-in user can toggle a post between published and draft; unpublished posts do not appear on `/posts`
  6. The editor autosaves to localStorage every 2-3 seconds; navigating away with unsaved changes shows a warning

**Plans**: TBD
**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Storage & Schema | 3/3 | Complete   | 2026-05-31 |
| 2. Public Reading API | 2/2 | Complete | 2026-05-31 |
| 3. Public Reading UI | 0/3 | Planned | - |
| 4. Write API | 0/? | Not started | - |
| 5. Editor UI | 0/? | Not started | - |

---

*Roadmap created: 2026-05-30*
*Last updated: 2026-06-04 after Phase 3 planning*
