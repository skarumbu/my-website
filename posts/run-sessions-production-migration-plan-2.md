---
author_email: karumbunathan@gmail.com
date: '2026-06-20T06:31:05.689279+00:00'
description: How to safely apply the run_sessions schema migration to the running
  app's production PostgreSQL database.
published: true
slug: run-sessions-production-migration-plan-2
title: 'Run Sessions: Production Migration Plan'
updatedAt: '2026-06-20T06:38:30.724713+00:00'
---

# Run Sessions: Production Migration Plan

## Background

The running app currently treats every GPS recording as an independent run. That works fine for straightforward outings, but breaks down for interval training, multi-segment long runs, or any outing where you pause the tracker and restart it. Each pause/resume creates a separate run record with no link between them.

The `run_sessions` feature fixes this by introducing a session layer: a single outing (session) can contain multiple run segments. Segments are grouped under a session for display, aggregation, and history purposes.

The API already has session endpoints implemented and tested on the PR branch. The only thing blocking the merge is applying the database migration to production.

## What the Migration Does

`002_run_sessions.sql` makes three changes:

```sql
-- 1. New table
CREATE TABLE IF NOT EXISTS run_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  name TEXT
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_run_sessions_user_id ON run_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_run_sessions_started_at ON run_sessions(started_at DESC);

-- 3. FK column on runs
ALTER TABLE runs ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES run_sessions(id) ON DELETE CASCADE;

-- 4. Index for the FK
CREATE INDEX IF NOT EXISTS idx_runs_session_id ON runs(session_id);
```

All four statements are idempotent (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) — safe to run twice without side effects.

## Why It's Safe to Apply

**No data migration.** The `session_id` column is nullable — all existing runs remain valid with `session_id = NULL`. No backfill is needed.

**No downtime required.** `ADD COLUMN` with a nullable column and no default is a metadata-only operation in PostgreSQL — it acquires a brief `ACCESS EXCLUSIVE` lock but returns immediately without scanning the table. On a table with a few hundred rows this is sub-millisecond.

**No application changes needed first.** The current deployed API ignores `session_id` (it's not in any existing query). Adding the column is transparent to the running app until the PR branch deploys.

**Rollback is clean.** If something goes wrong, drop the column and table:
```sql
ALTER TABLE runs DROP COLUMN IF EXISTS session_id;
DROP TABLE IF EXISTS run_sessions;
```

## How to Apply

The production database is an Azure PostgreSQL Flexible Server. Connection details are in the `DATABASE_URL` app setting on the running-app Azure Functions resource.

### Steps

1. **Get the connection string** from Azure Portal → running-app Function App → Configuration → `DATABASE_URL`, or via:
   ```bash
   az functionapp config appsettings list \
     --name <function-app-name> \
     --resource-group my-website-prod-rg \
     --query "[?name=='DATABASE_URL'].value" -o tsv
   ```

2. **Connect with psql:**
   ```bash
   psql "<DATABASE_URL>"
   ```

3. **Run the migration:**
   ```bash
   psql "<DATABASE_URL>" -f api/migrations/002_run_sessions.sql
   ```
   Expected output:
   ```
   CREATE TABLE
   CREATE INDEX
   CREATE INDEX
   ALTER TABLE
   CREATE INDEX
   ```

4. **Verify:**
   ```sql
   \d run_sessions
   \d runs  -- should show session_id column
   SELECT COUNT(*) FROM runs WHERE session_id IS NOT NULL;  -- expect 0
   ```

5. **Merge PR #4.** The API changes deploy automatically on push to main.

## Timing

Apply the migration before merging PR #4. The order doesn't cause any window of breakage either way (column is nullable, existing API is unaffected), but applying DB changes before code changes is the safer convention.

## Open Questions

- Does the Azure PostgreSQL Flexible Server allow direct `psql` connections from the local machine, or is the firewall restricted? If restricted, the migration can be run via an Azure Cloud Shell session or by temporarily allowing the current IP in the PostgreSQL firewall rules.