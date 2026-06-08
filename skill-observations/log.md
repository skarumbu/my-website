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
**Status:** ACTIONED — gsd-plan-phase SKILL.md — added <known_pitfalls> block (2026-06-07)

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
**Status:** ACTIONED — gsd-plan-phase SKILL.md — added gap analysis scope note in <known_pitfalls> (2026-06-07)

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
**Status:** ACTIONED — gsd-plan-phase SKILL.md — added infrastructure decommissioning pitfall (2026-06-07)

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
**Status:** ACTIONED — gsd-plan-phase SKILL.md — added Bicep param CI/CD propagation pitfall (2026-06-07)

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
**Status:** ACTIONED — gsd-execute-phase SKILL.md — added worktree merge conflict pitfall (2026-06-07)

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
**Status:** ACTIONED — gsd-execute-phase SKILL.md — added GitHub API mock test env var pattern (2026-06-07)

**Issue (positive signal — auto-fixed):** When tests mock `requests.get` but the module under test also reads environment variables inside the same call path, the tests fail with `KeyError` before reaching the mock. The executor correctly auto-fixed this by adding `patch.dict(os.environ, {"GITHUB_TOKEN": "fake", "GITHUB_REPO": "owner/repo"})` as a context manager alongside the `requests.get` patch. The fix was appropriate and the tests passed. This pattern should be documented as a known requirement for GitHub API mock tests.

**Suggested improvement:** Add to the Plan 06-02 test guidance (or as a general executor rule for GitHub API mock tests): "Any test that exercises code paths reading `GITHUB_TOKEN` or `GITHUB_REPO` from `os.environ` must patch both the requests call AND the env vars using `patch.dict(os.environ, {\"GITHUB_TOKEN\": \"fake\", \"GITHUB_REPO\": \"owner/repo\"})`. Failure to patch env vars causes `KeyError` before the requests mock can intercept." Document the correct stacking pattern: `with patch.dict(os.environ, ENV), patch("slugs.requests.get") as mock_get:`.

**Principle:** When mocking HTTP clients that read environment variables in the same call path, both the HTTP mock and the env var mock must be applied together. A requests mock alone is insufficient if the function under test reads env vars before making the request.

---

## 2026-06-07

### Observation 7: New skill candidate — Azure EasyAuth blocks machine-key auth when set to Return401

**Date:** 2026-06-07
**Session context:** Debugging ideas-bot "queued" status stuck — bot could not call set_bot_status() or fetch_idea() despite correct IDEAS_WRITE_KEY; all PATCH calls returned 401 before reaching function code.
**Skill:** New skill candidate: azure-functions-auth-pitfalls (internal)
**Type:** internal
**Phase/Area:** Azure Function App authentication design

**Issue:** ideas-api-prod had EasyAuth configured with `requireAuthentication: true` and `unauthenticatedClientAction: "Return401"`. This caused all requests without a valid Bearer token (including bot requests using the X-Ideas-Key machine write key) to be rejected by EasyAuth before they reached any function code. The function-level machine key check (`if IDEAS_WRITE_KEY and key == IDEAS_WRITE_KEY`) was never executed. The bot had been broken since deployment with no obvious error — it received 401 and the error was silently swallowed. Diagnosing this required checking AppRequests (no PATCH calls ever recorded) and tracing the EasyAuth config.

**Suggested improvement:** When designing Azure Function Apps that serve both browser users (EasyAuth) AND machine callers (API key), set EasyAuth to `unauthenticatedClientAction: AllowAnonymous` and handle all auth enforcement in function code. The function code already validates every endpoint appropriately. Document this as a deployment checklist item for ideas-api or any similar multi-caller Function App.

**Principle:** Azure EasyAuth's `Return401` mode is a pre-function layer that blocks ALL unauthenticated requests regardless of custom headers. Any non-Bearer-token auth scheme (API keys, HMAC, machine write keys) must be implemented in function code AND EasyAuth must be set to AllowAnonymous — otherwise EasyAuth intercepts before the function-level check ever runs. This is a silent failure mode: the custom header is sent, 401 is returned, but the auth logic in code is never reached.

---

### Observation 8: Azure Monitor workspace-based App Insights uses AppRoleName not Cloud_RoleName in KQL

**Date:** 2026-06-07
**Session context:** Dashboard failing to show ideas-api-prod errors despite App Insights being connected; KQL queries returned empty results with "Failed to resolve column or scalar expression named 'Cloud_RoleName'".
**Skill:** New skill candidate: azure-monitor-kql-patterns (internal)
**Type:** internal
**Phase/Area:** Log Analytics KQL query authoring

**Issue:** The dashboard's `query_log_analytics_function_app()` function filtered requests with `Cloud_RoleName =~ "{service}"`. When App Insights is connected to a Log Analytics workspace (workspace-based mode), the `AppRequests` and `AppExceptions` tables use `AppRoleName` instead of `Cloud_RoleName`. The queries failed with a semantic error. Additionally, `AppExceptions` exposes `InnermostMessage` (the actual Python traceback) rather than `OuterMessage` (always the generic Azure Functions host wrapper message). Both fixes were one-word changes but required live query inspection to discover.

**Suggested improvement:** Add to any KQL query template for workspace-based App Insights: use `AppRoleName` (not `Cloud_RoleName`) for filtering by service name, and `InnermostMessage` (not `OuterMessage`) for exception details in `AppExceptions`. The `OuterMessage` in Azure Functions is always "Exception while executing function: Functions.{name}" — useless for diagnosis.

**Principle:** Workspace-based App Insights (Log Analytics integration) uses a different column naming schema than classic App Insights. `Cloud_RoleName` → `AppRoleName`. Always validate column names against a live query with `| limit 1` before deploying KQL-based monitoring dashboards. The semantic error ("Failed to resolve column") reveals the problem immediately but only after deployment.

---

### Observation 9: Azure Container App Job secret refs in execution templates use snapshot of job template at trigger time

**Date:** 2026-06-07
**Session context:** Bot execution failed with 401 on all ideas-api calls; execution template showed secretRef "cappjob-ideas-bot-prod" for IDEAS_WRITE_KEY but the job's current secrets used "ideas-write-key". Container logs showed the bot started then immediately 401'd on fetch_idea().
**Skill:** New skill candidate: azure-container-apps-debugging (internal)
**Type:** internal
**Phase/Area:** Container App Job execution environment

**Issue:** When run_bot triggers the Container App Job by reading base.env and constructing a JobExecutionTemplate, it captures the secret ref names from the job's template AT trigger time. If the job's secrets were subsequently renamed or reorganized (e.g., from a single "cappjob-ideas-bot-prod" to individual "ideas-write-key", "azure-openai-key", "github-pat"), old executions' secret refs may reference secrets that no longer exist — resulting in empty env vars at runtime with no error at trigger time. The failure is silent: the container starts, env vars are empty strings, and all authenticated calls fail with 401.

**Suggested improvement:** After any restructuring of Container App Job secrets, verify by checking the job's live template (`az containerapp job show --query template.containers[0].env`) to confirm all secretRef names resolve to current secrets. Also add a startup check in bot.py: `if not IDEA_ID or not IDEAS_WRITE_KEY: raise RuntimeError("Required env vars missing — check Container App Job secret refs")`. This surfaces the misconfiguration before any API calls are attempted.

**Principle:** Container App Job execution templates capture secret ref NAMES (not values) at trigger time. If secrets are renamed after an execution template is constructed, the refs become dangling pointers — env vars silently receive empty strings. Secret reorganizations in Container App Jobs require re-checking all code paths that construct execution templates programmatically.



## 2026-06-07 (review + fixes session)

### Observation 10: gsd-review — skill workflow breaks when given a GitHub PR URL instead of a phase number

**Date:** 2026-06-07
**Session context:** User ran /gsd-review with a GitHub PR URL (skarumbu/running-app/pull/2/changes) instead of a phase number
**Skill:** gsd-review
**Type:** internal
**Phase/Area:** Step 1 — detect_clis / gather_context
**Status:** ACTIONED — gsd-review SKILL.md — added PR URL input detection mode (2026-06-07)
**Status:** ACTIONED — New skill: azure-functions-auth-pitfalls (2026-06-07)

**Issue:** The gsd-review workflow assumes a phase number as input and immediately tries to resolve a phase directory via `gsd-sdk query init.phase-op`. When the argument is a GitHub PR URL, the workflow has no path to follow — it cannot find a phase directory, PLAN.md files, or CONTEXT.md. The entire gather_context step is inapplicable. I adapted by fetching the PR diff via `gh pr diff` and doing an inline review, but this was improvised rather than supported by the skill.

**Suggested improvement:** Add a PR URL detection step at the start of the workflow: if the argument matches a GitHub PR URL pattern (`github.com/.*/pull/\d+`), switch to PR review mode — fetch the diff via `gh pr diff`, skip the phase artifact steps, and build a prompt around the PR diff instead of PLAN.md files. The reviewer invocation and REVIEWS.md output steps can remain the same. This makes /gsd-review useful for arbitrary PRs, not just GSD phase plans.

**Principle:** Skills that accept a primary argument should detect the argument type early and branch the workflow accordingly. A skill locked to a single argument format (phase number) fails silently or breaks confusingly when users apply it to a plausible adjacent use case (PR review). Argument detection + workflow branching widens utility without complicating the primary path.

---

### Observation 11: LLM code generation can produce null bytes — sanitize before writing files

**Date:** 2026-06-07
**Session context:** ideas-bot (gpt-4.1-mini) generated a null byte `\x00` inside a JSX string in TrackTab.tsx ("GPS \x00 auto-pause on"), causing git to treat the file as binary
**Skill:** New skill candidate: llm-output-sanitization (internal)
**Type:** internal
**Phase/Area:** Bot write_file dispatch / LLM output post-processing
**Status:** ACTIONED — New skill: llm-output-sanitization (2026-06-07)
**Status:** ACTIONED — New skill: azure-monitor-kql-patterns (2026-06-07)

**Issue:** The gpt-4.1-mini model generated a literal null byte inside a JSX string. Git treats any file containing a null byte as binary, which caused the PR to show "Binary file not shown" for the changed file — making the diff completely unreadable and the PR effectively unreviable. The fix was added to bot.py's write_file dispatch: `content = args["content"].replace('\x00', '')`. The observation is that this sanitization was missing initially and required a post-hoc PR fix.

**Suggested improvement:** Any agent that writes LLM-generated content to files should sanitize output before writing. At minimum: strip null bytes (`\x00`). Additional candidates: normalize line endings (CRLF → LF on Linux), strip BOM characters, validate UTF-8 encoding. These are cheap checks that prevent hard-to-diagnose downstream failures (binary detection, encoding errors, broken diffs).

**Principle:** LLM output is not guaranteed to be clean text even when prompted for code. Null bytes, BOMs, and encoding artifacts can appear sporadically and cause silent, hard-to-diagnose failures (binary git detection, broken CI, encoding errors). Any write_file path for LLM-generated content should apply a sanitization pass before writing.

---

### Observation 12: Windows — Python heredoc and /dev/stdin patterns fail in Git Bash

**Date:** 2026-06-07
**Session context:** Attempting to apply file edits to /tmp/running-app-fix/src/modules/track/TrackTab.tsx via Python script
**Skill:** New skill candidate: windows-shell-patterns (internal)
**Type:** internal
**Phase/Area:** File manipulation via Bash tool on Windows
**Status:** ACTIONED — New skill: windows-dev-patterns (2026-06-07)
**Status:** ACTIONED — New skill: azure-container-apps-debugging (2026-06-07)

**Issue:** Three common Unix shell patterns failed on Windows/Git Bash: (1) `python3 /dev/stdin` — Python resolves `/dev/stdin` as a Windows path (`C:\proc\self\fd\0`) which doesn't exist; (2) `python3 - << 'PYEOF'` heredoc — fails with "unexpected EOF" when the heredoc content contains single quotes (heredoc delimiter collision); (3) `cat > file << 'EOF'` — fails with "unexpected EOF while looking for matching `''`" for the same reason. The workaround was to write the Python script to a temp file first, then execute it with the Windows path.

**Suggested improvement:** For Windows/Git Bash environments, prefer writing scripts to temp files then executing, over inline heredoc/stdin patterns. Also: Python on Windows does not recognize /tmp paths — use `cygpath -w /tmp/...` to get the Windows-compatible path before passing to Python. Document as a Windows shell pitfall in any skill that uses Bash for file manipulation.

**Principle:** Unix shell patterns common in Linux CI (heredocs, /dev/stdin, /tmp paths) frequently fail on Windows even in Git Bash. Skills that use Bash for scripting should document Windows-compatible fallbacks: write scripts to temp files rather than using heredoc stdin, and use cygpath to translate Unix paths to Windows paths before passing to Python or native Windows tools.


---

## 2026-06-07 (session 2)

### Observation 13: gsd-execute-phase — worktree agents that only edit sibling repos produce fragile SUMMARY commits

**Date:** 2026-06-07
**Session context:** Executing Phase 7 — Wave 2 plan 07-03 edits only sibling repos (azure-infrastructure, posts-api); the only in-worktree artifact was SUMMARY.md
**Skill:** gsd-execute-phase
**Type:** internal
**Phase/Area:** execute_waves — worktree mode for sibling-repo-only plans
**Status:** OPEN

**Issue:** Plan 07-03 modified only files outside the my-website worktree (azure-infrastructure and posts-api deploy.yml files). The gsd-executor agent ran in worktree isolation, but worktree isolation was irrelevant for sibling repo commits — those go directly to the sibling repo's git history regardless of which worktree the agent runs in. The only artifact the agent needed to commit in its worktree was SUMMARY.md. The agent returned `[Tool result missing due to internal error]` before committing SUMMARY.md, requiring the orchestrator to recover inline (read the plan, verify the sibling repo commits were present, write SUMMARY.md manually, commit it to main). The spot-check mechanism (SUMMARY.md exists + commits present) correctly detected the incomplete state.

**Suggested improvement:** Plans whose `files_modified` list contains only sibling-repo paths (absolute paths outside the project root) should be flagged for sequential mode, not worktree isolation. In sequential mode, the agent runs on main and commits SUMMARY.md there directly — one less failure point. The per-plan worktree decision step (2.5 in execute_waves) already checks for submodule intersection; this could be extended to also check for "all files_modified are outside project root" → force sequential. Add to execute-phase known_pitfalls: "Plans that only modify sibling repos should use sequential mode — worktree isolation only protects commits to the current repo."

**Principle:** Worktree isolation adds value when the plan modifies files inside the project repo (keeps work-in-progress off main until merged). When a plan only modifies external repos, worktree isolation provides no benefit and adds a failure point (SUMMARY.md must be committed in the worktree before the agent returns, or it is lost). The cost-benefit of worktree isolation should be evaluated per-plan against where the actual file modifications land.

---

### Observation 14: gsd-execute-phase — "service vs reusable workflow" architectural tradeoff surfaced naturally in pre-planning discussion

**Date:** 2026-06-07
**Session context:** User asked "is it ever worth creating a separate service for this summarizer?" after Phase 7 planning was complete but before execution
**Skill:** gsd-discuss-phase
**Type:** internal
**Phase/Area:** Deferred Ideas — post-discuss-phase architectural reflection
**Status:** OPEN

**Issue:** After CONTEXT.md was written and plans were created, the user surfaced a "should this be a service?" architectural question about the arch-content-update pipeline. The question wasn't raised during discuss-phase (which focused on the existing reusable-workflow pattern) and wasn't in any CONTEXT.md deferred idea — it emerged during the execution lead-up. The tradeoff (centralized secrets vs infrastructure overhead at 9 repos) was evaluated quickly and the user chose to proceed with the current plan. The decision was correct for the current scale, but had no formal capture.

**Suggested improvement:** The discuss-phase workflow's Deferred Ideas section could include a prompt: "Is the chosen approach an architectural pattern (reusable workflow, script, CLI) that would be replaced by a dedicated service at some scale threshold?" If yes, record the scale threshold and what would trigger the switch as a deferred idea. This creates a documented trigger condition rather than relying on the question arising organically later.

**Principle:** Architectural "should this be a service?" questions often arise after planning, not during it, because planning focuses on the concrete implementation path. Discuss-phase workflows benefit from a late-stage architectural scale check: "at what point would this pattern break down and require a different approach?" Capturing the answer as a deferred idea with an explicit trigger condition prevents the question from re-arising without context in future sessions.

