# Phase 7: Arch Update Pipeline Generalization — Research

**Researched:** 2026-06-07
**Domain:** GitHub Actions reusable workflows, Python CI scripts, JSON content management
**Confidence:** HIGH — all findings sourced directly from reading the actual files in the repo tree

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Registration uses a setup script: `scripts/register_package.py <package-name>` in my-website
- **D-02:** Script location: `my-website/scripts/register_package.py` (top-level scripts/ directory — new folder)
- **D-03:** Script generates an AI-populated starter entry in `src/architecture-content.json` (same GPT-4o call as arch_content_update.py, scanned from the package's GitHub repo README/code)
- **D-04:** Script prints the ready-to-paste YAML job block to stdout so onboarding is a copy-paste operation
- **D-05:** The printed YAML uses `DESIGN_DOC_GH_TOKEN` as the canonical secret name
- **D-06:** `src/architecture-metadata.json` is deleted entirely
- **D-07:** The "Last deploy" display is removed from Architecture.tsx and PackageDetail.tsx
- **D-08:** The `update-architecture` job (metadata commit) is removed from ALL repo deploy workflows — no replacement needed
- **D-09:** `updatedAt` / `updatedBySha` in architecture-content.json remain — they reflect last *architectural* update, not last deploy
- **D-10:** All 7 existing repos (digits, dashboard_api, momentum_finder, trail_finder, ideas-api, ideas-bot, learning-plan-api) have their `update-architecture` job removed; `update-arch-content` job is updated to `needs: deploy` or equivalent deploy job name
- **D-11:** `azure-infrastructure`: remove `dispatch-architecture-update.yml`, add `update-arch-content` reusable job to `deploy.yml`, add a proper starter entry in `architecture-content.json`
- **D-12:** `posts-api`: add `update-arch-content` reusable job to `deploy.yml`, add starter entry in `architecture-content.json`
- **D-13:** Canonical PAT secret name is `DESIGN_DOC_GH_TOKEN` across all repos
- **D-14:** Repos currently using `MY_WEBSITE_DISPATCH_TOKEN` for the arch update job (digits, dashboard_api, momentum_finder, trail_finder) are updated to `DESIGN_DOC_GH_TOKEN`
- **D-15:** `MY_WEBSITE_DISPATCH_TOKEN` may still exist in some repos for other purposes — only the `ARCH_UPDATE_GH_TOKEN` input alias in the reusable workflow (which maps from the caller's secret) is affected

### Claude's Discretion

None specified.

### Deferred Ideas (OUT OF SCOPE)

- **BOT-02 (remove REPO_MAP from bot.py):** Out of scope for Phase 7 — belongs to ideas-bot work.
- **Design doc check workflow generalization:** Could be generalized similarly in a future phase.
- **Architecture page deploy badge:** If "last deploy" info is ever wanted back, source from GitHub API at runtime.
</user_constraints>

---

## Summary

Phase 7 eliminates the `update-architecture` metadata job from all 9 package repos and replaces the two-step chain (`deploy` → `update-architecture` → `update-arch-content`) with a single-step chain (`deploy` → `update-arch-content`). A new `scripts/register_package.py` script automates onboarding of future packages by generating an AI-populated entry in `architecture-content.json` and printing ready-to-paste YAML.

The reusable workflow (`arch-content-update-reusable.yml`) requires no changes — it is already the stable integration point. The changes are: (1) removing dead jobs from 7 existing repo workflows, (2) wiring 2 new repos (azure-infrastructure and posts-api), (3) deleting `architecture-metadata.json` and removing its UI references in 2 frontend files, (4) writing the register script.

**Primary recommendation:** Work repo-by-repo with exact job-name and secret-name facts from this document. Zero ambiguity items remain.

---

## 1. Reusable Workflow Summary

**File:** `.github/workflows/arch-content-update-reusable.yml` (my-website)

### Trigger
`workflow_call` — called by package repos after deploy.

### Inputs (all required)
| Input | Type | Description |
|-------|------|-------------|
| `repo_name` | string | Package key matching `architecture-content.json` (e.g. `digits`, `dashboard-api`) |
| `commit_sha` | string | Full SHA of the deployed commit — passed as `${{ github.sha }}` |
| `commit_message` | string | Commit message — passed as `${{ github.event.head_commit.message }}` |

### Secrets (both required)
| Secret name (in reusable workflow) | Mapped from caller |
|------------------------------------|--------------------|
| `ARCH_CONTENT_FOUNDRY_KEY` | `${{ secrets.ARCH_CONTENT_FOUNDRY_KEY }}` |
| `ARCH_UPDATE_GH_TOKEN` | `${{ secrets.DESIGN_DOC_GH_TOKEN }}` (canonical) |

### What the workflow does (in order)
1. Checks out the **calling repo** (`actions/checkout@v4`, `fetch-depth: 2`)
2. Computes `HEAD~1..HEAD` diff, saves to `/tmp/deploy.diff` (capped at 81,920 bytes)
3. Downloads `arch_content_update.py` from `skarumbu/my-website/main` via `curl`
4. Sets up Python 3.11
5. Installs `openai` package
6. Runs the script with env vars: `ARCH_CONTENT_FOUNDRY_KEY`, `GH_TOKEN` (mapped from `ARCH_UPDATE_GH_TOKEN`), `DIFF_FILE`, `REPO_NAME`, `COMMIT_SHA`, `COMMIT_MESSAGE`, `REPO_FULL`

### Standard caller block (to paste into each package's deploy.yml)
```yaml
  update-arch-content:
    needs: <deploy-job-name>
    uses: skarumbu/my-website/.github/workflows/arch-content-update-reusable.yml@main
    with:
      repo_name: <package-key>
      commit_sha: ${{ github.sha }}
      commit_message: ${{ github.event.head_commit.message }}
    secrets:
      ARCH_CONTENT_FOUNDRY_KEY: ${{ secrets.ARCH_CONTENT_FOUNDRY_KEY }}
      ARCH_UPDATE_GH_TOKEN: ${{ secrets.DESIGN_DOC_GH_TOKEN }}
```

---

## 2. arch_content_update.py Patterns

**File:** `.github/scripts/arch_content_update.py` (my-website)

### Azure OpenAI Client Setup
```python
from openai import AzureOpenAI

ENDPOINT = "https://eastus.api.cognitive.microsoft.com/"
DEPLOYMENT = "gpt-4o"
API_VERSION = "2024-02-01"

client = AzureOpenAI(
    azure_endpoint=ENDPOINT,
    api_key=os.environ["ARCH_CONTENT_FOUNDRY_KEY"],
    api_version=API_VERSION,
)
```
`register_package.py` must use this **identical** setup (same endpoint, deployment, API version). The environment variable is `ARCH_CONTENT_FOUNDRY_KEY`.

### strip_fences() helper
```python
def strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:])
        if text.endswith("```"):
            text = text[:-3].rstrip()
    return text
```
Must be copied verbatim into `register_package.py`.

### Key constants to replicate
```python
MY_WEBSITE_REPO = "skarumbu/my-website"
CONTENT_FILE = "src/architecture-content.json"
```

### Git clone + commit pattern (subprocess + tempfile)
```python
import subprocess, tempfile

def run(cmd, cwd=None):
    result = subprocess.run(
        cmd, check=True, capture_output=True, text=True, cwd=cwd
    )
    return result.stdout.strip()

with tempfile.TemporaryDirectory() as tmpdir:
    clone_url = f"https://x-access-token:{gh_token}@github.com/{MY_WEBSITE_REPO}.git"
    run(["git", "clone", "--depth=1", clone_url, tmpdir])
    run(["git", "config", "user.email", "github-actions[bot]@users.noreply.github.com"], cwd=tmpdir)
    run(["git", "config", "user.name", "github-actions[bot]"], cwd=tmpdir)
    # ... read, modify, write CONTENT_FILE ...
    run(["git", "add", CONTENT_FILE], cwd=tmpdir)
    run(["git", "commit", "-m", commit_msg], cwd=tmpdir)
    run(["git", "push"], cwd=tmpdir)
```
`register_package.py` must reuse this exact pattern — `--depth=1` clone, subprocess.run with `check=True`, `tempfile.TemporaryDirectory` context manager for automatic cleanup.

### How arch_content_update.py fetches current content
Uses `urllib.request` with Authorization header (not requests library):
```python
import urllib.request
raw_url = f"https://raw.githubusercontent.com/{MY_WEBSITE_REPO}/main/{CONTENT_FILE}"
req = urllib.request.Request(raw_url, headers={"Authorization": f"token {gh_token}"})
with urllib.request.urlopen(req) as resp:
    arch_content = json.loads(resp.read().decode("utf-8"))
```

### Two-phase GPT-4o pattern
1. **Significance check** (`temperature=0`, `max_tokens=300`): Is the change significant enough to update docs? Returns JSON `{needs_update, reason, affected_sections}`.
2. **Content generation** (`temperature=0.2`, `max_tokens=1500`): Generate only the changed fields as a JSON object. Merge updates into existing content, then write back.

`register_package.py` uses a **single-phase** pattern: fetch README, generate a complete starter entry (all fields), write it — no significance check needed because it's a new package.

---

## 3. Per-Repo Analysis Table

### 7 Existing Repos (D-10)

| Repo | Deploy job name | Has `update-architecture` job? | Secret used for arch job | `update-arch-content` `needs:` (current) | Action needed |
|------|----------------|-------------------------------|--------------------------|------------------------------------------|---------------|
| `digits` | `deploy` | YES | `MY_WEBSITE_DISPATCH_TOKEN` | `update-architecture` | Remove `update-architecture` job; change `update-arch-content.needs` to `deploy`; change `ARCH_UPDATE_GH_TOKEN` secret ref to `DESIGN_DOC_GH_TOKEN` |
| `dashboard_api` | `deploy` | YES | `MY_WEBSITE_DISPATCH_TOKEN` | `update-architecture` | Same as digits |
| `momentum_finder` | `build-and-deploy` | YES | `MY_WEBSITE_DISPATCH_TOKEN` | `update-architecture` | Remove `update-architecture` job; change `update-arch-content.needs` to `build-and-deploy`; change secret ref to `DESIGN_DOC_GH_TOKEN` |
| `trail_finder` | `build-and-deploy` | YES | `MY_WEBSITE_DISPATCH_TOKEN` | `update-architecture` | Same as momentum_finder |
| `ideas-api` | `deploy` | YES | `DESIGN_DOC_GH_TOKEN` | `update-architecture` | Remove `update-architecture` job; change `update-arch-content.needs` to `deploy` (secret already correct) |
| `ideas-bot` | `build-and-deploy` | YES | `DESIGN_DOC_GH_TOKEN` | `update-architecture` | Remove `update-architecture` job; change `update-arch-content.needs` to `build-and-deploy` (secret already correct) |
| `learning-plan-api` | `deploy` | YES | `DESIGN_DOC_GH_TOKEN` | `update-architecture` | Remove `update-architecture` job; change `update-arch-content.needs` to `deploy` (secret already correct) |

**All 7 existing repos have an `update-architecture` job** — none can be skipped.

**Secret split summary:**
- Need secret rename (`MY_WEBSITE_DISPATCH_TOKEN` → `DESIGN_DOC_GH_TOKEN` in workflow file): `digits`, `dashboard_api`, `momentum_finder`, `trail_finder`
- Secret already correct (`DESIGN_DOC_GH_TOKEN`): `ideas-api`, `ideas-bot`, `learning-plan-api`

### Exact `update-arch-content` block that should remain (after removing `update-architecture` above it)

For repos using `deploy` as the deploy job name:
```yaml
  update-arch-content:
    needs: deploy
    uses: skarumbu/my-website/.github/workflows/arch-content-update-reusable.yml@main
    with:
      repo_name: <key>
      commit_sha: ${{ github.sha }}
      commit_message: ${{ github.event.head_commit.message }}
    secrets:
      ARCH_CONTENT_FOUNDRY_KEY: ${{ secrets.ARCH_CONTENT_FOUNDRY_KEY }}
      ARCH_UPDATE_GH_TOKEN: ${{ secrets.DESIGN_DOC_GH_TOKEN }}
```

For repos using `build-and-deploy` as the deploy job name:
```yaml
  update-arch-content:
    needs: build-and-deploy
    uses: skarumbu/my-website/.github/workflows/arch-content-update-reusable.yml@main
    with:
      repo_name: <key>
      commit_sha: ${{ github.sha }}
      commit_message: ${{ github.event.head_commit.message }}
    secrets:
      ARCH_CONTENT_FOUNDRY_KEY: ${{ secrets.ARCH_CONTENT_FOUNDRY_KEY }}
      ARCH_UPDATE_GH_TOKEN: ${{ secrets.DESIGN_DOC_GH_TOKEN }}
```

### 2 New Repos (D-11, D-12)

| Repo | Deploy job name | Branch trigger | Has `update-arch-content`? | Has `update-architecture`? | Action needed |
|------|----------------|----------------|---------------------------|---------------------------|---------------|
| `azure-infrastructure` | `deploy` | `master` | NO | NO (has broken `dispatch-architecture-update.yml` instead) | Delete `dispatch-architecture-update.yml`; add `update-arch-content` job to `deploy.yml` (after the `deploy` job); add starter entry in `architecture-content.json` |
| `posts-api` | `deploy` | `main` (push only — `if: github.event_name == 'push'` gate already present) | NO | NO | Add `update-arch-content` job to `deploy.yml`; add starter entry in `architecture-content.json` |

**azure-infrastructure notes:**
- Deploy job name: `deploy`
- Last step is "Deploy Bicep" (`az deployment sub create`) — `update-arch-content` slots after this job, not inside it
- Trigger branch: `master` (not `main`)
- `dispatch-architecture-update.yml` uses `MY_WEBSITE_DISPATCH_TOKEN` and fires a `repository_dispatch` event — this entire file is deleted (D-11)

**posts-api notes:**
- Deploy workflow has two jobs: `test` (runs on PR + push) and `deploy` (push only, `needs: test`)
- `update-arch-content` should `needs: deploy`
- `repo_name` input value: `posts-api` (must match the key that will be added to `architecture-content.json`)

### architecture-content.json: packages currently present

All packages present in `architecture-content.json` as of research:
`my-website`, `digits`, `momentum-finder`, `trail-finder`, `dashboard-api`, `ideas-api`, `ideas-bot`, `azure-infrastructure`, `learning-plan-api`

**Posts-api is NOT present** — needs a starter entry added by `register_package.py` or by hand.

**Azure-infrastructure IS already present** — has a full entry (summary, description, features, architecture, dataFlow: null). No starter entry needed for azure-infrastructure from the register script; its entry only needs `updatedAt`/`updatedBySha` to be populated by the reusable workflow on first deploy after wiring.

---

## 4. architecture-content.json Schema

**File:** `src/architecture-content.json`

The file is a flat JSON object keyed by package name (string). The key must exactly match the `repo_name` input in the reusable workflow.

### Documented entry (using `dashboard-api` as the fully-hydrated example)

```json
{
  "dashboard-api": {
    "summary": "string — 2-3 sentences for the architecture overview page card",
    "description": "string — 1-2 sentence paragraph for the package detail header",
    "features": ["string", "string"],
    "architecture": {
      "overview": "string — paragraph describing the technical approach",
      "keyPoints": ["string", "string"]
    },
    "dataFlow": [
      {
        "label": "string — step description",
        "color": "blue|green|orange|purple",
        "sublines": ["string"]
      }
    ],
    "updatedAt": "YYYY-MM-DD",
    "updatedBySha": "7-char short SHA",
    "designDocs": [
      {
        "title": "string",
        "href": "string URL",
        "date": "YYYY-MM-DD",
        "description": "string"
      }
    ]
  }
}
```

### Field notes
- `dataFlow` may be `null` (azure-infrastructure has `"dataFlow": null`)
- `designDocs` is optional — only populated by `arch_content_update.py` if the commit generates one, or manually
- `updatedAt` / `updatedBySha` are written by `arch_content_update.py` on every architectural update; absent in entries that have never been updated by the pipeline (e.g. azure-infrastructure, my-website)
- The frontend reads all other fields from `architecture-content.json` via static import; `description`, `features`, `architecture`, `dataFlow` from the JSON are merged *over* the hardcoded defaults in `PackageDetail.tsx` — so the JSON is authoritative for AI-updated fields

### Minimum viable starter entry (for register_package.py to generate)
```json
{
  "posts-api": {
    "summary": "AI-generated from README",
    "description": "AI-generated from README",
    "features": ["..."],
    "architecture": {
      "overview": "...",
      "keyPoints": ["..."]
    },
    "dataFlow": null
  }
}
```

---

## 5. Frontend Removal Targets

### Architecture.tsx

**File:** `src/Architecture.tsx`

| Line | Content | Action |
|------|---------|--------|
| 4 | `import metadata from './architecture-metadata.json';` | Delete line |
| 12 | `type ServiceMeta = { lastDeploy: string \| null; commitSha: string \| null };` | Delete line |
| 13 | `const meta = metadata as Record<string, ServiceMeta>;` | Delete line |
| 15–19 | `function deployLabel(key: string) { ... }` (5-line function) | Delete entire function |
| 68 | `<th>Last Deploy</th>` (table header in Overview section) | Delete the `<th>` element |
| 82–94 | `[...].map(([pkg, role, runs, metaKey]) => (` row — the 4th tuple element `metaKey` and its corresponding `<td>` using `deployLabel()` | Remove `metaKey` from all tuples (change to 3-element tuples); remove the `<td>` cell rendering deploy label |

**Table row specifics (Architecture.tsx lines 72–97):**
The data array currently has entries like:
```tsx
['digits', 'Generates and serves Digits puzzles', 'Azure Functions', 'digits'],
```
The 4th element (`'digits'`) is the `metaKey`. Remove it. The `<td>` at the end of the row (lines ~91–93) that calls `deployLabel(metaKey as string)` must also be deleted.

Additionally, the `<thead>` row on line ~68 has `<th>Last Deploy</th>` — remove it.

**Summary of removals in Architecture.tsx:**
- Lines 4, 12–13: imports and type defs
- Lines 15–19: `deployLabel` function
- Line ~68: `<th>Last Deploy</th>` header cell
- Lines ~72–96: 4th tuple element in each of the 9 data rows + the corresponding `<td>` cell

### PackageDetail.tsx

**File:** `src/architecture/PackageDetail.tsx`

| Line | Content | Action |
|------|---------|--------|
| 2 | `import metadata from '../architecture-metadata.json';` | Delete line |
| 9 | `type ServiceMeta = { lastDeploy: string \| null; commitSha: string \| null };` | Delete line |
| 10 | `const meta = metadata as Record<string, ServiceMeta>;` | Delete line |
| 451 | `const m = staticPkg.metaKey ? meta[staticPkg.metaKey] : null;` | Delete line |
| 470–474 | `{m?.lastDeploy && ( <p className="arch-pkg-deploy"> Last deploy: {m.lastDeploy} · <code ...>{m.commitSha}</code> </p> )}` | Delete entire JSX block (5 lines) |

**Note on `metaKey` field in PACKAGES data:** The `PACKAGES` constant in PackageDetail.tsx has a `metaKey?: string` field on each package definition (e.g., `metaKey: 'digits'` on line 93). This field drives the now-deleted `m` lookup. After removing the `m` lookup and its JSX display, the `metaKey` property on the `PkgData` interface and on each package object can be removed too — but this is cosmetic dead code cleanup, not a runtime requirement. The planner should decide whether to include this cleanup in scope.

---

## 6. register_package.py Design

**Location:** `scripts/register_package.py` (new top-level `scripts/` directory in my-website)

**Invocation:** `python scripts/register_package.py <package-name>`

### Step-by-step logic

**Step 1 — Parse CLI argument**
```python
import sys
package_name = sys.argv[1]  # e.g. "posts-api"
```

**Step 2 — Set up Azure OpenAI client**
```python
# Identical to arch_content_update.py
client = AzureOpenAI(
    azure_endpoint="https://eastus.api.cognitive.microsoft.com/",
    api_key=os.environ["ARCH_CONTENT_FOUNDRY_KEY"],
    api_version="2024-02-01",
)
```
Requires `ARCH_CONTENT_FOUNDRY_KEY` in the local environment.

**Step 3 — Fetch package README from GitHub**
```python
import urllib.request
readme_url = f"https://raw.githubusercontent.com/skarumbu/{package_name}/main/README.md"
# Fallback to master if main 404s
try:
    with urllib.request.urlopen(readme_url) as resp:
        readme = resp.read().decode("utf-8")
except urllib.error.HTTPError:
    readme_url = f"https://raw.githubusercontent.com/skarumbu/{package_name}/master/README.md"
    with urllib.request.urlopen(readme_url) as resp:
        readme = resp.read().decode("utf-8")
```
No auth header needed for public repos.

**Step 4 — Generate starter JSON entry via GPT-4o**
Single prompt (no significance check):
```python
prompt = f"""Generate an architecture-content.json entry for the package '{package_name}'.

Package README:
{readme[:15000]}

Generate a JSON object (no markdown fences) with these fields:
- "summary": string — 2-3 sentences for the architecture overview page
- "description": string — 1-2 sentence paragraph for the package detail header
- "features": array of strings — one entry per notable feature
- "architecture": object with "overview" (string) and "keyPoints" (array of strings)
- "dataFlow": array of flow steps or null if not applicable

Each dataFlow step: {{"label": "...", "color": "blue|green|orange|purple", "sublines": ["..."]}}
color and sublines are optional.

Return valid JSON only."""

resp = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": prompt}],
    temperature=0.2,
    max_tokens=2000,
)
raw = strip_fences(resp.choices[0].message.content)
entry = json.loads(raw)
```

**Step 5 — Clone my-website and write the new entry**
```python
gh_token = os.environ["GH_TOKEN"]  # or DESIGN_DOC_GH_TOKEN
MY_WEBSITE_REPO = "skarumbu/my-website"
CONTENT_FILE = "src/architecture-content.json"

with tempfile.TemporaryDirectory() as tmpdir:
    clone_url = f"https://x-access-token:{gh_token}@github.com/{MY_WEBSITE_REPO}.git"
    run(["git", "clone", "--depth=1", clone_url, tmpdir])
    run(["git", "config", "user.email", "github-actions[bot]@users.noreply.github.com"], cwd=tmpdir)
    run(["git", "config", "user.name", "github-actions[bot]"], cwd=tmpdir)

    content_path = os.path.join(tmpdir, CONTENT_FILE)
    with open(content_path, "r", encoding="utf-8") as f:
        full_content = json.load(f)

    if package_name in full_content:
        print(f"WARNING: '{package_name}' already exists in architecture-content.json. Overwriting.")

    full_content[package_name] = entry

    with open(content_path, "w", encoding="utf-8") as f:
        json.dump(full_content, f, indent=2)
        f.write("\n")

    run(["git", "add", CONTENT_FILE], cwd=tmpdir)
    run(["git", "commit", "-m", f"chore: register {package_name} in architecture-content.json"], cwd=tmpdir)
    run(["git", "push"], cwd=tmpdir)
    print(f"Committed starter entry for '{package_name}' to my-website.")
```

**Step 6 — Print YAML block to stdout**
```python
yaml_block = f"""
# ── Paste this job into your deploy.yml (after your deploy job) ──────────────
# Prerequisites: add ARCH_CONTENT_FOUNDRY_KEY and DESIGN_DOC_GH_TOKEN secrets
# to this repo's GitHub Settings → Secrets and variables → Actions.

  update-arch-content:
    needs: <YOUR_DEPLOY_JOB_NAME>   # replace with your actual deploy job name
    uses: skarumbu/my-website/.github/workflows/arch-content-update-reusable.yml@main
    with:
      repo_name: {package_name}
      commit_sha: ${{{{ github.sha }}}}
      commit_message: ${{{{ github.event.head_commit.message }}}}
    secrets:
      ARCH_CONTENT_FOUNDRY_KEY: ${{{{ secrets.ARCH_CONTENT_FOUNDRY_KEY }}}}
      ARCH_UPDATE_GH_TOKEN: ${{{{ secrets.DESIGN_DOC_GH_TOKEN }}}}
"""
print(yaml_block)
```
(In the actual Python source the `{{{{` is `{{` which renders as `{` in the printed YAML.)

### Required environment variables when running locally
| Variable | Purpose |
|----------|---------|
| `ARCH_CONTENT_FOUNDRY_KEY` | Azure OpenAI API key for arch-content-foundry |
| `GH_TOKEN` (or `DESIGN_DOC_GH_TOKEN`) | PAT with `contents: write` access to `skarumbu/my-website` |

### Complete onboarding flow after the script exists
```
# In my-website:
python scripts/register_package.py posts-api
# -> writes entry to architecture-content.json and pushes
# -> prints YAML block

# In posts-api:
# paste the YAML block into .github/workflows/deploy.yml, replacing <YOUR_DEPLOY_JOB_NAME> with "deploy"
```

---

## 7. architecture-metadata.json: What Gets Deleted

**File to delete:** `src/architecture-metadata.json`

This file is written by all 7 existing `update-architecture` jobs. Its schema:
```json
{
  "digits": { "lastDeploy": "2026-05-15", "commitSha": "a1b2c3d" },
  "dashboard-api": { "lastDeploy": "2026-05-20", "commitSha": "e4f5a6b" }
}
```
After Phase 7, this file is deleted and all workflows that write to it are removed. The frontend no longer imports it.

---

## 8. Key Observations and Pitfalls

### Pitfall 1: `needs` chain must reference the correct job name
`momentum_finder` and `trail_finder` have deploy job name `build-and-deploy`, not `deploy`. Using `needs: deploy` would silently pass in YAML but fail at runtime because the dependency doesn't exist.

**Correct values:**
- `needs: deploy` → digits, dashboard_api, ideas-api, learning-plan-api, posts-api
- `needs: build-and-deploy` → momentum_finder, trail_finder, ideas-bot
- `needs: deploy` → azure-infrastructure (single job named `deploy`)

### Pitfall 2: posts-api has a `test` job that gates `deploy`
The posts-api `deploy` job already has `needs: test`. Adding `update-arch-content` with `needs: deploy` is correct — it forms the chain `test → deploy → update-arch-content`. Do NOT set `needs: [test, deploy]` (redundant).

### Pitfall 3: azure-infrastructure triggers on `master`, not `main`
The `dispatch-architecture-update.yml` triggered on both `main` and `master`. The `deploy.yml` trigger is `master` only. The new `update-arch-content` job will be in `deploy.yml` and inherits the `master` trigger automatically — no separate trigger configuration needed.

### Pitfall 4: `architecture-content.json` key for repos with hyphens
The key in `architecture-content.json` must exactly match `repo_name` in the workflow. Current conventions:
- `momentum-finder` (not `momentum_finder` — matches the repo name style used in the JSON)
- `dashboard-api` (not `dashboard_api`)
- `trail-finder` (not `trail_finder`)
- `ideas-api`, `ideas-bot`, `learning-plan-api`, `digits` all straightforward

**Verify:** `repo_name` in each workflow's `with:` block already uses the correct hyphenated form matching the JSON key.

### Pitfall 5: azure-infrastructure already has a content entry
Do NOT run `register_package.py azure-infrastructure` — the entry already exists in `architecture-content.json`. The register script should check for existing entries and warn (or skip) rather than silently overwrite.

### Pitfall 6: posts-api is NOT yet in architecture-content.json
The register script must be run for `posts-api` (or a hand-crafted starter entry added) before the reusable workflow runs for the first time on a posts-api deploy. If the key is absent, `arch_content_update.py` handles it gracefully (creates a new entry), but having a meaningful starter entry first is better.

### Pitfall 7: MY_WEBSITE_DISPATCH_TOKEN may still be used elsewhere
Per D-15: only the `ARCH_UPDATE_GH_TOKEN` secret reference in the `update-arch-content` job is changed. The `update-architecture` job that uses `MY_WEBSITE_DISPATCH_TOKEN` for checkout is being deleted entirely — so those checkout usages disappear with the job. There is no separate reference to `MY_WEBSITE_DISPATCH_TOKEN` in `update-arch-content` currently, so no surgical rename is needed beyond removing the dead job and updating the surviving job's secret mapping.

---

## 9. Full Job Blocks Being Deleted (for reference)

### digits — `update-architecture` job (lines 36–61 in deploy.yml)
```yaml
  update-architecture:
    needs: deploy
    runs-on: ubuntu-latest
    steps:
      - name: Checkout my-website
        uses: actions/checkout@v4
        with:
          repository: skarumbu/my-website
          token: ${{ secrets.MY_WEBSITE_DISPATCH_TOKEN }}
      - name: Update deploy metadata
        run: |
          git pull origin main
          DATE=$(date -u +%Y-%m-%d)
          SHORT_SHA=$(echo "${{ github.sha }}" | cut -c1-7)
          jq --arg date "$DATE" --arg sha "$SHORT_SHA" \
            '.digits = {"lastDeploy": $date, "commitSha": $sha}' \
            src/architecture-metadata.json > /tmp/meta.json
          mv /tmp/meta.json src/architecture-metadata.json
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add src/architecture-metadata.json
          git diff --staged --quiet && exit 0
          git commit -m "chore: update digits deploy metadata"
          git push
```
Pattern is identical for all 7 repos (only the `jq` key and commit message vary). All are deleted wholesale.

---

## Sources

All findings are sourced directly from file reads in this session — no external lookups required for this phase.

| File | Source type | Confidence |
|------|-------------|------------|
| `.github/workflows/arch-content-update-reusable.yml` | Direct file read | HIGH |
| `.github/scripts/arch_content_update.py` | Direct file read | HIGH |
| `digits/.github/workflows/deploy.yml` | Direct file read | HIGH |
| `dashboard_api/.github/workflows/deploy.yml` | Direct file read | HIGH |
| `momentum_finder/.github/workflows/deploy.yml` | Direct file read | HIGH |
| `trail_finder/.github/workflows/deploy.yml` | Direct file read | HIGH |
| `ideas-api/.github/workflows/deploy.yml` | Direct file read | HIGH |
| `ideas-bot/.github/workflows/deploy.yml` | Direct file read | HIGH |
| `learning-plan-api/.github/workflows/deploy.yml` | Direct file read | HIGH |
| `azure-infrastructure/.github/workflows/deploy.yml` | Direct file read | HIGH |
| `azure-infrastructure/.github/workflows/dispatch-architecture-update.yml` | Direct file read | HIGH |
| `posts-api/.github/workflows/deploy.yml` | Direct file read | HIGH |
| `src/architecture-content.json` | Direct file read | HIGH |
| `src/Architecture.tsx` | Direct file read | HIGH |
| `src/architecture/PackageDetail.tsx` | Direct file read | HIGH |
| `.planning/phases/07-arch-update-pipeline-generalization/07-CONTEXT.md` | Direct file read | HIGH |

## Assumptions Log

No `[ASSUMED]` claims — all findings verified by direct file read.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**All claims in this research were verified by direct file read. No user confirmation needed.**

## Metadata

**Confidence breakdown:**
- All repo job names, secret names, needs chains: HIGH — read directly from source files
- Architecture.tsx / PackageDetail.tsx removal targets: HIGH — exact lines identified
- register_package.py design: HIGH — based on exact patterns from arch_content_update.py plus locked decisions from CONTEXT.md
- architecture-content.json schema: HIGH — read directly from file

**Research date:** 2026-06-07
**Valid until:** Until any of the source files are modified (stable — these are infra workflow files, not frequently changing)
