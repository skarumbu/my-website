---
title: "ADR: Dashboard — GitHub Actions Integration & Expandable Cards"
slug: dashboard-github-actions-expandable-cards
date: "2026-05-12T00:00:00+00:00"
published: true
description: "Architecture decision record for Dashboard GitHub Actions integration and expandable card UI."
updatedAt: "2026-05-12T00:00:00+00:00"
---
# ADR: Dashboard — GitHub Actions Integration & Expandable Cards

**Date:** 2026-05-12
**Status:** Accepted
**Repos:** dashboard-api · my-website

---

## Context

The Dashboard showed a flat "Request volume & latency — 24h" table listing metrics for every registered service simultaneously. This layout had two problems:

1. **Information density vs. discoverability:** Seeing every endpoint row for every service at once produced a large table that was hard to scan. Most of the time only one or two services are of interest.
2. **Missing CI/CD signal:** There was no visibility into whether a service's deploy pipeline was healthy. Knowing a service is "up" tells you nothing about whether the last deploy succeeded, or whether a broken CI run is pending.

The goal of this change is to:
- Remove the flat metrics table and move per-service detail behind a click.
- Add GitHub Actions last-run status (and failed job names when applicable) as the primary CI/CD signal.
- Make the health cards the entry point for all per-service context.

---

## Decision

### GitHub Actions data fetched server-side in dashboard-api

The GitHub API requires authentication. Fetching from the browser would mean shipping a GitHub token to the client — unacceptable even for a private internal tool. The dashboard-api already aggregates health, metrics, Log Analytics, and cost data from external sources using `ThreadPoolExecutor`. GitHub Actions runs are a natural addition to this pattern.

A new `github_checks.py` module handles the API calls. Fetching is added to the existing parallel executor in `DashboardGetter` — no architectural change, just an additional parallel task per app.

### New `github_repo` field in the app registry

Each registered app now has an optional `github_repo: "owner/repo"` field stored in Table Storage alongside the existing fields. No migration needed (Table Storage is schemaless; existing rows simply have no value for the field). It is added to `UPDATABLE_FIELDS` so it can be set via `PATCH /api/apps/{name}`.

A new environment variable `GITHUB_TOKEN` (classic PAT or fine-grained token with `actions:read`) is required in the Function App settings for GitHub data to populate. If absent, `github_actions` returns an empty dict — the dashboard degrades gracefully.

### Inline accordion expansion on health cards

When a user clicks a health card, it expands in-place within the grid to show:
- **GitHub Actions:** last run chip (success/failure/in_progress), workflow name, branch, relative time, link to the run on GitHub. If the run failed, the failing job names are listed.
- **Request metrics (24h):** compact list of endpoints with request count, average latency, and error count (repurposed from the removed flat table).
- **Recent errors:** errors for this service filtered from the aggregated error list.

An inline accordion was chosen over a slide-over panel (as used on the Ideas page) because the dashboard is a monitoring surface where seeing multiple cards simultaneously has value. Expanding one card in place keeps the other cards visible for comparison.

### Removed: flat "Request volume & latency — 24h" table

The flat table is removed. The same data (`data.metrics` keyed by service name) is displayed inside the expanded card section instead, where it has service context. No API change is needed — `metrics` continues to be returned by `DashboardGetter`.

---

## Alternatives Considered

| Alternative | Reason rejected |
|---|---|
| Fetch GitHub API in the browser directly | Requires exposing `GITHUB_TOKEN` to the client — security risk |
| Add a dedicated `/api/github-actions` endpoint | Extra round-trip; the aggregated `DashboardGetter` pattern already batches all data in one call, which is the right model for a monitoring dashboard |
| Slide-over panel instead of inline accordion | Hides all other cards; the dashboard is a multi-service monitoring view where side-by-side context matters |
| Keep flat metrics table, add GitHub alongside it | The table already dominated vertical space; stacking more sections makes the page unwieldy |

---

## Consequences

**Positive:**
- CI/CD health is now a first-class signal alongside uptime health.
- Per-service detail is accessible without leaving the dashboard or losing context on other services.
- The dashboard is less cluttered by default; detail is revealed on demand.

**Trade-offs:**
- Requires setting up `GITHUB_TOKEN` as a Function App environment variable and patching each app's `github_repo` field before GitHub data appears.
- `DashboardGetter` makes additional HTTP calls (one per registered app with a `github_repo`, plus one more for failed-run job detail). These run in parallel with the existing health checks, so wall-clock latency impact should be minimal given the 45s health-check timeout budget.

---

## Relevant Code

| File | Notes |
|---|---|
| `dashboard-api/github_checks.py` | `fetch_github_run(repo)` — GitHub Actions API fetch with failure job detail |
| `dashboard-api/registry.py` | `UPDATABLE_FIELDS` updated to include `github_repo` |
| `dashboard-api/function_app.py` | `DashboardGetter` — adds `github_futures` to ThreadPoolExecutor, includes `github_actions` in payload |
| `my-website/src/Dashboard.tsx` | Expandable health cards, GitHub run display, removed metrics section |
