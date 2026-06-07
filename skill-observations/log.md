# Skill Observation Log

Observations captured during task-oriented work. Each entry identifies a
potential skill improvement or new skill opportunity.

**Status key:** OPEN = not yet actioned | ACTIONED = skill updated/created |
DECLINED = user decided not to pursue

---

## 2026-06-06

### Observation 1: gsd-plan-phase — Planner does not cite D-NN IDs causing decision coverage gate false positives

**Date:** 2026-06-06
**Session context:** Planning Phase 6 (GitHub-Backed Content) after discuss-phase captured 21 decisions (D-01 through D-21)
**Skill:** gsd-plan-phase
**Type:** internal
**Phase/Area:** Step 13a — Decision Coverage Gate
**Status:** OPEN

**Issue:** After the planner completed all 3 plans for Phase 6, the decision coverage gate (`gsd-sdk query check.decision-coverage-plan`) reported 0/21 decisions covered. The gate requires explicit `D-NN:` citations in plan text (must_haves/truths blocks), but the planner agent produced plans that described implementations in prose without citing decision IDs. The plan checker's Dimension 7 analysis independently verified that all 21 decisions were substantively covered. The result was a false-positive gate failure that required a manual user override.

**Suggested improvement:** Add an explicit instruction to the planner prompt in step 8 of the plan-phase workflow: "When implementing a decision from CONTEXT.md, cite its ID (e.g., `D-07:`) in the relevant plan's `must_haves.truths` block or `<action>` field. This enables the decision coverage gate to verify that all discuss-phase decisions are traceable in the execution plans." This is a one-line addition to the `<deep_work_rules>` or `<quality_gate>` section of the planner prompt.

**Principle:** When a workflow gate checks for explicit citations in generated artifacts, the agent generating those artifacts must be explicitly told to include them. Gates cannot enforce citation requirements that the producing agent doesn't know about.

---

### Observation 2: gsd-plan-phase — Post-planning gap analysis produces noise from prior-phase requirements

**Date:** 2026-06-06
**Session context:** Phase 6 planning — post-planning gap analysis at step 13e
**Skill:** gsd-plan-phase
**Type:** internal
**Phase/Area:** Step 13e — Post-Planning Gap Analysis
**Status:** OPEN

**Issue:** The `gsd-tools.cjs gap-analysis` tool scanned all 30 requirements from REQUIREMENTS.md and reported 25 as "not covered" by Phase 6 plans. All 25 uncovered requirements (STOR-01 through SEC-03, API-01 through EDIT-09, READ-01 through READ-05) were from prior completed phases 1–5. Only the 5 Phase 6 requirements (GH-01 through GH-05) were relevant. The report was technically accurate but created noise that required explanation.

**Suggested improvement:** The gap analysis output in plan-phase step 13e should note the phase scope before presenting the table: "Items from prior phases are expected to show as 'not covered' — this report only checks current-phase requirement IDs ({phase_req_ids})." Alternatively, the tool could accept a `--phase-reqs` filter to scope the report to only the current phase's requirement IDs, suppressing prior-phase noise. If the tool can't be changed, the workflow output message could pre-filter or annotate before displaying.

**Principle:** Post-planning reports that include all historical requirements (not just the current phase's) create cognitive overhead for the user who must mentally filter prior-phase items. Scope should match intent: a Phase N gap analysis should report on Phase N requirements.

---

### Observation 3: gsd-phase-researcher — Critical infrastructure pitfall correctly surfaced from Bicep inspection

**Date:** 2026-06-06
**Session context:** Phase 6 research — GitHub-backed content storage layer rewrite
**Skill:** gsd-phase-researcher
**Type:** internal
**Phase/Area:** Research quality / pitfall detection
**Status:** OPEN

**Issue (positive signal):** The researcher agent read `postsapi.bicep` directly and correctly identified that the Azure Storage account serves dual purpose: (1) post content storage (the `posts` container, being decommissioned) and (2) Azure Functions runtime requirements (`AzureWebJobsStorage`, `WEBSITE_CONTENTAZUREFILECONNECTIONSTRING`). Removing the storage account entirely would break the Azure Function app at deployment. This was a non-obvious pitfall that would not have been visible from requirements or context alone.

**Suggested improvement:** Document this as a validated research pattern: "When decommissioning storage infrastructure, always read the actual infrastructure files (Bicep, Terraform, CloudFormation) to check for shared resource dependencies. Storage accounts, databases, and networks often serve multiple consumers." Consider adding this as an example to the researcher agent's pitfall-detection guidance.

**Principle:** Infrastructure decommissioning requires reading actual infrastructure files, not just the application code. Shared resources (storage accounts, VPCs, databases) commonly serve multiple consumers, and removing one use may break another. Researchers should always check for this pattern when planning any infrastructure removal.

---

## 2026-06-06 (execution session)

### Observation 4: gsd-plan-phase — Bicep param additions not propagated to CI/CD deploy workflow

**Date:** 2026-06-06
**Session context:** Phase 6 execution — Wave 3 added `githubToken` and `githubRepo` as required params to main.bicep, but the deploy.yml workflow was missing them (plus pre-existing missing params `postsApiClientId` and `postsApiClientSecret`). User had to ask explicitly; fix was a separate commit after push.
**Skill:** gsd-plan-phase
**Type:** internal
**Phase/Area:** Plan 06-03 Task 2 (Bicep update)
**Status:** OPEN

**Issue:** When Plan 06-03 Task 2 added new required params to `main.bicep` (`githubToken`, `githubRepo`), it did not check or update the existing GitHub Actions deploy workflow (`deploy.yml`). The workflow passes params to `az deployment sub create` — any new required param (one without a default) will cause the deployment to fail on next push unless also added to the workflow's parameter list. The executor correctly updated both `postsapi.bicep` and `main.bicep` but did not look at `.github/workflows/deploy.yml`. The user caught the gap post-push and asked about it.

**Suggested improvement:** Add a step to the Bicep update task instructions (in gsd-plan-phase or as a standard executor rule): "After adding or removing required params in main.bicep, check `.github/workflows/` for any deploy workflows that call `az deployment sub create` and update the `--parameters` block to match." This could be a checklist item in the must_haves for any plan that modifies Bicep param signatures.

**Principle:** When a build artifact's required interface changes (e.g., a new required Bicep param), all callers of that interface must be updated in the same change set. CI/CD workflows are callers. Plans that change infrastructure param signatures should include an explicit step to audit and update workflow files.

---

### Observation 5: gsd-execute-phase — Worktree merge conflict when plan deletes directory that HEAD also modified

**Date:** 2026-06-06
**Session context:** Phase 6 execution — Wave 3 worktree deleted `docs/design/` via `git rm -r`, but a file in that directory (`docs/design/2026-06-06-posts-writing-system.md`) had been committed to main HEAD during the discuss-phase. On merge, git detected the worktree renamed the file to `posts/posts-writing-system.md` but also created a conflict path `posts/2026-06-06-posts-writing-system.md` (the original file name under the new directory). Required manual resolution.
**Skill:** gsd-execute-phase
**Type:** internal
**Phase/Area:** Worktree merge — post-wave integration
**Status:** OPEN

**Issue:** When an executor agent deletes an entire directory in a worktree (`git rm -r docs/design/`) and also creates a new file with a different name from one of the deleted files (`posts/posts-writing-system.md` from `docs/design/2026-06-06-posts-writing-system.md`), git's rename detection triggers a merge conflict on the worktree merge. Git suggests the original filename under the new parent (`posts/2026-06-06-posts-writing-system.md`), which conflicts with the intentionally renamed migration target. The orchestrator had to manually `git rm` the conflict file and re-commit.

**Suggested improvement:** After a wave that deletes a directory and migrates files to a new location, the orchestrator should anticipate potential rename-detection conflicts before merging: `git diff --name-status HEAD worktree-branch | grep ^R` to preview renames git will detect. If the detected rename targets conflict with already-staged new files, resolve by staging the correct file and removing the conflict path before running `git merge`. Alternatively, note in the plan that `git rm -r` + create-new-file patterns require the merge step to handle rename conflicts.

**Principle:** Git rename detection during merge is based on content similarity, not on what the developer intended. When a plan both deletes files and creates similarly-named files in a different path, git may detect an "unintended rename" that creates merge conflicts. Plans involving directory deletion + file migration should include a merge-conflict anticipation step.

---

### Observation 6: gsd-executor — Mock tests for GitHub API require env var patch alongside requests patch

**Date:** 2026-06-06
**Session context:** Phase 6 Wave 1 — rewriting test_slugs.py with `patch("slugs.requests.get")`; tests initially failed with `KeyError: 'GITHUB_REPO'` because slugs.py reads `os.environ["GITHUB_REPO"]` inside `_gh_url()`, which is called before the `requests.get` mock intercepts.
**Skill:** gsd-executor
**Type:** internal
**Phase/Area:** Task execution — test infrastructure rewrite
**Status:** OPEN

**Issue (positive signal — auto-fixed):** When tests mock `requests.get` but the module under test also reads environment variables inside the same call path, the tests fail with `KeyError` before reaching the mock. The executor correctly auto-fixed this by adding `patch.dict(os.environ, {"GITHUB_TOKEN": "fake", "GITHUB_REPO": "owner/repo"})` as a context manager alongside the `requests.get` patch. The fix was appropriate and the tests passed. This pattern should be documented as a known requirement for GitHub API mock tests.

**Suggested improvement:** Add to the Plan 06-02 test guidance (or as a general executor rule for GitHub API mock tests): "Any test that exercises code paths reading `GITHUB_TOKEN` or `GITHUB_REPO` from `os.environ` must patch both the requests call AND the env vars using `patch.dict(os.environ, {\"GITHUB_TOKEN\": \"fake\", \"GITHUB_REPO\": \"owner/repo\"})`. Failure to patch env vars causes `KeyError` before the requests mock can intercept." Document the correct stacking pattern: `with patch.dict(os.environ, ENV), patch("slugs.requests.get") as mock_get:`.

**Principle:** When mocking HTTP clients that read environment variables in the same call path, both the HTTP mock and the env var mock must be applied together. A requests mock alone is insufficient if the function under test reads env vars before making the request.

