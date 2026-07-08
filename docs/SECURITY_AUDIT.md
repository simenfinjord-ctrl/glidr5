# Glidr security & scale audit (#14)

_Scope: multi-tenant data leakage and stability under ~100 users. Date: 2026-07-08._

## Verdict

No critical cross-team data leakage found. Multi-tenant isolation and the
core infrastructure are sound for ~100 users. Two low-risk recommendations
below.

## What was verified

### Multi-tenant isolation (no cross-team leakage)
- **`verifyTeamOwnership(record, req)`** (`server/routes.ts`) gates access on
  every `:id` detail/mutation endpoint (32 call sites). A non-SA user can only
  touch a record whose `teamId` equals their **active** team.
- **`getActiveTeamId(req)`** returns `activeTeamId || teamId`. `activeTeamId` is
  only set by `POST /api/teams/switch`, which first validates the user actually
  belongs to the target team — so it can't be spoofed to reach another team.
- **List endpoints are team-scoped**: `/api/athletes`, `/api/products`,
  `/api/weather`, tests, series, race-skis all pass `getActiveTeamId` into the
  storage layer and filter by it. Spot-checked and consistent.
- **Per-team effective permissions**: switching teams loads
  `user_team_permissions` into the session (`effectivePermissions`,
  `effectiveGroupScope`, `activeTeamIsAdmin`); `/api/auth/me` returns
  permissions/`teamEnabledAreas`/`isTeamAdmin` scoped to the active team. The
  dashboard menu and server `requirePermission` both honour it.
- **Group scoping**: regular tests additionally require
  `userHasGroupAccess(groupScope, …)`; race-ski tests require per-athlete
  `hasAthleteAccess`. Both use the active team.
- **Share-view (athlete-access) accounts** are read-only by default; `canEdit`
  is per-athlete and ignored for cross-team athletes.
- **Active sessions** (`/api/admin/active-sessions`) and **emergency lockdown**
  are Super-Admin only (`u.isAdmin`), and the UI card is SA-gated.
- **Archive athletes** (new, #13) uses `hasAthleteAccess(..., getActiveTeamId)`
  before archiving/restoring; archived athletes are filtered out of every
  picker server-side unless `?includeArchived=1`.

### Stability under load
- **DB pool**: `pg.Pool` `max: 20`, `connectionTimeoutMillis: 5000`
  (fails fast instead of hanging), `idleTimeoutMillis: 30000`. Short-lived
  queries mean 20 connections comfortably serve ~100 users, whose requests are
  not simultaneous at the query level.
- **Session store**: `connect-pg-simple` (PostgreSQL-backed), not in-memory —
  survives restarts and horizontal scaling, no memory blow-up.
- **Hardening**: `helmet` enabled; `express-rate-limit` on general API, auth,
  password-reset, interest and 2FA routes.

## Recommendations (low risk, not yet applied)

1. **`verifyTeamOwnership` treats a `null` `teamId` as public** (returns `true`).
   Current tables default `teamId` to `1`/NOT NULL, so this only matters for any
   legacy rows with a null team. Consider a one-off migration to backfill null
   `teamId`s, then tighten the guard to deny nulls.
2. **`TestListView` fetches one `/api/tests/:id/entries` request per test** in
   parallel. For an athlete with many tests this is a request burst per page
   load. A single batch endpoint (`POST /api/tests/entries?ids=…`) would cut it
   to one round-trip and reduce pool pressure under heavy traffic.

## Not in scope / infra-owned
- TLS, WAF, DDoS protection and DB connection ceilings are handled by the Render
  platform. If the managed Postgres plan caps connections below 20 per instance,
  lower `pool.max` accordingly to avoid `too many connections` under load.
