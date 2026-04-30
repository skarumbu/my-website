#!/usr/bin/env python3
"""
Checks whether a PR diff is significant enough to warrant an Architecture
Decision Record, and if so generates and commits one.

Required env vars:
  AZURE_OPENAI_API_KEY  - API key for ideas-bot-oai-c4aqfdfs.openai.azure.com
  PR_DIFF               - Full unified diff of the PR
  PR_TITLE              - PR title
  PR_URL                - HTML URL of the PR (e.g. https://github.com/org/repo/pull/42)
  PR_NUMBER             - PR number (integer string)
  REPO_NAME             - Short repo name (e.g. "ideas-api")
  REPO_FULL             - Full repo slug (e.g. "skarumbu/ideas-api")
  BRANCH_NAME           - Name for the new ADR branch (e.g. design-doc/pr-42)
  GH_TOKEN              - Fine-grained PAT with contents+PRs write access
"""

import json
import os
import subprocess
import sys
from datetime import date

from openai import AzureOpenAI

ENDPOINT = "https://ideas-bot-oai-c4aqfdfs.openai.azure.com"
DEPLOYMENT = "gpt-4o"
API_VERSION = "2024-02-01"

client = AzureOpenAI(
    azure_endpoint=ENDPOINT,
    api_key=os.environ["AZURE_OPENAI_API_KEY"],
    api_version=API_VERSION,
)

diff_file = os.environ.get("PR_DIFF_FILE")
if diff_file:
    with open(diff_file, "r", encoding="utf-8", errors="replace") as f:
        diff = f.read(80_000)
else:
    diff = os.environ.get("PR_DIFF", "")[:80_000]
pr_title = os.environ["PR_TITLE"]
pr_url = os.environ["PR_URL"]
pr_number = os.environ["PR_NUMBER"]
repo_name = os.environ["REPO_NAME"]
repo_full = os.environ["REPO_FULL"]
branch_name = os.environ["BRANCH_NAME"]

# ── Phase 1: significance check ──────────────────────────────────────────────

significance_prompt = f"""You are a technical architect reviewing a pull request for the '{repo_name}' service.

PR title: {pr_title}
PR diff (truncated to 80KB):
{diff}

Decide whether this PR is significant enough to warrant an Architecture Decision Record (ADR).

Write an ADR for:
- New API endpoints or routes
- New external integrations or dependencies
- Data model / schema changes
- Security or authentication changes
- Significant new features visible to users or callers

Do NOT write an ADR for:
- Bug fixes
- Dependency version bumps
- UI tweaks (colour, spacing, copy)
- Test-only changes
- Lint or formatting changes

Respond with a JSON object (no markdown fences):
{{
  "needs_doc": <true|false>,
  "reason": "<one sentence>",
  "feature_name": "<kebab-case-name>",
  "summary": "<two-to-three sentence plain-English summary of what changed and why>"
}}"""

resp1 = client.chat.completions.create(
    model=DEPLOYMENT,
    messages=[{"role": "user", "content": significance_prompt}],
    temperature=0,
    max_tokens=400,
)

raw = resp1.choices[0].message.content.strip()
# Strip markdown fences if model adds them anyway
if raw.startswith("```"):
    raw = raw.split("```")[1]
    if raw.startswith("json"):
        raw = raw[4:]

try:
    decision = json.loads(raw)
except json.JSONDecodeError:
    print(f"Could not parse significance response:\n{raw}", file=sys.stderr)
    sys.exit(0)

print(f"needs_doc={decision['needs_doc']} — {decision['reason']}")

if not decision.get("needs_doc"):
    print("No ADR needed. Exiting.")
    sys.exit(0)

# ── Phase 2: generate ADR ─────────────────────────────────────────────────────

today = date.today().isoformat()
feature_name = decision["feature_name"].strip().lower().replace(" ", "-")
filename = f"{today}-{feature_name}.md"
filepath = f"docs/design/{filename}"

adr_prompt = f"""You are a technical architect writing an Architecture Decision Record (ADR).

Repository: {repo_name}
PR: {pr_url}
Summary: {decision['summary']}

PR diff:
{diff}

Write a concise ADR in this exact Markdown format (no extra sections):

# ADR: {decision['feature_name'].replace('-', ' ').title()}
**Date:** {today}  **Status:** Proposed  **PR:** [{repo_name}#{pr_number}]({pr_url})

## Context
<2-3 sentences: what problem or opportunity prompted this change>

## Decision
<2-3 sentences: what was decided and the core rationale>

## Alternatives Considered
<bullet list of 1-3 alternatives and why each was rejected>

## Consequences
**Positive:** <bullet list>
**Trade-offs:** <bullet list>

## Relevant Code
<bullet list of the most important changed files with GitHub permalink links using the format:
`[path/to/file](https://github.com/{repo_full}/blob/main/path/to/file)`>
"""

resp2 = client.chat.completions.create(
    model=DEPLOYMENT,
    messages=[{"role": "user", "content": adr_prompt}],
    temperature=0.2,
    max_tokens=1200,
)

adr_content = resp2.choices[0].message.content.strip()
if adr_content.startswith("```"):
    adr_content = "\n".join(adr_content.split("\n")[1:])
    if adr_content.endswith("```"):
        adr_content = adr_content[:-3].rstrip()

os.makedirs("docs/design", exist_ok=True)
with open(filepath, "w", encoding="utf-8") as f:
    f.write(adr_content + "\n")

print(f"Wrote {filepath}")

# ── Phase 3: commit, push, open PR ───────────────────────────────────────────

def run(cmd, **kw):
    result = subprocess.run(cmd, check=True, capture_output=True, text=True, **kw)
    return result.stdout.strip()

run(["git", "config", "user.email", "github-actions[bot]@users.noreply.github.com"])
run(["git", "config", "user.name", "github-actions[bot]"])
run(["git", "checkout", "-b", branch_name])
run(["git", "add", filepath])
run(["git", "commit", "-m", f"docs: add ADR for {feature_name} ({repo_name}#{pr_number})"])
run(["git", "push", "origin", branch_name])

pr_body = f"""Automatically generated Architecture Decision Record for {repo_name}#{pr_number}.

**Source PR:** {pr_url}
**Summary:** {decision['summary']}

> This ADR was generated by the design-doc-check workflow. Review and edit before merging.
"""

run([
    "gh", "pr", "create",
    "--title", f"docs: ADR for {feature_name}",
    "--body", pr_body,
    "--base", "main",
    "--head", branch_name,
    "--repo", repo_full,
], env={**os.environ, "GH_TOKEN": os.environ["GH_TOKEN"]})

print(f"PR opened: {repo_full} — design-doc/{feature_name}")
