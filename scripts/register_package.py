import sys
import os
import json
import subprocess
import tempfile
import urllib.request
import urllib.error

from openai import AzureOpenAI

ENDPOINT = "https://eastus.api.cognitive.microsoft.com/"
DEPLOYMENT = "gpt-4o"
API_VERSION = "2024-02-01"
MY_WEBSITE_REPO = "skarumbu/my-website"
CONTENT_FILE = "src/architecture-content.json"


def strip_fences(text):
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:])
        if text.endswith("```"):
            text = text[:-3].rstrip()
    return text


def run(cmd, cwd=None):
    result = subprocess.run(cmd, check=True, capture_output=True, text=True, cwd=cwd)
    return result.stdout.strip()


if len(sys.argv) < 2:
    print("Usage: python scripts/register_package.py <package-name>", file=sys.stderr)
    sys.exit(1)
package_name = sys.argv[1]

client = AzureOpenAI(
    azure_endpoint=ENDPOINT,
    api_key=os.environ["ARCH_CONTENT_FOUNDRY_KEY"],
    api_version=API_VERSION,
)

readme_url = f"https://raw.githubusercontent.com/skarumbu/{package_name}/main/README.md"
try:
    with urllib.request.urlopen(readme_url) as resp:
        readme = resp.read().decode("utf-8")
except urllib.error.HTTPError:
    readme_url = f"https://raw.githubusercontent.com/skarumbu/{package_name}/master/README.md"
    with urllib.request.urlopen(readme_url) as resp:
        readme = resp.read().decode("utf-8")

resp = client.chat.completions.create(
    model=DEPLOYMENT,
    temperature=0.2,
    max_tokens=2000,
    messages=[
        {
            "role": "user",
            "content": f"""Generate an architecture-content.json entry for the package '{package_name}'.

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

Return valid JSON only.""",
        }
    ],
)

entry = json.loads(strip_fences(resp.choices[0].message.content))

gh_token = os.environ["GH_TOKEN"]

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

print(f"""
# ── Paste this job into your deploy.yml (after your deploy job) ───────────────
# Prerequisites: add ARCH_CONTENT_FOUNDRY_KEY and DESIGN_DOC_GH_TOKEN as secrets
# in this repo's GitHub Settings → Secrets and variables → Actions.

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
""")
