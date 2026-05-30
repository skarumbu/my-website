# Domain Pitfalls: Custom Blog on Azure (Functions + Blob Storage + MSAL + React)

**Domain:** Personal writing/publishing system
**Stack:** React 18 (CRA/TypeScript) + Azure Static Web Apps + Azure Functions + Azure Blob Storage + MSAL
**Researched:** 2026-05-30

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or security incidents.

---

### Pitfall 1: Markdown Rendered Without Sanitization (XSS)

**What goes wrong:** Post body content is parsed from Blob Storage as a markdown string, then rendered into the DOM. If the render path uses `dangerouslySetInnerHTML` — or if a markdown library is configured with raw HTML passthrough — any `<script>`, inline event handler (`onerror=`, `onclick=`), or `javascript:` URL embedded in the markdown executes in the reader's browser.

**Why it happens:** This codebase already has this exact vulnerability in `LearningPlan.tsx` (hand-rolled `renderMarkdown` with `dangerouslySetInnerHTML`, no sanitization). The same pattern copied for post rendering will be silently broken.

**Consequences:** Stored XSS on a public-facing page. Any visitor to `/posts/:slug` runs attacker-controlled script. Even as a solo author, a compromised markdown file (or import from an external doc) is enough.

**Prevention:**
- Use `react-markdown` (renders via `React.createElement`, not `innerHTML`) as the rendering library. It does NOT use `dangerouslySetInnerHTML` by default.
- Add `rehype-sanitize` as a plugin to `react-markdown` to strip any raw HTML blocks the author might write.
- Never use `dangerouslySetInnerHTML` with post content anywhere in the chain.
- If importing existing docs from `docs/design/` or `docs/incidents/`, run them through the same sanitizer path.

**Detection:** Search the post-rendering component for `dangerouslySetInnerHTML`. If it exists, the code is vulnerable.

**Phase:** Address in the first rendering phase before any public post page ships.

---

### Pitfall 2: Azure Blob Storage CORS Blocks Browser Reads (and the Proxy Bypass Has Security Tradeoffs)

**What goes wrong:** Two approaches exist for reading post content in the browser:
- **Direct read**: Browser fetches from `*.blob.core.windows.net` directly. Requires CORS rules on the storage account. If not configured (or misconfigured), all reads silently fail with a CORS error.
- **Proxy read**: Azure Function proxies the blob to the browser. No CORS issue, but adds a cold-start latency on every read and leaks the storage account's structure if the function is not carefully scoped.

Direct access also means the storage account URL is effectively public — any blob in the container is reachable if an attacker guesses or enumerates slugs.

**Why it happens:** Developers configure the SPA and Functions correctly but forget that `blob.core.windows.net` is a different origin than both the SWA domain and the Functions URL. The browser preflight silently fails and the app shows empty content or an opaque network error.

**Consequences:**
- Direct read without CORS: Posts render as blank. Error appears only in DevTools Network tab.
- Direct read with public container: Entire post corpus is enumerable without authentication, including drafts.
- Proxy without scoping: Cold start delays on every public post read.

**Prevention:**
- Route ALL blob reads through Azure Functions. Do not expose the storage account to the browser directly.
- The Function reads from Blob Storage using a Managed Identity or connection string — no SAS tokens in client code.
- For public posts, the Function checks the `published: true` flag in frontmatter before serving content. Drafts are never returned from the public endpoint.
- Keep the Blob Storage container access set to **private** (not public blob or container access).

**Detection:** Check the Azure portal Storage Account > Containers > Access level. Any value other than "Private" is a misconfiguration for this architecture.

**Phase:** Architecture decision in Phase 1 (storage + API design). Never revisit once posts are live.

---

### Pitfall 3: MSAL Token Not Attached to Azure Functions Requests (Silent 401s)

**What goes wrong:** The editor calls a protected Azure Function (`/api/posts`) but the MSAL access token is not included in the request. The Function returns 401. The UI either silently fails or shows a generic error.

The more subtle version: `acquireTokenSilent` is called correctly, but the token is acquired for the wrong scope — for the dashboard's `clientId` instead of a separate posts API registration, or with `api://` prefix missing. The Function's audience validation rejects a technically-valid token with a wrong audience claim.

**Why it happens:** This codebase already has the wrong-scope bug: `ideasApiRequest` in `authConfig.js` (line 18) uses a hardcoded GUID instead of an env-var-derived scope. A new `postsApiRequest` scope added the same way will silently break if the app registration is ever rotated.

**Consequences:** Editor saves silently fail. Author sees no feedback. Posts are lost or never written to storage.

**Prevention:**
- Define the posts API scope in `authConfig.js` using the same `api://${process.env.REACT_APP_AZURE_CLIENT_ID}/access_as_user` pattern as `dashboardApiRequest` — not a hardcoded GUID.
- Call `acquireTokenSilent({ scopes: postsApiRequest.scopes, account })` before every mutating API call and attach the resulting `accessToken` as `Authorization: Bearer <token>` header.
- In the Azure Function, validate the token's `aud` (audience) claim matches the app registration client ID.
- Test token passing explicitly: log the decoded JWT in development to confirm audience matches before deploying.

**Detection:** A 401 from the Function while `useIsAuthenticated()` returns `true` in React almost always means wrong scope or missing `Authorization` header.

**Phase:** Address in the authentication wiring phase (before any write operations).

---

### Pitfall 4: `interaction_in_progress` Crashes the Editor on Token Refresh

**What goes wrong:** When the editor mounts, it calls `acquireTokenSilent`. If the token has expired, MSAL falls back to `acquireTokenRedirect` or `acquireTokenPopup`. If a second component (e.g. a nav bar or a separate `useEffect`) also initiates an interactive flow at the same time, MSAL throws `BrowserAuthError: interaction_in_progress`. The editor becomes non-functional and the in-progress draft is abandoned.

**Why it happens:** MSAL only permits one interactive request at a time. Multiple components calling auth APIs on mount race against each other.

**Consequences:** Editor crashes with an opaque auth error at the worst possible time (while the author is actively writing).

**Prevention:**
- Gate all interactive auth calls behind `inProgress === InteractionStatus.None` from `useMsal()`.
- Centralize token acquisition in a single `usePostsToken()` custom hook rather than calling `acquireTokenSilent` inline in components.
- The autosave mechanism must not trigger a token refresh independently — acquire once on mount, re-acquire only on explicit save action.
- Wrap the editor in an `<AuthenticatedTemplate>` so it never renders until MSAL has fully resolved the redirect promise.

**Detection:** `BrowserAuthError: interaction_in_progress` in the browser console during editor use.

**Phase:** Address during editor authentication wiring.

---

### Pitfall 5: No Autosave Means Draft Data Loss on Tab Close or Navigation

**What goes wrong:** The author writes for 10 minutes, accidentally closes the tab or navigates away, and the draft is gone. There is no recovery path because the post was never saved to Blob Storage (the save button was never clicked, or the network call failed silently).

**Why it happens:** Optimistic autosave is easy to defer because the happy path (user clicks save) works fine in testing.

**Consequences:** Author loses work. Trust in the editor is permanently damaged after one incident.

**Prevention:**
- Implement two-tier persistence:
  1. **localStorage draft backup**: Debounce writes to `localStorage` every 2-3 seconds while the author types. Key: `draft-${slug}` or `draft-new`. This survives tab crashes and accidental navigation.
  2. **API autosave**: Every 30-60 seconds (debounced), persist the draft to Blob Storage via the Azure Function. Only if the previous save succeeded.
- On editor mount, check localStorage for an unsaved draft. If found, prompt to restore.
- Clear localStorage only on successful API save, not on every write.
- Use the browser `beforeunload` event to warn if there are unsaved changes beyond the last API save.
- localStorage quota is ~5MB per origin — a markdown file will never approach this, but wrap writes in `try/catch` anyway.

**Detection:** Close the browser tab mid-edit. Reopen the editor. If the draft is gone, autosave is not working.

**Phase:** Address in the editor build phase, before any user testing.

---

## Moderate Pitfalls

---

### Pitfall 6: Slug Collisions and Non-URL-Safe Characters

**What goes wrong:** Two posts with similar titles generate the same slug. Or a title with colons, quotes, Unicode, or emoji produces a slug that breaks URL routing or the Blob Storage filename.

Example: "A: Deep Dive" and "A — Deep Dive" both slugify to `a-deep-dive`. The second post silently overwrites the first in Blob Storage (blob names are case-sensitive but otherwise exact-match).

**Why it happens:** Naive slug generators strip punctuation but do not deduplicate. Blob Storage has no uniqueness constraint — a write to an existing key overwrites without warning.

**Consequences:** Silent data loss. The original post is overwritten by a new one with the same slug.

**Prevention:**
- Use a battle-tested slugify library (e.g. `slugify` npm package with `strict: true`). Do not roll a regex-based implementation.
- Slug generation: lowercase, strip non-alphanumeric except hyphens, collapse consecutive hyphens, trim leading/trailing hyphens, max 80 characters.
- Before creating a post, call `GET /api/posts/{slug}` to check existence. If taken, append `-2`, `-3`, etc.
- Include the slug in the frontmatter and treat it as the canonical identifier — never re-derive it from the title after creation.
- Store posts as `{slug}.md` files. The slug is both the Blob name and the URL path segment.

**Detection:** Create two posts with the same title. Verify the second gets a `-2` suffix.

**Phase:** Address in the API design phase.

---

### Pitfall 7: Cold Start Latency Makes the Editor Feel Broken on First Save

**What goes wrong:** The author opens the editor (which has been idle for 20+ minutes), types a post, and clicks "Save". The Azure Function cold starts — taking 2-10 seconds — before responding. The UI shows no feedback, the author clicks save again, and either two identical posts are created or a spinner appears with no explanation.

**Why it happens:** Azure Functions on the Consumption plan deallocate after ~20 minutes of inactivity. The editor is a low-traffic feature used intermittently by a single user, so cold starts are nearly guaranteed.

**Consequences:** Duplicate save requests; confusing UX; author doubts whether posts were saved.

**Prevention:**
- Show a loading state on the save button immediately on click (disable the button, show spinner). Do not wait for the API response to start indicating activity.
- Implement idempotent save: include the slug and a `lastModified` timestamp in the request. If a duplicate request arrives (author clicked twice), the Function detects the ETag or timestamp match and returns 200 without writing.
- A lightweight "ping" Function (called on editor mount) pre-warms the instance by the time the author finishes their first sentence. Cost: one invocation per editor session.
- Consider a 15-second frontend timeout with a user-friendly retry option rather than an infinite spinner.

**Detection:** Stop all Function activity for 25 minutes. Open the editor and immediately click Save. Observe latency.

**Phase:** Address in the editor UX phase.

---

### Pitfall 8: YAML Frontmatter Breaks on Post Titles with Special Characters

**What goes wrong:** A post titled `"On React: Why I Changed My Mind"` generates frontmatter like:

```yaml
---
title: On React: Why I Changed My Mind
---
```

The colon makes the YAML parser interpret `Why I Changed My Mind` as the value of a key named `On React`. The parse fails or silently drops the title.

Similarly, a title starting with `#`, containing `>`, or using Unicode em-dash (`—`) can break naively constructed YAML.

**Why it happens:** Frontmatter is usually written by templating the title directly into the YAML block without escaping or quoting. This works for 90% of titles and fails silently for the rest.

**Consequences:** Post metadata is corrupted. Slug derivation fails. Post list shows empty titles or crashes.

**Prevention:**
- Always wrap the `title` value in double quotes in the frontmatter template: `title: "${title}"`.
- Escape internal double quotes in the title: `title.replace(/"/g, '\\"')`.
- Use `gray-matter` (battle-tested, used by Gatsby, Vite Press, Netlify) for both writing and parsing frontmatter — do not hand-roll YAML serialization.
- Validate frontmatter roundtrip in development: parse the file immediately after writing and assert the title field matches the original.

**Detection:** Create a post titled `"Test: Colon In Title"`. Verify the list and post page display the full title correctly.

**Phase:** Address in the API design / storage layer phase.

---

### Pitfall 9: `redirectUri` in `msalConfig` Hard-Coded to `/dashboard` Breaks Editor Auth Flow

**What goes wrong:** The current `authConfig.js` sets `redirectUri: window.location.origin + "/dashboard"`. When the editor at `/write` initiates a login redirect, MSAL redirects the user back to `/dashboard` after authentication, not back to `/write`. The draft context is lost and the author must navigate back manually.

**Why it happens:** The redirect URI was set for the existing dashboard use case and was not designed to be shared across routes.

**Consequences:** Auth on the editor redirects the author away from their draft. Combined with no autosave, this causes data loss.

**Prevention:**
- Set `redirectUri` to `window.location.origin` (the root, not a specific route).
- Register this root URI in the Azure AD App Registration's Redirect URIs list.
- After the redirect resolves, use MSAL's `loginHint` or post-login redirect logic to return the user to `/write`.
- Alternatively, use `loginPopup` instead of `loginRedirect` for the editor — popup auth does not navigate away from the current page.

**Detection:** Log out, navigate to `/write`, observe where you land after login completes.

**Phase:** Address during authentication wiring, before the editor ships.

---

## Minor Pitfalls

---

### Pitfall 10: `listed` vs `published` Flag Confusion Creates Accidental Publishing

**What goes wrong:** A draft has `published: false` in frontmatter, but the list endpoint reads all blobs without filtering on the `published` field. The draft appears in the public post feed.

**Why it happens:** The list endpoint is built first (quick to prototype — just list all blobs), and the published filter is deferred. The filter is then forgotten.

**Prevention:**
- Define the data model upfront: frontmatter must include `published: boolean`. The list endpoint filters blobs before returning. Never return blobs where `published: false` from the public `GET /api/posts` endpoint.
- The private editor endpoint can return all posts including drafts (gated by auth).
- Write a simple integration test: create a draft, call the public list API, assert the draft is absent.

**Phase:** Define in the storage schema design phase.

---

### Pitfall 11: Blob Storage List API Returns Stale Data After Write

**What goes wrong:** Author publishes a post. The editor calls `GET /api/posts` to refresh the list immediately after. The list still shows the old state because the blob operation has not propagated. The author thinks the publish failed and clicks again, creating a duplicate.

**Why it happens:** Azure Blob Storage list operations have eventual consistency for some metadata operations when combined with concurrent writes. More commonly, a local cache in the Function causes this.

**Prevention:**
- After a create/update/delete, do not immediately re-fetch. Instead, optimistically update the local UI state and only re-fetch after a 1-second delay.
- Include the slug in the API response on write — use that to update the local list without a round trip.
- Do not cache blob list results server-side without a clear invalidation strategy.

**Phase:** Address in the API integration phase.

---

### Pitfall 12: Large Blob Lists Become Slow Without a Metadata Index

**What goes wrong:** With dozens or hundreds of posts, listing all blobs and parsing frontmatter on every `GET /api/posts` call to extract title, slug, date, and published status is slow (each blob requires a separate metadata read or a full blob download).

**Why it happens:** Starting with "just read all blobs" is the obvious MVP approach. Performance degrades invisibly until there are enough posts to notice.

**Consequences:** Public post list loads slowly. Azure Function execution time increases, increasing costs.

**Prevention:**
- Include all list-relevant metadata (title, slug, date, published, excerpt) as blob metadata tags or in a separate index blob (`_index.json`) that is updated on every write.
- The list endpoint reads only the index, not individual post blobs.
- The index update is the Azure Function's responsibility on every create/update/delete.

**Phase:** Address in the API design phase. Defer the index if post count will stay under ~50 for the foreseeable future, but design the API contract to allow adding it later without breaking clients.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Storage schema design | Slug collisions (#6), YAML special chars (#8), draft/published confusion (#10) | Define schema and slug algorithm before writing any API code |
| API (CRUD Functions) | CORS architecture (#2), blob list staleness (#11), index performance (#12) | Route all reads through Functions; design index from the start |
| Auth wiring (editor) | Wrong scope 401 (#3), interaction_in_progress (#4), redirect URI mismatch (#9) | Centralize token acquisition in one hook; use popup flow for editor |
| Editor build | Autosave data loss (#5), cold start UX (#7) | localStorage backup + debounced API save + pre-warm ping on mount |
| Post rendering (public) | XSS via markdown (#1) | Use react-markdown + rehype-sanitize before any public page ships |

---

## Sources

- [MSAL React error handling — interaction_in_progress](https://learn.microsoft.com/en-us/entra/msal/javascript/react/errors)
- [MSAL JS common errors — BrowserAuthError](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/errors)
- [Acquiring tokens in SPAs — acquireTokenSilent](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-spa-acquire-token)
- [Azure Blob Storage CORS support](https://learn.microsoft.com/en-us/rest/api/storageservices/cross-origin-resource-sharing--cors--support-for-the-azure-storage-services)
- [Azure Blob Storage CORS + InteractiveBrowserCredential issue](https://github.com/Azure/azure-sdk-for-js/issues/26473)
- [Azure Blob Storage concurrency management](https://azure.microsoft.com/en-us/blog/managing-concurrency-in-microsoft-azure-storage-2/)
- [Manage concurrency in Blob Storage](https://learn.microsoft.com/en-us/azure/storage/blobs/concurrency-manage)
- [Azure Functions cold start mitigation](https://learn.microsoft.com/en-us/answers/questions/5515120/how-to-reduce-cold-start-latency-in-azure-functions-on-consumption-plan)
- [XSS via Markdown in React](https://medium.com/javascript-security/avoiding-xss-via-markdown-in-react-91665479900)
- [react-markdown performance issue thread](https://github.com/remarkjs/react-markdown/issues/459)
- [Pitfall of stored XSS in React markdown editors](https://medium.com/@brian3814/pitfall-of-potential-xss-in-markdown-editors-1d9e0d2df93a)
- [gray-matter — frontmatter parser](https://github.com/jonschlinkert/gray-matter)
- [Escaping characters in YAML frontmatter](https://inspirnathan.com/posts/134-escape-characters-in-yaml-frontmatter/)
- [SPA with msal-browser and AD-protected Azure Functions](https://marc-bastiaansen.medium.com/spa-with-msal-browser-and-ad-protected-azure-functions-a5a3415df411)
- [Azure Static Web Apps authentication](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-authorization)
