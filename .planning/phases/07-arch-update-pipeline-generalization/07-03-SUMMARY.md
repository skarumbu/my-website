---
plan: "07-03"
status: complete
started: "2026-06-07"
completed: "2026-06-07"
---

# Plan 07-03 Summary: New Repos Wiring

## What Was Built

Wired azure-infrastructure and posts-api into the reusable architecture content update pipeline (D-11, D-12).

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Deleted dispatch-architecture-update.yml from azure-infrastructure | b87aed6 (azure-infrastructure) |
| 2 | Added update-arch-content job to azure-infrastructure/deploy.yml | d9ba487 (azure-infrastructure) |
| 3 | Added update-arch-content job to posts-api/deploy.yml | cd060a5 (posts-api) |

## Key Files

### Modified
- `C:/Users/Sriram/azure-infrastructure/.github/workflows/deploy.yml` — added `update-arch-content` job (needs: deploy, repo_name: azure-infrastructure)
- `C:/Users/Sriram/posts-api/.github/workflows/deploy.yml` — added `update-arch-content` job (needs: deploy, repo_name: posts-api)

### Deleted
- `C:/Users/Sriram/azure-infrastructure/.github/workflows/dispatch-architecture-update.yml` — broken dispatch workflow removed

## Decisions Honored

- D-11: azure-infrastructure dispatch workflow deleted; standard reusable job added
- D-12: posts-api wired to reusable workflow; repo_name: posts-api matches key in architecture-content.json (added by 07-01)
- Both repos use `ARCH_UPDATE_GH_TOKEN: ${{ secrets.DESIGN_DOC_GH_TOKEN }}`

## Self-Check: PASSED

- `dispatch-architecture-update.yml` does not exist in azure-infrastructure
- azure-infrastructure/deploy.yml: `update-arch-content` job present, `needs: deploy`, `repo_name: azure-infrastructure`, `DESIGN_DOC_GH_TOKEN`
- posts-api/deploy.yml: `update-arch-content` job present, `needs: deploy`, `repo_name: posts-api`, `DESIGN_DOC_GH_TOKEN`
- No `if:` condition on either new job (GitHub skips downstream when upstream is skipped)
- Both files are valid YAML
