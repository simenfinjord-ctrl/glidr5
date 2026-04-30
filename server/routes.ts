import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage, parseGroupScopes } from "./storage";
import { parsePermissions, hashPassword } from "./auth";
import { type PermissionArea, type PermissionLevel, PERMISSION_AREAS, DEFAULT_PERMISSIONS, runsheetProgress, watchSessions, watchQueue, teams, tests, testEntries, users, testSkiSeries, products, dailyWeather } from "@shared/schema";
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

function userInfo(req: Request) {
  const u = req.user!;
  const perms = parsePermissions(u.permissions, u.isAdmin === 1, u.isTeamAdmin === 1);
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    groupScope: u.groupScope,
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
    const perms = parsePermissions(u.permissions, u.isAdmin === 1, u.isTeamAdmin === 1);
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
  return u.isAdmin === 1 || u.isTeamAdmin === 1;
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
    `);
  }

  // --- Maintenance mode gate (runs before all other /api routes) ---
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    if (!maintenanceMode) return next();
    // Always allow health check, auth, and the maintenance-mode status endpoint
    const exemptPaths = ["/api/health", "/api/admin/maintenance-mode"];
    if (exemptPaths.includes(req.path) || req.path.startsWith("/api/auth/")) return next();
    // Super Admins always pass through
    if (req.isAuthenticated() && (req.user as any)?.isAdmin === 1) return next();
    return res.status(503).json({ message: "Maintenance mode is active. The system will be back shortly.", maintenance: true });
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
    if (teamId === u.teamId && (req.session as any).stealth) {
      (req.session as any).stealth = false;
      const prev = (req.session as any).incognitoBeforeStealth;
      (req.session as any).incognito = !!prev;
      delete (req.session as any).incognitoBeforeStealth;
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
    const hasTestsPerm = u.isAdmin || u.isTeamAdmin || u.permissions.tests !== "none";
    const hasRaceskisPerm = u.isAdmin || u.isTeamAdmin || u.permissions.raceskis !== "none";
    const teamId = getActiveTeamId(req);
    let result: any[] = [];
    if (hasTestsPerm) {
      const list = await storage.listTests(u.groupScope, u.isScopeAdmin, teamId);
      result = u.permissions.grinding !== "none" ? list : list.filter((t: any) => t.testType !== "Grind");
    }
    if (!u.isScopeAdmin) {
      const athleteIds = await storage.listAthleteIdsForUser(u.id);
      if (athleteIds.length > 0) {
        const existingIds = new Set(result.map((t: any) => t.id));
        const allTeamTests = await storage.listAllTestsForTeam(teamId);
        const athleteTests = allTeamTests.filter((t: any) =>
          t.testSkiSource === "raceskis" && t.athleteId && athleteIds.includes(t.athleteId) && !existingIds.has(t.id)
        );
        result = [...result, ...athleteTests];
      }
    }
    if (result.length === 0 && !hasTestsPerm && !hasRaceskisPerm) {
      return res.status(403).json({ message: "No access" });
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
    if (u.permissions.tests === "none" && !u.isAdmin && !u.isTeamAdmin) {
      return res.json([]);
    }
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 50);
    let allTests = await storage.listTests(u.groupScope, u.isScopeAdmin, teamId);
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
    let hasAccess = userHasGroupAccess(u.groupScope, u.isScopeAdmin, test.groupScope) && u.permissions.tests !== "none";
    if (!hasAccess && (test as any).testSkiSource === "raceskis" && (test as any).athleteId) {
      hasAccess = await storage.hasAthleteAccess((test as any).athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    }
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden" });
    }
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
    let hasAccess = userHasGroupAccess(u.groupScope, u.isScopeAdmin, existing.groupScope) && u.permissions.tests === "edit";
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
    let hasAccess = userHasGroupAccess(u.groupScope, u.isScopeAdmin, existing.groupScope) && u.permissions.tests === "edit";
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
    const hasTestAccess = userHasGroupAccess(u.groupScope, u.isScopeAdmin, test.groupScope) && u.permissions.tests !== "none";
    let hasAccess = hasTestAccess;
    if (!hasAccess && (test as any).testSkiSource === "raceskis" && (test as any).athleteId) {
      hasAccess = await storage.hasAthleteAccess((test as any).athleteId, u.id, u.isScopeAdmin, getActiveTeamId(req));
    }
    if (!hasAccess) {
      console.log(`[entries] DENIED user=${u.name} testId=${testId} testAccess=${hasTestAccess}`);
      return res.status(403).json({ message: "Forbidden" });
    }
    if ((test as any).testType === "Grind" && u.permissions.grinding === "none") {
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
    let sanitizedPerms = sanitizePermissions(req.body.permissions);
    const teamId = u.isAdmin === 1 ? (req.body.teamId || getActiveTeamId(req)) : u.teamId;
    const isSuperAdmin = u.isAdmin === 1;
    if (!isSuperAdmin) {
      sanitizedPerms = await enforceTeamAreas(sanitizedPerms, teamId);
    }
    const hashedPw = await hashPassword(req.body.password);
    const created = await storage.createUser({
      email: req.body.email,
      password: hashedPw,
      name: req.body.name,
      groupScope: req.body.groupScope,
      isAdmin: isSuperAdmin && req.body.isAdmin ? 1 : 0,
      isTeamAdmin: req.body.isTeamAdmin ? 1 : 0,
      permissions: JSON.stringify(sanitizedPerms),
      teamId,
      isBlindTester: req.body.isBlindTester ? 1 : 0,
    });
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
    const hashedPw = await hashPassword(newPassword);
    const updated = await storage.updateUser(id, { password: hashedPw });
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
    if (u.password !== currentPassword) return res.status(403).json({ message: "Current password is incorrect" });
    if (newPassword.length < 1) return res.status(400).json({ message: "New password too short" });
    await storage.updateUser(u.id, { password: newPassword });
    res.json({ ok: true });
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

  // ── Security routes (Super Admin only) ─────────────────────────────────────

  // Get / set maintenance mode
  app.get("/api/admin/maintenance-mode", (_req, res) => {
    res.json({ enabled: maintenanceMode });
  });

  app.post("/api/admin/maintenance-mode", requireAuth, (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Super Admin only" });
    maintenanceMode = !!req.body.enabled;
    res.json({ enabled: maintenanceMode });
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
    userName: string;
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
        teamId: session.teamId ?? null,
        createdAt: new Date(session.createdAt).toISOString(),
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      }).onConflictDoUpdate({
        target: watchSessions.code,
        set: { bracket: JSON.stringify(session.bracket), skiLabels: labelsJson },
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
      .set({ runsheetBracket: JSON.stringify(session.bracket) })
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

      const filteredTests = allTests.filter((t) => {
        if (testType && t.testType !== testType) return false;
        return t.weatherId && weatherMap.has(t.weatherId);
      });

      function weatherSimilarity(w: any): number {
        let score = 0;
        const snowTDiff = Math.abs((w.snowTemperatureC ?? 0) - (snowTemperatureC ?? 0));
        const airTDiff = Math.abs((w.airTemperatureC ?? 0) - (airTemperatureC ?? 0));
        score += Math.max(0, 10 - snowTDiff * 2);
        score += Math.max(0, 8 - airTDiff * 1.5);
        const snowHDiff = Math.abs((w.snowHumidityPct ?? 50) - (snowHumidityPct ?? 50));
        const airHDiff = Math.abs((w.airHumidityPct ?? 50) - (airHumidityPct ?? 50));
        score += Math.max(0, 5 - snowHDiff / 10);
        score += Math.max(0, 4 - airHDiff / 10);
        if (artificialSnow && w.artificialSnow) score += 6;
        if (naturalSnow && w.naturalSnow === naturalSnow) score += 6;
        if (grainSize && w.grainSize === grainSize) score += 3;
        if (snowHumidityType && w.snowHumidityType === snowHumidityType) score += 3;
        if (trackHardness && w.trackHardness === trackHardness) score += 3;
        return score;
      }

      const scoredTests: { test: any; weather: any; similarity: number }[] = [];
      for (const test of filteredTests) {
        const weather = weatherMap.get(test.weatherId!);
        if (!weather) continue;
        const similarity = weatherSimilarity(weather);
        if (similarity > 5) {
          scoredTests.push({ test, weather, similarity });
        }
      }
      scoredTests.sort((a, b) => b.similarity - a.similarity);

      const productStats = new Map<number, { totalRank: number; count: number; wins: number; testCount: number; bestSimilarity: number }>();
      const topTests = scoredTests.slice(0, 50);

      for (const { test, similarity } of topTests) {
        const entries = await storage.listEntries(test.id);
        if (entries.length === 0) continue;
        const sorted = [...entries].sort((a, b) => (a.rank0km ?? 999) - (b.rank0km ?? 999));
        for (const entry of sorted) {
          if (!entry.productId) continue;
          const rank = entry.rank0km ?? 999;
          const stats = productStats.get(entry.productId) || { totalRank: 0, count: 0, wins: 0, testCount: 0, bestSimilarity: 0 };
          stats.totalRank += rank;
          stats.count += 1;
          if (rank === 1) stats.wins += 1;
          stats.testCount += 1;
          if (similarity > stats.bestSimilarity) stats.bestSimilarity = similarity;
          productStats.set(entry.productId, stats);
        }
      }

      const ranked = Array.from(productStats.entries())
        .map(([productId, stats]) => {
          const avgRank = stats.totalRank / stats.count;
          const winRate = stats.wins / stats.count;
          const compositeScore = (1 / avgRank) * 0.4 + winRate * 0.3 + (stats.bestSimilarity / 40) * 0.3;
          return { productId, avgRank, winRate, compositeScore, ...stats };
        })
        .sort((a, b) => b.compositeScore - a.compositeScore)
        .slice(0, 6);

      const suggestions = ranked.map((r, idx) => {
        const prod = productMap.get(r.productId);
        const productName = prod ? `${prod.brand} ${prod.name}` : "Unknown";
        let confidence: string;
        if (r.count >= 3 && r.bestSimilarity > 20) confidence = "High";
        else if (r.count >= 2 && r.bestSimilarity > 10) confidence = "Medium";
        else confidence = "Low";

        const avgRankStr = r.avgRank.toFixed(1);
        const winPct = (r.winRate * 100).toFixed(0);

        return {
          title: `#${idx + 1} ${productName}`,
          description: `Avg rank ${avgRankStr} across ${r.count} similar test${r.count > 1 ? "s" : ""}. Win rate: ${winPct}%. Based on ${topTests.length} matching tests.`,
          products: [productName],
          confidence,
        };
      });

      if (suggestions.length === 0) {
        res.json({ suggestions: [{ title: "No data", description: "Not enough historical test data matching these conditions. Try adjusting the parameters or run more tests.", products: [], confidence: "Low" }] });
      } else {
        res.json({ suggestions });
      }
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

  // Get active watch queue for current team (authenticated)
  app.get("/api/watch/queue", requireAuth, async (req, res) => {
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `SELECT * FROM watch_queue WHERE team_id = $1 AND status = 'active' ORDER BY added_at DESC`,
      [teamId]
    );
    res.json(result.rows);
  });

  // Get watch queue archive for current team (authenticated)
  app.get("/api/watch/queue/archive", requireAuth, async (req, res) => {
    const teamId = getActiveTeamId(req);
    const { pool } = await import("./db");
    const result = await (pool as any).query(
      `SELECT * FROM watch_queue WHERE team_id = $1 AND status = 'completed' ORDER BY completed_at DESC LIMIT 10`,
      [teamId]
    );
    res.json(result.rows);
  });

  // Add test to watch queue (authenticated)
  app.post("/api/watch/queue", requireAuth, async (req, res) => {
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
          const skiPairs = entriesRows.map((e) => e.skiNumber);
          sessionCode = await generateSessionCode();
          const session: WatchSession = {
            code: sessionCode,
            skiPairs,
            skiLabels: {}, // ski numbers displayed as-is on the watch
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

  // Remove from watch queue (authenticated)
  app.delete("/api/watch/queue/:id", requireAuth, async (req, res) => {
    const teamId = getActiveTeamId(req);
    const id = parseInt(req.params.id);
    const { pool } = await import("./db");
    await (pool as any).query(`DELETE FROM watch_queue WHERE id = $1 AND team_id = $2`, [id, teamId]);
    res.json({ ok: true });
  });

  // Restore archived item back to active queue
  app.post("/api/watch/queue/:id/restore", requireAuth, async (req, res) => {
    const teamId = getActiveTeamId(req);
    const id = parseInt(req.params.id);
    const { pool } = await import("./db");
    await (pool as any).query(
      `UPDATE watch_queue SET status = 'active', completed_at = NULL WHERE id = $1 AND team_id = $2`,
      [id, teamId]
    );
    res.json({ ok: true });
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
      `SELECT id FROM teams WHERE watch_pin = $1`, [pin]
    );
    if (!teamResult.rows[0]) return res.status(404).json({ message: "Invalid PIN" });
    const teamId = teamResult.rows[0].id;
    const result = await (pool as any).query(
      `SELECT id, test_id, series_id, test_name, series_name, added_by_name, added_at FROM watch_queue
       WHERE team_id = $1 AND status = 'active' ORDER BY added_at DESC`,
      [teamId]
    );
    res.json({ items: result.rows });
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

    // 1. Use the stored session code if it's still valid
    if (item.session_code) {
      const existingSession = await getWatchSession(item.session_code);
      if (existingSession) {
        // Clear any old product-name labels — watch always shows ski numbers
        if (existingSession.skiLabels && Object.keys(existingSession.skiLabels).length > 0) {
          existingSession.skiLabels = {};
          watchSessionsMemory.set(existingSession.code, existingSession);
          await db.update(watchSessions)
            .set({ skiLabels: "{}" })
            .where(eq(watchSessions.code, existingSession.code))
            .catch(() => {});
        }
        return res.json({ code: item.session_code, testName: item.test_name, seriesName: item.series_name, queueItemId: item.id });
      }
    }

    // 2. Session expired or missing — recreate it from the test's entries
    if (item.test_id) {
      try {
        const entriesRows = await db.select().from(testEntries).where(eq(testEntries.testId, Number(item.test_id)));
        if (entriesRows.length >= 2) {
          const skiPairs = entriesRows.map((e) => e.skiNumber);
          const newCode = await generateSessionCode();
          const session: WatchSession = {
            code: newCode,
            skiPairs,
            skiLabels: {}, // ski numbers displayed as-is on the watch
            bracket: watchInitBracket(skiPairs),
            createdAt: Date.now(),
            userId: 0,
            userName: item.added_by_name,
            testId: Number(item.test_id),
            testInfo: null,
            teamId,
          };
          await saveWatchSession(session);
          // Update queue item with new code
          await (pool as any).query(
            `UPDATE watch_queue SET session_code = $1 WHERE id = $2`,
            [newCode, item.id]
          );
          return res.json({ code: newCode, testName: item.test_name, seriesName: item.series_name, queueItemId: item.id });
        }
      } catch (_) {}
    }

    // 3. Cannot create session (no entries)
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

  return httpServer;
}
