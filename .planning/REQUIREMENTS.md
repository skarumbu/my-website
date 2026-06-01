# Requirements: Personal Site — Posts & Writing

**Defined:** 2026-05-30
**Core Value:** A private writing space that publishes instantly to a public reading feed — write anything, share without friction.

## v1 Requirements

### Storage & Backend

- [x] **STOR-01**: Azure Blob Storage container provisioned for posts (one `.md` file per post)
- [x] **STOR-02**: Post frontmatter schema defined and documented (`title`, `slug`, `date`, `published`, `description`)
- [x] **STOR-03**: Slug generation algorithm implemented with deduplication (no two posts share a slug)
- [x] **API-01**: `GET /api/posts` returns all published posts sorted by date descending (public)
- [x] **API-02**: `GET /api/posts/:slug` returns a single published post by slug (public)
- [ ] **API-03**: `POST /api/posts` creates a new post blob from request body (MSAL-gated)
- [ ] **API-04**: `PUT /api/posts/:slug` updates an existing post blob (MSAL-gated)
- [ ] **API-05**: `DELETE /api/posts/:slug` deletes a post blob (MSAL-gated)

### Public Reading

- [ ] **READ-01**: User can view a list of all published posts at `/posts`, sorted newest first
- [ ] **READ-02**: Each post in the list shows title, date, and excerpt/description
- [ ] **READ-03**: User can click a post to read the full article at `/posts/:slug`
- [ ] **READ-04**: Post content is rendered from markdown (headings, bold, italic, links, lists, code blocks)
- [ ] **READ-05**: Post pages have a "back to posts" link

### Editor

- [ ] **EDIT-01**: Authenticated user can access the editor at `/write`
- [ ] **EDIT-02**: Editor is gated behind Azure AD login (reusing existing MSAL setup)
- [ ] **EDIT-03**: User can create a new post with title, description, and markdown body
- [ ] **EDIT-04**: User can edit an existing post from the editor
- [ ] **EDIT-05**: User can delete a post from the editor
- [ ] **EDIT-06**: User can toggle a post between published and draft (unpublished posts don't appear on `/posts`)
- [ ] **EDIT-07**: Editor autosaves to localStorage every 2-3 seconds (crash recovery)
- [ ] **EDIT-08**: Editor saves to API every 30-60 seconds
- [ ] **EDIT-09**: User sees an unsaved-changes warning before navigating away with unsaved work

### Security

- [ ] **SEC-01**: Post content rendered using `react-markdown` (not `dangerouslySetInnerHTML`) — prevents XSS
- [ ] **SEC-02**: Write API endpoints validate Bearer token before any mutation
- [ ] **SEC-03**: Azure Blob Storage container is private — all access goes through Functions, never direct browser

## v2 Requirements

### Reading Enhancements

- **READ-V2-01**: Code syntax highlighting in post bodies
- **READ-V2-02**: Heading anchor links for long articles
- **READ-V2-03**: Estimated reading time shown on post list and reader

### Editor Enhancements

- **EDIT-V2-01**: Live split-pane preview (markdown left, rendered right)
- **EDIT-V2-02**: Cmd/Ctrl+S keyboard shortcut to save
- **EDIT-V2-03**: Post list in editor showing all posts (published + drafts)

### Discovery

- **DISC-01**: Posts linked from main site navigation
- **DISC-02**: RSS feed at `/feed.xml`
- **DISC-03**: Sitemap for SEO

## Out of Scope

| Feature | Reason |
|---------|--------|
| Comments / reactions | Personal site, not a community platform |
| Tags or categories | Date ordering is sufficient for v1 |
| Full-text search | Low post count makes this unnecessary |
| Image uploads via editor | Adds storage complexity; use external hosting for now |
| Version history / drafts list | Overkill for solo author v1 |
| Multi-author support | Solo author only |
| Scheduled publishing | Publish-on-save is sufficient |
| OAuth login (non-Azure AD) | MSAL already installed and working |
| Pagination | Low post count; simple list is fine |

## Traceability

*Updated: 2026-05-30 after roadmap creation.*

| Requirement | Phase | Status |
|-------------|-------|--------|
| STOR-01 | Phase 1 | Complete |
| STOR-02 | Phase 1 | Complete |
| STOR-03 | Phase 1 | Complete |
| API-01 | Phase 2 | Complete |
| API-02 | Phase 2 | Complete |
| SEC-03 | Phase 2 | Complete |
| READ-01 | Phase 3 | Pending |
| READ-02 | Phase 3 | Pending |
| READ-03 | Phase 3 | Pending |
| READ-04 | Phase 3 | Pending |
| READ-05 | Phase 3 | Pending |
| SEC-01 | Phase 3 | Pending |
| API-03 | Phase 4 | Pending |
| API-04 | Phase 4 | Pending |
| API-05 | Phase 4 | Pending |
| SEC-02 | Phase 4 | Pending |
| EDIT-01 | Phase 5 | Pending |
| EDIT-02 | Phase 5 | Pending |
| EDIT-03 | Phase 5 | Pending |
| EDIT-04 | Phase 5 | Pending |
| EDIT-05 | Phase 5 | Pending |
| EDIT-06 | Phase 5 | Pending |
| EDIT-07 | Phase 5 | Pending |
| EDIT-08 | Phase 5 | Pending |
| EDIT-09 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25 ✓
- Unmapped: 0

---
*Requirements defined: 2026-05-30*
*Last updated: 2026-05-30 after roadmap creation*
