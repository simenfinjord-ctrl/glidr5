import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage, parseGroupScopes } from "./storage";
import { parsePermissions, hashPassword } from "./auth";

/** Shared password validation: ≥7 chars, ≥1 digit, ≥1 special character */
export function validatePassword(pw: string): string | null {
  if (!pw || pw.length < 7) return "Password must be at least 7 characters.";
  if (!/[0-9]/.test(pw)) return "Password must contain at least one number.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Password must contain at least one special character.";
  return null;
}
import { type PermissionArea, type PermissionLevel, PERMISSION_AREAS, DEFAULT_PERMISSIONS, runsheetProgress, watchSessions, watchQueue, teams, tests, testEntries, users, testSkiSeries, products, dailyWeather, raceSkis } from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, inArray } from "drizzle-orm";
async function enforceTeamAreas(perms: Record<string, string>, teamId: number | undefined): Promise<Record<string, string>> {
  if (!teamId) return perms;
  const team = await storage.getTeam(teamId);
  if (!team || !team.enabledAreas) return perms;
  try {
    const enabled: string[] = JSON.parse(team.enabledAreas as string);
    const result = { ...perms };
    for (const area of PERMISSION_AREAS) {
      if (!enabled.includes(area)) {
        result[area] = "none";
      }
    }
    return result;
  } catch {
    return perms;
  }
}

function sanitizePermissions(input: any): Record<string, string> {
  const result: Record<string, string> = { ...DEFAULT_PERMISSIONS };
  if (!input) return result;
  const raw = typeof input === "string" ? (() => { try { return JSON.parse(input); } catch { return {}; } })() : input;
  if (typeof raw !== "object" || raw === null) return result;
  for (const area of PERMISSION_AREAS) {
    const val = raw[area];
    if (val === "none" || val === "edit") {
      result[area] = val;
    } else if (val === "view") {
      result[area] = "edit";
    }
  }
  return result;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

function isIncognito(req: Request): boolean {
  return !!(req.session as any)?.incognito || !!(req.session as any)?.stealth;
}

function isStealth(req: Request): boolean {
  return !!(req.session as any)?.stealth;
}

function isStealthViewingOtherTeam(req: Request): boolean {
  if (!req.user || req.user.isAdmin !== 1) return false;
  if (!isStealth(req)) return false;
  const activeTeamId = (req.user as any).activeTeamId || req.user.teamId;
  return activeTeamId !== req.user.teamId;
}

function enforceStealthReadOnly(req: Request, res: Response, next: NextFunction) {
  if (isStealthViewingOtherTeam(req)) {
    const method = req.method.toUpperCase();
    if (method === "PUT" || method === "PATCH" || method === "DELETE") {
      const url = req.originalUrl || req.url;
      const allowedPaths = ["/api/auth/stealth", "/api/auth/incognito", "/api/auth/logout", "/api/teams/switch"];
      if (allowedPaths.some(p => url.startsWith(p))) {
        return next();
      }
      return res.status(403).json({ message: "Read-only access in stealth mode" });
    }
    if (method === "POST") {
      const url = req.originalUrl || req.url;
      const safePostPaths = [
        "/api/auth/stealth", "/api/auth/incognito", "/api/auth/logout",
        "/api/teams/switch",
      ];
      if (safePostPaths.some(p => url.startsWith(p))) {
        return next();
      }
      return res.status(403).json({ message: "Read-only access in stealth mode" });
    }
  }
  next();
}

function getEffectivePermissionsStr(req: Request): string {
  // Per-team permissions override global permissions when viewing a non-primary team
  const sessionPerms = (req.session as any)?.effectivePermissions;
  return sessionPerms ?? req.user!.permissions;
}

function getEffectiveGroupScope(req: Request): string {
  // Per-team group scope overrides global group scope when viewing a non-primary team
  const sessionScope = (req.session as any)?.effectiveGroupScope;
  if (sessionScope !== undefined && sessionScope !== null) return sessionScope;
  return req.user!.groupScope;
}

function userInfo(req: Request) {
  const u = req.user!;
  const perms = parsePermissions(getEffectivePermissionsStr(req), u.isAdmin === 1, u.isTeamAdmin === 1);
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    groupScope: getEffectiveGroupScope(req),
    isAdmin: u.isAdmin === 1,
    isTeamAdmin: u.isTeamAdmin === 1,
    isScopeAdmin: u.isAdmin === 1 || u.isTeamAdmin === 1,
    teamId: u.teamId,
    activeTeamId: getActiveTeamId(req),
    permissions: perms,
  };
}

function requirePermission(area: PermissionArea, level: PermissionLevel) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const u = req.user!;
    if (u.isAdmin !== 1) {
      const effectiveTeamId = getActiveTeamId(req);
      if (effectiveTeamId) {
        try {
          const team = await storage.getTeam(effectiveTeamId);
          if (team?.enabledAreas) {
            const enabled: string[] = JSON.parse(team.enabledAreas);
            if (!enabled.includes(area)) {
              return res.status(403).json({ message: "This area is not enabled for your team" });
            }
          }
        } catch {}
      }
    }
    const perms = parsePermissions(getEffectivePermissionsStr(req), u.isAdmin === 1, u.isTeamAdmin === 1);
    const userLevel = perms[area];
    if (userLevel === "none") {
      return res.status(403).json({ message: "No access" });
    }
    next();
  };
}

function isEffectiveAdmin(req: Request): boolean {
  const u = req.user!;
  return u.isAdmin === 1 || u.isTeamAdmin === 1;
}

function userHasGroupAccess(userGroupScope: string, isAdmin: boolean, recordGroupScope: string): boolean {
  if (isAdmin) return true;
  const userGroups = parseGroupScopes(userGroupScope);
  return userGroups.includes(recordGroupScope);
}

function verifyTeamOwnership(record: any, req: Request): boolean {
  if (!record || record.teamId == null) return true;
  const u = req.user!;
  if (u.isAdmin === 1) return true;
  const teamId = getActiveTeamId(req);
  return record.teamId === teamId;
}

function resolveCreateGroupScope(req: Request): string {
  const u = req.user!;
  const isAdminOrTeamAdmin = u.isAdmin === 1 || u.isTeamAdmin === 1;
  const requestedGroup = req.body.groupScope?.trim();

  if (requestedGroup) {
    if (isAdminOrTeamAdmin) return requestedGroup;
    const userGroups = parseGroupScopes(u.groupScope);
    if (userGroups.includes(requestedGroup)) return requestedGroup;
  }

  return parseGroupScopes(u.groupScope)[0] || u.groupScope;
}

function getActiveTeamId(req: Request): number {
  const u = req.user!;
  // Respect activeTeamId for ALL users — the team-switch route already validates
  // that a user belongs to the target team before setting activeTeamId.
  return (u as any).activeTeamId || u.teamId;
}

function canManageTeam(req: Request): boolean {
  const u = req.user!;
  // Super Admin or global team admin OR per-team admin for the currently active team
  if (u.isAdmin === 1 || u.isTeamAdmin === 1) return true;
  return !!(req.session as any)?.activeTeamIsAdmin;
}

function getAdminTeamScope(req: Request): number | undefined {
  const u = req.user!;
  if (u.isAdmin !== 1) return getActiveTeamId(req);
  const scope = req.query.teamScope as string | undefined;
  if (scope === "all") return undefined;
  if (scope && !isNaN(parseInt(scope))) return parseInt(scope);
  return getActiveTeamId(req);
}

// ─── Maintenance mode (Super Admin only to toggle) ───────────────────────────
let maintenanceMode = false;
let maintenanceReopenAt: string | null = null; // ISO datetime string
// ─────────────────────────────────────────────────────────────────────────────

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {

  app.use("/api", enforceStealthReadOnly);

  // --- Ensure watch tables exist (migration-safe, runs before any route uses them) ---
  {
    const { pool } = await import("./db");
    await (pool as any).query(`
      CREATE TABLE IF NOT EXISTS watch_sessions (
        code VARCHAR(4) PRIMARY KEY,
        ski_pairs TEXT NOT NULL DEFAULT '[]',
        ski_labels TEXT,
        bracket TEXT NOT NULL DEFAULT '[]',
        test_id INTEGER,
        user_id INTEGER NOT NULL DEFAULT 0,
        user_name TEXT NOT NULL DEFAULT '',
        team_id INTEGER,
        created_at TEXT NOT NULL DEFAULT '',
        expires_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS watch_queue (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL,
        test_id INTEGER,
        series_id INTEGER,
        test_name TEXT,
        series_name TEXT,
        added_by_name TEXT NOT NULL DEFAULT '',
        added_at TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        completed_at TEXT,
        session_code TEXT
      );
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS watch_pin TEXT;
      ALTER TABLE watch_sessions ADD COLUMN IF NOT EXISTS ski_labels TEXT;
      ALTER TABLE watch_queue ADD COLUMN IF NOT EXISTS session_code TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS garmin_watch INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS watch_code TEXT;
      CREATE TABLE IF NOT EXISTS user_team_permissions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        team_id INTEGER NOT NULL,
        permissions TEXT NOT NULL
      );
      ALTER TABLE user_team_permissions ADD COLUMN IF NOT EXISTS permissions TEXT;
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'utp_user_team_unique'
        ) THEN
          ALTER TABLE user_team_permissions ADD CONSTRAINT utp_user_team_unique UNIQUE (user_id, team_id);
        END IF;
      END $$;
      ALTER TABLE user_team_permissions ADD COLUMN IF NOT EXISTS group_scope TEXT NOT NULL DEFAULT '';
      ALTER TABLE user_team_permissions ADD COLUMN IF NOT EXISTS is_team_admin INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE watch_sessions ADD COLUMN IF NOT EXISTS operator_name TEXT;
      ALTER TABLE tests ADD COLUMN IF NOT EXISTS watch_operator_name TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS login_locked INTEGER NOT NULL DEFAULT 0;
      CREATE TABLE IF NOT EXISTS grind_profiles (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        grind_type TEXT NOT NULL,
        stone TEXT NOT NULL,
        pattern TEXT NOT NULL,
        extra_params TEXT,
        created_by_name TEXT NOT NULL,
        team_id INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      ALTER TABLE test_entries ADD COLUMN IF NOT EXISTS grind_extra_params TEXT;
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_paused INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
      UPDATE users SET username = email WHERE username IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users(username);
      CREATE TABLE IF NOT EXISTS inbox_messages (
        id SERIAL PRIMARY KEY,
        to_user_id INTEGER NOT NULL,
        from_user_id INTEGER,
        from_name TEXT,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        team_name TEXT
      );
    `);
  }

  // --- Maintenance mode gate (runs before all other /api routes) ---
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    if (!maintenanceMode) return next();
    // Always allow health check, auth, maintenance-mode status, and Garmin watch endpoints
    const exemptPaths = ["/api/health", "/api/admin/maintenance-mode"];
    if (exemptPaths.includes(req.path)) return next();
    // req.path inside app.use("/api", ...) includes the /api prefix
    if (req.path.startsWith("/api/auth/") || req.path.startsWith("/api/watch/") || req.path.startsWith("/api/runsheet/watch")) return next();
    // Super Admins always pass through
    if (req.isAuthenticated() && (req.user as any)?.isAdmin === 1) return next();
    const reopenMsg = maintenanceReopenAt
      ? ` The system will reopen at ${new Date(maintenanceReopenAt).toLocaleString("no-NO", { dateStyle: "short", timeStyle: "short" })}.`
      : " The system will be back shortly.";
    return res.status(503).json({
      message: `Maintenance in progress.${reopenMsg} If you have urgent needs, contact your Team Admin.`,
      maintenance: true,
      reopenAt: maintenanceReopenAt,
    });
  });

  // --- Health check (used by keep-alive ping) ---
  app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

  // --- Teams CRUD ---
  app.get("/api/teams", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin === 1) {
      const list = await storage.listTeams();
      return res.json(list);
    }
    const team = await storage.getTeam(u.teamId);
    res.json(team ? [team] : []);
  });

  app.post("/api/teams", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super admin only" });
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ message: "Name is required" });
    const data: any = { name, createdAt: new Date().toISOString() };
    if (req.body.enabledAreas !== undefined) {
      data.enabledAreas = JSON.stringify(req.body.enabledAreas);
    }
    const team = await storage.createTeam(data);
    res.json(team);
  });

  app.put("/api/teams/:id", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super admin only" });
    const id = parseInt(req.params.id);
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ message: "Name is required" });
    const data: any = { name };
    if (req.body.enabledAreas !== undefined) {
      data.enabledAreas = JSON.stringify(req.body.enabledAreas);
    }
    const updated = await storage.updateTeam(id, data);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });

  app.post("/api/teams/:id/set-default", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super admin only" });
    const id = parseInt(req.params.id);
    const team = await storage.getTeam(id);
    if (!team) return res.status(404).json({ message: "Team not found" });
    await storage.setDefaultTeam(id);
    res.json({ ok: true });
  });

  app.delete("/api/teams/:id", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super admin only" });
    const id = parseInt(req.params.id);
    const team = await storage.getTeam(id);
    if (!team) return res.status(404).json({ message: "Not found" });
    if (team.isDefault === 1) return res.status(400).json({ message: "Cannot delete the default team. Set another team as default first." });
    const deleted = await storage.deleteTeam(id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  // Check whether Google Sheets backup is configured on this server
  app.get("/api/backup/status", requireAuth, async (_req, res) => {
    const { isGoogleSheetsAvailable } = await import('./googleSheets');
    const available = isGoogleSheetsAvailable();
    const mode = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
      ? 'service_account'
      : process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL
      ? 'replit'
      : 'none';
    res.json({ available, mode });
  });

  app.put("/api/teams/:id/backup-sheet", requireAuth, async (req, res) => {
    const u = req.user!;
    const id = parseInt(req.params.id);
    if (u.isAdmin !== 1 && !(u.isTeamAdmin === 1 && u.teamId === id)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const url = req.body.url?.trim() || null;
    if (url && !url.includes('docs.google.com/spreadsheets')) {
      return res.status(400).json({ message: "Must be a Google Sheets URL" });
    }
    const updated = await storage.updateTeam(id, { backupSheetUrl: url });
    if (!updated) return res.status(404).json({ message: "Not found" });
    const { startAutoBackup, stopAutoBackup } = await import('./backup');
    if (url) {
      startAutoBackup(id);
    } else {
      stopAutoBackup(id);
    }
    res.json(updated);
  });

  app.post("/api/teams/:id/backup", requireAuth, async (req, res) => {
    const u = req.user!;
    const id = parseInt(req.params.id);
    if (u.isAdmin !== 1 && !(u.isTeamAdmin === 1 && u.teamId === id)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const { isGoogleSheetsAvailable } = await import('./googleSheets');
    if (!isGoogleSheetsAvailable()) {
      return res.status(503).json({
        message:
          "Google Sheets backup is not configured. Set the GOOGLE_SERVICE_ACCOUNT_JSON environment variable in your Render dashboard.",
      });
    }
    const team = await storage.getTeam(id);
    if (!team) return res.status(404).json({ message: "Team not found" });
    if (!team.backupSheetUrl) return res.status(400).json({ message: "No backup sheet URL configured" });
    const { runBackupForTeam } = await import('./backup');
    const result = await runBackupForTeam(id);
    if (result.success) {
      res.json({ ok: true, lastBackupAt: new Date().toISOString() });
    } else {
      res.status(500).json({ message: result.error || "Backup failed" });
    }
  });

  app.post("/api/teams/switch", requireAuth, async (req, res) => {
    const u = req.user!;
    const teamId = parseInt(req.body.teamId);
    if (!teamId) return res.status(400).json({ message: "teamId required" });
    const team = await storage.getTeam(teamId);
    if (!team) return res.status(404).json({ message: "Team not found" });

    // Super admins can switch to any team; regular users can only switch to their own teams
    if (u.isAdmin !== 1) {
      const memberships = await storage.getUserTeams(u.id);
      const allowed = memberships.map((m) => m.teamId);
      // Also always allow their primary teamId
      if (!allowed.includes(u.teamId)) allowed.push(u.teamId);
      if (!allowed.includes(teamId)) {
        return res.status(403).json({ message: "You do not belong to that team" });
      }
    }

    await storage.updateUser(u.id, { activeTeamId: teamId } as any);

    // Clear stealth when switching to primary team OR any team the user is explicitly a member of
    const memberships = await storage.getUserTeams(u.id);
    const isExplicitMember = teamId === u.teamId || memberships.some(m => m.teamId === teamId);
    if (isExplicitMember && (req.session as any).stealth) {
      (req.session as any).stealth = false;
      const prev = (req.session as any).incognitoBeforeStealth;
      (req.session as any).incognito = !!prev;
      delete (req.session as any).incognitoBeforeStealth;
    }

    // Resolve per-team permissions and group scope for users switching to a non-primary team
    if (u.isAdmin !== 1 && teamId !== u.teamId) {
      try {
        const { pool: p } = await import("./db");
        const tpRes = await (p as any).query(
          "SELECT permissions, group_scope, is_team_admin FROM user_team_permissions WHERE user_id = $1 AND team_id = $2",
          [u.id, teamId]
        );
        if (tpRes.rows.length > 0) {
          (req.session as any).effectivePermissions = tpRes.rows[0].permissions ?? null;
          (req.session as any).effectiveGroupScope = tpRes.rows[0].group_scope ?? u.groupScope;
          (req.session as any).activeTeamIsAdmin = tpRes.rows[0].is_team_admin === 1;
        } else {
          (req.session as any).effectivePermissions = null;
          (req.session as any).effectiveGroupScope = u.groupScope;
          (req.session as any).activeTeamIsAdmin = false;
        }
      } catch (_) {
        (req.session as any).effectivePermissions = null;
        (req.session as any).effectiveGroupScope = null;
        (req.session as any).activeTeamIsAdmin = false;
      }
    } else {
      (req.session as any).effectivePermissions = null;
      (req.session as any).effectiveGroupScope = null;
      (req.session as any).activeTeamIsAdmin = false;
    }

    req.session.save(() => {
      res.json({ ok: true });
    });
  });

  // Get all teams the current user belongs to
  app.get("/api/user/teams", requireAuth, async (req, res) => {
    const u = req.user!;
    const memberships = await storage.getUserTeams(u.id);
    const teamIds = [...new Set([u.teamId, ...memberships.map((m) => m.teamId)])];
    const allTeams = await storage.listTeams();
    const userTeams = allTeams.filter((t) => teamIds.includes(t.id));
    res.json(userTeams);
  });

  // Admin: add a user to a team
  app.post("/api/users/:id/teams", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const userId = parseInt(req.params.id);
    const teamId = parseInt(req.body.teamId);
    if (!teamId) return res.status(400).json({ message: "teamId required" });
    const team = await storage.getTeam(teamId);
    if (!team) return res.status(404).json({ message: "Team not found" });
    await storage.addUserToTeam(userId, teamId);
    res.json({ ok: true });
  });

  // Admin: remove a user from a team
  app.delete("/api/users/:id/teams/:teamId", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const userId = parseInt(req.params.id);
    const teamId = parseInt(req.params.teamId);
    await storage.removeUserFromTeam(userId, teamId);
    // Reset activeTeamId if the user was currently viewing the removed team
    // This prevents them from being stuck on a team they no longer have access to
    const { pool: p2 } = await import("./db");
    await (p2 as any).query(
      `UPDATE users SET active_team_id = NULL WHERE id = $1 AND active_team_id = $2`,
      [userId, teamId]
    );
    res.json({ ok: true });
  });

  // Admin: list teams for a user
  app.get("/api/users/:id/teams", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const userId = parseInt(req.params.id);
    const memberships = await storage.getUserTeams(userId);
    res.json(memberships);
  });

  app.get("/api/groups", requireAuth, async (req, res) => {
    const teamId = canManageTeam(req) ? getAdminTeamScope(req) : getActiveTeamId(req);
    const list = await storage.listGroups(teamId);
    res.json(list);
  });

  app.post("/api/groups", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const u = req.user!;
    const teamId = u.isAdmin === 1 && req.body.teamId ? req.body.teamId : getActiveTeamId(req);
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ message: "Name is required" });
    try {
      const created = await storage.createGroup({ name, teamId });
      res.json(created);
    } catch (e: any) {
      if (e.code === "23505") return res.status(409).json({ message: "Group already exists" });
      throw e;
    }
  });

  app.put("/api/groups/:id", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ message: "Name is required" });
    try {
      const updated = await storage.updateGroup(id, { name });
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (e: any) {
      if (e.code === "23505") return res.status(409).json({ message: "Group already exists" });
      throw e;
    }
  });

  app.delete("/api/groups/:id", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteGroup(id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  app.get("/api/series", requirePermission("testskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const list = await storage.listSeries(u.groupScope, u.isScopeAdmin, teamId);
    res.json(list);
  });

  app.post("/api/series", requirePermission("testskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const now = new Date().toISOString();
    const groupScope = resolveCreateGroupScope(req);
    const result = await storage.createSeries({
      name: req.body.name,
      type: req.body.type,
      brand: req.body.brand?.trim() || null,
      skiType: req.body.skiType?.trim() || null,
      grind: req.body.grind || null,
      numberOfSkis: req.body.numberOfSkis ?? 8,
      pairLabels: req.body.pairLabels || null,
      lastRegrind: req.body.lastRegrind || null,
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
      groupScope,
      teamId,
    });
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "created",
        entityType: "series", entityId: result.id,
        details: `Series: ${result.name}`, createdAt: new Date().toISOString(), groupScope, teamId,
      });
    } catch (_) {}
    res.json(result);
  });

  app.put("/api/series/:id", requirePermission("testskis", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getSeries(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const u = userInfo(req);
    if (!userHasGroupAccess(u.groupScope, u.isScopeAdmin, existing.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const data: any = {
      name: req.body.name,
      type: req.body.type,
      grind: req.body.grind || null,
      numberOfSkis: req.body.numberOfSkis,
      pairLabels: req.body.pairLabels !== undefined ? (req.body.pairLabels || null) : undefined,
      lastRegrind: req.body.lastRegrind || null,
    };
    if (data.pairLabels === undefined) delete data.pairLabels;
    if (req.body.brand !== undefined) data.brand = req.body.brand;
    if (req.body.skiType !== undefined) data.skiType = req.body.skiType;
    if (req.body.groupScope) data.groupScope = req.body.groupScope;
    const updated = await storage.updateSeries(id, data);
    res.json(updated);
  });

  app.get("/api/series/archived", requirePermission("testskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const list = await storage.listArchivedSeries(u.groupScope, u.isScopeAdmin, teamId);
    res.json(list);
  });

  app.post("/api/series/:id/archive", requirePermission("testskis", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getSeries(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const u = userInfo(req);
    if (!userHasGroupAccess(u.groupScope, u.isScopeAdmin, existing.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const updated = await storage.archiveSeries(id);
    res.json(updated);
  });

  app.post("/api/series/:id/restore", requirePermission("testskis", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getSeries(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const u = userInfo(req);
    if (!userHasGroupAccess(u.groupScope, u.isScopeAdmin, existing.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const updated = await storage.restoreSeries(id);
    res.json(updated);
  });

  app.delete("/api/series/:id", requirePermission("testskis", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getSeries(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const u = userInfo(req);
    if (!userHasGroupAccess(u.groupScope, u.isScopeAdmin, existing.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (!existing.archivedAt) {
      return res.status(400).json({ message: "Series must be archived before permanent deletion" });
    }
    await storage.deleteSeries(id);
    res.json({ ok: true });
  });

  app.get("/api/products", requirePermission("products", "view"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const list = await storage.listProducts(u.groupScope, u.isScopeAdmin, teamId);
    res.json(list);
  });

  app.post("/api/products", requirePermission("products", "edit"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const now = new Date().toISOString();
    const groupScope = resolveCreateGroupScope(req);
    const result = await storage.createProduct({
      category: req.body.category,
      brand: req.body.brand.trim(),
      name: req.body.name.trim(),
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
      groupScope,
      teamId,
    });
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "created",
        entityType: "product", entityId: result.id,
        details: `Product: ${result.brand} ${result.name}`, createdAt: new Date().toISOString(), groupScope, teamId,
      });
    } catch (_) {}
    res.json(result);
  });

  app.put("/api/products/:id", requirePermission("products", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const existing = await storage.getProduct(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const data: any = {};
    if (req.body.groupScope !== undefined) {
      if (!u.isScopeAdmin) return res.status(403).json({ message: "Admin only" });
      data.groupScope = req.body.groupScope;
    }
    if (req.body.category !== undefined) data.category = req.body.category;
    if (req.body.brand !== undefined) data.brand = req.body.brand;
    if (req.body.name !== undefined) data.name = req.body.name;
    const updated = await storage.updateProduct(id, data);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });

  app.patch("/api/products/:id/stock", requirePermission("products", "view"), async (req, res) => {
    const id = parseInt(req.params.id);
    const { delta, quantity } = req.body;
    const existing = await storage.getProduct(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const oldQty = existing.stockQuantity ?? 0;
    let newQty: number;
    if (typeof quantity === "number" && Number.isInteger(quantity)) {
      newQty = Math.max(0, quantity);
    } else if (typeof delta === "number" && Number.isInteger(delta)) {
      newQty = Math.max(0, oldQty + delta);
    } else {
      return res.status(400).json({ message: "delta or quantity must be an integer" });
    }
    const updated = await storage.updateProduct(id, { stockQuantity: newQty } as any);
    const u = userInfo(req);
    if (!isIncognito(req)) {
      const change = newQty - oldQty;
      const action = change > 0 ? "stock_added" : change < 0 ? "stock_removed" : "stock_set";
      try {
        await storage.createActivityLog({
          userId: u.id,
          userName: u.name,
          action,
          entityType: "product",
          entityId: id,
          details: `${existing.brand} ${existing.name}: ${oldQty} → ${newQty} (${change >= 0 ? "+" : ""}${change})`,
          createdAt: new Date().toISOString(),
          groupScope: existing.groupScope,
          teamId: getActiveTeamId(req),
        });
      } catch (_) {}
    }
    res.json(updated);
  });

  app.delete("/api/products/:id", requirePermission("products", "edit"), async (req, res) => {
    const u = userInfo(req);
    if (!u.isScopeAdmin) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    const existing = await storage.getProduct(id);
    if (existing && !verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteProduct(id);
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "deleted",
        entityType: "product", entityId: id,
        details: "Product deleted", createdAt: new Date().toISOString(), groupScope: u.groupScope, teamId: getActiveTeamId(req),
      });
    } catch (_) {}
    res.json({ ok: true });
  });

  // Product test history
  app.get("/api/products/:id/tests", requirePermission("products", "view"), async (req, res) => {
    const teamId = getActiveTeamId(req);
    const productId = parseInt(req.params.id);
    const product = await storage.getProduct(productId);
    if (!product) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(product, req)) return res.status(403).json({ message: "Forbidden" });

    const { pool: pg } = await import("./db");
    // Find tests where at least one entry references this product (directly or in additional_product_ids)
    const result = await (pg as any).query(
      `SELECT DISTINCT
         t.id, t.date, t.location, t.test_name, t.test_type, t.notes, t.weather_id,
         t.distance_labels, t.distance_label_0km, t.distance_label_xkm,
         w.air_temperature_c, w.snow_temperature_c, w.air_humidity_pct, w.snow_humidity_pct,
         w.snow_type, w.artificial_snow, w.natural_snow, w.grain_size, w.snow_humidity_type,
         w.track_hardness, w.test_quality, w.wind, w.clouds, w.precipitation
       FROM test_entries te
       JOIN tests t ON t.id = te.test_id
       LEFT JOIN daily_weather w ON w.id = t.weather_id
       WHERE t.team_id = $1
         AND (
           te.product_id = $2
           OR te.additional_product_ids LIKE $3
         )
       ORDER BY t.date DESC, t.id DESC`,
      [teamId, productId, `%${productId}%`]
    );

    const testIds: number[] = result.rows.map((r: any) => r.id);
    let entriesByTestId: Record<number, any[]> = {};
    if (testIds.length > 0) {
      // Fetch ALL entries for these tests so we can show every ski and highlight the selected product
      const entryRows = await (pg as any).query(
        `SELECT te.id, te.test_id, te.ski_number, te.product_id, te.additional_product_ids,
                te.result_0km_cm_behind, te.rank_0km, te.result_xkm_cm_behind, te.rank_xkm,
                te.results, te.feeling_rank,
                p.brand as product_brand, p.name as product_name
         FROM test_entries te
         LEFT JOIN products p ON p.id = te.product_id
         WHERE te.test_id = ANY($1)
         ORDER BY te.ski_number ASC`,
        [testIds]
      );
      for (const e of entryRows.rows) {
        if (!entriesByTestId[e.test_id]) entriesByTestId[e.test_id] = [];
        const isSelectedProduct =
          e.product_id === productId ||
          (e.additional_product_ids && e.additional_product_ids.split(",").map((x: string) => parseInt(x.trim(), 10)).includes(productId));
        entriesByTestId[e.test_id].push({
          id: e.id, skiNumber: e.ski_number,
          productId: e.product_id, additionalProductIds: e.additional_product_ids,
          productBrand: e.product_brand, productName: e.product_name,
          result0kmCmBehind: e.result_0km_cm_behind, rank0km: e.rank_0km,
          resultXkmCmBehind: e.result_xkm_cm_behind, rankXkm: e.rank_xkm,
          results: e.results, feelingRank: e.feeling_rank,
          isSelectedProduct,
        });
      }
    }

    const tests = result.rows.map((r: any) => ({
      id: r.id, date: r.date, location: r.location, testName: r.test_name,
      testType: r.test_type, notes: r.notes,
      distanceLabels: r.distance_labels, distanceLabel0km: r.distance_label_0km, distanceLabelXkm: r.distance_label_xkm,
      weather: r.weather_id ? {
        airTemperatureC: r.air_temperature_c, snowTemperatureC: r.snow_temperature_c,
        airHumidityPct: r.air_humidity_pct, snowHumidityPct: r.snow_humidity_pct,
        snowType: r.snow_type, artificialSnow: r.artificial_snow, naturalSnow: r.natural_snow,
        grainSize: r.grain_size, snowHumidityType: r.snow_humidity_type, trackHardness: r.track_hardness,
        testQuality: r.test_quality, wind: r.wind, clouds: r.clouds, precipitation: r.precipitation,
      } : null,
      entries: entriesByTestId[r.id] || [],
    }));

    res.json({ tests });
  });

  app.post("/api/products/bulk-assign-group", requirePermission("products", "edit"), async (req, res) => {
    const u = userInfo(req);
    if (!u.isScopeAdmin) return res.status(403).json({ message: "Admin only" });
    const { ids, groupScope } = req.body as { ids: number[]; groupScope: string };
    if (!Array.isArray(ids) || !groupScope) return res.status(400).json({ message: "ids and groupScope required" });
    for (const id of ids) {
      await storage.updateProduct(id, { groupScope });
    }
    if (!isIncognito(req) && ids.length > 0) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "updated",
        entityType: "product", entityId: 0,
        details: `Assigned ${ids.length} product(s) to group: ${groupScope}`,
        createdAt: new Date().toISOString(), groupScope: u.groupScope, teamId: getActiveTeamId(req),
      });
    } catch (_) {}
    res.json({ updated: ids.length });
  });

  app.post("/api/products/remove-duplicates", requirePermission("products", "edit"), async (req, res) => {
    const u = userInfo(req);
    if (!u.isScopeAdmin) return res.status(403).json({ message: "Admin only" });
    const teamId = getActiveTeamId(req);
    const all = await storage.listProducts(u.groupScope, u.isScopeAdmin, teamId);
    const seen = new Map<string, number>();
    const toDelete: number[] = [];
    for (const p of all.sort((a, b) => a.id - b.id)) {
      const key = `${p.teamId}|${p.category}|${(p.brand || "").toLowerCase().trim()}|${(p.name || "").toLowerCase().trim()}`;
      if (seen.has(key)) {
        toDelete.push(p.id);
      } else {
        seen.set(key, p.id);
      }
    }
    for (const id of toDelete) {
      await storage.deleteProduct(id);
    }
    if (!isIncognito(req) && toDelete.length > 0) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "deleted",
        entityType: "product", entityId: 0,
        details: `Removed ${toDelete.length} duplicate product(s)`, createdAt: new Date().toISOString(), groupScope: u.groupScope, teamId,
      });
    } catch (_) {}
    res.json({ removed: toDelete.length });
  });

  app.get("/api/weather", requirePermission("weather", "view"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const list = await storage.listWeather(u.groupScope, u.isScopeAdmin, teamId);
    res.json(list);
  });

  app.get("/api/weather/find", requirePermission("weather", "view"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const { date, location } = req.query as { date: string; location: string };
    if (!date || !location) return res.status(400).json({ message: "date and location required" });
    const w = await storage.findWeather(date, location, u.groupScope, teamId);
    res.json(w || null);
  });

  app.post("/api/weather", requirePermission("weather", "edit"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const now = new Date().toISOString();
    const groupScope = resolveCreateGroupScope(req);
    const result = await storage.createWeather({
      date: req.body.date,
      time: req.body.time,
      location: req.body.location.trim(),
      snowTemperatureC: req.body.snowTemperatureC,
      airTemperatureC: req.body.airTemperatureC,
      snowHumidityPct: req.body.snowHumidityPct,
      airHumidityPct: req.body.airHumidityPct,
      clouds: req.body.clouds ?? null,
      visibility: req.body.visibility?.trim() || null,
      wind: req.body.wind?.trim() || null,
      precipitation: req.body.precipitation?.trim() || null,
      artificialSnow: req.body.artificialSnow || null,
      naturalSnow: req.body.naturalSnow || null,
      grainSize: req.body.grainSize || null,
      snowHumidityType: req.body.snowHumidityType || null,
      trackHardness: req.body.trackHardness || null,
      testQuality: req.body.testQuality ?? null,
      snowType: req.body.snowType?.trim() || null,
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
      groupScope,
      teamId,
    });
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "created",
        entityType: "weather", entityId: result.id,
        details: `Weather: ${req.body.date} ${req.body.location}`, createdAt: new Date().toISOString(), groupScope, teamId,
      });
    } catch (_) {}
    res.json(result);
  });

  app.put("/api/weather/:id", requirePermission("weather", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getWeather(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const u = userInfo(req);
    if (!userHasGroupAccess(u.groupScope, u.isScopeAdmin, existing.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const updated = await storage.updateWeather(id, {
      date: req.body.date,
      time: req.body.time,
      location: req.body.location.trim(),
      snowTemperatureC: req.body.snowTemperatureC,
      airTemperatureC: req.body.airTemperatureC,
      snowHumidityPct: req.body.snowHumidityPct,
      airHumidityPct: req.body.airHumidityPct,
      clouds: req.body.clouds ?? null,
      visibility: req.body.visibility?.trim() || null,
      wind: req.body.wind?.trim() || null,
      precipitation: req.body.precipitation?.trim() || null,
      artificialSnow: req.body.artificialSnow || null,
      naturalSnow: req.body.naturalSnow || null,
      grainSize: req.body.grainSize || null,
      snowHumidityType: req.body.snowHumidityType || null,
      trackHardness: req.body.trackHardness || null,
      testQuality: req.body.testQuality ?? null,
      snowType: req.body.snowType?.trim() || null,
    });
    res.json(updated);
  });

  app.delete("/api/weather/:id", requirePermission("weather", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getWeather(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const u = userInfo(req);
    if (!userHasGroupAccess(u.groupScope, u.isScopeAdmin, existing.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteWeather(id);
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "deleted",
        entityType: "weather", entityId: id,
        details: "Weather deleted", createdAt: new Date().toISOString(), groupScope: existing.groupScope, teamId: getActiveTeamId(req),
      });
    } catch (_) {}
    res.json({ ok: true });
  });

  app.get("/api/tests", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    let result: any[] = [];
    const seenIds = new Set<number>();

    if (u.isScopeAdmin) {
      // Team Admin / Super Admin: see all tests in their active team
      const all = await storage.listAllTestsForTeam(teamId);
      for (const t of all) { result.push(t); seenIds.add(t.id); }
    } else {
      // Non-raceski tests: only visible when 'tests' permission is granted
      // Retroactive: losing permission removes access to all previous tests too
      if (u.permissions.tests !== "none") {
        const scopedTests = await storage.listTests(u.groupScope, false, teamId);
        for (const t of scopedTests) {
          if (!seenIds.has(t.id) && (t as any).testSkiSource !== "raceskis") {
            result.push(t);
            seenIds.add(t.id);
          }
        }
      }

      // Raceski tests: only visible when 'raceskis' permission is granted AND user has athlete access
      if (u.permissions.raceskis !== "none") {
        const athleteIds = await storage.listAthleteIdsForUser(u.id);
        if (athleteIds.length > 0) {
          const allTeamTests = await storage.listAllTestsForTeam(teamId);
          for (const t of allTeamTests) {
            if (!seenIds.has(t.id) && (t as any).testSkiSource === "raceskis" &&
                (t as any).athleteId && athleteIds.includes((t as any).athleteId)) {
              result.push(t);
              seenIds.add(t.id);
            }
          }
        }
      }

      // Filter out grinding tests if no grinding permission
      if (u.permissions.grinding === "none") {
        result = result.filter((t: any) => t.testType !== "Grind");
      }
    }

    const seriesIds = [...new Set(result.filter((t: any) => t.seriesId).map((t: any) => t.seriesId))];
    let seriesNameMap: Record<number, string> = {};
    if (seriesIds.length > 0) {
      const seriesList = await db.select({ id: testSkiSeries.id, name: testSkiSeries.name }).from(testSkiSeries).where(inArray(testSkiSeries.id, seriesIds));
      for (const s of seriesList) seriesNameMap[s.id] = s.name;
    }
    const enriched = result.map((t: any) => ({ ...t, seriesName: t.seriesId ? (seriesNameMap[t.seriesId] || null) : null }));
    res.json(enriched);
  });

  app.post("/api/tests", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const testSkiSourceCheck = req.body.testSkiSource === "raceskis" ? "raceskis" : "series";
    let canCreateTest = u.isAdmin || u.isTeamAdmin || u.permissions.tests === "edit"
      || (testSkiSourceCheck === "raceskis" && u.permissions.raceskis !== "none");
    if (!canCreateTest && testSkiSourceCheck === "raceskis" && req.body.athleteId) {
      canCreateTest = await storage.hasAthleteAccess(req.body.athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    }
    if (!canCreateTest) return res.status(403).json({ message: "No access" });
    if (req.body.testType === "Grind" && u.permissions.grinding === "none") {
      return res.status(403).json({ message: "Grinding access required" });
    }
    const now = new Date().toISOString();
    const groupScope = resolveCreateGroupScope(req);
    const testSkiSource = req.body.testSkiSource === "raceskis" ? "raceskis" : "series";
    const raceOnly = ["Classic", "Skating", "Double Poling"];
    const seriesOnly = ["Glide", "Structure", "Grind"];
    if (testSkiSource === "raceskis" && seriesOnly.includes(req.body.testType)) {
      return res.status(400).json({ message: "Race ski tests only allow Classic, Skating, or Double Poling" });
    }
    if (testSkiSource !== "raceskis" && raceOnly.includes(req.body.testType)) {
      return res.status(400).json({ message: "Classic/Skating/Double Poling are only for race ski tests" });
    }

    const entries = req.body.entries || [];
    if (testSkiSource === "raceskis") {
      const raceSkiIds = entries.map((e: any) => e.raceSkiId).filter(Boolean);
      if (raceSkiIds.length > 0) {
        const allowedSkis = await storage.listAllRaceSkisForUser(u.id, u.isScopeAdmin);
        const allowedIds = new Set(allowedSkis.map((s: any) => s.id));
        for (const rsId of raceSkiIds) {
          if (!allowedIds.has(rsId)) {
            return res.status(403).json({ message: "Access denied to race ski " + rsId });
          }
        }
      }
    }

    const test = await storage.createTest({
      date: req.body.date,
      location: req.body.location.trim(),
      testName: req.body.testName?.trim() || null,
      weatherId: req.body.weatherId || null,
      testType: req.body.testType,
      seriesId: testSkiSource === "raceskis" ? null : req.body.seriesId,
      athleteId: testSkiSource === "raceskis" ? (req.body.athleteId || null) : null,
      testSkiSource,
      notes: req.body.notes?.trim() || null,
      distanceLabel0km: req.body.distanceLabel0km?.trim() || null,
      distanceLabelXkm: req.body.distanceLabelXkm?.trim() || null,
      distanceLabels: req.body.distanceLabels || null,
      grindParameters: req.body.grindParameters || null,
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
      groupScope,
      teamId,
    });
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "created",
        entityType: "test", entityId: test.id,
        details: `Test: ${req.body.testType} on ${req.body.date}`, createdAt: new Date().toISOString(), groupScope, teamId,
      });
    } catch (_) {}

    for (const e of entries) {
      await storage.createEntry({
        testId: test.id,
        skiNumber: e.skiNumber,
        productId: e.productId || null,
        freeTextProduct: e.freeTextProduct || null,
        additionalProductIds: e.additionalProductIds || null,
        methodology: e.methodology || "",
        result0kmCmBehind: e.result0kmCmBehind ?? null,
        rank0km: e.rank0km ?? null,
        resultXkmCmBehind: e.resultXkmCmBehind ?? null,
        rankXkm: e.rankXkm ?? null,
        results: e.results || null,
        feelingRank: e.feelingRank ?? null,
        kickRank: e.kickRank ?? null,
        grindType: e.grindType || null,
        grindStone: e.grindStone || null,
        grindPattern: e.grindPattern || null,
        grindExtraParams: e.grindExtraParams || null,
        raceSkiId: e.raceSkiId || null,
        createdAt: now,
        createdById: u.id,
        createdByName: u.name,
        groupScope,
        teamId,
      });
    }

    res.json(test);
  });

  app.get("/api/tests/recent-results", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const isBlind = req.user!.isBlindTester === 1;
    const teamId = getActiveTeamId(req);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 50);

    // Reuse the same access-control logic as GET /api/tests
    let allTests: any[] = [];
    const seenIds = new Set<number>();
    if (u.isScopeAdmin) {
      const all = await storage.listAllTestsForTeam(teamId);
      for (const t of all) { allTests.push(t); seenIds.add(t.id); }
    } else {
      if (u.permissions.tests !== "none") {
        const scopedTests = await storage.listTests(u.groupScope, false, teamId);
        for (const t of scopedTests) {
          if (!seenIds.has(t.id) && (t as any).testSkiSource !== "raceskis") { allTests.push(t); seenIds.add(t.id); }
        }
      }
      if (u.permissions.raceskis !== "none") {
        const athleteIds = await storage.listAthleteIdsForUser(u.id);
        if (athleteIds.length > 0) {
          const allTeamTests = await storage.listAllTestsForTeam(teamId);
          for (const t of allTeamTests) {
            if (!seenIds.has(t.id) && (t as any).testSkiSource === "raceskis" && (t as any).athleteId && athleteIds.includes((t as any).athleteId)) {
              allTests.push(t); seenIds.add(t.id);
            }
          }
        }
      }
    }
    if (u.permissions.grinding === "none") {
      allTests = allTests.filter((t: any) => t.testType !== "Grind");
    }
    const allTestIds = allTests.map((t: any) => t.id);
    if (allTestIds.length === 0) return res.json([]);
    const allEntries = await storage.listAllEntriesForTests(allTestIds);

    const latestEntryByTest: Record<number, string> = {};
    for (const e of allEntries) {
      const tid = (e as any).testId;
      const cat = (e as any).createdAt || "";
      if (!latestEntryByTest[tid] || cat > latestEntryByTest[tid]) {
        latestEntryByTest[tid] = cat;
      }
    }

    const testsWithResults = allTests.filter((t: any) => latestEntryByTest[t.id]);
    testsWithResults.sort((a: any, b: any) => (latestEntryByTest[b.id] || "").localeCompare(latestEntryByTest[a.id] || ""));
    const sorted = testsWithResults.slice(0, limit);

    const sortedIds = new Set(sorted.map((t: any) => t.id));
    const entries = allEntries.filter((e: any) => sortedIds.has(e.testId));

    const productIds = new Set<number>();
    for (const e of entries) {
      if ((e as any).productId) productIds.add((e as any).productId);
    }
    const productMap: Record<number, any> = {};
    for (const pid of productIds) {
      const p = await storage.getProduct(pid);
      if (p) productMap[pid] = { id: p.id, brand: p.brand, name: p.name };
    }
    const result = sorted.map((t: any) => {
      const testEntries = entries.filter((e: any) => e.testId === t.id);
      const winner = testEntries.find((e: any) => e.rank0km === 1);
      const winnerProduct = winner && (winner as any).productId ? productMap[(winner as any).productId] : null;
      const entryCount = testEntries.length;
      const hasResults = testEntries.some((e: any) => e.rank0km !== null);
      return {
        id: t.id,
        date: t.date,
        location: t.location,
        testName: (t as any).testName || null,
        testType: t.testType,
        createdByName: t.createdByName,
        createdAt: t.createdAt,
        lastResultAt: latestEntryByTest[t.id] || t.createdAt,
        entryCount,
        hasResults,
        winnerProduct: isBlind ? null : winnerProduct,
        winnerSkiNumber: isBlind ? null : (winner?.skiNumber ?? null),
      };
    });
    res.json(result);
  });

  app.get("/api/tests/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const test = await storage.getTest(id);
    if (!test) return res.status(404).json({ message: "Not found" });
    const u = userInfo(req);
    if (!verifyTeamOwnership(test, req)) return res.status(403).json({ message: "Forbidden" });
    // Permissions are enforced retroactively — losing access removes all prior tests
    let hasAccess = false;
    if (u.isScopeAdmin) {
      hasAccess = true;
    } else if ((test as any).testSkiSource === "raceskis") {
      // Raceski test: must have raceskis permission AND athlete access
      if (u.permissions.raceskis !== "none" && (test as any).athleteId) {
        hasAccess = await storage.hasAthleteAccess((test as any).athleteId, u.id, false, getActiveTeamId(req));
      }
    } else {
      // Regular test: must have tests permission AND be in the same group
      if (u.permissions.tests !== "none") {
        hasAccess = userHasGroupAccess(u.groupScope, u.isScopeAdmin, test.groupScope);
      }
    }
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    if ((test as any).testType === "Grind" && u.permissions.grinding === "none") {
      return res.status(403).json({ message: "Grinding access required" });
    }
    res.json(test);
  });

  app.post("/api/tests/:id/share", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super admin only" });
    const testId = parseInt(req.params.id);
    const rawIds = req.body.targetTeamIds;
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return res.status(400).json({ message: "targetTeamIds must be a non-empty array" });
    }
    const targetTeamIds = [...new Set(rawIds.map(Number).filter((n: number) => !isNaN(n) && n > 0))] as number[];
    if (targetTeamIds.length === 0) {
      return res.status(400).json({ message: "targetTeamIds must contain valid team IDs" });
    }
    const sourceTest = await storage.getTest(testId);
    if (!sourceTest) return res.status(404).json({ message: "Test not found" });
    const sourceEntries = await storage.listEntries(testId);
    const now = new Date().toISOString();
    const sharedTeamNames: string[] = [];
    const sharerName = `Shared by ${u.name}`;
    const sharerId = u.id;

    const allProductIds = new Set<number>();
    for (const entry of sourceEntries) {
      if (entry.productId) allProductIds.add(entry.productId);
      if (entry.additionalProductIds) {
        for (const idStr of entry.additionalProductIds.split(",")) {
          const id = parseInt(idStr.trim(), 10);
          if (!isNaN(id) && id > 0) allProductIds.add(id);
        }
      }
    }
    const sourceProducts = new Map<number, any>();
    for (const pid of allProductIds) {
      const p = await storage.getProduct(pid);
      if (p) sourceProducts.set(pid, p);
    }

    for (const targetTeamId of targetTeamIds) {
      if (targetTeamId === sourceTest.teamId) continue;
      const team = await storage.getTeam(targetTeamId);
      if (!team) continue;
      const teamGroups = await storage.listGroups(targetTeamId);
      const defaultGroup = teamGroups.length > 0 ? teamGroups[0].name : "default";

      const existingProducts = await storage.listProducts("", true, targetTeamId);
      const productIdMap = new Map<number, number>();

      await db.transaction(async (tx) => {
        for (const [sourceId, srcProd] of sourceProducts) {
          const match = existingProducts.find(
            (ep) => ep.brand === srcProd.brand && ep.name === srcProd.name && ep.category === srcProd.category
          );
          if (match) {
            productIdMap.set(sourceId, match.id);
          } else {
            const [newProd] = await tx.insert(products).values({
              category: srcProd.category,
              brand: srcProd.brand,
              name: srcProd.name,
              createdAt: now,
              createdById: sharerId,
              createdByName: sharerName,
              groupScope: defaultGroup,
              teamId: targetTeamId,
              stockQuantity: 0,
            }).returning();
            productIdMap.set(sourceId, newProd.id);
            existingProducts.push(newProd);
          }
        }

        let newWeatherId: number | null = null;
        if (sourceTest.weatherId) {
          const srcWeather = await storage.getWeather(sourceTest.weatherId);
          if (srcWeather) {
            const [newW] = await tx.insert(dailyWeather).values({
              date: srcWeather.date,
              time: srcWeather.time,
              location: srcWeather.location,
              snowTemperatureC: srcWeather.snowTemperatureC,
              airTemperatureC: srcWeather.airTemperatureC,
              snowHumidityPct: srcWeather.snowHumidityPct,
              airHumidityPct: srcWeather.airHumidityPct,
              clouds: srcWeather.clouds ?? null,
              visibility: srcWeather.visibility || null,
              wind: srcWeather.wind || null,
              precipitation: srcWeather.precipitation || null,
              artificialSnow: srcWeather.artificialSnow || null,
              naturalSnow: srcWeather.naturalSnow || null,
              grainSize: srcWeather.grainSize || null,
              snowHumidityType: srcWeather.snowHumidityType || null,
              trackHardness: srcWeather.trackHardness || null,
              testQuality: srcWeather.testQuality ?? null,
              snowType: srcWeather.snowType || null,
              createdAt: now,
              createdById: sharerId,
              createdByName: sharerName,
              groupScope: defaultGroup,
              teamId: targetTeamId,
            }).returning();
            newWeatherId = newW.id;
          }
        }

        const [newTest] = await tx.insert(tests).values({
          date: sourceTest.date,
          location: sourceTest.location,
          testName: sourceTest.testName || null,
          weatherId: newWeatherId,
          testType: sourceTest.testType,
          testSkiSource: sourceTest.testSkiSource || "series",
          seriesId: null,
          athleteId: null,
          notes: sourceTest.notes || null,
          grindParameters: sourceTest.grindParameters || null,
          distanceLabel0km: sourceTest.distanceLabel0km || null,
          distanceLabelXkm: sourceTest.distanceLabelXkm || null,
          distanceLabels: sourceTest.distanceLabels || null,
          createdAt: now,
          createdById: sharerId,
          createdByName: sharerName,
          groupScope: defaultGroup,
          teamId: targetTeamId,
        }).returning();

        for (const entry of sourceEntries) {
          const mappedProductId = entry.productId ? (productIdMap.get(entry.productId) || null) : null;
          let mappedAdditionalIds: string | null = null;
          if (entry.additionalProductIds) {
            const mapped = entry.additionalProductIds.split(",").map((s) => {
              const id = parseInt(s.trim(), 10);
              return !isNaN(id) && id > 0 ? (productIdMap.get(id) || id) : id;
            });
            mappedAdditionalIds = mapped.join(",");
          }

          await tx.insert(testEntries).values({
            testId: newTest.id,
            skiNumber: entry.skiNumber,
            productId: mappedProductId,
            additionalProductIds: mappedAdditionalIds,
            freeTextProduct: entry.freeTextProduct || null,
            methodology: entry.methodology || "",
            result0kmCmBehind: entry.result0kmCmBehind ?? null,
            rank0km: entry.rank0km ?? null,
            resultXkmCmBehind: entry.resultXkmCmBehind ?? null,
            rankXkm: entry.rankXkm ?? null,
            results: entry.results || null,
            feelingRank: entry.feelingRank ?? null,
            kickRank: entry.kickRank ?? null,
            grindType: entry.grindType || null,
            grindStone: entry.grindStone || null,
            grindPattern: entry.grindPattern || null,
            grindExtraParams: entry.grindExtraParams || null,
            raceSkiId: null,
            createdAt: now,
            createdById: sharerId,
            createdByName: sharerName,
            groupScope: defaultGroup,
            teamId: targetTeamId,
          });
        }
      });
      sharedTeamNames.push(team.name);
    }
    res.json({ success: true, sharedTeams: sharedTeamNames });
  });

  app.put("/api/tests/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getTest(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const u = userInfo(req);
    // Creator can always edit their own test
    let hasAccess = (existing as any).createdById === u.id;
    if (!hasAccess) hasAccess = userHasGroupAccess(u.groupScope, u.isScopeAdmin, existing.groupScope) && u.permissions.tests === "edit";
    if (!hasAccess && (existing as any).testSkiSource === "raceskis" && (existing as any).athleteId) {
      hasAccess = await storage.hasAthleteAccess((existing as any).athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    }
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const testSkiSource = req.body.testSkiSource === "raceskis" ? "raceskis" : (existing as any).testSkiSource || "series";
    const raceOnly = ["Classic", "Skating", "Double Poling"];
    const seriesOnly = ["Glide", "Structure", "Grind"];
    if (testSkiSource === "raceskis" && seriesOnly.includes(req.body.testType)) {
      return res.status(400).json({ message: "Race ski tests only allow Classic, Skating, or Double Poling" });
    }
    if (testSkiSource !== "raceskis" && raceOnly.includes(req.body.testType)) {
      return res.status(400).json({ message: "Classic/Skating/Double Poling are only for race ski tests" });
    }
    const testData: any = {
      date: req.body.date,
      location: req.body.location?.trim(),
      testName: req.body.testName !== undefined ? (req.body.testName?.trim() || null) : undefined,
      weatherId: req.body.weatherId || null,
      testType: req.body.testType,
      seriesId: testSkiSource === "raceskis" ? null : req.body.seriesId,
      testSkiSource,
      notes: req.body.notes?.trim() || null,
      distanceLabel0km: req.body.distanceLabel0km?.trim() || null,
      distanceLabelXkm: req.body.distanceLabelXkm?.trim() || null,
      distanceLabels: req.body.distanceLabels || null,
      grindParameters: req.body.grindParameters ?? null,
    };
    if (req.body.groupScope) testData.groupScope = req.body.groupScope;

    if (req.body.entries && testSkiSource === "raceskis") {
      const raceSkiIds = req.body.entries.map((e: any) => e.raceSkiId).filter(Boolean);
      if (raceSkiIds.length > 0) {
        const allowedSkis = await storage.listAllRaceSkisForUser(u.id, u.isScopeAdmin);
        const allowedIds = new Set(allowedSkis.map((s: any) => s.id));
        for (const rsId of raceSkiIds) {
          if (!allowedIds.has(rsId)) {
            return res.status(403).json({ message: "Access denied to race ski " + rsId });
          }
        }
      }
    }

    const updated = await storage.updateTest(id, testData);

    if (req.body.entries) {
      await storage.deleteEntriesByTestId(id);
      const now = new Date().toISOString();
      const groupScope = req.body.groupScope || existing.groupScope;
      const teamId = getActiveTeamId(req);
      for (const e of req.body.entries) {
        await storage.createEntry({
          testId: id,
          skiNumber: e.skiNumber,
          productId: e.productId || null,
          freeTextProduct: e.freeTextProduct || null,
          additionalProductIds: e.additionalProductIds || null,
          methodology: e.methodology || "",
          result0kmCmBehind: e.result0kmCmBehind ?? null,
          rank0km: e.rank0km ?? null,
          resultXkmCmBehind: e.resultXkmCmBehind ?? null,
          rankXkm: e.rankXkm ?? null,
          results: e.results || null,
          feelingRank: e.feelingRank ?? null,
          kickRank: e.kickRank ?? null,
          grindType: e.grindType || null,
          grindStone: e.grindStone || null,
          grindPattern: e.grindPattern || null,
          grindExtraParams: e.grindExtraParams || null,
          raceSkiId: e.raceSkiId || null,
          createdAt: now,
          createdById: u.id,
          createdByName: u.name,
          groupScope,
          teamId,
        });
      }
    }

    res.json(updated);
  });

  app.patch("/api/tests/:id/runsheet-results", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getTest(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const u = userInfo(req);
    const canEditTests = userHasGroupAccess(u.groupScope, u.isScopeAdmin, existing.groupScope) && (u.permissions.tests === "edit" || u.permissions.tests === "view");
    let hasAccess = canEditTests;
    if (!hasAccess && (existing as any).testSkiSource === "raceskis" && (existing as any).athleteId) {
      hasAccess = await storage.hasAthleteAccess((existing as any).athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    }
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });

    const results = req.body.results;
    const bracket = req.body.bracket;
    if (!Array.isArray(results)) return res.status(400).json({ message: "results array required" });
    for (const r of results) {
      if (typeof r.skiNumber !== "number" || (r.diff !== null && r.diff !== undefined && typeof r.diff !== "number") || (r.rank !== null && r.rank !== undefined && typeof r.rank !== "number")) {
        return res.status(400).json({ message: "Invalid result item: skiNumber (number), diff (number|null), rank (number|null) required" });
      }
    }

    const entries = await storage.listEntries(id);
    const entryBySkiNumber = new Map(entries.map((e: any) => [e.skiNumber, e]));

    for (const r of results) {
      const entry = entryBySkiNumber.get(r.skiNumber);
      if (!entry) continue;
      await storage.updateEntryResults((entry as any).id, r.diff ?? null, r.rank ?? null);
    }

    if (Array.isArray(bracket)) {
      await db.update(tests).set({ runsheetBracket: JSON.stringify(bracket) }).where(eq(tests.id, id));
    }

    if (!isIncognito(req)) {
      await storage.createActivityLog({
        userId: u.id,
        userName: u.name,
        action: "runsheet_applied",
        entityType: "test",
        entityId: id,
        details: `Applied runsheet results to test ${existing.location} (${existing.date})`,
        createdAt: new Date().toISOString(),
        groupScope: existing.groupScope,
        teamId: getActiveTeamId(req),
      });
    }

    res.json({ success: true });
  });

  app.get("/api/tests/:id/runsheet-progress", requireAuth, async (req, res) => {
    const testId = parseInt(req.params.id);
    const u = userInfo(req);
    const row = await db.select().from(runsheetProgress).where(
      and(
        eq(runsheetProgress.testId, testId),
        eq(runsheetProgress.userId, u.id),
        sql`${runsheetProgress.completedAt} IS NULL`
      )
    ).limit(1);
    if (row.length === 0) return res.json(null);
    try {
      res.json({ bracket: JSON.parse(row[0].bracket), updatedAt: row[0].updatedAt });
    } catch {
      res.json(null);
    }
  });

  app.put("/api/tests/:id/runsheet-progress", requireAuth, async (req, res) => {
    const testId = parseInt(req.params.id);
    const u = userInfo(req);
    const { bracket } = req.body;
    if (!Array.isArray(bracket)) return res.status(400).json({ message: "bracket array required" });
    const now = new Date().toISOString();
    const bracketJson = JSON.stringify(bracket);
    const existing = await db.select({ id: runsheetProgress.id }).from(runsheetProgress).where(
      and(eq(runsheetProgress.testId, testId), eq(runsheetProgress.userId, u.id))
    ).limit(1);
    if (existing.length > 0) {
      await db.update(runsheetProgress)
        .set({ bracket: bracketJson, updatedAt: now, completedAt: null })
        .where(eq(runsheetProgress.id, existing[0].id));
    } else {
      await db.insert(runsheetProgress).values({
        testId,
        userId: u.id,
        bracket: bracketJson,
        updatedAt: now,
        completedAt: null,
      });
    }
    res.json({ ok: true });
  });

  app.post("/api/tests/:id/runsheet-progress/complete", requireAuth, async (req, res) => {
    const testId = parseInt(req.params.id);
    const u = userInfo(req);
    const now = new Date().toISOString();
    await db.update(runsheetProgress)
      .set({ completedAt: now, updatedAt: now })
      .where(and(eq(runsheetProgress.testId, testId), eq(runsheetProgress.userId, u.id)));
    res.json({ ok: true });
  });

  app.delete("/api/tests/:id/runsheet-progress", requireAuth, async (req, res) => {
    const testId = parseInt(req.params.id);
    const u = userInfo(req);
    await db.delete(runsheetProgress).where(
      and(eq(runsheetProgress.testId, testId), eq(runsheetProgress.userId, u.id))
    );
    res.json({ ok: true });
  });

  app.get("/api/live-runsheets", requireAuth, requirePermission("liverunsheets", "view"), async (req, res) => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayIso = todayStart.toISOString();

      const rows = await db
        .select({
          id: runsheetProgress.id,
          testId: runsheetProgress.testId,
          userId: runsheetProgress.userId,
          bracket: runsheetProgress.bracket,
          updatedAt: runsheetProgress.updatedAt,
          completedAt: runsheetProgress.completedAt,
          userName: users.name,
          testDate: tests.date,
          testLocation: tests.location,
          testName: tests.testName,
          testType: tests.testType,
          seriesId: tests.seriesId,
          testSkiSource: tests.testSkiSource,
        })
        .from(runsheetProgress)
        .innerJoin(users, eq(users.id, runsheetProgress.userId))
        .innerJoin(tests, eq(tests.id, runsheetProgress.testId))
        .where(sql`${runsheetProgress.updatedAt} >= ${todayIso} AND ${tests.teamId} = ${getActiveTeamId(req)}`);

      const seriesIds = [...new Set(rows.filter(r => r.seriesId).map(r => r.seriesId!))];
      let seriesMap: Record<number, { name: string; pairLabels: string | null }> = {};
      if (seriesIds.length > 0) {
        const seriesList = await db
          .select({ id: testSkiSeries.id, name: testSkiSeries.name, pairLabels: testSkiSeries.pairLabels })
          .from(testSkiSeries)
          .where(inArray(testSkiSeries.id, seriesIds));
        for (const s of seriesList) {
          seriesMap[s.id] = { name: s.name, pairLabels: s.pairLabels };
        }
      }

      const result = rows.map(r => {
        let bracket: any = null;
        try { bracket = JSON.parse(r.bracket); } catch {}
        let pairLabels: Record<string, string> | null = null;
        const seriesInfo = r.seriesId ? seriesMap[r.seriesId] : null;
        const rawPl = seriesInfo?.pairLabels;
        try { if (rawPl) pairLabels = JSON.parse(rawPl); } catch {}
        return {
          id: r.id,
          testId: r.testId,
          userId: r.userId,
          userName: r.userName,
          testDate: r.testDate,
          testLocation: r.testLocation,
          testName: r.testName,
          testType: r.testType,
          seriesName: seriesInfo?.name || null,
          testSkiSource: r.testSkiSource,
          pairLabels,
          bracket,
          updatedAt: r.updatedAt,
          completedAt: r.completedAt,
        };
      });

      // Also include active watch sessions that were started from the Watch Queue today
      try {
        const todayIsoStr = todayIso;
        const watchRows = await db
          .select({
            code: watchSessions.code,
            testId: watchSessions.testId,
            userId: watchSessions.userId,
            userName: watchSessions.userName,
            operatorName: watchSessions.operatorName,
            teamId: watchSessions.teamId,
            bracket: watchSessions.bracket,
            createdAt: watchSessions.createdAt,
            expiresAt: watchSessions.expiresAt,
            testDate: tests.date,
            testLocation: tests.location,
            testName: tests.testName,
            testType: tests.testType,
            seriesId: tests.seriesId,
            testSkiSource: tests.testSkiSource,
          })
          .from(watchSessions)
          .innerJoin(tests, eq(tests.id, watchSessions.testId!))
          .where(
            sql`${watchSessions.teamId} = ${getActiveTeamId(req)}
              AND ${watchSessions.createdAt} >= ${todayIsoStr}
              AND ${watchSessions.expiresAt} > ${new Date().toISOString()}
              AND ${watchSessions.testId} IS NOT NULL`
          );

        const watchSeriesIds = [...new Set(watchRows.filter(r => r.seriesId).map(r => r.seriesId!))];
        const watchSeriesMap: Record<number, { name: string; pairLabels: string | null }> = {};
        if (watchSeriesIds.length > 0) {
          const wSeriesList = await db
            .select({ id: testSkiSeries.id, name: testSkiSeries.name, pairLabels: testSkiSeries.pairLabels })
            .from(testSkiSeries)
            .where(inArray(testSkiSeries.id, watchSeriesIds));
          for (const s of wSeriesList) watchSeriesMap[s.id] = { name: s.name, pairLabels: s.pairLabels };
        }

        // Also pull in-memory sessions not in DB yet (same team, today, has testId)
        const todayMs = new Date(todayIsoStr).getTime();
        const nowMs = Date.now();
        const teamIdNum = getActiveTeamId(req);
        const seenCodes = new Set(watchRows.map(r => r.code));
        for (const [code, ws] of watchSessionsMemory.entries()) {
          if (ws.teamId !== teamIdNum) continue;
          if (ws.createdAt < todayMs) continue;
          if (!ws.testId) continue;
          // Check not expired
          if (seenCodes.has(code)) continue;
          seenCodes.add(code);
          // Fetch test info for this session
          try {
            const tRows = await db.select({ date: tests.date, location: tests.location, testName: tests.testName, testType: tests.testType, seriesId: tests.seriesId, testSkiSource: tests.testSkiSource })
              .from(tests).where(eq(tests.id, ws.testId));
            if (tRows[0]) {
              const t = tRows[0];
              let wPairLabels: Record<string, string> | null = null;
              if (ws.skiLabels) {
                wPairLabels = Object.fromEntries(Object.entries(ws.skiLabels).map(([k, v]) => [k, String(v)]));
              }
              result.push({
                id: -(code as any), // negative numeric id to distinguish
                testId: ws.testId,
                userId: ws.userId,
                userName: ws.userName,
                operatorName: ws.operatorName ?? null,
                testDate: t.date,
                testLocation: t.location ?? "",
                testName: t.testName,
                testType: t.testType,
                seriesName: t.seriesId ? (watchSeriesMap[t.seriesId]?.name ?? null) : null,
                testSkiSource: t.testSkiSource ?? "series",
                pairLabels: wPairLabels,
                bracket: ws.bracket,
                updatedAt: new Date(ws.createdAt).toISOString(),
                completedAt: null,
                isWatchSession: true,
              });
            }
          } catch (_) {}
        }

        for (const wr of watchRows) {
          let wBracket: any = null;
          try { wBracket = JSON.parse(wr.bracket); } catch {}
          const wSeriesInfo = wr.seriesId ? watchSeriesMap[wr.seriesId] : null;
          let wPairLabels: Record<string, string> | null = null;
          try {
            if (wSeriesInfo?.pairLabels) wPairLabels = JSON.parse(wSeriesInfo.pairLabels);
          } catch {}
          // Avoid duplicates if already added from memory
          const existingIdx = result.findIndex(r => r.testId === wr.testId && r.userName === wr.userName && (r as any).isWatchSession);
          if (existingIdx >= 0) continue;
          result.push({
            id: -(parseInt(wr.code) || 0),
            testId: wr.testId!,
            userId: wr.userId,
            userName: wr.userName,
            operatorName: (wr as any).operatorName ?? null,
            testDate: wr.testDate,
            testLocation: wr.testLocation ?? "",
            testName: wr.testName,
            testType: wr.testType,
            seriesName: wSeriesInfo?.name ?? null,
            testSkiSource: wr.testSkiSource ?? "series",
            pairLabels: wPairLabels,
            bracket: wBracket,
            updatedAt: wr.createdAt,
            completedAt: null,
            isWatchSession: true,
          });
        }
      } catch (watchErr: any) {
        // Non-fatal — watch session merge is best-effort
        console.warn("live-runsheets watch merge error:", watchErr?.message);
      }

      res.json(result);
    } catch (e: any) {
      console.error("live-runsheets error:", e.stack || e.message || e);
      res.status(500).json({ message: e.message || "Failed to fetch live runsheets" });
    }
  });

  app.delete("/api/tests/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getTest(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const u = userInfo(req);
    // Creator can always delete their own test
    let hasAccess = (existing as any).createdById === u.id;
    if (!hasAccess) hasAccess = userHasGroupAccess(u.groupScope, u.isScopeAdmin, existing.groupScope) && u.permissions.tests === "edit";
    if (!hasAccess && (existing as any).testSkiSource === "raceskis" && (existing as any).athleteId) {
      hasAccess = await storage.hasAthleteAccess((existing as any).athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    }
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteRunsheetsByTestId(id);
    await storage.deleteTest(id);
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "deleted",
        entityType: "test", entityId: id,
        details: "Test deleted", createdAt: new Date().toISOString(), groupScope: existing.groupScope, teamId: getActiveTeamId(req),
      });
    } catch (_) {}
    res.json({ ok: true });
  });

  app.get("/api/tests/:id/entries", requireAuth, async (req, res) => {
    const testId = parseInt(req.params.id as string);
    const u = userInfo(req);
    const test = await storage.getTest(testId);
    if (!test) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(test, req)) return res.status(403).json({ message: "Forbidden" });
    // Own tests always accessible
    let hasAccess = (test as any).createdById === u.id;
    if (!hasAccess) hasAccess = userHasGroupAccess(u.groupScope, u.isScopeAdmin, test.groupScope) && u.permissions.tests !== "none";
    if (!hasAccess && (test as any).testSkiSource === "raceskis" && (test as any).athleteId) {
      hasAccess = await storage.hasAthleteAccess((test as any).athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    }
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if ((test as any).testType === "Grind" && u.permissions.grinding === "none" && (test as any).createdById !== u.id) {
      return res.status(403).json({ message: "Grinding access required" });
    }
    const entries = await storage.listEntries(testId);
    if (req.user!.isBlindTester === 1) {
      const redacted = entries.map((e: any) => ({
        ...e,
        productId: null,
        additionalProductIds: null,
        freeTextProduct: null,
        methodology: null,
      }));
      return res.json(redacted);
    }
    res.json(entries);
  });

  app.get("/api/users", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const teamId = getAdminTeamScope(req);
    const list = await storage.listUsers(teamId);
    res.json(list.map(({ password, ...rest }) => rest));
  });

  app.post("/api/users", requireAuth, async (req, res) => {
    const u = req.user!;
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const existing = await storage.getUserByEmail(req.body.email);
    if (existing) return res.status(409).json({ message: "Email already in use" });
    const pwError = validatePassword(req.body.password);
    if (pwError) return res.status(400).json({ message: pwError });
    let sanitizedPerms = sanitizePermissions(req.body.permissions);
    const teamId = u.isAdmin === 1 ? (req.body.teamId || getActiveTeamId(req)) : u.teamId;
    const isSuperAdmin = u.isAdmin === 1;
    if (!isSuperAdmin) {
      sanitizedPerms = await enforceTeamAreas(sanitizedPerms, teamId);
    }
    const hashedPw = await hashPassword(req.body.password);
    // Derive username: use provided username, or fall back to email prefix
    let usernameToSet = req.body.username?.trim()?.toLowerCase() || null;
    if (!usernameToSet) {
      usernameToSet = req.body.email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");
    }
    // Ensure uniqueness by appending number if needed
    const { pool: pgUser } = await import("./db");
    let finalUsername = usernameToSet;
    let suffix = 2;
    while (true) {
      const existingUn = await (pgUser as any).query(`SELECT id FROM users WHERE LOWER(username) = $1`, [finalUsername]);
      if (existingUn.rows.length === 0) break;
      finalUsername = `${usernameToSet}${suffix++}`;
    }
    const created = await storage.createUser({
      email: req.body.email,
      password: hashedPw,
      name: req.body.name,
      username: finalUsername,
      groupScope: req.body.groupScope,
      isAdmin: isSuperAdmin && req.body.isAdmin ? 1 : 0,
      isTeamAdmin: req.body.isTeamAdmin ? 1 : 0,
      permissions: JSON.stringify(sanitizedPerms),
      teamId,
      isBlindTester: req.body.isBlindTester ? 1 : 0,
    } as any);
    const { password, ...safe } = created;
    res.json(safe);
  });

  app.put("/api/users/:id", requireAuth, async (req, res) => {
    const u = req.user!;
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    if (u.isTeamAdmin === 1 && u.isAdmin !== 1) {
      const targetUser = await storage.getUser(id);
      if (!targetUser || targetUser.teamId !== u.teamId) {
        return res.status(403).json({ message: "Can only manage users in your team" });
      }
    }
    const data: any = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.email !== undefined) data.email = req.body.email;
    if (req.body.username !== undefined && req.body.username.trim()) {
      const newUsername = req.body.username.trim().toLowerCase();
      const { pool: pgEdit } = await import("./db");
      const existing = await (pgEdit as any).query(`SELECT id FROM users WHERE LOWER(username) = $1 AND id != $2`, [newUsername, id]);
      if (existing.rows.length > 0) return res.status(409).json({ message: "Username already taken" });
      data.username = newUsername;
    }
    if (req.body.groupScope !== undefined) data.groupScope = req.body.groupScope;
    if (u.isAdmin === 1 && req.body.isAdmin !== undefined) data.isAdmin = req.body.isAdmin ? 1 : 0;
    if (req.body.isTeamAdmin !== undefined) data.isTeamAdmin = req.body.isTeamAdmin ? 1 : 0;
    if (req.body.permissions !== undefined) {
      let perms = sanitizePermissions(req.body.permissions);
      if (u.isAdmin !== 1) {
        const targetTeamId = data.teamId || (await storage.getUser(id))?.teamId;
        perms = await enforceTeamAreas(perms, targetTeamId);
      }
      data.permissions = JSON.stringify(perms);
    }
    if (req.body.isActive !== undefined) data.isActive = req.body.isActive ? 1 : 0;
    if (u.isAdmin === 1 && req.body.teamId !== undefined) data.teamId = req.body.teamId;
    if (req.body.isBlindTester !== undefined) data.isBlindTester = req.body.isBlindTester ? 1 : 0;
    const updated = await storage.updateUser(id, data);
    if (!updated) return res.status(404).json({ message: "Not found" });
    const { password, ...safe } = updated;
    res.json(safe);
  });

  app.post("/api/users/:id/reset-password", requireAuth, async (req, res) => {
    const u = req.user!;
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    if (u.isTeamAdmin === 1 && u.isAdmin !== 1) {
      const targetUser = await storage.getUser(id);
      if (!targetUser || targetUser.teamId !== u.teamId) {
        return res.status(403).json({ message: "Can only manage users in your team" });
      }
    }
    const newPassword = req.body.password || "password";
    const pwError = validatePassword(newPassword);
    if (pwError) return res.status(400).json({ message: pwError });
    const hashedPw = await hashPassword(newPassword);
    const updated = await storage.updateUser(id, { password: hashedPw, failedAttempts: 0, loginLocked: 0 });
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  app.delete("/api/users/:id", requireAuth, async (req, res) => {
    const u = req.user!;
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    if (id === u.id) return res.status(400).json({ message: "Cannot delete yourself" });
    if (u.isTeamAdmin === 1 && u.isAdmin !== 1) {
      const targetUser = await storage.getUser(id);
      if (!targetUser || targetUser.teamId !== u.teamId) {
        return res.status(403).json({ message: "Can only manage users in your team" });
      }
    }
    const deleted = await storage.deleteUser(id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  // Unlock a locked account (Team Admin or SA)
  app.post("/api/users/:id/unlock", requireAuth, async (req, res) => {
    const u = req.user!;
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    if (u.isTeamAdmin === 1 && u.isAdmin !== 1) {
      const targetUser = await storage.getUser(id);
      if (!targetUser || targetUser.teamId !== u.teamId) {
        return res.status(403).json({ message: "Can only manage users in your team" });
      }
    }
    const { pool: pg } = await import("./db");
    await (pg as any).query(
      "UPDATE users SET failed_attempts = 0, login_locked = 0 WHERE id = $1",
      [id]
    );
    res.json({ ok: true });
  });

  // --- Garmin Watch access per-user ---
  app.put("/api/users/:id/garmin-watch", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    const { pool: p } = await import("./db");
    const enabled = !!req.body.enabled;
    await (p as any).query("UPDATE users SET garmin_watch = $1 WHERE id = $2", [enabled ? 1 : 0, id]);
    res.json({ ok: true, garminWatch: enabled });
  });

  // --- Per-team permissions for multi-team users ---
  app.get("/api/users/:id/team-permissions", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const userId = parseInt(req.params.id);
    const { pool: p } = await import("./db");
    const result = await (p as any).query(
      "SELECT team_id, permissions, group_scope, is_team_admin FROM user_team_permissions WHERE user_id = $1",
      [userId]
    );
    res.json(result.rows.map((r: any) => ({ ...r, isTeamAdmin: r.is_team_admin === 1 || r.is_team_admin === true })));
  });

  app.put("/api/users/:id/team-permissions/:teamId", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const userId = parseInt(req.params.id);
    const teamId = parseInt(req.params.teamId);
    const u = req.user!;
    // Team admins can only manage users within their own team
    if (u.isAdmin !== 1) {
      if (teamId !== u.teamId) return res.status(403).json({ message: "Cannot manage permissions for other teams" });
    }
    let perms = sanitizePermissions(req.body.permissions);
    if (u.isAdmin !== 1) {
      perms = await enforceTeamAreas(perms, teamId);
    }
    const { pool: p } = await import("./db");
    const groupScope = req.body.groupScope !== undefined ? String(req.body.groupScope) : "";
    const isTeamAdmin = req.body.isTeamAdmin ? 1 : 0;
    await (p as any).query(
      `INSERT INTO user_team_permissions (user_id, team_id, permissions, group_scope, is_team_admin)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ON CONSTRAINT utp_user_team_unique DO UPDATE SET permissions = $3, group_scope = $4, is_team_admin = $5`,
      [userId, teamId, JSON.stringify(perms), groupScope, isTeamAdmin]
    );
    res.json({ ok: true });
  });

  app.delete("/api/users/:id/team-permissions/:teamId", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const userId = parseInt(req.params.id);
    const teamId = parseInt(req.params.teamId);
    const { pool: p } = await import("./db");
    await (p as any).query(
      "DELETE FROM user_team_permissions WHERE user_id = $1 AND team_id = $2",
      [userId, teamId]
    );
    res.json({ ok: true });
  });

  app.get("/api/login-logs", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const teamId = getAdminTeamScope(req);
    const logs = await storage.listLoginLogs(teamId);
    res.json(logs);
  });

  app.post("/api/action-log", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const { action, details } = req.body;
    if (!action) return res.status(400).json({ message: "action required" });
    const ip = req.headers["x-forwarded-for"]
      ? String(req.headers["x-forwarded-for"]).split(",")[0].trim()
      : req.socket.remoteAddress || "unknown";
    if (!isIncognito(req)) {
      await storage.createLoginLog({
        userId: u.id,
        email: u.email,
        name: u.name,
        loginAt: new Date().toISOString(),
        ipAddress: ip,
        action,
        details: details || null,
      });
    }
    res.json({ ok: true });
  });

  app.get("/api/stock-changes", requirePermission("products", "view"), async (req, res) => {
    const teamId = getActiveTeamId(req);
    const limit = parseInt(req.query.limit as string) || 500;
    const logs = await storage.listStockChanges(limit, teamId);
    res.json(logs);
  });

  // Activity feed
  app.get("/api/activity", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const limit = parseInt(req.query.limit as string) || 50;
    const teamId = getAdminTeamScope(req);
    const logs = await storage.listActivityLogs(limit, teamId);
    res.json(logs);
  });

  // Profile - change own password
  app.post("/api/users/me/password", requireAuth, async (req, res) => {
    const u = req.user!;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: "Both current and new password required" });
    const { verifyPassword, hashPassword: hp } = await import("./auth");
    const valid = await verifyPassword(currentPassword, u.password);
    if (!valid) return res.status(403).json({ message: "Current password is incorrect" });
    const pwError = validatePassword(newPassword);
    if (pwError) return res.status(400).json({ message: pwError });
    const hashed = await hp(newPassword);
    await storage.updateUser(u.id, { password: hashed });
    res.json({ ok: true });
  });

  // Change own username
  app.put("/api/users/me/username", requireAuth, async (req, res) => {
    const u = req.user!;
    const { username } = req.body;
    if (!username || typeof username !== "string" || username.trim().length < 2) {
      return res.status(400).json({ message: "Username must be at least 2 characters" });
    }
    const clean = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]+$/.test(clean)) {
      return res.status(400).json({ message: "Username may only contain letters, numbers, dots, underscores and dashes" });
    }
    const { pool } = await import("./db");
    // Check uniqueness
    const existing = await (pool as any).query(
      `SELECT id FROM users WHERE LOWER(username) = $1 AND id != $2`,
      [clean, u.id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "Username already taken" });
    }
    await storage.updateUser(u.id, { username: clean } as any);
    // Update session
    (u as any).username = clean;
    return res.json({ ok: true, username: clean });
  });

  // Alias used by My Account page
  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    const u = req.user!;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: "Both current and new password required" });
    const { verifyPassword, hashPassword: hp } = await import("./auth");
    const valid = await verifyPassword(currentPassword, u.password);
    if (!valid) return res.status(403).json({ message: "Current password is incorrect" });
    const pwError = validatePassword(newPassword);
    if (pwError) return res.status(400).json({ message: pwError });
    const hashed = await hp(newPassword);
    await storage.updateUser(u.id, { password: hashed });
    res.json({ ok: true });
  });

  // Location history — unique locations from tests for the current team
  app.get("/api/locations/history", requireAuth, async (req, res) => {
    const teamId = getActiveTeamId(req);
    const { pool: pg } = await import("./db");
    try {
      const result = await (pg as any).query(
        `SELECT DISTINCT location FROM tests WHERE team_id = $1 AND location IS NOT NULL AND location != '' ORDER BY location`,
        [teamId]
      );
      const locations = result.rows.map((r: any) => r.location as string).filter(Boolean);
      return res.json(locations);
    } catch {
      return res.json([]);
    }
  });

  // Personal watch code — GET returns existing code (generates if missing), POST regenerates
  app.get("/api/auth/my-watch-code", requireAuth, async (req, res) => {
    const u = req.user!;
    const { pool } = await import("./db");
    const row = await (pool as any).query("SELECT watch_code FROM users WHERE id = $1", [u.id]);
    let code: string = row.rows[0]?.watch_code;
    if (!code) {
      // Generate a unique 4-digit code
      let attempts = 0;
      do {
        code = String(Math.floor(1000 + Math.random() * 9000));
        const conflict = await (pool as any).query("SELECT id FROM users WHERE watch_code = $1 AND id != $2", [code, u.id]);
        if (conflict.rows.length === 0) break;
        attempts++;
      } while (attempts < 20);
      await (pool as any).query("UPDATE users SET watch_code = $1 WHERE id = $2", [code, u.id]);
    }
    res.json({ watchCode: code });
  });

  app.post("/api/auth/my-watch-code/regenerate", requireAuth, async (req, res) => {
    const u = req.user!;
    const { pool } = await import("./db");
    let code: string;
    let attempts = 0;
    do {
      code = String(Math.floor(1000 + Math.random() * 9000));
      const conflict = await (pool as any).query("SELECT id FROM users WHERE watch_code = $1 AND id != $2", [code!, u.id]);
      if (conflict.rows.length === 0) break;
      attempts++;
    } while (attempts < 20);
    await (pool as any).query("UPDATE users SET watch_code = $1 WHERE id = $2", [code!, u.id]);
    res.json({ watchCode: code! });
  });

  // Resolve personal watch code → user name (used by Garmin app, no auth required)
  app.get("/api/watch/resolve-user/:code", async (req, res) => {
    const { code } = req.params;
    if (!/^\d{4}$/.test(code)) return res.status(400).json({ message: "Invalid code" });
    const { pool } = await import("./db");
    const row = await (pool as any).query(
      "SELECT id, name FROM users WHERE watch_code = $1 AND is_active = 1", [code]
    );
    if (!row.rows[0]) return res.status(404).json({ message: "Code not found" });
    res.json({ userId: row.rows[0].id, userName: row.rows[0].name });
  });

  // Grinding records
  app.get("/api/grinding", requirePermission("grinding", "view"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const list = await storage.listGrindingRecords(u.groupScope, u.isScopeAdmin, teamId);
    res.json(list);
  });

  app.post("/api/grinding", requirePermission("grinding", "edit"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const groupScope = resolveCreateGroupScope(req);
    const record = await storage.createGrindingRecord({
      seriesId: req.body.seriesId || null,
      date: req.body.date,
      grindType: req.body.grindType,
      stone: req.body.stone || null,
      notes: req.body.notes || null,
      createdAt: new Date().toISOString(),
      createdById: u.id,
      createdByName: u.name,
      groupScope,
      teamId,
    });
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "created",
        entityType: "grinding", entityId: record.id,
        details: `Grinding: ${record.grindType}`, createdAt: new Date().toISOString(), groupScope, teamId,
      });
    } catch (_) {}
    res.json(record);
  });

  app.put("/api/grinding/:id", requirePermission("grinding", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getGrindingRecord(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateGrindingRecord(id, {
      seriesId: req.body.seriesId,
      date: req.body.date,
      grindType: req.body.grindType,
      stone: req.body.stone || null,
      notes: req.body.notes || null,
    });
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });

  app.delete("/api/grinding/:id", requirePermission("grinding", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getGrindingRecord(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteGrindingRecord(id);
    res.json({ ok: true });
  });

  app.get("/api/grinding-sheets", requirePermission("grinding", "view"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const sheets = await storage.listGrindingSheets(u.groupScope, u.isScopeAdmin, teamId);
    res.json(sheets);
  });

  app.post("/api/grinding-sheets", requirePermission("grinding", "edit"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const { name, url } = req.body;
    if (!name || !url) return res.status(400).json({ message: "Name and URL are required" });
    if (!url.includes("docs.google.com")) return res.status(400).json({ message: "Only Google Sheets URLs are supported" });
    const sheet = await storage.createGrindingSheet({
      name,
      url,
      createdAt: new Date().toISOString(),
      createdById: u.id,
      createdByName: u.name,
      groupScope: u.groupScope.split(",")[0].trim(),
      teamId,
    });
    res.json(sheet);
  });

  app.put("/api/grinding-sheets/:id", requirePermission("grinding", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const existing = await storage.getGrindingSheet(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    if (!u.isScopeAdmin) {
      const scopes = u.groupScope.split(",").map((s: string) => s.trim());
      if (!scopes.includes(existing.groupScope)) return res.status(403).json({ message: "No access" });
    }
    const { name, url } = req.body;
    if (url && !url.includes("docs.google.com")) return res.status(400).json({ message: "Only Google Sheets URLs are supported" });
    const updated = await storage.updateGrindingSheet(id, { name, url });
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });

  app.delete("/api/grinding-sheets/:id", requirePermission("grinding", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const existing = await storage.getGrindingSheet(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    if (!u.isScopeAdmin) {
      const scopes = u.groupScope.split(",").map((s: string) => s.trim());
      if (!scopes.includes(existing.groupScope)) return res.status(403).json({ message: "No access" });
    }
    const deleted = await storage.deleteGrindingSheet(id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  // Grind Profiles
  app.get("/api/grind-profiles", requirePermission("grinding", "view"), async (req, res) => {
    const teamId = getActiveTeamId(req);
    const profiles = await storage.listGrindProfiles(teamId);
    res.json(profiles);
  });

  app.post("/api/grind-profiles", requirePermission("grinding", "edit"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const { name, grindType, stone, pattern, extraParams } = req.body;
    if (!name || !grindType || !stone || !pattern) {
      return res.status(400).json({ message: "name, grindType, stone, and pattern are required" });
    }
    const profile = await storage.createGrindProfile({
      name,
      grindType,
      stone,
      pattern,
      extraParams: extraParams ? JSON.stringify(extraParams) : null,
      createdByName: u.name,
      teamId,
      createdAt: new Date().toISOString(),
    });
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "created",
        entityType: "grind_profile", entityId: profile.id,
        details: `Grind profile: ${profile.name}`, createdAt: new Date().toISOString(),
        groupScope: u.groupScope.split(",")[0].trim(), teamId,
      });
    } catch (_) {}
    res.json(profile);
  });

  app.put("/api/grind-profiles/:id", requirePermission("grinding", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getGrindProfile(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const { name, grindType, stone, pattern, extraParams } = req.body;
    if (!name || !grindType || !stone || !pattern) {
      return res.status(400).json({ message: "name, grindType, stone, and pattern are required" });
    }
    const updated = await storage.updateGrindProfile(id, {
      name,
      grindType,
      stone,
      pattern,
      extraParams: extraParams ? JSON.stringify(extraParams) : null,
    });
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });

  app.post("/api/grind-profiles/:id/duplicate", requirePermission("grinding", "edit"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const id = parseInt(req.params.id);
    const existing = await storage.getGrindProfile(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const copy = await storage.createGrindProfile({
      name: `${existing.name} (copy)`,
      grindType: existing.grindType,
      stone: existing.stone,
      pattern: existing.pattern,
      extraParams: existing.extraParams,
      createdByName: u.name,
      teamId,
      createdAt: new Date().toISOString(),
    });
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "duplicated",
        entityType: "grind_profile", entityId: copy.id,
        details: `Duplicated grind profile: ${existing.name}`, createdAt: new Date().toISOString(),
        groupScope: u.groupScope.split(",")[0].trim(), teamId,
      });
    } catch (_) {}
    res.json(copy);
  });

  app.delete("/api/grind-profiles/:id", requirePermission("grinding", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getGrindProfile(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    const deleted = await storage.deleteGrindProfile(id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  // Grind profile test history — returns tests whose entries match this profile's grind params
  app.get("/api/grind-profiles/:id/tests", requirePermission("grinding", "view"), async (req, res) => {
    const teamId = getActiveTeamId(req);
    const profileId = parseInt(req.params.id);
    const profile = await storage.getGrindProfile(profileId);
    if (!profile) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(profile, req)) return res.status(403).json({ message: "Forbidden" });

    const { pool: pg } = await import("./db");
    // Entries store grindType as the PROFILE NAME (profile.name), not profile.grindType.
    // Stone/pattern matching is secondary — also match entries that use the profile name alone.
    const stoneIsEmpty = !profile.stone;
    const patternIsEmpty = !profile.pattern;
    const result = await (pg as any).query(
      `SELECT DISTINCT
         t.id, t.date, t.location, t.test_name, t.weather_id, t.test_type, t.notes,
         t.distance_labels, t.distance_label_0km, t.distance_label_xkm,
         t.series_id, t.created_by_name, t.created_at, t.group_scope,
         w.air_temperature_c, w.snow_temperature_c, w.air_humidity_pct as humidity, w.snow_type as weather_type
       FROM test_entries te
       JOIN tests t ON t.id = te.test_id
       LEFT JOIN daily_weather w ON w.id = t.weather_id
       WHERE te.team_id = $1
         AND (
           te.grind_type ILIKE $2
           OR (
             te.grind_type ILIKE $3
             AND ($4::boolean OR te.grind_stone ILIKE $5)
             AND ($6::boolean OR te.grind_pattern ILIKE $7)
           )
         )
       ORDER BY t.date DESC, t.id DESC`,
      [teamId, profile.name, profile.grindType, stoneIsEmpty, profile.stone || '', patternIsEmpty, profile.pattern || '']
    );

    // For each test, fetch its entries
    const testIds: number[] = result.rows.map((r: any) => r.id);
    let entriesByTestId: Record<number, any[]> = {};
    if (testIds.length > 0) {
      const entryRows = await (pg as any).query(
        `SELECT te.*, rs.model as ski_model, rs.brand as ski_brand
         FROM test_entries te
         LEFT JOIN race_skis rs ON rs.id = te.race_ski_id
         WHERE te.test_id = ANY($1) AND te.team_id = $2
           AND (
             te.grind_type ILIKE $3
             OR (
               te.grind_type ILIKE $4
               AND ($5::boolean OR te.grind_stone ILIKE $6)
               AND ($7::boolean OR te.grind_pattern ILIKE $8)
             )
           )
         ORDER BY te.ski_number ASC`,
        [testIds, teamId, profile.name, profile.grindType, stoneIsEmpty, profile.stone || '', patternIsEmpty, profile.pattern || '']
      );
      for (const e of entryRows.rows) {
        if (!entriesByTestId[e.test_id]) entriesByTestId[e.test_id] = [];
        entriesByTestId[e.test_id].push({
          id: e.id, testId: e.test_id, skiNumber: e.ski_number,
          productId: e.product_id, raceSkiId: e.race_ski_id,
          skiModel: e.ski_model, skiBrand: e.ski_brand,
          methodology: e.methodology,
          result0kmCmBehind: e.result_0km_cm_behind, rank0km: e.rank_0km,
          resultXkmCmBehind: e.result_xkm_cm_behind, rankXkm: e.rank_xkm,
          results: e.results, feelingRank: e.feeling_rank, kickRank: e.kick_rank,
          grindType: e.grind_type, grindStone: e.grind_stone,
          grindPattern: e.grind_pattern, grindExtraParams: e.grind_extra_params,
        });
      }
    }

    const tests = result.rows.map((r: any) => ({
      id: r.id, date: r.date, location: r.location, testName: r.test_name,
      weatherId: r.weather_id, testType: r.test_type, notes: r.notes,
      distanceLabels: r.distance_labels, distanceLabel0km: r.distance_label_0km,
      distanceLabelXkm: r.distance_label_xkm, seriesId: r.series_id,
      createdByName: r.created_by_name, createdAt: r.created_at, groupScope: r.group_scope,
      weather: r.weather_id ? {
        airTemperatureC: r.air_temperature_c, snowTemperatureC: r.snow_temperature_c,
        humidity: r.humidity, weatherType: r.weather_type,
      } : null,
      entries: entriesByTestId[r.id] || [],
    }));

    res.json({ profile, tests });
  });

  // Admin stats
  app.get("/api/admin/stats", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const teamId = getAdminTeamScope(req);
    const [userCount, testCount, productCount, seriesCount, weatherCount, grindingCount, loginCount, activityCount] = await Promise.all([
      storage.countTable("users", teamId),
      storage.countTable("tests", teamId),
      storage.countTable("products", teamId),
      storage.countTable("testSkiSeries", teamId),
      storage.countTable("dailyWeather", teamId),
      storage.countTable("grindingRecords", teamId),
      storage.countTable("loginLogs", teamId),
      storage.countTable("activityLogs", teamId),
    ]);
    res.json({ userCount, testCount, productCount, seriesCount, weatherCount, grindingCount, loginCount, activityCount });
  });

  app.get("/api/admin/full-export", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const teamId = getActiveTeamId(req);
    const [allTests, allWeather, allSeries, allProducts, allUsers, allGroups, allLoginLogs, allActivities, allAthletes] = await Promise.all([
      storage.listAllTestsForTeam(teamId),
      storage.listAllWeatherForTeam(teamId),
      storage.listSeries(u.groupScope, true, teamId),
      storage.listProducts(u.groupScope, true, teamId),
      storage.listUsers(teamId),
      storage.listGroups(teamId),
      storage.listLoginLogs(teamId),
      storage.listActivityLogs(5000, teamId),
      storage.listAthletes(u.id, true, teamId),
    ]);
    const testIds = allTests.map((t: any) => t.id);
    const allEntries = await storage.listAllEntriesForTests(testIds);
    const entriesByTest: Record<number, any[]> = {};
    for (const e of allEntries) {
      if (!entriesByTest[e.testId]) entriesByTest[e.testId] = [];
      entriesByTest[e.testId].push(e);
    }
    const allRaceSkis: any[] = [];
    for (const ath of allAthletes) {
      const skis = await storage.listAllRaceSkisIncludingArchived(ath.id);
      allRaceSkis.push(...skis.map((s) => ({ ...s, athleteName: ath.name })));
    }
    const grindingRecords = await storage.listGrindingRecords(u.groupScope, true, teamId);
    const grindingSheetsList = await storage.listGrindingSheets(u.groupScope, true, teamId);
    const allRaceSkiRegrinds: any[] = [];
    for (const ski of allRaceSkis) {
      const regrinds = await storage.listRaceSkiRegrinds(ski.id);
      allRaceSkiRegrinds.push(...regrinds.map((r) => ({ ...r, skiId: ski.skiId, athleteName: ski.athleteName, brand: ski.brand })));
    }
    const allTestSkiRegrinds: any[] = [];
    for (const series of allSeries) {
      const regrinds = await storage.listTestSkiRegrinds(series.id);
      allTestSkiRegrinds.push(...regrinds.map((r) => ({ ...r, seriesName: series.name })));
    }
    const grindProfilesList = await storage.listGrindProfiles(teamId);
    res.json({
      tests: allTests,
      entriesByTest,
      weather: allWeather,
      series: allSeries,
      products: allProducts,
      users: allUsers.map(({ password, ...rest }) => rest),
      groups: allGroups,
      loginLogs: allLoginLogs,
      activities: allActivities,
      athletes: allAthletes,
      raceSkis: allRaceSkis,
      grindingRecords,
      grindingSheets: grindingSheetsList,
      raceSkiRegrinds: allRaceSkiRegrinds,
      testSkiRegrinds: allTestSkiRegrinds,
      grindProfiles: grindProfilesList,
    });
  });

  app.post("/api/admin/import", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const u = userInfo(req);
    const teamId = getActiveTeamId(req) ?? u.teamId;
    const data = req.body;

    if (!data || typeof data !== "object") {
      return res.status(400).json({ message: "Invalid import data" });
    }

    const result = { series: 0, products: 0, tests: 0, entries: 0, weather: 0, skipped: 0 };

    // Import series
    const seriesIdMap: Record<number, number> = {};
    if (Array.isArray(data.series)) {
      const existingSeries = await storage.listSeries(u.groupScope, true, teamId);
      for (const s of data.series) {
        const exists = existingSeries.find((e) => e.name === s.name && e.type === s.type);
        if (exists) {
          seriesIdMap[s.id] = exists.id;
          result.skipped++;
        } else {
          const created = await storage.createSeries({
            name: s.name,
            type: s.type,
            brand: s.brand || null,
            skiType: s.skiType || null,
            grind: s.grind || null,
            numberOfSkis: s.numberOfSkis ?? 8,
            lastRegrind: s.lastRegrind || null,
            createdAt: new Date().toISOString(),
            createdById: u.id,
            createdByName: u.name,
            groupScope: s.groupScope || u.groupScope,
            teamId,
            pairLabels: s.pairLabels || null,
            archivedAt: null,
          });
          seriesIdMap[s.id] = created.id;
          result.series++;
        }
      }
    }

    // Import products
    const productIdMap: Record<number, number> = {};
    if (Array.isArray(data.products)) {
      const existingProducts = await storage.listProducts(u.groupScope, true, teamId);
      for (const p of data.products) {
        const exists = existingProducts.find((e) => e.brand === p.brand && e.name === p.name);
        if (exists) {
          productIdMap[p.id] = exists.id;
          result.skipped++;
        } else {
          const created = await storage.createProduct({
            category: p.category || "Other",
            brand: p.brand || "",
            name: p.name,
            createdAt: new Date().toISOString(),
            createdById: u.id,
            createdByName: u.name,
            groupScope: p.groupScope || u.groupScope,
            teamId,
            stockQuantity: p.stockQuantity ?? 0,
          });
          productIdMap[p.id] = created.id;
          result.products++;
        }
      }
    }

    // Import tests + entries
    if (Array.isArray(data.tests)) {
      const existingTests = await storage.listTests(u.groupScope, true, teamId);
      for (const t of data.tests) {
        const exists = existingTests.find(
          (e) => e.date === t.date && e.location === t.location && e.testType === t.testType
        );
        if (exists) {
          result.skipped++;
          continue;
        }
        const newSeriesId = t.seriesId ? (seriesIdMap[t.seriesId] ?? t.seriesId) : null;
        const created = await storage.createTest({
          date: t.date,
          location: t.location,
          testName: t.testName || null,
          weatherId: null,
          testType: t.testType,
          testSkiSource: t.testSkiSource || "series",
          seriesId: newSeriesId,
          athleteId: t.athleteId || null,
          notes: t.notes || null,
          grindParameters: t.grindParameters || null,
          distanceLabel0km: t.distanceLabel0km || null,
          distanceLabelXkm: t.distanceLabelXkm || null,
          distanceLabels: t.distanceLabels || null,
          createdAt: new Date().toISOString(),
          createdById: u.id,
          createdByName: u.name,
          groupScope: t.groupScope || u.groupScope,
          teamId,
        });
        result.tests++;

        const entries = data.entriesByTest?.[t.id] ?? [];
        for (const e of entries) {
          const newProductId = e.productId ? (productIdMap[e.productId] ?? null) : null;
          const additionalIds = e.additionalProductIds
            ? e.additionalProductIds.split(",").map((id: string) => {
                const n = parseInt(id);
                return productIdMap[n] ?? n;
              }).join(",")
            : null;
          await storage.createEntry({
            testId: created.id,
            skiNumber: e.skiNumber,
            productId: newProductId,
            additionalProductIds: additionalIds,
            freeTextProduct: e.freeTextProduct || null,
            methodology: e.methodology || "",
            result0kmCmBehind: e.result0kmCmBehind ?? null,
            rank0km: e.rank0km ?? null,
            resultXkmCmBehind: e.resultXkmCmBehind ?? null,
            rankXkm: e.rankXkm ?? null,
            results: e.results || null,
            feelingRank: e.feelingRank ?? null,
            kickRank: e.kickRank ?? null,
            grindType: e.grindType || null,
            grindStone: e.grindStone || null,
            grindPattern: e.grindPattern || null,
            grindExtraParams: e.grindExtraParams || null,
            raceSkiId: null,
            createdAt: new Date().toISOString(),
            createdById: u.id,
            createdByName: u.name,
            groupScope: e.groupScope || u.groupScope,
            teamId,
          });
          result.entries++;
        }
      }
    }

    // Import weather
    if (Array.isArray(data.weather)) {
      for (const w of data.weather) {
        const exists = await storage.findWeather(w.date, w.location, w.groupScope || u.groupScope, teamId);
        if (exists) {
          result.skipped++;
          continue;
        }
        await storage.createWeather({
          date: w.date,
          time: w.time || "12:00",
          location: w.location,
          snowTemperatureC: w.snowTemperatureC,
          airTemperatureC: w.airTemperatureC,
          snowHumidityPct: w.snowHumidityPct,
          airHumidityPct: w.airHumidityPct,
          clouds: w.clouds ?? null,
          visibility: w.visibility || null,
          wind: w.wind || null,
          precipitation: w.precipitation || null,
          artificialSnow: w.artificialSnow || null,
          naturalSnow: w.naturalSnow || null,
          grainSize: w.grainSize || null,
          snowHumidityType: w.snowHumidityType || null,
          trackHardness: w.trackHardness || null,
          testQuality: w.testQuality ?? null,
          createdAt: new Date().toISOString(),
          createdById: u.id,
          createdByName: u.name,
          groupScope: w.groupScope || u.groupScope,
          teamId,
        });
        result.weather++;
      }
    }

    res.json({ ok: true, imported: result });
  });

  app.post("/api/admin/purge-activity-logs", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const beforeDate = req.body.beforeDate;
    if (!beforeDate) return res.status(400).json({ message: "beforeDate required" });
    const count = await storage.purgeOldActivityLogs(beforeDate);
    res.json({ deleted: count });
  });

  app.post("/api/admin/purge-login-logs", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const beforeDate = req.body.beforeDate;
    if (!beforeDate) return res.status(400).json({ message: "beforeDate required" });
    const count = await storage.purgeOldLoginLogs(beforeDate);
    res.json({ deleted: count });
  });

  app.post("/api/admin/force-logout-all", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const { pool } = await import("./db");
    const mySessionId = (req.session as any)?.id;
    await (pool as any).query(`DELETE FROM user_sessions WHERE sess::jsonb -> 'passport' ->> 'user' != $1`, [String(u.id)]);
    res.json({ ok: true });
  });

  app.get("/api/admin/db-stats", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!canManageTeam(req)) return res.status(403).json({ message: "Admin only" });
    const { pool } = await import("./db");
    const sessionResult = await (pool as any).query(`SELECT count(*) as count FROM user_sessions`);
    const sessionCount = parseInt(sessionResult.rows[0]?.count || "0");
    const teamId = getAdminTeamScope(req);
    const [userCount, testCount, productCount, seriesCount, weatherCount, grindingCount, loginCount, activityCount, athleteCount, raceSkiCount] = await Promise.all([
      storage.countTable("users", teamId),
      storage.countTable("tests", teamId),
      storage.countTable("products", teamId),
      storage.countTable("testSkiSeries", teamId),
      storage.countTable("dailyWeather", teamId),
      storage.countTable("grindingRecords", teamId),
      storage.countTable("loginLogs", teamId),
      storage.countTable("activityLogs", teamId),
      storage.countTable("athletes", teamId),
      storage.countTable("raceSkis", teamId),
    ]);
    res.json({ sessionCount, userCount, testCount, productCount, seriesCount, weatherCount, grindingCount, loginCount, activityCount, athleteCount, raceSkiCount });
  });

  // Admin force logout user (delete their sessions)
  app.post("/api/admin/force-logout/:userId", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isScopeAdmin) return res.status(403).json({ message: "Admin only" });
    const targetId = parseInt(req.params.userId);
    const { pool } = await import("./db");
    await (pool as any).query(`DELETE FROM user_sessions WHERE sess::jsonb -> 'passport' ->> 'user' = $1`, [String(targetId)]);
    res.json({ ok: true });
  });

  // ── User history (SA only) ──────────────────────────────────────────────────
  app.get("/api/admin/users/:id/history", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    const targetId = parseInt(req.params.id);
    const { pool: pg } = await import("./db");

    const [loginResult, activityResult] = await Promise.all([
      (pg as any).query(
        `SELECT id, user_id, email, name, login_at, ip_address, action, details
         FROM login_logs WHERE user_id = $1 ORDER BY login_at DESC LIMIT 200`,
        [targetId]
      ),
      (pg as any).query(
        `SELECT id, user_id, user_name, action, entity_type, entity_id, details, created_at, team_id
         FROM activity_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`,
        [targetId]
      ),
    ]);

    const loginLogs = loginResult.rows.map((r: any) => ({
      id: r.id, userId: r.user_id, email: r.email, name: r.name,
      loginAt: r.login_at, ipAddress: r.ip_address, action: r.action, details: r.details,
    }));

    const activityLogs = activityResult.rows.map((r: any) => ({
      id: r.id, userId: r.user_id, userName: r.user_name, action: r.action,
      entityType: r.entity_type, entityId: r.entity_id, details: r.details,
      createdAt: r.created_at, teamId: r.team_id,
    }));

    const passwordChanges = activityLogs.filter((l: any) =>
      l.action === "password_changed" || l.action === "password_reset" || l.entityType === "password"
    );

    res.json({ loginLogs, activityLogs, passwordChanges });
  });

  // ── Security routes (Super Admin only) ─────────────────────────────────────

  // Get / set maintenance mode
  app.get("/api/admin/maintenance-mode", (_req, res) => {
    res.json({ enabled: maintenanceMode, reopenAt: maintenanceReopenAt });
  });

  app.post("/api/admin/maintenance-mode", requireAuth, (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    maintenanceMode = !!req.body.enabled;
    if (!maintenanceMode) {
      maintenanceReopenAt = null;
    } else {
      maintenanceReopenAt = req.body.reopenAt ?? null;
    }
    res.json({ enabled: maintenanceMode, reopenAt: maintenanceReopenAt });
  });

  // List all active sessions with user info
  app.get("/api/admin/active-sessions", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    const { pool } = await import("./db");
    try {
      const result = await (pool as any).query(`
        SELECT sid,
               (sess::json -> 'passport' ->> 'user')::int AS user_id,
               expire
        FROM user_sessions
        WHERE expire > NOW()
          AND sess::json -> 'passport' IS NOT NULL
          AND sess::json -> 'passport' ->> 'user' IS NOT NULL
        ORDER BY expire DESC
      `);
      const userIds: number[] = [...new Set(result.rows.map((r: any) => r.user_id as number))];
      const userDetails: Record<number, any> = {};
      for (const uid of userIds) {
        const found = await storage.getUser(uid);
        if (found) userDetails[uid] = found;
      }
      const sessions = result.rows.map((row: any) => {
        const usr = userDetails[row.user_id];
        return {
          sid: row.sid,
          userId: row.user_id,
          userName: usr?.name || "Unknown",
          email: usr?.email || "—",
          teamId: usr?.teamId ?? null,
          isAdmin: usr?.isAdmin ?? 0,
          expiresAt: row.expire,
        };
      });
      res.json(sessions);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Emergency lockdown: terminate all sessions for users in a specific team
  app.post("/api/admin/emergency-lockdown/:teamId", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    const teamId = parseInt(req.params.teamId);
    const { pool } = await import("./db");
    // Find all users in the team
    const userRes = await (pool as any).query(`SELECT id FROM users WHERE team_id = $1`, [teamId]);
    const teamUserIds: string[] = userRes.rows.map((r: any) => String(r.id));
    if (teamUserIds.length === 0) return res.json({ loggedOut: 0 });
    // Delete their sessions, but NOT the current SA's session
    const result = await (pool as any).query(
      `DELETE FROM user_sessions
       WHERE sess::jsonb -> 'passport' ->> 'user' = ANY($1::text[])
         AND sess::jsonb -> 'passport' ->> 'user' != $2`,
      [teamUserIds, String(u.id)]
    );
    res.json({ loggedOut: result.rowCount || 0 });
  });

  // Team pause
  app.put("/api/admin/teams/:id/pause", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    const teamId = parseInt(req.params.id);
    const paused = req.body.paused === true ? 1 : 0;
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `UPDATE teams SET is_paused = $1 WHERE id = $2 RETURNING *`,
      [paused, teamId]
    );
    if (!result.rows[0]) return res.status(404).json({ message: "Team not found" });
    res.json(result.rows[0]);
  });

  // SA Overview
  app.get("/api/admin/overview", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    const { pool } = await import("./db");
    const [teamsRes, recentTestsRes, recentLoginsRes, statsRes, activeSessionsRes] = await Promise.all([
      (pool as any).query(`
        SELECT t.id, t.name, t.is_paused,
          COUNT(DISTINCT u.id) AS user_count,
          COUNT(DISTINCT te.id) AS test_count,
          MAX(te.date) AS last_activity
        FROM teams t
        LEFT JOIN users u ON u.team_id = t.id
        LEFT JOIN tests te ON te.team_id = t.id
        GROUP BY t.id, t.name, t.is_paused
        ORDER BY t.name
      `),
      (pool as any).query(`
        SELECT te.id, t.name AS team_name, te.date, te.location, te.test_type,
          te.created_by_name
        FROM tests te
        LEFT JOIN teams t ON t.id = te.team_id
        ORDER BY te.id DESC
        LIMIT 20
      `),
      (pool as any).query(`
        SELECT ll.user_id, ll.name, t.name AS team_name, ll.login_at AS logged_in_at
        FROM login_logs ll
        LEFT JOIN users u ON u.id = ll.user_id
        LEFT JOIN teams t ON t.id = u.team_id
        ORDER BY ll.id DESC
        LIMIT 500
      `),
      (pool as any).query(`
        SELECT
          (SELECT COUNT(*) FROM teams) AS total_teams,
          (SELECT COUNT(*) FROM users) AS total_users,
          (SELECT COUNT(*) FROM tests) AS total_tests,
          (SELECT COUNT(*) FROM products) AS total_products
      `),
      (pool as any).query(`
        SELECT us.sid, us.sess, us.expire,
          u.id AS user_id,
          u.name AS name,
          t.name AS team_name
        FROM user_sessions us
        LEFT JOIN users u ON u.id = (us.sess::json->'passport'->>'user')::int
        LEFT JOIN teams t ON t.id = u.team_id
        WHERE us.expire > NOW()
        ORDER BY us.expire DESC
      `),
    ]);
    const stats = statsRes.rows[0];
    res.json({
      teams: teamsRes.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        isPaused: r.is_paused === 1 || r.is_paused === true,
        userCount: parseInt(r.user_count) || 0,
        testCount: parseInt(r.test_count) || 0,
        lastActivity: r.last_activity || null,
      })),
      recentTests: recentTestsRes.rows.map((r: any) => ({
        id: r.id,
        teamName: r.team_name,
        date: r.date,
        location: r.location,
        testType: r.test_type,
        createdByName: r.created_by_name,
      })),
      recentLogins: recentLoginsRes.rows.map((r: any) => ({
        userId: r.user_id,
        name: r.name,
        teamName: r.team_name,
        loggedInAt: r.logged_in_at,
      })),
      activeSessions: activeSessionsRes.rows
        .filter((r: any) => r.user_id != null)
        .map((r: any) => ({
          userId: r.user_id,
          name: r.name || "Unknown",
          teamName: r.team_name || "—",
          lastActive: r.expire,
        })),
      stats: {
        totalTeams: parseInt(stats.total_teams) || 0,
        totalUsers: parseInt(stats.total_users) || 0,
        totalTests: parseInt(stats.total_tests) || 0,
        totalProducts: parseInt(stats.total_products) || 0,
      },
    });
  });

  // ───────────────────────────────────────────────────────────────────────────

  // --- Athletes CRUD ---
  app.get("/api/athletes", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const list = await storage.listAthletes(u.id, u.isScopeAdmin, teamId);
    res.json(list);
  });

  app.post("/api/athletes", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const now = new Date().toISOString();
    const athlete = await storage.createAthlete({
      name: req.body.name,
      team: req.body.team || null,
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
      teamId,
    });
    const accessUserIds: number[] = req.body.accessUserIds || [];
    const allAccessIds = [...new Set([...accessUserIds, u.id])];
    await storage.setAthleteAccess(athlete.id, allAccessIds);
    res.json(athlete);
  });

  app.put("/api/athletes/:id", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const hasAccess = await storage.hasAthleteAccess(id, u.id, u.isScopeAdmin, getActiveTeamId(req));
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const data: any = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.team !== undefined) data.team = req.body.team;
    const updated = await storage.updateAthlete(id, data);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });

  app.delete("/api/athletes/:id", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const athlete = await storage.getAthlete(id);
    if (!athlete) return res.status(404).json({ message: "Not found" });
    if (!u.isScopeAdmin && athlete.createdById !== u.id) {
      return res.status(403).json({ message: "Only admin or creator can delete" });
    }
    await storage.deleteAthlete(id);
    res.json({ ok: true });
  });

  app.get("/api/athletes/:id/access", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const hasAccess = await storage.hasAthleteAccess(id, u.id, u.isScopeAdmin, getActiveTeamId(req));
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const accessList = await storage.listAthleteAccess(id);
    res.json(accessList);
  });

  app.put("/api/athletes/:id/access", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const athlete = await storage.getAthlete(id);
    if (!athlete) return res.status(404).json({ message: "Not found" });
    if (!u.isScopeAdmin && athlete.createdById !== u.id) {
      return res.status(403).json({ message: "Only admin or creator can manage access" });
    }
    const userIds = Array.isArray(req.body.userIds)
      ? req.body.userIds.filter((id: any) => typeof id === "number" && !isNaN(id))
      : [];
    await storage.setAthleteAccess(id, userIds);
    res.json({ ok: true });
  });

  // --- Race Skis CRUD ---
  app.get("/api/race-skis/all", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const includeArchived = req.query.includeArchived === "true";
    if (includeArchived) {
      const athleteList = await storage.listAthletes(u.id, u.isScopeAdmin);
      if (athleteList.length === 0) return res.json([]);
      const all: any[] = [];
      for (const ath of athleteList) {
        const skis = await storage.listAllRaceSkisIncludingArchived(ath.id);
        all.push(...skis);
      }
      return res.json(all);
    }
    const list = await storage.listAllRaceSkisForUser(u.id, u.isScopeAdmin);
    res.json(list);
  });

  app.get("/api/athletes/:athleteId/skis", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const athleteId = parseInt(req.params.athleteId);
    const hasAccess = await storage.hasAthleteAccess(athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const includeArchived = req.query.includeArchived === "true";
    const list = includeArchived
      ? await storage.listAllRaceSkisIncludingArchived(athleteId)
      : await storage.listRaceSkis(athleteId);
    res.json(list);
  });

  app.post("/api/athletes/:athleteId/skis", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const athleteId = parseInt(req.params.athleteId);
    const hasAccess = await storage.hasAthleteAccess(athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const now = new Date().toISOString();
    const ski = await storage.createRaceSki({
      athleteId,
      serialNumber: req.body.serialNumber || null,
      skiId: req.body.skiId,
      brand: req.body.brand || null,
      discipline: req.body.discipline,
      construction: req.body.construction || null,
      mold: req.body.mold || null,
      base: req.body.base || null,
      grind: req.body.grind || null,
      heights: req.body.heights || null,
      year: req.body.year || null,
      customParams: req.body.customParams || null,
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
    });
    res.json(ski);
  });

  app.put("/api/race-skis/:id", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const ski = await storage.getRaceSki(id);
    if (!ski) return res.status(404).json({ message: "Not found" });
    const hasAccess = await storage.hasAthleteAccess(ski.athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const data: any = {};
    if (req.body.serialNumber !== undefined) data.serialNumber = req.body.serialNumber;
    if (req.body.skiId !== undefined) data.skiId = req.body.skiId;
    if (req.body.brand !== undefined) data.brand = req.body.brand;
    if (req.body.discipline !== undefined) data.discipline = req.body.discipline;
    if (req.body.construction !== undefined) data.construction = req.body.construction;
    if (req.body.mold !== undefined) data.mold = req.body.mold;
    if (req.body.base !== undefined) data.base = req.body.base;
    if (req.body.grind !== undefined) data.grind = req.body.grind;
    if (req.body.heights !== undefined) data.heights = req.body.heights;
    if (req.body.year !== undefined) data.year = req.body.year;
    if (req.body.customParams !== undefined) data.customParams = req.body.customParams;
    const updated = await storage.updateRaceSki(id, data);
    res.json(updated);
  });

  app.get("/api/athletes/:athleteId/skis/archived", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const athleteId = parseInt(req.params.athleteId);
    const hasAccess = await storage.hasAthleteAccess(athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const list = await storage.listArchivedRaceSkis(athleteId);
    res.json(list);
  });

  app.post("/api/race-skis/:id/archive", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const ski = await storage.getRaceSki(id);
    if (!ski) return res.status(404).json({ message: "Not found" });
    const hasAccess = await storage.hasAthleteAccess(ski.athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.archiveRaceSki(id);
    res.json(updated);
  });

  app.post("/api/race-skis/:id/restore", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const ski = await storage.getRaceSki(id);
    if (!ski) return res.status(404).json({ message: "Not found" });
    const hasAccess = await storage.hasAthleteAccess(ski.athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.restoreRaceSki(id);
    res.json(updated);
  });

  app.delete("/api/race-skis/:id", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const ski = await storage.getRaceSki(id);
    if (!ski) return res.status(404).json({ message: "Not found" });
    const hasAccess = await storage.hasAthleteAccess(ski.athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    if (!ski.archivedAt) {
      return res.status(400).json({ message: "Ski must be archived before permanent deletion" });
    }
    await storage.deleteRaceSki(id);
    res.json({ ok: true });
  });

  // --- Race Ski Regrinds ---
  app.get("/api/race-skis/:id/regrinds", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const ski = await storage.getRaceSki(id);
    if (!ski) return res.status(404).json({ message: "Not found" });
    const hasAccess = await storage.hasAthleteAccess(ski.athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const list = await storage.listRaceSkiRegrinds(id);
    res.json(list);
  });

  app.post("/api/race-skis/:id/regrinds", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const ski = await storage.getRaceSki(id);
    if (!ski) return res.status(404).json({ message: "Not found" });
    const hasAccess = await storage.hasAthleteAccess(ski.athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const now = new Date().toISOString();
    const regrind = await storage.createRaceSkiRegrind({
      raceSkiId: id,
      date: req.body.date,
      grindType: req.body.grindType,
      stone: req.body.stone || null,
      pattern: req.body.pattern || null,
      notes: req.body.notes || null,
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
    });
    await storage.updateRaceSki(id, { grind: req.body.grindType });
    res.json(regrind);
  });

  app.delete("/api/race-ski-regrinds/:id", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const regrind = await storage.getRaceSkiRegrind(id);
    if (!regrind) return res.status(404).json({ message: "Not found" });
    const ski = await storage.getRaceSki(regrind.raceSkiId);
    if (!ski) return res.status(404).json({ message: "Not found" });
    const hasAccess = await storage.hasAthleteAccess(ski.athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteRaceSkiRegrind(id);
    res.json({ ok: true });
  });

  // --- Test Ski Regrinds ---
  app.get("/api/series/:id/regrinds", requirePermission("testskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const series = await storage.getSeries(id);
    if (!series) return res.status(404).json({ message: "Not found" });
    if (!userHasGroupAccess(u.groupScope, u.isScopeAdmin, series.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const list = await storage.listTestSkiRegrinds(id);
    res.json(list);
  });

  app.post("/api/series/:id/regrinds", requirePermission("testskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const series = await storage.getSeries(id);
    if (!series) return res.status(404).json({ message: "Not found" });
    if (!userHasGroupAccess(u.groupScope, u.isScopeAdmin, series.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const now = new Date().toISOString();
    const regrind = await storage.createTestSkiRegrind({
      seriesId: id,
      date: req.body.date,
      grindType: req.body.grindType,
      stone: req.body.stone || null,
      pattern: req.body.pattern || null,
      notes: req.body.notes || null,
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
    });
    await storage.updateSeries(id, { grind: req.body.grindType, lastRegrind: req.body.date });
    res.json(regrind);
  });

  app.delete("/api/test-ski-regrinds/:id", requirePermission("testskis", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteTestSkiRegrind(id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  // --- Runsheets CRUD ---

  app.get("/api/runsheets", requireAuth, async (req, res) => {
    const teamId = getActiveTeamId(req);
    const items = await storage.listRunsheets(teamId);
    res.json(items);
  });

  app.post("/api/runsheets", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const { testId, label } = req.body;
    if (!testId || !label) return res.status(400).json({ message: "testId and label required" });
    const existing = await storage.getRunsheetByTestId(testId, teamId);
    if (existing) return res.status(409).json({ message: "This test already has a runsheet" });
    const created = await storage.createRunsheet({
      testId,
      label,
      createdAt: new Date().toISOString(),
      createdById: u.id,
      teamId,
    });
    res.status(201).json(created);
  });

  app.delete("/api/runsheets/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getRunsheet(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!verifyTeamOwnership(existing, req)) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteRunsheet(id);
    res.json({ ok: true });
  });

  // --- Runsheet Watch Sessions (in-memory) ---

  type WatchHeat = { pairA: number | null; pairB: number | null; distA: string; distB: string };
  type WatchSession = {
    code: string;
    skiPairs: number[];
    skiLabels: Record<number, string>;
    bracket: WatchHeat[][];
    createdAt: number;
    userId: number;
    userName: string;         // test creator / person who added to queue
    operatorName?: string;    // person logged in on the watch device
    testId: number | null;
    testInfo: { date: string; location: string; testType: string } | null;
    teamId: number;
  };

  // In-memory fallback if DB table doesn't exist yet
  const watchSessionsMemory = new Map<string, WatchSession>();

  async function generateSessionCode(): Promise<string> {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    return code;
  }

  async function getWatchSession(code: string): Promise<WatchSession | null> {
    // Try DB first, fall back to memory
    try {
      const rows = await db.select().from(watchSessions).where(eq(watchSessions.code, code));
      if (rows.length > 0) {
        const row = rows[0];
        if (new Date(row.expiresAt) < new Date()) {
          await db.delete(watchSessions).where(eq(watchSessions.code, code)).catch(() => {});
          return null;
        }
        return {
          code: row.code,
          skiPairs: JSON.parse(row.skiPairs),
          skiLabels: row.skiLabels ? JSON.parse(row.skiLabels) : {},
          bracket: JSON.parse(row.bracket),
          createdAt: new Date(row.createdAt).getTime(),
          userId: row.userId,
          userName: row.userName,
          operatorName: (row as any).operatorName ?? undefined,
          testId: row.testId ?? null,
          testInfo: null,
          teamId: row.teamId ?? 0,
        };
      }
    } catch (_) {}
    // Fall back to memory
    return watchSessionsMemory.get(code) ?? null;
  }

  async function saveWatchSession(session: WatchSession): Promise<void> {
    // Save to memory always (instant)
    watchSessionsMemory.set(session.code, session);
    // Also try DB
    try {
      const labelsJson = JSON.stringify(session.skiLabels ?? {});
      await db.insert(watchSessions).values({
        code: session.code,
        skiPairs: JSON.stringify(session.skiPairs),
        skiLabels: labelsJson,
        bracket: JSON.stringify(session.bracket),
        testId: session.testId ?? null,
        userId: session.userId,
        userName: session.userName,
        operatorName: session.operatorName ?? null,
        teamId: session.teamId ?? null,
        createdAt: new Date(session.createdAt).toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }).onConflictDoUpdate({
        target: watchSessions.code,
        set: { bracket: JSON.stringify(session.bracket), skiLabels: labelsJson, operatorName: session.operatorName ?? null },
      });
    } catch (_) {}
  }

  async function updateWatchBracket(code: string, bracket: WatchHeat[][]): Promise<void> {
    // Update memory
    const mem = watchSessionsMemory.get(code);
    if (mem) mem.bracket = bracket;
    // Also try DB
    try {
      await db.update(watchSessions).set({ bracket: JSON.stringify(bracket) }).where(eq(watchSessions.code, code));
    } catch (_) {}
  }

  async function deleteWatchSession(code: string): Promise<void> {
    watchSessionsMemory.delete(code);
    try {
      await db.delete(watchSessions).where(eq(watchSessions.code, code));
    } catch (_) {}
  }

  // Helper: build skiLabels for a watch session — handles both race skis and test ski series
  async function getSkiLabelsForTest(testId: number | null | undefined): Promise<Record<number, string>> {
    if (!testId) return {};
    try {
      // Fetch the test to know the ski source and seriesId
      const testRows = await db.select({ testSkiSource: tests.testSkiSource, seriesId: tests.seriesId })
        .from(tests).where(eq(tests.id, testId));
      const test = testRows[0];
      if (!test) return {};

      if (test.testSkiSource === "raceskis") {
        // Race ski test: label = serialNumber (3-digit) or skiId per entry
        const entries = await db.select({ skiNumber: testEntries.skiNumber, raceSkiId: testEntries.raceSkiId })
          .from(testEntries).where(eq(testEntries.testId, testId));
        const raceSkiIds = entries.map(e => e.raceSkiId).filter((id): id is number => id != null);
        if (raceSkiIds.length === 0) return {};
        const skis = await db.select({ id: raceSkis.id, serialNumber: raceSkis.serialNumber, skiId: raceSkis.skiId })
          .from(raceSkis).where(inArray(raceSkis.id, raceSkiIds));
        const skiById = new Map(skis.map(s => [s.id, s]));
        const labels: Record<number, string> = {};
        for (const entry of entries) {
          if (entry.raceSkiId) {
            const ski = skiById.get(entry.raceSkiId);
            if (ski) labels[entry.skiNumber] = ski.serialNumber || ski.skiId;
          }
        }
        return labels;
      }

      // Regular test ski series: use pairLabels
      if (!test.seriesId) return {};
      const seriesRows = await db.select({ pairLabels: testSkiSeries.pairLabels })
        .from(testSkiSeries).where(eq(testSkiSeries.id, test.seriesId));
      const raw = seriesRows[0]?.pairLabels;
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) return {};
      const labels: Record<number, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string" && v.trim()) labels[Number(k)] = v.trim();
      }
      return labels;
    } catch { return {}; }
  }

  function watchInitBracket(pairs: number[]): WatchHeat[][] {
    if (pairs.length < 2) return [];
    const totalRounds = Math.ceil(Math.log2(pairs.length));
    const rounds: WatchHeat[][] = [];
    const firstRound: WatchHeat[] = [];
    for (let i = 0; i < pairs.length; i += 2) {
      firstRound.push({ pairA: pairs[i], pairB: i + 1 < pairs.length ? pairs[i + 1] : null, distA: "", distB: "" });
    }
    rounds.push(firstRound);
    let prevCount = firstRound.length;
    for (let r = 1; r < totalRounds; r++) {
      const numHeats = Math.ceil(prevCount / 2);
      const round: WatchHeat[] = [];
      for (let h = 0; h < numHeats; h++) round.push({ pairA: null, pairB: null, distA: "", distB: "" });
      rounds.push(round);
      prevCount = numHeats;
    }
    for (let r = 0; r < rounds.length - 1; r++) {
      for (let h = 0; h < rounds[r].length; h++) {
        const heat = rounds[r][h];
        const byeWinner = (heat.pairA !== null && heat.pairB === null) ? heat.pairA
          : (heat.pairB !== null && heat.pairA === null) ? heat.pairB : null;
        if (byeWinner !== null) {
          const nh = Math.floor(h / 2);
          const ns = h % 2 === 0 ? "A" : "B";
          if (rounds[r + 1]?.[nh]) {
            if (ns === "A") rounds[r + 1][nh].pairA = byeWinner;
            else rounds[r + 1][nh].pairB = byeWinner;
          }
        }
      }
    }
    return rounds;
  }

  function watchGetWinner(heat: WatchHeat): number | null {
    if (heat.pairA !== null && heat.pairB === null) return heat.pairA;
    if (heat.pairB !== null && heat.pairA === null) return heat.pairB;
    if (heat.pairA === null || heat.pairB === null) return null;
    const dA = parseFloat(heat.distA), dB = parseFloat(heat.distB);
    if (isNaN(dA) || isNaN(dB)) return null;
    if (dA === 0 && dB > 0) return heat.pairA;
    if (dB === 0 && dA > 0) return heat.pairB;
    return null;
  }

  function watchRebuildDownstream(bracket: WatchHeat[][], fromRound: number) {
    for (let r = fromRound; r < bracket.length; r++) {
      for (const heat of bracket[r]) { heat.pairA = null; heat.pairB = null; heat.distA = ""; heat.distB = ""; }
    }
    for (let r = Math.max(0, fromRound - 1); r < bracket.length - 1; r++) {
      for (let h = 0; h < bracket[r].length; h++) {
        const w = watchGetWinner(bracket[r][h]);
        if (w === null) continue;
        const nh = Math.floor(h / 2), ns = h % 2 === 0 ? "A" : "B";
        if (!bracket[r + 1]?.[nh]) continue;
        if (ns === "A") bracket[r + 1][nh].pairA = w; else bracket[r + 1][nh].pairB = w;
      }
    }
  }

  function watchFindCurrentHeat(bracket: WatchHeat[][]): { roundIndex: number; heatIndex: number; roundName: string; pairA: number; pairB: number } | null {
    const totalRounds = bracket.length;
    for (let r = 0; r < bracket.length; r++) {
      for (let h = 0; h < bracket[r].length; h++) {
        const heat = bracket[r][h];
        if (heat.pairA !== null && heat.pairB !== null && watchGetWinner(heat) === null) {
          const fromEnd = totalRounds - 1 - r;
          const name = fromEnd === 0 ? "Final" : fromEnd === 1 ? "Semi-final" : fromEnd === 2 ? "Quarter-final" : `Round ${r + 1}`;
          return { roundIndex: r, heatIndex: h, roundName: name, pairA: heat.pairA, pairB: heat.pairB };
        }
      }
    }
    return null;
  }

  function watchCalcDiffs(bracket: WatchHeat[][]): Map<number, number> {
    const diffs = new Map<number, number>();
    for (let r = bracket.length - 1; r >= 0; r--) {
      for (const heat of bracket[r]) {
        if (heat.pairA === null || heat.pairB === null) continue;
        const dA = parseFloat(heat.distA), dB = parseFloat(heat.distB);
        if (isNaN(dA) || isNaN(dB)) continue;
        if (dA === 0 && dB > 0) {
          if (!diffs.has(heat.pairA)) diffs.set(heat.pairA, 0);
          diffs.set(heat.pairB, dB + (diffs.get(heat.pairA) ?? 0));
        } else if (dB === 0 && dA > 0) {
          if (!diffs.has(heat.pairB)) diffs.set(heat.pairB, 0);
          diffs.set(heat.pairA, dA + (diffs.get(heat.pairB) ?? 0));
        }
      }
    }
    return diffs;
  }

  app.post("/api/runsheet/sessions", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const { skiPairs, testId, skiLabels } = req.body;
    if (!Array.isArray(skiPairs) || skiPairs.length < 2) {
      return res.status(400).json({ message: "Need at least 2 ski pairs" });
    }
    const code = await generateSessionCode();
    const teamId = getActiveTeamId(req);
    const session: WatchSession = {
      code,
      skiPairs: skiPairs.map(Number),
      skiLabels: skiLabels && typeof skiLabels === "object" ? skiLabels : {},
      bracket: watchInitBracket(skiPairs.map(Number)),
      createdAt: Date.now(),
      userId: u.id,
      userName: u.name,
      testId: testId ? Number(testId) : null,
      testInfo: null,
      teamId,
    };
    await saveWatchSession(session);
    res.json({ code, bracket: session.bracket });
  });

  app.get("/api/runsheet/sessions/:code", requireAuth, async (req, res) => {
    const session = await getWatchSession(req.params.code as string);
    if (!session) return res.status(404).json({ message: "Session not found" });
    const u = userInfo(req);
    if (session.userId !== u.id && !u.isScopeAdmin) return res.status(403).json({ message: "Forbidden" });
    const currentHeat = watchFindCurrentHeat(session.bracket);
    const diffs = watchCalcDiffs(session.bracket);
    const results = [...diffs.entries()].sort((a, b) => a[1] - b[1]).map(([ski, diff], i, arr) => {
      let rank = 1;
      for (let j = 0; j < i; j++) { if (arr[j][1] < diff) rank = j + 2; }
      return { skiNumber: ski, diff, rank };
    });
    res.json({ bracket: session.bracket, currentHeat, results, skiPairs: session.skiPairs, complete: !currentHeat && results.length === session.skiPairs.length });
  });

  app.get("/api/runsheet/watch/:code", async (req, res) => {
    const code = req.params.code as string;
    const session = await getWatchSession(code);
    if (!session) return res.status(404).json({ message: "Invalid code" });
    const labels = session.skiLabels ?? {};
    const currentHeat = watchFindCurrentHeat(session.bracket);
    const diffs = watchCalcDiffs(session.bracket);
    const complete = !currentHeat && diffs.size === session.skiPairs.length;
    let champion: number | null = null;
    if (complete) {
      const sorted = [...diffs.entries()].sort((a, b) => a[1] - b[1]);
      if (sorted.length > 0) champion = sorted[0][0];
    }
    const labeledHeat = currentHeat ? {
      ...currentHeat,
      labelA: currentHeat.pairA !== null ? (labels[currentHeat.pairA] ?? String(currentHeat.pairA)) : null,
      labelB: currentHeat.pairB !== null ? (labels[currentHeat.pairB] ?? String(currentHeat.pairB)) : null,
    } : null;
    res.json({ currentHeat: labeledHeat, complete, champion, totalPairs: session.skiPairs.length });
  });

  app.post("/api/runsheet/watch/:code/result", async (req, res) => {
    const code = req.params.code as string;
    const session = await getWatchSession(code);
    if (!session) return res.status(404).json({ message: "Invalid code" });
    const { roundIndex, heatIndex, winnerPair, loserDistance } = req.body;
    if (typeof roundIndex !== "number" || typeof heatIndex !== "number" || typeof winnerPair !== "number" || typeof loserDistance !== "number") {
      return res.status(400).json({ message: "Missing fields" });
    }
    if (!Number.isFinite(loserDistance) || loserDistance < 1 || loserDistance > 999 || loserDistance !== Math.floor(loserDistance)) {
      return res.status(400).json({ message: "Distance must be integer 1-999" });
    }
    if (roundIndex < 0 || roundIndex >= session.bracket.length) return res.status(400).json({ message: "Invalid round" });
    if (heatIndex < 0 || heatIndex >= session.bracket[roundIndex].length) return res.status(400).json({ message: "Invalid heat" });
    const heat = session.bracket[roundIndex][heatIndex];
    if (!heat || heat.pairA === null || heat.pairB === null) {
      return res.status(400).json({ message: "Invalid heat" });
    }
    if (heat.pairA !== winnerPair && heat.pairB !== winnerPair) {
      return res.status(400).json({ message: "Winner not in this heat" });
    }
    if (heat.pairA === winnerPair) {
      heat.distA = "0";
      heat.distB = String(loserDistance);
    } else {
      heat.distB = "0";
      heat.distA = String(loserDistance);
    }
    watchRebuildDownstream(session.bracket, roundIndex + 1);
    await updateWatchBracket(code, session.bracket);
    const nextHeat = watchFindCurrentHeat(session.bracket);
    const sessionLabels = session.skiLabels ?? {};
    const labeledNext = nextHeat ? {
      ...nextHeat,
      labelA: nextHeat.pairA !== null ? (sessionLabels[nextHeat.pairA] ?? String(nextHeat.pairA)) : null,
      labelB: nextHeat.pairB !== null ? (sessionLabels[nextHeat.pairB] ?? String(nextHeat.pairB)) : null,
    } : null;
    res.json({ ok: true, nextHeat: labeledNext });
  });

  app.post("/api/runsheet/sessions/:code/apply", async (req, res) => {
    const session = await getWatchSession(req.params.code as string);
    if (!session) return res.status(404).json({ message: "Invalid code" });
    if (!session.testId) return res.status(400).json({ message: "No test linked to this session" });

    const diffs = watchCalcDiffs(session.bracket);
    if (diffs.size === 0) return res.status(400).json({ message: "No results yet" });

    const sorted = [...diffs.entries()].sort((a, b) => a[1] - b[1]);
    const results: { skiNumber: number; diff: number; rank: number }[] = [];
    let prevDiff: number | null = null;
    let currentRank = 1;
    for (let i = 0; i < sorted.length; i++) {
      const [skiNumber, diff] = sorted[i];
      if (prevDiff !== null && diff !== prevDiff) currentRank = i + 1;
      results.push({ skiNumber, diff, rank: currentRank });
      prevDiff = diff;
    }

    const entries = await storage.listEntries(session.testId);
    const entryBySkiNumber = new Map(entries.map((e: any) => [e.skiNumber, e]));
    for (const r of results) {
      const entry = entryBySkiNumber.get(r.skiNumber);
      if (!entry) continue;
      await storage.updateEntryResults((entry as any).id, r.diff, r.rank);
    }

    await db.update(tests)
      .set({
        runsheetBracket: JSON.stringify(session.bracket),
        watchOperatorName: session.operatorName ?? null,
      })
      .where(eq(tests.id, session.testId));

    res.json({ ok: true, applied: results.length });
  });

  app.delete("/api/runsheet/sessions/:code", requireAuth, async (req, res) => {
    const session = await getWatchSession(req.params.code as string);
    if (session) {
      const u = userInfo(req);
      if (session.userId !== u.id && !u.isScopeAdmin) return res.status(403).json({ message: "Forbidden" });
    }
    await deleteWatchSession(req.params.code as string);
    res.json({ ok: true });
  });

  setInterval(async () => {
    try {
      await db.delete(watchSessions).where(sql`expires_at < NOW()`);
    } catch (_) {}
  }, 60 * 60 * 1000);

  // --- DB-based Suggestions ---
  app.post("/api/suggestions", requirePermission("suggestions", "view"), async (req, res) => {
    const u = userInfo(req);
    const { snowTemperatureC, airTemperatureC, snowHumidityPct, airHumidityPct,
      artificialSnow, naturalSnow, grainSize, snowHumidityType, trackHardness, testType } = req.body;

    try {
      const teamId = getActiveTeamId(req);
      const allTests = await storage.listTests(u.groupScope, u.isScopeAdmin, teamId);
      const allWeather = await storage.listWeather(u.groupScope, u.isScopeAdmin, teamId);
      const products = await storage.listProducts(u.groupScope, u.isScopeAdmin, teamId);
      const weatherMap = new Map(allWeather.map((w) => [w.id, w]));
      const productMap = new Map(products.map((p) => [p.id, p]));

      // Include tests with weather linked first; fall back to all tests if needed
      const weatherLinkedTests = allTests.filter((t) => {
        if (testType && t.testType !== testType) return false;
        return t.weatherId && weatherMap.has(t.weatherId);
      });
      // Also keep tests without weather for the "no weather data" fallback
      const allTypeFilteredTests = allTests.filter((t) => {
        if (testType && t.testType !== testType) return false;
        return true;
      });

      function weatherSimilarity(w: any): number {
        let score = 0;
        // Temperature — most important signal (max 18 pts)
        const snowTDiff = Math.abs((w.snowTemperatureC ?? 0) - (snowTemperatureC ?? 0));
        const airTDiff  = Math.abs((w.airTemperatureC  ?? 0) - (airTemperatureC  ?? 0));
        score += Math.max(0, 10 - snowTDiff * 2);   // 0–10 pts
        score += Math.max(0, 8  - airTDiff  * 1.5); // 0–8 pts
        // Humidity (max 9 pts)
        const snowHDiff = Math.abs((w.snowHumidityPct ?? 50) - (snowHumidityPct ?? 50));
        const airHDiff  = Math.abs((w.airHumidityPct  ?? 50) - (airHumidityPct  ?? 50));
        score += Math.max(0, 5 - snowHDiff / 10);
        score += Math.max(0, 4 - airHDiff  / 10);
        // Categorical fields (max 15 pts)
        if (artificialSnow && w.artificialSnow) score += 6;
        if (naturalSnow && w.naturalSnow === naturalSnow) score += 6;
        if (grainSize && w.grainSize === grainSize) score += 3;
        if (snowHumidityType && w.snowHumidityType === snowHumidityType) score += 3;
        if (trackHardness && w.trackHardness === trackHardness) score += 3;
        return score;
      }

      // Helper: extract the best rank from an entry (supports both old rank0km and new results JSON)
      function extractBestRank(entry: any): number | null {
        // Try new multi-round results array first
        if (entry.results) {
          try {
            const rounds: { result?: number | null; rank?: number | null }[] = JSON.parse(entry.results);
            const ranks = rounds.map((r) => r.rank).filter((r) => r != null && r > 0) as number[];
            if (ranks.length > 0) return Math.min(...ranks);
          } catch {}
        }
        // Fall back to legacy columns
        const r0 = entry.rank0km;
        const rX = entry.rankXkm;
        if (r0 != null && r0 > 0) return r0;
        if (rX != null && rX > 0) return rX;
        return null;
      }

      // Score all tests that have weather data
      const scoredTests: { test: any; weather: any; similarity: number }[] = [];
      for (const test of weatherLinkedTests) {
        const weather = weatherMap.get(test.weatherId!);
        if (!weather) continue;
        const similarity = weatherSimilarity(weather);
        scoredTests.push({ test, weather, similarity });
      }
      scoredTests.sort((a, b) => b.similarity - a.similarity);

      // Tiered matching — progressive fallback so we always try to return something useful
      // Thresholds: perfect temp match ≈ 18 pts, so HIGH=16 catches "almost perfect temp"
      const HIGH_SIM = 16;
      const MED_SIM  = 8;
      const LOW_SIM  = 2;  // any temperature overlap at all

      const highMatches = scoredTests.filter((t) => t.similarity >= HIGH_SIM);
      const medMatches  = scoredTests.filter((t) => t.similarity >= MED_SIM);
      const lowMatches  = scoredTests.filter((t) => t.similarity >= LOW_SIM);

      let selectedTests: typeof scoredTests;
      let tierConfidence: "High" | "Medium" | "Low";
      let matchDescription: string;
      let noWeatherFallback = false;

      if (highMatches.length >= 1) {
        selectedTests = highMatches;
        tierConfidence = "High";
        matchDescription = "Very similar conditions in test history.";
      } else if (medMatches.length >= 1) {
        selectedTests = medMatches;
        tierConfidence = "Medium";
        matchDescription = "Moderately similar conditions in test history.";
      } else if (lowMatches.length >= 1) {
        selectedTests = lowMatches;
        tierConfidence = "Low";
        matchDescription = "Limited similar data — treat with caution.";
      } else if (scoredTests.length >= 1) {
        // Have weather-linked tests but none match — show the closest ones
        selectedTests = scoredTests.slice(0, 20);
        tierConfidence = "Low";
        matchDescription = "No closely matching conditions found. Showing best available data.";
      } else if (allTypeFilteredTests.length >= 1) {
        // No weather data at all — fall back to all tests of this type
        selectedTests = allTypeFilteredTests.map((t) => ({ test: t, weather: null, similarity: 0 }));
        tierConfidence = "Low";
        matchDescription = "No weather data linked to tests. Showing overall product performance.";
        noWeatherFallback = true;
      } else {
        return res.json({ suggestions: [{ title: "No data", description: "No test data found for this test type. Run some tests first to build recommendations.", products: [], confidence: "Low" }] });
      }

      // Aggregate product stats from the selected tests
      const productStats = new Map<number, { totalRank: number; count: number; wins: number }>();
      for (const { test } of selectedTests.slice(0, 200)) {
        const entries = await storage.listEntries(test.id);
        if (entries.length === 0) continue;
        for (const entry of entries) {
          if (!entry.productId) continue;
          const rank = extractBestRank(entry);
          if (rank == null) continue; // skip entries with no ranking data
          const stats = productStats.get(entry.productId) || { totalRank: 0, count: 0, wins: 0 };
          stats.totalRank += rank;
          stats.count += 1;
          if (rank === 1) stats.wins += 1;
          productStats.set(entry.productId, stats);
        }
      }

      // If no ranked entries found, show frequency (how often a product was tested) as proxy
      if (productStats.size === 0) {
        const freqStats = new Map<number, number>();
        for (const { test } of selectedTests.slice(0, 200)) {
          const entries = await storage.listEntries(test.id);
          for (const entry of entries) {
            if (!entry.productId) continue;
            freqStats.set(entry.productId, (freqStats.get(entry.productId) ?? 0) + 1);
          }
        }
        const suggestions = Array.from(freqStats.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([productId, count], idx) => {
            const prod = productMap.get(productId);
            const productName = prod ? `${prod.brand} ${prod.name}` : "Unknown";
            return {
              title: `#${idx + 1} ${productName}`,
              description: `Tested ${count} time${count > 1 ? "s" : ""} in similar conditions. No ranking data recorded yet.`,
              products: [productName],
              confidence: "Low",
            };
          });
        if (suggestions.length === 0) {
          return res.json({ suggestions: [{ title: "No data", description: "Tests found but no products or rankings recorded. Add products and results to your tests to get suggestions.", products: [], confidence: "Low" }] });
        }
        return res.json({ suggestions });
      }

      const ranked = Array.from(productStats.entries())
        .map(([productId, stats]) => {
          const avgRank = stats.totalRank / stats.count;
          const winRate = stats.wins / stats.count;
          const score = (1 / avgRank) * 0.6 + winRate * 0.4;
          const confidence: string =
            !noWeatherFallback && tierConfidence === "High" && stats.count >= 3 ? "High" :
            !noWeatherFallback && tierConfidence !== "Low"  && stats.count >= 2 ? "Medium" : "Low";
          return { productId, avgRank, winRate, score, confidence, count: stats.count };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);

      const suggestions = ranked.map((r, idx) => {
        const prod = productMap.get(r.productId);
        const productName = prod ? `${prod.brand} ${prod.name}` : "Unknown";
        const avgRankStr = r.avgRank.toFixed(1);
        const winPct = (r.winRate * 100).toFixed(0);
        return {
          title: `#${idx + 1} ${productName}`,
          description: `Avg rank ${avgRankStr} across ${r.count} test${r.count > 1 ? "s" : ""}. Win rate: ${winPct}%. ${matchDescription}`,
          products: [productName],
          confidence: r.confidence,
        };
      });

      res.json({ suggestions });
    } catch (err: any) {
      console.error("Suggestion error:", err);
      res.status(500).json({ message: "Failed to generate suggestions", error: err.message });
    }
  });

  // ─── Watch Queue (Garmin watch app integration) ───────────────────────────

  // Get or generate team's watch PIN (authenticated users)
  app.get("/api/watch/pin", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");
    const result = await (pool as any).query(`SELECT watch_pin FROM teams WHERE id = $1`, [teamId]);
    let pin = result.rows[0]?.watch_pin;
    if (!pin) {
      // Generate a random 4-digit PIN
      pin = String(Math.floor(1000 + Math.random() * 9000));
      await (pool as any).query(`UPDATE teams SET watch_pin = $1 WHERE id = $2`, [pin, teamId]);
    }
    res.json({ pin, teamName: u.groupScope || "Team" });
  });

  // Regenerate team's watch PIN
  app.post("/api/watch/pin/regenerate", requireAuth, async (req, res) => {
    const teamId = getActiveTeamId(req);
    if (!canManageTeam(req)) return res.status(403).json({ message: "Team admin only" });
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    const { pool } = await import("./db");
    await (pool as any).query(`UPDATE teams SET watch_pin = $1 WHERE id = $2`, [pin, teamId]);
    res.json({ pin });
  });

  // Check if user has garmin_watch access (team feature enabled + per-user flag, or admin)
  async function hasGarminWatchAccess(req: Request): Promise<boolean> {
    const u = req.user!;
    if (u.isAdmin === 1) return true;
    // Check team feature gate
    const teamId = getActiveTeamId(req);
    try {
      const team = await storage.getTeam(teamId);
      if (team?.enabledAreas) {
        const enabled: string[] = JSON.parse(team.enabledAreas as string);
        if (!enabled.includes("garmin_watch")) return false;
      }
    } catch (_) {}
    if (u.isTeamAdmin === 1) return true;
    return !!u.garminWatch;
  }

  // Get active watch queue for current team (authenticated + garminWatch access)
  app.get("/api/watch/queue", requireAuth, async (req, res) => {
    if (!(await hasGarminWatchAccess(req))) {
      return res.status(403).json({ message: "Watch Queue access not granted" });
    }
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `SELECT * FROM watch_queue WHERE team_id = $1 AND status = 'active' ORDER BY added_at DESC`,
      [teamId]
    );
    res.json(result.rows);
  });

  // Get watch queue archive for current team (authenticated + garminWatch access)
  app.get("/api/watch/queue/archive", requireAuth, async (req, res) => {
    if (!(await hasGarminWatchAccess(req))) {
      return res.status(403).json({ message: "Watch Queue access not granted" });
    }
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `SELECT * FROM watch_queue WHERE team_id = $1 AND status = 'completed' ORDER BY completed_at DESC LIMIT 10`,
      [teamId]
    );
    res.json(result.rows);
  });

  // Add test to watch queue (authenticated + garminWatch access)
  app.post("/api/watch/queue", requireAuth, async (req, res) => {
    if (!(await hasGarminWatchAccess(req))) {
      return res.status(403).json({ message: "Watch Queue access not granted" });
    }
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const { testId, seriesId, testName, seriesName } = req.body;
    const { pool } = await import("./db");
    // Check if already in queue
    const existing = await (pool as any).query(
      `SELECT id FROM watch_queue WHERE team_id = $1 AND test_id = $2 AND status = 'active'`,
      [teamId, testId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "Already in watch queue" });
    }

    // Auto-create a watch session from the test's entries so Garmin can join directly
    let sessionCode: string | null = null;
    if (testId) {
      try {
        const entriesRows = await db.select().from(testEntries).where(eq(testEntries.testId, Number(testId)));
        if (entriesRows.length >= 2) {
          const skiPairs = entriesRows.map((e) => e.skiNumber).sort((a, b) => a - b);
          // Use correct labels — handles both race skis (serialNumber) and series pairLabels
          const skiLabels = await getSkiLabelsForTest(Number(testId));
          sessionCode = await generateSessionCode();
          const session: WatchSession = {
            code: sessionCode,
            skiPairs,
            skiLabels,
            bracket: watchInitBracket(skiPairs),
            createdAt: Date.now(),
            userId: u.id,
            userName: u.name,
            testId: Number(testId),
            testInfo: null,
            teamId,
          };
          await saveWatchSession(session);
        }
      } catch (err) {
        // Session creation failed — queue item still added, just without a code
        sessionCode = null;
      }
    }

    const result = await (pool as any).query(
      `INSERT INTO watch_queue (team_id, test_id, series_id, test_name, series_name, added_by_name, added_at, status, session_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8) RETURNING *`,
      [teamId, testId || null, seriesId || null, testName || null, seriesName || null, u.name, new Date().toISOString(), sessionCode]
    );
    res.json(result.rows[0]);
  });

  // Refresh (regenerate) session code for a queue item
  app.post("/api/watch/queue/:id/refresh-code", requireAuth, async (req, res) => {
    if (!canManageTeam(req)) return res.status(403).json({ message: "Team admin only" });
    const teamId = getActiveTeamId(req);
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const { pool } = await import("./db");
    const itemResult = await (pool as any).query(
      `SELECT * FROM watch_queue WHERE id = $1 AND team_id = $2 AND status = 'active'`, [id, teamId]
    );
    const item = itemResult.rows[0];
    if (!item) return res.status(404).json({ message: "Queue item not found" });
    if (!item.test_id) return res.status(400).json({ message: "No test associated" });

    // Delete old session if exists
    if (item.session_code) await deleteWatchSession(item.session_code);

    const entriesRows = await db.select().from(testEntries).where(eq(testEntries.testId, Number(item.test_id)));
    if (entriesRows.length < 2) return res.status(400).json({ message: "Not enough entries" });

    const skiPairs = entriesRows.map((e) => e.skiNumber).sort((a, b) => a - b);
    const skiLabels = await getSkiLabelsForTest(item.test_id);
    const newCode = await generateSessionCode();
    const session: WatchSession = {
      code: newCode, skiPairs, skiLabels,
      bracket: watchInitBracket(skiPairs),
      createdAt: Date.now(), userId: u.id, userName: u.name,
      testId: Number(item.test_id), testInfo: null, teamId,
    };
    await saveWatchSession(session);
    await (pool as any).query(`UPDATE watch_queue SET session_code = $1 WHERE id = $2`, [newCode, id]);
    res.json({ code: newCode });
  });

  // Remove from watch queue (authenticated)
  app.delete("/api/watch/queue/:id", requireAuth, async (req, res) => {
    if (!(await hasGarminWatchAccess(req))) return res.status(403).json({ message: "Watch Queue access not granted" });
    const teamId = getActiveTeamId(req);
    const id = parseInt(req.params.id);
    const { pool } = await import("./db");
    await (pool as any).query(`DELETE FROM watch_queue WHERE id = $1 AND team_id = $2`, [id, teamId]);
    res.json({ ok: true });
  });

  // Restore archived item back to active queue
  app.post("/api/watch/queue/:id/restore", requireAuth, async (req, res) => {
    if (!(await hasGarminWatchAccess(req))) return res.status(403).json({ message: "Watch Queue access not granted" });
    const teamId = getActiveTeamId(req);
    const id = parseInt(req.params.id);
    const { pool } = await import("./db");
    await (pool as any).query(
      `UPDATE watch_queue SET status = 'active', completed_at = NULL WHERE id = $1 AND team_id = $2`,
      [id, teamId]
    );
    res.json({ ok: true });
  });

  // ── Watch device authentication: personal code + team PIN ────────────────
  // Called by the Garmin/watch app during login. No session auth required.
  app.post("/api/watch/auth", async (req, res) => {
    const { userCode, teamPin } = req.body ?? {};
    if (!userCode || !teamPin) {
      return res.status(400).json({ message: "userCode and teamPin are required" });
    }
    if (!/^\d{4}$/.test(String(userCode))) {
      return res.status(400).json({ message: "Personal ID must be a 4-digit code" });
    }
    const { pool } = await import("./db");

    // Resolve user by personal watch code
    const userRow = await (pool as any).query(
      "SELECT id, name, is_admin, is_team_admin, garmin_watch, team_id FROM users WHERE watch_code = $1 AND is_active = 1",
      [String(userCode)]
    );
    if (!userRow.rows[0]) {
      return res.status(404).json({ message: "Personal ID not found" });
    }
    const watchUser = userRow.rows[0];

    // Resolve team by PIN
    const teamRow = await (pool as any).query(
      "SELECT id, name, enabled_areas FROM teams WHERE watch_pin = $1",
      [String(teamPin)]
    );
    if (!teamRow.rows[0]) {
      return res.status(404).json({ message: "Team ID not found" });
    }
    const team = teamRow.rows[0];

    // Check team-level garmin_watch feature gate
    if (watchUser.is_admin !== 1) {
      let enabledAreas: string[] = [];
      try { enabledAreas = JSON.parse(team.enabled_areas ?? "[]"); } catch (_) {}
      if (!enabledAreas.includes("garmin_watch")) {
        return res.status(403).json({ message: "Watch access is not enabled for this team" });
      }
    }

    // Check user has access to this team (primary team OR member of team via user_teams)
    if (watchUser.is_admin !== 1) {
      const teamId: number = Number(team.id);
      const isOwnTeam = Number(watchUser.team_id) === teamId;
      let isMember = isOwnTeam;
      if (!isMember) {
        const memberRow = await (pool as any).query(
          "SELECT id FROM user_teams WHERE user_id = $1 AND team_id = $2",
          [watchUser.id, teamId]
        );
        isMember = memberRow.rows.length > 0;
      }
      if (!isMember) {
        return res.status(403).json({ message: "You don't have access to this team" });
      }

      // Check per-user garmin_watch flag (team admins always get access)
      if (watchUser.is_team_admin !== 1 && !watchUser.garmin_watch) {
        return res.status(403).json({ message: "Watch Queue access not granted for your account" });
      }
    }

    res.json({
      userId: watchUser.id,
      userName: watchUser.name,
      teamId: team.id,
      teamName: team.name,
    });
  });

  // ── Public watch API (authenticated by team watch PIN) ────────────────────

  // Resolve PIN → team (used by Garmin app)
  app.get("/api/watch/resolve/:pin", async (req, res) => {
    const { pin } = req.params;
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `SELECT id, name FROM teams WHERE watch_pin = $1`,
      [pin]
    );
    if (!result.rows[0]) return res.status(404).json({ message: "Invalid PIN" });
    res.json({ teamId: result.rows[0].id, teamName: result.rows[0].name });
  });

  // Get active queue by PIN (Garmin app)
  app.get("/api/watch/list/:pin", async (req, res) => {
    const { pin } = req.params;
    const { pool } = await import("./db");
    const teamResult = await (pool as any).query(
      `SELECT id, enabled_areas FROM teams WHERE watch_pin = $1`, [pin]
    );
    if (!teamResult.rows[0]) return res.status(404).json({ message: "Invalid PIN" });
    const teamId = teamResult.rows[0].id;

    // Validate userCode if provided (query param ?userCode=XXXX)
    // Only checks team membership — garmin_watch feature is validated at /api/watch/auth time
    const userCode = typeof req.query.userCode === "string" ? req.query.userCode : null;
    if (userCode && /^\d{4}$/.test(userCode)) {
      try {
        const userRow = await (pool as any).query(
          "SELECT id, is_admin, team_id FROM users WHERE watch_code = $1 AND is_active = 1",
          [userCode]
        );
        const watchUser = userRow.rows[0];
        if (!watchUser) {
          return res.status(403).json({ message: "Personal ID not found" });
        }
        if (watchUser.is_admin !== 1) {
          // Only check team membership (garmin_watch access already validated at login)
          const isOwnTeam = Number(watchUser.team_id) === Number(teamId);
          let isMember = isOwnTeam;
          if (!isMember) {
            const memberRow = await (pool as any).query(
              "SELECT id FROM user_teams WHERE user_id = $1 AND team_id = $2",
              [watchUser.id, teamId]
            );
            isMember = memberRow.rows.length > 0;
          }
          if (!isMember) {
            return res.status(403).json({ message: "No access to this team" });
          }
        }
      } catch (_) {
        // Validation error — still return list to avoid blocking watch access
      }
    }

    const result = await (pool as any).query(
      `SELECT id, test_id, series_id, test_name, series_name, added_by_name, added_at FROM watch_queue
       WHERE team_id = $1 AND status = 'active' ORDER BY added_at DESC`,
      [teamId]
    );
    res.json({ items: result.rows });
  });

  // Watch diagnostic endpoint — shows queue status, session state, and config
  app.get("/api/watch/debug/:pin", async (req, res) => {
    const { pin } = req.params;
    const { pool } = await import("./db");
    const teamResult = await (pool as any).query(
      `SELECT id, name, watch_pin, enabled_areas FROM teams WHERE watch_pin = $1`, [pin]
    );
    if (!teamResult.rows[0]) return res.status(404).json({ message: "Invalid PIN", pin });
    const team = teamResult.rows[0];
    const teamId = team.id;
    let enabledAreas: string[] = [];
    try { enabledAreas = JSON.parse(team.enabled_areas ?? "[]"); } catch {}
    const garminEnabled = enabledAreas.includes("garmin_watch");

    const queueResult = await (pool as any).query(
      `SELECT id, test_id, series_id, test_name, series_name, session_code, status, added_at FROM watch_queue
       WHERE team_id = $1 ORDER BY added_at DESC LIMIT 20`,
      [teamId]
    );
    const items = queueResult.rows;

    // Check which items have valid sessions
    const now = new Date().toISOString();
    const sessionChecks = await Promise.all(items.map(async (item: any) => {
      let sessionStatus = "no_code";
      if (item.session_code) {
        const sess = await getWatchSession(item.session_code);
        sessionStatus = sess ? "active" : "expired";
      }
      let entryCount = 0;
      if (item.test_id) {
        try {
          const ec = await (pool as any).query(`SELECT COUNT(*) FROM test_entries WHERE test_id = $1`, [item.test_id]);
          entryCount = parseInt(ec.rows[0]?.count ?? "0");
        } catch {}
      }
      return { id: item.id, name: item.test_name || item.series_name, status: item.status, sessionStatus, entryCount, testId: item.test_id, seriesId: item.series_id };
    }));

    res.json({
      team: { id: teamId, name: team.name, garminEnabled, watchPin: pin },
      maintenanceMode,
      queueItems: sessionChecks,
      activeSessions: watchSessionsMemory.size,
      serverTime: now,
    });
  });

  // Get archive by PIN (Garmin app — last 10 completed)
  app.get("/api/watch/archive/:pin", async (req, res) => {
    const { pin } = req.params;
    const { pool } = await import("./db");
    const teamResult = await (pool as any).query(
      `SELECT id FROM teams WHERE watch_pin = $1`, [pin]
    );
    if (!teamResult.rows[0]) return res.status(404).json({ message: "Invalid PIN" });
    const teamId = teamResult.rows[0].id;
    const result = await (pool as any).query(
      `SELECT id, test_id, series_id, test_name, series_name, completed_at FROM watch_queue
       WHERE team_id = $1 AND status = 'completed' ORDER BY completed_at DESC LIMIT 10`,
      [teamId]
    );
    res.json({ items: result.rows });
  });

  // Start a session from queue item (Garmin app) — returns stored session code
  app.post("/api/watch/list/:pin/start/:itemId", async (req, res) => {
    const { pin, itemId } = req.params;
    const { pool } = await import("./db");
    const teamResult = await (pool as any).query(
      `SELECT id FROM teams WHERE watch_pin = $1`, [pin]
    );
    if (!teamResult.rows[0]) return res.status(404).json({ message: "Invalid PIN" });
    const teamId = teamResult.rows[0].id;
    const itemResult = await (pool as any).query(
      `SELECT * FROM watch_queue WHERE id = $1 AND team_id = $2`, [parseInt(itemId), teamId]
    );
    const item = itemResult.rows[0];
    if (!item) return res.status(404).json({ message: "Queue item not found" });

    // Fetch labels — handles race skis (serialNumber) and series pairLabels
    const skiLabels = await getSkiLabelsForTest(item.test_id);
    const labelsJson = JSON.stringify(skiLabels);

    // Resolve operator name from personal watch code if provided
    const userCode = req.body?.userCode ?? req.query.userCode;
    let resolvedOperatorName: string | undefined;
    if (userCode && /^\d{4}$/.test(String(userCode))) {
      try {
        const opRow = await (pool as any).query(
          "SELECT name FROM users WHERE watch_code = $1 AND is_active = 1", [String(userCode)]
        );
        if (opRow.rows[0]) resolvedOperatorName = opRow.rows[0].name;
      } catch (_) {}
    }

    // 1. Use the stored session code if it's still valid
    if (item.session_code) {
      const existingSession = await getWatchSession(item.session_code);
      if (existingSession) {
        // Always sync skiLabels; also update operatorName if watch user logged in
        existingSession.skiLabels = skiLabels;
        if (resolvedOperatorName) existingSession.operatorName = resolvedOperatorName;
        watchSessionsMemory.set(existingSession.code, existingSession);
        await db.update(watchSessions)
          .set({ skiLabels: labelsJson, ...(resolvedOperatorName ? { operatorName: resolvedOperatorName } : {}) })
          .where(eq(watchSessions.code, existingSession.code))
          .catch(() => {});
        return res.json({ code: item.session_code, testName: item.test_name, seriesName: item.series_name, queueItemId: item.id });
      }
    }

    // 2. Session expired or missing — recreate from test entries
    if (item.test_id) {
      try {
        const entriesRows = await db.select().from(testEntries).where(eq(testEntries.testId, Number(item.test_id)));
        if (entriesRows.length >= 2) {
          const skiPairs = entriesRows.map((e) => e.skiNumber).sort((a, b) => a - b);
          const newCode = await generateSessionCode();
          const session: WatchSession = {
            code: newCode,
            skiPairs,
            skiLabels,
            bracket: watchInitBracket(skiPairs),
            createdAt: Date.now(),
            userId: 0,
            userName: item.added_by_name,
            operatorName: resolvedOperatorName,
            testId: Number(item.test_id),
            testInfo: null,
            teamId,
          };
          await saveWatchSession(session);
          await (pool as any).query(
            `UPDATE watch_queue SET session_code = $1 WHERE id = $2`,
            [newCode, item.id]
          );
          return res.json({ code: newCode, testName: item.test_name, seriesName: item.series_name, queueItemId: item.id });
        }
      } catch (_) {}
    }

    // 3. No test_id — try series-based: build ski pairs from series pairLabels
    if (item.series_id) {
      try {
        const seriesRows = await db.select({ pairLabels: testSkiSeries.pairLabels, name: testSkiSeries.name })
          .from(testSkiSeries).where(eq(testSkiSeries.id, Number(item.series_id)));
        const seriesRow = seriesRows[0];
        if (seriesRow?.pairLabels) {
          const parsed = JSON.parse(seriesRow.pairLabels);
          const labelKeys = Object.keys(parsed).map(Number).filter(n => !isNaN(n));
          if (labelKeys.length >= 2) {
            const skiPairs = labelKeys.sort((a, b) => a - b);
            const seriesLabels: Record<number, string> = {};
            for (const k of skiPairs) {
              const v = parsed[k];
              if (typeof v === "string" && v.trim()) seriesLabels[k] = v.trim();
            }
            const newCode = await generateSessionCode();
            const session: WatchSession = {
              code: newCode,
              skiPairs,
              skiLabels: seriesLabels,
              bracket: watchInitBracket(skiPairs),
              createdAt: Date.now(),
              userId: 0,
              userName: item.added_by_name,
              operatorName: resolvedOperatorName,
              testId: null,
              testInfo: null,
              teamId,
            };
            await saveWatchSession(session);
            await (pool as any).query(
              `UPDATE watch_queue SET session_code = $1 WHERE id = $2`,
              [newCode, item.id]
            );
            return res.json({ code: newCode, testName: item.test_name, seriesName: item.series_name ?? seriesRow.name, queueItemId: item.id });
          }
        }
      } catch (_) {}
    }

    // 4. Cannot create session
    res.json({ code: null, testName: item.test_name, seriesName: item.series_name, queueItemId: item.id });
  });

  // Mark queue item as completed (called by watch app after finishing)
  app.post("/api/watch/list/:pin/complete/:itemId", async (req, res) => {
    const { pin, itemId } = req.params;
    const { pool } = await import("./db");
    const teamResult = await (pool as any).query(
      `SELECT id FROM teams WHERE watch_pin = $1`, [pin]
    );
    if (!teamResult.rows[0]) return res.status(404).json({ message: "Invalid PIN" });
    const teamId = teamResult.rows[0].id;
    await (pool as any).query(
      `UPDATE watch_queue SET status = 'completed', completed_at = $1 WHERE id = $2 AND team_id = $3`,
      [new Date().toISOString(), parseInt(itemId), teamId]
    );
    res.json({ ok: true });
  });

  // ──────────────────────────────────────────────────────────────────────────

  // ─── Report a Problem + SA Inbox ─────────────────────────────────────────

  // POST /api/report-problem — any authenticated user submits a problem report
  app.post("/api/report-problem", requireAuth, async (req, res) => {
    const { subject, body } = req.body || {};
    if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
      return res.status(400).json({ message: "Subject is required" });
    }
    if (subject.length > 200) {
      return res.status(400).json({ message: "Subject must be 200 characters or fewer" });
    }
    if (!body || typeof body !== "string" || body.trim().length === 0) {
      return res.status(400).json({ message: "Body is required" });
    }
    if (body.length > 2000) {
      return res.status(400).json({ message: "Body must be 2000 characters or fewer" });
    }

    const sender = req.user!;
    const { pool } = await import("./db");

    // Get sender's team name
    let teamName: string | null = null;
    try {
      const teamRow = await (pool as any).query(
        `SELECT name FROM teams WHERE id = $1`,
        [sender.teamId]
      );
      teamName = teamRow.rows[0]?.name ?? null;
    } catch (_) {}

    // Get all SA users
    const saResult = await (pool as any).query(
      `SELECT id, name FROM users WHERE is_admin = 1`
    );
    const saUsers: { id: number; name: string }[] = saResult.rows;

    const now = new Date().toISOString();
    for (const sa of saUsers) {
      await (pool as any).query(
        `INSERT INTO inbox_messages (to_user_id, from_user_id, from_name, subject, body, is_read, created_at, team_name)
         VALUES ($1, $2, $3, $4, $5, 0, $6, $7)`,
        [sa.id, sender.id, sender.name, subject.trim(), body.trim(), now, teamName]
      );
    }

    return res.json({ ok: true });
  });

  // GET /api/inbox — return inbox messages for current user
  app.get("/api/inbox", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `SELECT * FROM inbox_messages WHERE to_user_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [userId]
    );
    return res.json(result.rows);
  });

  // GET /api/inbox/unread-count — return unread count for current user
  app.get("/api/inbox/unread-count", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `SELECT COUNT(*) FROM inbox_messages WHERE to_user_id = $1 AND is_read = 0`,
      [userId]
    );
    return res.json({ count: parseInt(result.rows[0].count, 10) });
  });

  // ── Add from picture ──────────────────────────────────────────────────────

  // POST /api/tests/from-picture/analyze — analyze image with Claude vision
  app.post("/api/tests/from-picture/analyze", requireAuth, async (req, res) => {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ message: "imageBase64 and mimeType required" });
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: "ANTHROPIC_API_KEY not configured on server" });
    }
    const prompt = `You are analyzing an image of a ski test result sheet or similar test document. Extract all relevant data and return ONLY raw JSON — no markdown, no explanation.

Return a JSON object with this exact structure (use null for missing values):
{
  "date": "YYYY-MM-DD or null",
  "location": "location name or null",
  "testType": "Glide" or "Structure" or "Classic" or "Skating" or "Double Poling" or null,
  "testName": "test name or null",
  "notes": "any notes or null",
  "weather": {
    "airTemperatureC": number or null,
    "snowTemperatureC": number or null,
    "airHumidityPct": number 0-100 or null,
    "snowHumidityPct": number 0-100 or null,
    "snowType": "string or null",
    "artificialSnow": "string or null",
    "naturalSnow": "string or null",
    "grainSize": "string or null",
    "snowHumidityType": "dry" or "moist" or "wet" or null,
    "trackHardness": "soft" or "medium" or "hard" or null,
    "testQuality": integer 1-5 or null,
    "wind": "string or null",
    "clouds": integer 0-100 or null,
    "precipitation": "string or null",
    "visibility": "string or null"
  },
  "products": [
    {
      "skiNumber": integer,
      "category": "Ski" or "Wax" or "Binding" or "Boot" or "Other",
      "brand": "brand name",
      "name": "product/model name"
    }
  ],
  "entries": [
    {
      "skiNumber": integer,
      "result0kmCmBehind": number or null,
      "rank0km": integer or null,
      "methodology": "string or empty string",
      "feelingRank": integer or null,
      "kickRank": integer or null
    }
  ]
}`;
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-opus-4-5",
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "base64", media_type: mimeType, data: imageBase64 },
                },
                { type: "text", text: prompt },
              ],
            },
          ],
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        return res.status(500).json({ message: `AI error: ${errText.slice(0, 300)}` });
      }
      const data = await response.json() as any;
      const text = (data.content?.[0]?.text || "").trim();
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
        return res.json(parsed);
      } catch {
        return res.status(500).json({ message: "Failed to parse AI response", raw: text.slice(0, 500) });
      }
    } catch (e: any) {
      return res.status(500).json({ message: e.message || "Failed to analyze image" });
    }
  });

  // POST /api/tests/from-picture/create — create series/products/weather/test from analyzed data
  app.post("/api/tests/from-picture/create", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (u.permissions.tests === "none" && !u.isAdmin && !u.isTeamAdmin) {
      return res.status(403).json({ message: "No access" });
    }
    const teamId = getActiveTeamId(req);
    const groupScope = resolveCreateGroupScope(req);
    const now = new Date().toISOString();
    const { pool } = await import("./db");
    const body = req.body as {
      date: string;
      location: string;
      testType: string;
      testName?: string | null;
      notes?: string | null;
      weather?: Record<string, any> | null;
      products?: Array<{ skiNumber: number; category: string; brand: string; name: string }>;
      entries?: Array<Record<string, any>>;
    };

    // 1. Find or create "From picture - no series available" series for this team
    const SERIES_NAME = "From picture - no series available";
    let seriesId: number;
    const existingSeriesRows = await (pool as any).query(
      `SELECT id FROM test_ski_series WHERE name = $1 AND team_id = $2 AND archived_at IS NULL LIMIT 1`,
      [SERIES_NAME, teamId]
    );
    if (existingSeriesRows.rows.length > 0) {
      seriesId = existingSeriesRows.rows[0].id;
    } else {
      const createdSeries = await storage.createSeries({
        name: SERIES_NAME,
        type: body.testType === "Classic" || body.testType === "Skating" || body.testType === "Double Poling" ? "Classic" : "Glide",
        brand: null,
        skiType: null,
        grind: null,
        numberOfSkis: (body.entries || []).length || 8,
        pairLabels: null,
        lastRegrind: null,
        createdAt: now,
        createdById: u.id,
        createdByName: u.name,
        groupScope,
        teamId,
      });
      seriesId = createdSeries.id;
    }

    // 2. Find or create each product, build skiNumber→productId map
    const productMap = new Map<number, number>();
    for (const p of (body.products || [])) {
      if (!p.brand || !p.name) continue;
      const existingProds = await (pool as any).query(
        `SELECT id FROM products WHERE LOWER(brand) = LOWER($1) AND LOWER(name) = LOWER($2) AND team_id = $3 LIMIT 1`,
        [p.brand.trim(), p.name.trim(), teamId]
      );
      let productId: number;
      if (existingProds.rows.length > 0) {
        productId = existingProds.rows[0].id;
      } else {
        const created = await storage.createProduct({
          category: p.category || "Ski",
          brand: p.brand.trim(),
          name: p.name.trim(),
          createdAt: now,
          createdById: u.id,
          createdByName: u.name,
          groupScope,
          teamId,
        });
        productId = created.id;
      }
      productMap.set(p.skiNumber, productId);
    }

    // 3. Create weather if data is present
    let weatherId: number | null = null;
    const w = body.weather;
    if (w && (w.airTemperatureC != null || w.snowTemperatureC != null)) {
      const createdWeather = await storage.createWeather({
        date: body.date,
        time: "",
        location: body.location?.trim() || "Unknown",
        airTemperatureC: w.airTemperatureC ?? 0,
        snowTemperatureC: w.snowTemperatureC ?? 0,
        airHumidityPct: w.airHumidityPct ?? 0,
        snowHumidityPct: w.snowHumidityPct ?? 0,
        clouds: w.clouds ?? null,
        visibility: w.visibility?.trim() || null,
        wind: w.wind?.trim() || null,
        precipitation: w.precipitation?.trim() || null,
        artificialSnow: w.artificialSnow || null,
        naturalSnow: w.naturalSnow || null,
        grainSize: w.grainSize || null,
        snowHumidityType: w.snowHumidityType || null,
        trackHardness: w.trackHardness || null,
        testQuality: w.testQuality ?? null,
        snowType: w.snowType?.trim() || null,
        createdAt: now,
        createdById: u.id,
        createdByName: u.name,
        groupScope,
        teamId,
      });
      weatherId = createdWeather.id;
    }

    // 4. Create test
    const test = await storage.createTest({
      date: body.date,
      location: body.location?.trim() || "Unknown",
      testName: body.testName?.trim() || null,
      weatherId,
      testType: body.testType || "Glide",
      seriesId,
      athleteId: null,
      testSkiSource: "series",
      notes: body.notes?.trim() || null,
      distanceLabel0km: null,
      distanceLabelXkm: null,
      distanceLabels: null,
      grindParameters: null,
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
      groupScope,
      teamId,
    });

    // 5. Create entries
    for (const e of (body.entries || [])) {
      await storage.createEntry({
        testId: test.id,
        skiNumber: e.skiNumber,
        productId: productMap.get(e.skiNumber) || null,
        freeTextProduct: null,
        additionalProductIds: null,
        methodology: e.methodology || "",
        result0kmCmBehind: e.result0kmCmBehind ?? null,
        rank0km: e.rank0km ?? null,
        resultXkmCmBehind: e.resultXkmCmBehind ?? null,
        rankXkm: e.rankXkm ?? null,
        results: e.results || null,
        feelingRank: e.feelingRank ?? null,
        kickRank: e.kickRank ?? null,
        grindType: e.grindType || null,
        grindStone: e.grindStone || null,
        grindPattern: e.grindPattern || null,
        grindExtraParams: e.grindExtraParams || null,
        raceSkiId: null,
        createdAt: now,
        createdById: u.id,
        createdByName: u.name,
        groupScope,
        teamId,
      });
    }

    try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "created",
        entityType: "test", entityId: test.id,
        details: `Test from picture: ${body.testType} on ${body.date}`,
        createdAt: now, groupScope, teamId,
      });
    } catch (_) {}

    return res.json({ testId: test.id, seriesId, weatherId, productIds: Object.fromEntries(productMap) });
  });

  // PUT /api/inbox/:id/read — mark a message as read
  app.put("/api/inbox/:id/read", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const msgId = parseInt(req.params.id, 10);
    const { pool } = await import("./db");
    await (pool as any).query(
      `UPDATE inbox_messages SET is_read = 1 WHERE id = $1 AND to_user_id = $2`,
      [msgId, userId]
    );
    return res.json({ ok: true });
  });

  // PUT /api/inbox/read-all — mark all messages as read for current user
  app.put("/api/inbox/read-all", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const { pool } = await import("./db");
    await (pool as any).query(
      `UPDATE inbox_messages SET is_read = 1 WHERE to_user_id = $1`,
      [userId]
    );
    return res.json({ ok: true });
  });

  // DELETE /api/inbox/:id — delete a message (only if it belongs to current user)
  app.delete("/api/inbox/:id", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const msgId = parseInt(req.params.id, 10);
    const { pool } = await import("./db");
    await (pool as any).query(
      `DELETE FROM inbox_messages WHERE id = $1 AND to_user_id = $2`,
      [msgId, userId]
    );
    return res.json({ ok: true });
  });

  // ──────────────────────────────────────────────────────────────────────────

  return httpServer;
}
