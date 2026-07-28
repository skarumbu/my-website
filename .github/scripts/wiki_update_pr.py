#!/usr/bin/env python3
"""
Analyses a pull request's full diff and, when the changes are significant,
proposes an architecture wiki update as a PR against my-website — rather than
committing directly, so the proposed content gets real review before it lands.

Re-run on every push to the PR (opened/synchronize/reopened): regenerates from
the current PR diff and force-pushes the same branch, so there's only ever one
wiki-update PR per code PR, always reflecting its latest state. Nothing here
closes or merges that PR automatically — that's a deliberate choice: review and
merge it yourself, on your own schedule, independent of the code PR.

Required env vars:
  ARCH_CONTENT_FOUNDRY_KEY  - API key for arch-content-foundry.services.ai.azure.com
  WIKI_UPDATE_GH_TOKEN      - Fine-grained PAT with contents+PRs write access to skarumbu/my-website
  GH_TOKEN                  - Token for the CALLING repo (posting the linking comment) —
                              the default Actions token is sufficient
  PR_DIFF_FILE              - Path to the full PR unified diff
  PR_TITLE                  - PR title
  PR_URL                    - HTML URL of the originating PR
  PR_NUMBER                 - PR number of the originating PR (integer string)
  HEAD_SHA                  - Full SHA of the PR's current head commit
  REPO_NAME                 - Page key matching architecture-pages.json (e.g. "digits")
  REPO_FULL                 - Full repo slug of the calling repo (e.g. "skarumbu/digits")
"""

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
import base64
from datetime import date

from openai import AzureOpenAI

ENDPOINT = "https://eastus.api.cognitive.microsoft.com/"
DEPLOYMENT = "gpt-4o"
API_VERSION = "2024-02-01"
MY_WEBSITE_REPO = "skarumbu/my-website"
PAGES_FILE = "src/architecture-pages.json"
HISTORY_INDEX_FILE = "src/architecture-history-index.json"
MAX_RELATED_PAGES = 2

client = AzureOpenAI(
    azure_endpoint=ENDPOINT,
    api_key=os.environ["ARCH_CONTENT_FOUNDRY_KEY"],
    api_version=API_VERSION,
)

diff_file = os.environ["PR_DIFF_FILE"]
with open(diff_file, "r", encoding="utf-8", errors="replace") as f:
    diff = f.read(80_000)

pr_title = os.environ["PR_TITLE"]
pr_url = os.environ["PR_URL"]
pr_number = os.environ["PR_NUMBER"]
head_sha = os.environ["HEAD_SHA"]
repo_name = os.environ["REPO_NAME"]
repo_full = os.environ["REPO_FULL"]
wiki_gh_token = os.environ["WIKI_UPDATE_GH_TOKEN"]
today = date.today().isoformat()
short_sha = head_sha[:7]
wiki_branch = f"wiki-update/{repo_name}-pr-{pr_number}"


def strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:])
        if text.endswith("```"):
            text = text[:-3].rstrip()
    return text


def run(cmd, **kw):
    result = subprocess.run(cmd, check=True, capture_output=True, text=True, **kw)
    return result.stdout.strip()


# ── Fetch the current wiki page list from my-website's main (for the "reuse an
#    existing page instead of duplicating" prompt hint) ─────────────────────

def fetch_pages_from_main() -> dict:
    api_url = f"https://api.github.com/repos/{MY_WEBSITE_REPO}/contents/{PAGES_FILE}"
    req = urllib.request.Request(
        api_url,
        headers={
            "Authorization": f"token {wiki_gh_token}",
            "Accept": "application/vnd.github.v3+json",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            file_meta = json.loads(resp.read().decode("utf-8"))
            return json.loads(base64.b64decode(file_meta["content"]).decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            print(f"Error: GitHub API returned {e.code} — WIKI_UPDATE_GH_TOKEN is expired or lacks Contents permission.", file=sys.stderr)
            sys.exit(1)
        if e.code == 404:
            print(f"Warning: {PAGES_FILE} not found — will generate content from scratch.", file=sys.stderr)
            return {}
        raise


current_pages = fetch_pages_from_main()
existing_pages_list = "\n".join(f"- {key}: {p.get('title', key)}" for key, p in current_pages.items()) or "(none yet)"

# ── Phase 1: significance check ──────────────────────────────────────────────

significance_prompt = f"""You are a technical architect reviewing a pull request for the '{repo_name}' service,
before it merges, to decide whether the architecture wiki needs updating.

PR title: {pr_title}
PR diff (truncated to 80KB):
{diff}

Decide whether this PR is significant enough to warrant updating the architecture
documentation for '{repo_name}'.

Update docs for:
- New or removed API endpoints/routes
- New or removed external integrations or dependencies
- Changed data models or storage patterns
- Security or authentication changes
- New or removed user-facing features
- Changes to how the service scales or operates

Do NOT update docs for:
- Bug fixes
- Dependency version bumps
- Test-only changes
- Lint, formatting, or comment changes
- Minor copy or UI tweaks

Additionally, identify any OTHER wiki pages this diff is relevant to — cross-cutting
concepts or patterns that span multiple services (e.g. authentication, caching
strategy, rate limiting, observability conventions, external AI provider
integration patterns). Existing wiki pages (reuse one of these keys if the diff
relates to it — do not create a near-duplicate under a new key):
{existing_pages_list}

For each relevant page (existing or new — at most {MAX_RELATED_PAGES}), add an entry
to "related_page_updates":
- "key": kebab-case identifier. Reuse an existing key from the list above if it
  matches; otherwise propose a new short key.
- "title": human-readable title.
- "is_new": true if this key is not in the existing pages list above.
- "reason": one sentence on why this diff is relevant to that page.

Only include a page if the diff reveals something genuinely relevant to it — most
diffs won't need any. related_page_updates may be an empty array.

Respond with a JSON object (no markdown fences):
{{
  "needs_update": <true|false>,
  "reason": "<one sentence>",
  "affected_sections": ["features", "architecture", "dataFlow"],
  "related_page_updates": [
    {{"key": "...", "title": "...", "is_new": <true|false>, "reason": "..."}}
  ]
}}

Only include sections in affected_sections that actually changed.
affected_sections may be empty if needs_update is false."""

resp1 = client.chat.completions.create(
    model=DEPLOYMENT,
    messages=[{"role": "user", "content": significance_prompt}],
    temperature=0,
    max_tokens=500,
)

raw1 = strip_fences(resp1.choices[0].message.content)

try:
    decision = json.loads(raw1)
except json.JSONDecodeError:
    print(f"Could not parse significance response:\n{raw1}", file=sys.stderr)
    sys.exit(0)

print(f"needs_update={decision['needs_update']} — {decision['reason']}")

if not decision.get("needs_update"):
    print("No wiki update needed. Exiting.")
    sys.exit(0)

affected = decision.get("affected_sections", ["features", "architecture"])
related_page_updates = (decision.get("related_page_updates") or [])[:MAX_RELATED_PAGES]

# ── Phase 2a: generate the package's own content patch ───────────────────────

current_page = current_pages.get(repo_name, {})
sections_desc = ", ".join(affected) if affected else "features, architecture"

update_prompt = f"""You are updating the architecture wiki page for the '{repo_name}' package.

Current content for this page:
{json.dumps(current_page, indent=2)}

Pull request: {pr_title} ({repo_name}#{pr_number})
PR diff:
{diff}

The following sections may need updating: {sections_desc}

Generate a JSON object containing ONLY the fields that changed. Omit fields that
don't need updating. You may update any subset of these fields:

- "summary": string — 2-3 sentences for the architecture overview page
- "description": string — 1-2 sentence paragraph for the page header
- "features": array of strings — one entry per notable feature or capability
- "architecture": object with:
    "overview": string — paragraph describing the technical approach
    "keyPoints": array of strings — key design decisions, constraints, implementation details
- "dataFlow": array of flow steps, each: {{"label": "...", "color": "blue|green|orange|purple", "sublines": ["..."]}}
  (color and sublines are optional; only include dataFlow if the request flow changed significantly)

Any of these fields may reference another wiki page inline by wrapping the mention as
[[key|display text]] (the |display text part is optional) — but ONLY using a key from
this list of existing pages, or one you are creating via related_page_updates in this
same response. Never invent a reference to a page that doesn't exist.

Existing wiki pages:
{existing_pages_list}

Rules:
- Keep the same level of detail as the current content
- Do not change fields unrelated to this diff
- dataFlow color values must be one of: blue, green, orange, purple (or omit color entirely)
- Return valid JSON only (no markdown fences, no commentary)"""

resp2 = client.chat.completions.create(
    model=DEPLOYMENT,
    messages=[{"role": "user", "content": update_prompt}],
    temperature=0.2,
    max_tokens=1500,
)

raw2 = strip_fences(resp2.choices[0].message.content)

try:
    page_updates = json.loads(raw2)
except json.JSONDecodeError:
    print(f"Could not parse content update response:\n{raw2}", file=sys.stderr)
    sys.exit(1)

print(f"Generated updates for sections: {list(page_updates.keys())}")

# ── Phase 2b: generate content for each related page (independent — one bad
#    response here must not sink the package update above) ──────────────────

generated_related_pages = {}
for related in related_page_updates:
    key = related["key"]
    is_new = related.get("is_new", key not in current_pages)
    current_related = current_pages.get(key, {})

    related_prompt = f"""You are updating the "{related['title']}" wiki page (key: "{key}") — a page
describing a CROSS-CUTTING CONCEPT/PATTERN used across multiple services, not one
specific package.

{"This page does not exist yet — create it from scratch." if is_new else
 f"Current content for this page:{chr(10)}{json.dumps(current_related, indent=2)}"}

The '{repo_name}' package just made this change, in pull request {pr_title} ({repo_name}#{pr_number}):
PR diff (truncated):
{diff}

Reason this is relevant to the page: {related['reason']}

Generate a JSON object for this page with these fields:
- "title": string
- "summary": string — 1-2 sentences, shown in the wiki's page index list
- "description": string — general philosophy/approach paragraph (the page's overview)
- "sections": [ {{"heading": "...", "content": "..."}}, ... ] — return the FULL
  updated sections array, not a partial patch, since sections are addressed by
  heading rather than index
- "relatedPages": array of page keys this page applies to (always include
  "{repo_name}"; add others only if you have specific evidence they use the same
  pattern — do not guess)

Content in "description" or any section's "content" may reference another wiki page
inline via [[key|display text]] — only using an existing key from the list below,
or "{key}" itself is not needed since you're already on this page.

Existing wiki pages:
{existing_pages_list}

If this page is not new, only include fields that need to change; if a section's
content is unaffected, keep it byte-for-byte as it already is.

Return valid JSON only (no markdown fences, no commentary)."""

    try:
        resp3 = client.chat.completions.create(
            model=DEPLOYMENT,
            messages=[{"role": "user", "content": related_prompt}],
            temperature=0.2,
            max_tokens=2000,
        )
        raw3 = strip_fences(resp3.choices[0].message.content)
        related_content = json.loads(raw3)
        if len(related_content.get("sections", [])) > 12:
            print(f"Skipping related page '{key}': {len(related_content['sections'])} sections looks like a hallucination/duplication bug.", file=sys.stderr)
            continue
        generated_related_pages[key] = related_content
        print(f"Generated related page update: {key}")
    except (json.JSONDecodeError, KeyError) as e:
        print(f"Skipping related page '{key}': failed to generate/parse ({e})", file=sys.stderr)
        continue

# ── Phase 3: clone my-website, apply changes on a dedicated branch ───────────

clone_url = f"https://x-access-token:{wiki_gh_token}@github.com/{MY_WEBSITE_REPO}.git"
run(["git", "clone", "--depth=1", clone_url, "my-website-clone"])
cwd = "my-website-clone"
run(["git", "config", "user.email", "github-actions[bot]@users.noreply.github.com"], cwd=cwd)
run(["git", "config", "user.name", "github-actions[bot]"], cwd=cwd)
run(["git", "checkout", "-B", wiki_branch], cwd=cwd)

pages_path = os.path.join(cwd, PAGES_FILE)
with open(pages_path, "r", encoding="utf-8") as f:
    full_pages = json.load(f)

history_index_path = os.path.join(cwd, HISTORY_INDEX_FILE)
try:
    with open(history_index_path, "r", encoding="utf-8") as f:
        history_index = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    history_index = []

# The package's own history entry — no triggeringPackage needed, its own repoUrl
# (derived elsewhere from arch-graph-data.ts) resolves the commit link.
history_index.insert(0, {
    "key": repo_name,
    "capturedAt": today,
    "commitSha": short_sha,
    "commitMessage": pr_title,
})

# Merge the package's own patch
pkg_page = full_pages.get(repo_name, {})
for key, value in page_updates.items():
    if key == "architecture" and isinstance(value, dict):
        pkg_page["architecture"] = {**pkg_page.get("architecture", {}), **value}
    else:
        pkg_page[key] = value
pkg_page["updatedAt"] = today
pkg_page["updatedBySha"] = short_sha
full_pages[repo_name] = pkg_page

# Merge each related page (full replace of the generated fields) + its history entry
for key, content in generated_related_pages.items():
    existing = full_pages.get(key, {})
    merged = {**existing, **content}
    merged["updatedAt"] = today
    merged["updatedBySha"] = short_sha
    merged["updatedByPackage"] = repo_name
    full_pages[key] = merged

    # A related page has no repo of its own — its commit link resolves via
    # whichever package triggered the update.
    history_index.insert(0, {
        "key": key,
        "capturedAt": today,
        "commitSha": short_sha,
        "commitMessage": pr_title,
        "triggeringPackage": repo_name,
    })

with open(pages_path, "w", encoding="utf-8") as f:
    json.dump(full_pages, f, indent=2)
    f.write("\n")

with open(history_index_path, "w", encoding="utf-8") as f:
    json.dump(history_index, f, indent=2)
    f.write("\n")

run(["git", "add", PAGES_FILE, HISTORY_INDEX_FILE], cwd=cwd)
commit_msg = f"chore: propose {repo_name} wiki update ({repo_name}#{pr_number})"
run(["git", "commit", "-m", commit_msg], cwd=cwd)
run(["git", "push", "--force", "origin", wiki_branch], cwd=cwd)
print(f"Pushed {wiki_branch} to {MY_WEBSITE_REPO}")

# ── Phase 4: open the wiki-update PR (if it doesn't already exist) ───────────

existing_pr = run([
    "gh", "pr", "list",
    "--repo", MY_WEBSITE_REPO,
    "--head", wiki_branch,
    "--json", "number",
    "--jq", ".[0].number // empty",
], cwd=cwd, env={**os.environ, "GH_TOKEN": wiki_gh_token})

if existing_pr:
    print(f"Wiki-update PR already open: {MY_WEBSITE_REPO}#{existing_pr} — updated in place.")
else:
    pr_body = (
        f"Proposed architecture wiki update for {repo_full}#{pr_number}.\n\n"
        f"**Source PR:** {pr_url}\n"
        f"**Reason:** {decision['reason']}\n\n"
        f"Related to {repo_full}#{pr_number}\n\n"
        f"> Generated by the wiki-update-pr workflow from the PR's diff. Review and edit "
        f"before merging — this does not auto-merge or auto-close when the source PR does; "
        f"merge it yourself whenever you're happy with it."
    )
    run([
        "gh", "pr", "create",
        "--title", f"chore: {repo_name} wiki update ({repo_name}#{pr_number})",
        "--body", pr_body,
        "--base", "main",
        "--head", wiki_branch,
        "--repo", MY_WEBSITE_REPO,
    ], cwd=cwd, env={**os.environ, "GH_TOKEN": wiki_gh_token})
    print(f"Wiki-update PR opened against {MY_WEBSITE_REPO}")

    # Only comment on the origin PR the first time this wiki-update PR is created —
    # not on every synchronize, to avoid spamming the code PR with repeat comments.
    wiki_pr_url = run([
        "gh", "pr", "view", wiki_branch,
        "--repo", MY_WEBSITE_REPO,
        "--json", "url",
        "--jq", ".url",
    ], cwd=cwd, env={**os.environ, "GH_TOKEN": wiki_gh_token})
    run([
        "gh", "pr", "comment", pr_number,
        "--repo", repo_full,
        "--body", f"📖 Proposed architecture wiki update: {wiki_pr_url}",
    ], env={**os.environ, "GH_TOKEN": os.environ["GH_TOKEN"]})
    print(f"Linked wiki-update PR on {repo_full}#{pr_number}")
