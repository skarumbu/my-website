---
plan: "07-02"
phase: 7
title: "Existing 7 repo workflow cleanup"
subsystem: ci-cd
tags: [github-actions, workflow-cleanup, secret-rename, sibling-repos]
dependency_graph:
  requires: []
  provides: [clean-deploy-workflows-all-7-repos]
  affects: [digits, dashboard_api, momentum_finder, trail_finder, ideas-api, ideas-bot, learning-plan-api]
tech_stack:
  added: []
  patterns: [reusable-workflow-call, needs-chain]
key_files:
  created: []
  modified:
    - C:/Users/Sriram/digits/.github/workflows/deploy.yml
    - C:/Users/Sriram/dashboard_api/.github/workflows/deploy.yml
    - C:/Users/Sriram/momentum_finder/.github/workflows/deploy.yml
    - C:/Users/Sriram/trail_finder/.github/workflows/deploy.yml
    - C:/Users/Sriram/ideas-api/.github/workflows/deploy.yml
    - C:/Users/Sriram/ideas-bot/.github/workflows/deploy.yml
    - C:/Users/Sriram/learning-plan-api/.github/workflows/deploy.yml
decisions:
  - "needs: chain updated to point directly to the deploy job (not the now-deleted update-architecture job)"
  - "MY_WEBSITE_DISPATCH_TOKEN renamed to DESIGN_DOC_GH_TOKEN in 4 repos (digits, dashboard_api, momentum_finder, trail_finder)"
  - "ideas-api, ideas-bot, learning-plan-api already used DESIGN_DOC_GH_TOKEN — secret line left unchanged"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-07T21:13:39Z"
  tasks_completed: 7
  files_modified: 7
---

# Phase 7 Plan 02: Existing 7 Repo Workflow Cleanup Summary

## One-liner

Removed dead `update-architecture` metadata job from all 7 package repo deploy workflows and standardized secret name to `DESIGN_DOC_GH_TOKEN`.

## What Was Built

Pure YAML cleanup across 7 sibling repos. Each deploy.yml had the `update-architecture` job block removed (~26 lines of metadata-commit logic per file) and the surviving `update-arch-content` job's `needs:` updated to point directly to the deploy job. Secret references standardized in 4 repos.

## Tasks Completed

| Task | Repo | Sibling Commit | Changes |
|------|------|----------------|---------|
| 1 | digits | 43d4a4f | Remove update-architecture job, needs: deploy, secret -> DESIGN_DOC_GH_TOKEN |
| 2 | dashboard_api | 04804f9 | Remove update-architecture job, needs: deploy, secret -> DESIGN_DOC_GH_TOKEN |
| 3 | momentum_finder | 82fb654 | Remove update-architecture job, needs: build-and-deploy, secret -> DESIGN_DOC_GH_TOKEN |
| 4 | trail_finder | 4521c01 | Remove update-architecture job, needs: build-and-deploy, secret -> DESIGN_DOC_GH_TOKEN |
| 5 | ideas-api | 3beb9ea | Remove update-architecture job, needs: deploy (secret unchanged) |
| 6 | ideas-bot | 83807df | Remove update-architecture job, needs: build-and-deploy (secret unchanged) |
| 7 | learning-plan-api | 18a3f3a | Remove update-architecture job, needs: deploy (secret unchanged) |

## Verification Results

- Zero `update-architecture` references across all 7 deploy.yml files
- Zero `MY_WEBSITE_DISPATCH_TOKEN` references in digits, dashboard_api, momentum_finder, trail_finder
- All 7 repos have `update-arch-content.needs` pointing to correct deploy job:
  - `deploy`: digits, dashboard_api, ideas-api, learning-plan-api
  - `build-and-deploy`: momentum_finder, trail_finder, ideas-bot
- All 7 repos have `ARCH_UPDATE_GH_TOKEN: ${{ secrets.DESIGN_DOC_GH_TOKEN }}`

## Deviations from Plan

None — plan executed exactly as written. All 7 files matched the expected structure from RESEARCH.md.

## Known Stubs

None.

## Threat Flags

None — pure YAML cleanup, no new security surface introduced.

## Self-Check

All 7 sibling repo commits verified via git log. No `update-architecture` or `MY_WEBSITE_DISPATCH_TOKEN` references remain.
