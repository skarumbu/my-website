#!/usr/bin/env python3
"""
Analyses a post-deploy git diff and, when the changes are significant,
regenerates the architecture documentation for that package in my-website.

Required env vars:
  ARCH_CONTENT_FOUNDRY_KEY  - API key for arch-content-foundry.services.ai.azure.com
  GH_TOKEN                  - Fine-grained PAT with contents write access to skarumbu/my-website
  DIFF_FILE                 - Path to the unified diff file
  REPO_NAME                 - Package key matching architecture-content.json (e.g. "digits")
  COMMIT_SHA                - Full SHA of the deployed commit
  COMMIT_MESSAGE            - Commit message of the deployed commit
  REPO_FULL                 - Full repo slug of the backend repo (e.g. "skarumbu/digits")
"""

import json
import os
import subprocess
import sys
import tempfile
from datetime import date

from azure.ai.inference import ChatCompletionsClient
from azure.core.credentials import AzureKeyCredential

ENDPOINT = "https://arch-content-foundry.services.ai.azure.com/openai/deployments/gpt-4o"
MY_WEBSITE_REPO = "skarumbu/my-website"
CONTENT_FILE = "src/architecture-content.json"
HISTORY_DIR = "src/architecture-history"

client = ChatCompletionsClient(
    endpoint=ENDPOINT,
    credential=AzureKeyCredential(os.environ["ARCH_CONTENT_FOUNDRY_KEY"]),
)

diff_file = os.environ["DIFF_FILE"]
with open(diff_file, "r", encoding="utf-8", errors="replace") as f:
    diff = f.read(80_000)

repo_name = os.environ["REPO_NAME"]
commit_sha = os.environ["COMMIT_SHA"]
commit_message = os.environ["COMMIT_MESSAGE"]
gh_token = os.environ["GH_TOKEN"]
today = date.today().isoformat()
short_sha = commit_sha[:7]


def strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:])
        if text.endswith("```"):
            text = text[:-3].rstrip()
    return text


# ── Phase 1: significance check ──────────────────────────────────────────────

significance_prompt = f"""You are a technical architect reviewing a post-deploy diff for the '{repo_name}' service.

Commit: {commit_message}
Diff (truncated to 80KB):
{diff}

Decide whether this deploy warrants updating the architecture documentation for '{repo_name}'.

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

Respond with a JSON object (no markdown fences):
{{
  "needs_update": <true|false>,
  "reason": "<one sentence>",
  "affected_sections": ["features", "architecture", "dataFlow"]
}}

Only include sections in affected_sections that actually changed.
affected_sections may be empty if needs_update is false."""

resp1 = client.complete(
    messages=[{"role": "user", "content": significance_prompt}],
    temperature=0,
    max_tokens=300,
)

raw1 = strip_fences(resp1.choices[0].message.content)

try:
    decision = json.loads(raw1)
except json.JSONDecodeError:
    print(f"Could not parse significance response:\n{raw1}", file=sys.stderr)
    sys.exit(0)

print(f"needs_update={decision['needs_update']} — {decision['reason']}")

if not decision.get("needs_update"):
    print("No architecture update needed. Exiting.")
    sys.exit(0)

affected = decision.get("affected_sections", ["features", "architecture"])

# ── Fetch current architecture-content.json from my-website ──────────────────

import urllib.request

raw_url = f"https://raw.githubusercontent.com/{MY_WEBSITE_REPO}/main/{CONTENT_FILE}"
req = urllib.request.Request(raw_url, headers={"Authorization": f"token {gh_token}"})
with urllib.request.urlopen(req) as resp:
    arch_content = json.loads(resp.read().decode("utf-8"))

current_pkg = arch_content.get(repo_name, {})

# ── Phase 2: generate updated content ────────────────────────────────────────

sections_desc = ", ".join(affected) if affected else "features, architecture"

update_prompt = f"""You are updating the architecture documentation for the '{repo_name}' package in a system architecture page.

Current documentation for this package:
{json.dumps(current_pkg, indent=2)}

Deployed commit: {commit_message} ({short_sha})
Git diff:
{diff}

The following sections may need updating: {sections_desc}

Generate a JSON object containing ONLY the fields that changed. Omit fields that don't need updating.
You may update any subset of these fields:

- "summary": string — 2-3 sentences for the architecture overview page (plain English, no jargon overload)
- "description": string — 1-2 sentence paragraph for the package detail header
- "features": array of strings — one entry per notable feature or capability
- "architecture": object with:
    "overview": string — paragraph describing the technical approach
    "keyPoints": array of strings — key design decisions, constraints, implementation details
- "dataFlow": array of flow steps, each: {{"label": "...", "color": "blue|green|orange|purple", "sublines": ["..."]}}
  (color and sublines are optional; only include dataFlow if the request flow changed significantly)

Rules:
- Keep the same level of detail as the current content
- Do not change fields unrelated to this diff
- dataFlow color values must be one of: blue, green, orange, purple (or omit color entirely)
- Return valid JSON only (no markdown fences, no commentary)

Example output (only changed fields):
{{
  "features": ["updated feature list here..."],
  "architecture": {{
    "keyPoints": ["updated key points..."]
  }}
}}"""

resp2 = client.complete(
    messages=[{"role": "user", "content": update_prompt}],
    temperature=0.2,
    max_tokens=1500,
)

raw2 = strip_fences(resp2.choices[0].message.content)

try:
    updates = json.loads(raw2)
except json.JSONDecodeError:
    print(f"Could not parse content update response:\n{raw2}", file=sys.stderr)
    sys.exit(1)

print(f"Generated updates for sections: {list(updates.keys())}")

# ── Phase 3: clone my-website and commit changes ──────────────────────────────

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

    content_path = os.path.join(tmpdir, CONTENT_FILE)
    with open(content_path, "r", encoding="utf-8") as f:
        full_content = json.load(f)

    # Save history snapshot of current content before overwriting
    old_content = full_content.get(repo_name, {})
    if old_content:
        history_pkg_dir = os.path.join(tmpdir, HISTORY_DIR, repo_name)
        os.makedirs(history_pkg_dir, exist_ok=True)
        history_entry = {
            "package": repo_name,
            "capturedAt": today,
            "commitSha": short_sha,
            "commitMessage": commit_message,
            "content": old_content,
        }
        history_filename = f"{today}-{short_sha}.json"
        history_path = os.path.join(history_pkg_dir, history_filename)
        with open(history_path, "w", encoding="utf-8") as f:
            json.dump(history_entry, f, indent=2)
            f.write("\n")
        print(f"Saved history snapshot: {HISTORY_DIR}/{repo_name}/{history_filename}")

    # Merge updates into the package's content
    pkg = full_content.get(repo_name, {})
    for key, value in updates.items():
        if key == "architecture" and isinstance(value, dict):
            existing_arch = pkg.get("architecture", {})
            pkg["architecture"] = {**existing_arch, **value}
        else:
            pkg[key] = value
    pkg["updatedAt"] = today
    pkg["updatedBySha"] = short_sha
    full_content[repo_name] = pkg

    with open(content_path, "w", encoding="utf-8") as f:
        json.dump(full_content, f, indent=2)
        f.write("\n")

    run(["git", "add", CONTENT_FILE], cwd=tmpdir)
    if old_content:
        run(["git", "add", os.path.join(HISTORY_DIR, repo_name, history_filename)], cwd=tmpdir)

    commit_msg = f"chore: update {repo_name} architecture content ({short_sha})"
    run(["git", "commit", "-m", commit_msg], cwd=tmpdir)
    run(["git", "push"], cwd=tmpdir)
    print(f"Committed and pushed architecture update for {repo_name}")
