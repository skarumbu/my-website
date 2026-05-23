# ADR: Running App

**Date:** 2026-05-23
**Status:** Accepted
**Repos:** running-app · azure-infrastructure

---

## Context

No existing tool tracks runs in a way that fits the existing personal app ecosystem. The goal is a mobile-first PWA that:

- Uses GPS to track distance and pace automatically during a run (no manual entry)
- Saves every completed run per user, with full GPS waypoint data
- Shows historic pace and distance trends, route maps, and personal bests
- Supports multiple users (open registration — no fixed allowlist)

The app should follow the same patterns as `home-app`: React + TypeScript frontend on Azure Static Web Apps, Python Azure Functions backend, Google OAuth via SWA built-in auth. The primary difference is that Azure Table Storage is replaced with Azure Database for PostgreSQL, which makes analytics queries (pace trends, distance aggregations, badge computation) practical without fetching all data client-side.

---

## Decision

### Standalone repo: `running-app`

The running app is an independent PWA, not a module of `home-app` or `my-website`. It has its own Azure SWA, its own Python Functions API, its own PostgreSQL database, and its own GitHub Actions deploy workflow. This matches the `home-app` pattern for a personal standalone app.

### Azure PostgreSQL instead of Table Storage

Table Storage is key-value only. Querying "all runs this week" or "fastest pace across all runs" requires fetching all rows client-side and filtering in JavaScript — acceptable for a small household shopping list, not for a running history that grows indefinitely. PostgreSQL makes these queries trivial SQL aggregations and is the correct choice for relational time-series data.

### GPS tracking via browser Geolocation API + Screen Wake Lock

`navigator.geolocation.watchPosition()` provides continuous position updates. Waypoints are collected every ~5 seconds and filtered for accuracy (`accuracy > 30m` discarded to prevent GPS drift inflating distance). The Haversine formula accumulates distance between consecutive waypoints. The Screen Wake Lock API keeps the screen active during a run so the timer and GPS are not interrupted by the browser backgrounding.

iOS Safari has known limitations with background GPS in PWAs. The wake lock mitigates this by keeping the screen on; users should keep the screen on during runs on iOS.

### Route maps via Leaflet.js + OpenStreetMap

No API key required. Consistent with the `home-app` ecosystem (which uses Overpass/OSM for store detection). Waypoints rendered as a polyline with green start / red finish markers, auto-fit to bounds.

### Badge computation server-side on run save

Badges (`first_run`, `5k`, `10k`, `21k`, `42k`, `longest_streak`) are computed and upserted in `POST /api/runs` using a `UNIQUE` constraint on `(user_id, badge_type)` — idempotent on retry. This keeps badge logic in one place rather than split across client and server.

### Infrastructure declared in Bicep (azure-infrastructure)

Following the ecosystem convention: Azure resources are never created lazily in Python code. A new `modules/runningapp.bicep` declares the PostgreSQL Flexible Server, `running_app` database, and the Azure SWA. Wired into `main.bicep`.

---

## Alternatives Considered

| Alternative | Reason rejected |
|---|---|
| Module inside `home-app` | Running is a different domain; shared auth and deployment would couple two unrelated apps |
| Azure Table Storage (match home-app exactly) | Analytics queries impractical without client-side full-table scans; grows linearly with run count |
| Supabase as backend | Adds a non-Azure dependency; PostgreSQL benefits achievable within the existing Azure ecosystem |
| React Native / Expo | Better native GPS reliability, but new stack and App Store deployment complexity; PWA with wake lock is sufficient for the use case |
| Manual distance entry | Removes the core value proposition; GPS tracking is why the app is worth building |

---

## Data Model

```sql
users   — id, google_id, email, display_name, created_at
runs    — id, user_id, started_at, ended_at, distance_meters,
          duration_seconds, avg_pace_seconds_per_km, name, waypoints (JSONB)
badges  — id, user_id, badge_type, earned_at, run_id
         UNIQUE (user_id, badge_type)
```

Waypoints stored as a JSONB array in the `runs` row: `[{lat, lng, ts, alt?}, ...]`. This avoids a separate waypoints table for the expected data scale (personal use, hundreds of runs).

---

## Consequences

**Positive:**
- SQL makes all history queries trivial: weekly distance totals, all-time best pace, streak computation.
- Full GPS trace stored per run enables route map rendering without re-tracking.
- Open registration (no `ALLOWED_EMAILS` list) makes the app immediately usable for any Google account.
- PWA install on Android/iOS home screen gives a near-native experience.

**Trade-offs:**
- Azure PostgreSQL Flexible Server (Burstable B1ms) adds ~$15/month vs. ~$0 for Table Storage. Acceptable for a personal app.
- iOS PWA GPS reliability depends on screen staying awake (wake lock). Not as robust as a native app, but sufficient for the use case.
- First-time GPS lock can take several seconds outdoors — UX should handle this gracefully with a "acquiring GPS..." state.

---

## Relevant Code

| File | Notes |
|---|---|
| `running-app/src/hooks/useGPS.ts` | `watchPosition` wrapper, Haversine distance, accuracy filtering |
| `running-app/src/hooks/useRunTimer.ts` | Elapsed time ticker (setInterval, 1s) |
| `running-app/src/hooks/useWakeLock.ts` | Screen Wake Lock API — acquire on run start, release on finish |
| `running-app/src/modules/track/TrackTab.tsx` | Run state machine: idle → running → paused → finished |
| `running-app/src/modules/history/RouteMap.tsx` | Leaflet.js polyline from JSONB waypoints |
| `running-app/src/modules/history/DistanceChart.tsx` | Recharts weekly distance bar chart |
| `running-app/api/function_app.py` | All endpoints; badge upsert on POST /api/runs |
| `running-app/api/schema.sql` | Table definitions for local dev and documentation |
| `azure-infrastructure/modules/runningapp.bicep` | PostgreSQL Flexible Server + SWA declaration |
