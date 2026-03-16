import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage, parseGroupScopes } from "./storage";
import { parsePermissions } from "./auth";
import { type PermissionArea, type PermissionLevel, PERMISSION_AREAS, DEFAULT_PERMISSIONS } from "@shared/schema";
import OpenAI from "openai";

function sanitizePermissions(input: any): Record<string, string> {
  const result: Record<string, string> = { ...DEFAULT_PERMISSIONS };
  if (!input) return result;
  const raw = typeof input === "string" ? (() => { try { return JSON.parse(input); } catch { return {}; } })() : input;
  if (typeof raw !== "object" || raw === null) return result;
  for (const area of PERMISSION_AREAS) {
    const val = raw[area];
    if (val === "none" || val === "view" || val === "edit") {
      result[area] = val;
    }
  }
  return result;
}

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

function isIncognito(req: Request): boolean {
  return !!(req.session as any)?.incognito;
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
    teamId: u.teamId,
    activeTeamId: getActiveTeamId(req),
    permissions: perms,
  };
}

function requirePermission(area: PermissionArea, level: PermissionLevel) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const u = req.user!;
    const perms = parsePermissions(u.permissions, u.isAdmin === 1, u.isTeamAdmin === 1);
    const userLevel = perms[area];
    if (userLevel === "none") {
      return res.status(403).json({ message: "No access" });
    }
    if (level === "edit" && userLevel === "view") {
      return res.status(403).json({ message: "Read-only access" });
    }
    next();
  };
}

function userHasGroupAccess(userGroupScope: string, isAdmin: boolean, recordGroupScope: string): boolean {
  if (isAdmin) return true;
  const userGroups = parseGroupScopes(userGroupScope);
  return userGroups.includes(recordGroupScope);
}

function resolveCreateGroupScope(req: Request): string {
  const u = req.user!;
  const isAdmin = u.isAdmin === 1;
  const requestedGroup = req.body.groupScope?.trim();

  if (requestedGroup) {
    if (isAdmin) return requestedGroup;
    const userGroups = parseGroupScopes(u.groupScope);
    if (userGroups.includes(requestedGroup)) return requestedGroup;
  }

  return parseGroupScopes(u.groupScope)[0] || u.groupScope;
}

function getActiveTeamId(req: Request): number {
  const u = req.user!;
  const isSuperAdmin = u.isAdmin === 1;
  if (isSuperAdmin) {
    return (u as any).activeTeamId || u.teamId;
  }
  return u.teamId;
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

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {

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
    const team = await storage.createTeam({ name, createdAt: new Date().toISOString() });
    res.json(team);
  });

  app.put("/api/teams/:id", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super admin only" });
    const id = parseInt(req.params.id);
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ message: "Name is required" });
    const updated = await storage.updateTeam(id, { name });
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

  app.post("/api/teams/switch", requireAuth, async (req, res) => {
    const u = req.user!;
    if (u.isAdmin !== 1) return res.status(403).json({ message: "Super admin only" });
    const teamId = req.body.teamId;
    if (!teamId) return res.status(400).json({ message: "teamId required" });
    const team = await storage.getTeam(teamId);
    if (!team) return res.status(404).json({ message: "Team not found" });
    await storage.updateUser(u.id, { activeTeamId: teamId } as any);
    res.json({ ok: true });
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
    const list = await storage.listSeries(u.groupScope, u.isAdmin, teamId);
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
        details: `Series: ${result.name}`, createdAt: new Date().toISOString(), groupScope,
      });
    } catch (_) {}
    res.json(result);
  });

  app.put("/api/series/:id", requirePermission("testskis", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getSeries(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const u = userInfo(req);
    if (!userHasGroupAccess(u.groupScope, u.isAdmin, existing.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const data: any = {
      name: req.body.name,
      type: req.body.type,
      grind: req.body.grind || null,
      numberOfSkis: req.body.numberOfSkis,
      lastRegrind: req.body.lastRegrind || null,
    };
    if (req.body.brand !== undefined) data.brand = req.body.brand;
    if (req.body.skiType !== undefined) data.skiType = req.body.skiType;
    if (req.body.groupScope) data.groupScope = req.body.groupScope;
    const updated = await storage.updateSeries(id, data);
    res.json(updated);
  });

  app.get("/api/series/archived", requirePermission("testskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const list = await storage.listArchivedSeries(u.groupScope, u.isAdmin, teamId);
    res.json(list);
  });

  app.post("/api/series/:id/archive", requirePermission("testskis", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getSeries(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const u = userInfo(req);
    if (!userHasGroupAccess(u.groupScope, u.isAdmin, existing.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const updated = await storage.archiveSeries(id);
    res.json(updated);
  });

  app.post("/api/series/:id/restore", requirePermission("testskis", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getSeries(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const u = userInfo(req);
    if (!userHasGroupAccess(u.groupScope, u.isAdmin, existing.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const updated = await storage.restoreSeries(id);
    res.json(updated);
  });

  app.delete("/api/series/:id", requirePermission("testskis", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getSeries(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const u = userInfo(req);
    if (!userHasGroupAccess(u.groupScope, u.isAdmin, existing.groupScope)) {
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
    const list = await storage.listProducts(u.groupScope, u.isAdmin, teamId);
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
        details: `Product: ${result.brand} ${result.name}`, createdAt: new Date().toISOString(), groupScope,
      });
    } catch (_) {}
    res.json(result);
  });

  app.put("/api/products/:id", requirePermission("products", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const data: any = {};
    if (req.body.groupScope !== undefined) {
      if (!u.isAdmin) return res.status(403).json({ message: "Admin only" });
      data.groupScope = req.body.groupScope;
    }
    if (req.body.category !== undefined) data.category = req.body.category;
    if (req.body.brand !== undefined) data.brand = req.body.brand;
    if (req.body.name !== undefined) data.name = req.body.name;
    const updated = await storage.updateProduct(id, data);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });

  app.delete("/api/products/:id", requirePermission("products", "edit"), async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    await storage.deleteProduct(id);
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "deleted",
        entityType: "product", entityId: id,
        details: "Product deleted", createdAt: new Date().toISOString(), groupScope: u.groupScope,
      });
    } catch (_) {}
    res.json({ ok: true });
  });

  app.get("/api/weather", requirePermission("weather", "view"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const list = await storage.listWeather(u.groupScope, u.isAdmin, teamId);
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
        details: `Weather: ${req.body.date} ${req.body.location}`, createdAt: new Date().toISOString(), groupScope,
      });
    } catch (_) {}
    res.json(result);
  });

  app.put("/api/weather/:id", requirePermission("weather", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getWeather(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const u = userInfo(req);
    if (!userHasGroupAccess(u.groupScope, u.isAdmin, existing.groupScope)) {
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
    const u = userInfo(req);
    if (!userHasGroupAccess(u.groupScope, u.isAdmin, existing.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteWeather(id);
    if (!isIncognito(req)) try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "deleted",
        entityType: "weather", entityId: id,
        details: "Weather deleted", createdAt: new Date().toISOString(), groupScope: existing.groupScope,
      });
    } catch (_) {}
    res.json({ ok: true });
  });

  app.get("/api/tests", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const hasTestsPerm = u.isAdmin || u.isTeamAdmin || u.permissions.tests !== "none";
    const hasRaceskisPerm = u.isAdmin || u.isTeamAdmin || u.permissions.raceskis !== "none";
    if (!hasTestsPerm && !hasRaceskisPerm) return res.status(403).json({ message: "No access" });
    const teamId = getActiveTeamId(req);
    let result: any[] = [];
    if (hasTestsPerm) {
      const list = await storage.listTests(u.groupScope, u.isAdmin, teamId);
      result = u.permissions.grinding !== "none" ? list : list.filter((t: any) => t.testType !== "Grind");
    }
    if (!u.isAdmin) {
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
    res.json(result);
  });

  app.post("/api/tests", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const testSkiSourceCheck = req.body.testSkiSource === "raceskis" ? "raceskis" : "series";
    const canCreateTest = u.isAdmin || u.isTeamAdmin || u.permissions.tests === "edit"
      || (testSkiSourceCheck === "raceskis" && u.permissions.raceskis !== "none");
    if (!canCreateTest) return res.status(403).json({ message: "No access" });
    if (req.body.testType === "Grind" && u.permissions.grinding === "none") {
      return res.status(403).json({ message: "Grinding access required" });
    }
    const now = new Date().toISOString();
    const groupScope = resolveCreateGroupScope(req);
    const testSkiSource = req.body.testSkiSource === "raceskis" ? "raceskis" : "series";
    if (testSkiSource === "raceskis" && u.permissions.raceskis === "none") {
      return res.status(403).json({ message: "Race skis access required" });
    }

    const entries = req.body.entries || [];
    if (testSkiSource === "raceskis") {
      const raceSkiIds = entries.map((e: any) => e.raceSkiId).filter(Boolean);
      if (raceSkiIds.length > 0) {
        const allowedSkis = await storage.listAllRaceSkisForUser(u.id, u.isAdmin);
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
        details: `Test: ${req.body.testType} on ${req.body.date}`, createdAt: new Date().toISOString(), groupScope,
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

  app.get("/api/tests/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const test = await storage.getTest(id);
    if (!test) return res.status(404).json({ message: "Not found" });
    const u = userInfo(req);
    let hasAccess = userHasGroupAccess(u.groupScope, u.isAdmin, test.groupScope) && u.permissions.tests !== "none";
    if (!hasAccess && (test as any).testSkiSource === "raceskis" && (test as any).athleteId) {
      hasAccess = await storage.hasAthleteAccess((test as any).athleteId, u.id, u.isAdmin);
    }
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if ((test as any).testType === "Grind" && u.permissions.grinding === "none") {
      return res.status(403).json({ message: "Grinding access required" });
    }
    res.json(test);
  });

  app.put("/api/tests/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getTest(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const u = userInfo(req);
    let hasAccess = userHasGroupAccess(u.groupScope, u.isAdmin, existing.groupScope) && u.permissions.tests === "edit";
    if (!hasAccess && (existing as any).testSkiSource === "raceskis" && (existing as any).athleteId) {
      hasAccess = await storage.hasAthleteAccess((existing as any).athleteId, u.id, u.isAdmin);
    }
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const testSkiSource = req.body.testSkiSource === "raceskis" ? "raceskis" : (existing as any).testSkiSource || "series";
    const testData: any = {
      date: req.body.date,
      location: req.body.location?.trim(),
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
        const allowedSkis = await storage.listAllRaceSkisForUser(u.id, u.isAdmin);
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
    const canEditTests = userHasGroupAccess(u.groupScope, u.isAdmin, existing.groupScope) && u.permissions.tests === "edit";
    const canEditRunsheets = userHasGroupAccess(u.groupScope, u.isAdmin, existing.groupScope) && u.permissions.runsheets === "edit";
    let hasAccess = canEditTests || canEditRunsheets;
    if (!hasAccess && (existing as any).testSkiSource === "raceskis" && (existing as any).athleteId) {
      hasAccess = await storage.hasAthleteAccess((existing as any).athleteId, u.id, u.isAdmin);
    }
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });

    const results = req.body.results;
    if (!Array.isArray(results)) return res.status(400).json({ message: "results array required" });

    const entries = await storage.listEntries(id);
    const entryBySkiNumber = new Map(entries.map((e: any) => [e.skiNumber, e]));

    for (const r of results) {
      const entry = entryBySkiNumber.get(r.skiNumber);
      if (!entry) continue;
      await storage.updateEntryResults((entry as any).id, r.diff ?? null, r.rank ?? null);
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

  app.get("/api/runsheets", requirePermission("runsheets", "view"), async (req, res) => {
    const teamId = getActiveTeamId(req);
    const items = await storage.listRunsheets(teamId);
    res.json(items);
  });

  app.post("/api/runsheets", requirePermission("runsheets", "edit"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const testId = parseInt(req.body.testId);
    const test = await storage.getTest(testId);
    if (!test || (test as any).teamId !== teamId) return res.status(404).json({ message: "Test not found" });

    const existing = await storage.getRunsheetByTestId(testId, teamId);
    if (existing) return res.status(409).json({ message: "Test already added to runsheets", runsheet: existing });

    let label = req.body.label?.trim();
    if (!label) {
      if ((test as any).testSkiSource === "raceskis" && (test as any).athleteId) {
        const athlete = await storage.getAthlete((test as any).athleteId);
        label = athlete ? athlete.name : `Race ski test #${testId}`;
      } else if (test.seriesId) {
        const allSeries = await storage.listSeries(u.groupScope, u.isAdmin, teamId);
        const series = allSeries.find((s: any) => s.id === test.seriesId);
        label = series ? (series as any).name : `Test #${testId}`;
      } else {
        label = `Test #${testId}`;
      }
    }

    const runsheet = await storage.createRunsheet({
      testId,
      label,
      createdAt: new Date().toISOString(),
      createdById: u.id,
      teamId,
    });
    res.json(runsheet);
  });

  app.delete("/api/runsheets/:id", requirePermission("runsheets", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
    const teamId = getActiveTeamId(req);
    const runsheet = await storage.getRunsheet(id);
    if (!runsheet || runsheet.teamId !== teamId) return res.status(404).json({ message: "Not found" });
    await storage.deleteRunsheet(id);
    res.json({ success: true });
  });

  app.delete("/api/tests/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getTest(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const u = userInfo(req);
    let hasAccess = userHasGroupAccess(u.groupScope, u.isAdmin, existing.groupScope) && u.permissions.tests === "edit";
    if (!hasAccess && (existing as any).testSkiSource === "raceskis" && (existing as any).athleteId) {
      hasAccess = await storage.hasAthleteAccess((existing as any).athleteId, u.id, u.isAdmin);
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
        details: "Test deleted", createdAt: new Date().toISOString(), groupScope: existing.groupScope,
      });
    } catch (_) {}
    res.json({ ok: true });
  });

  app.get("/api/tests/:id/entries", requireAuth, async (req, res) => {
    const testId = parseInt(req.params.id as string);
    const u = userInfo(req);
    const test = await storage.getTest(testId);
    if (!test) return res.status(404).json({ message: "Not found" });
    const hasTestAccess = userHasGroupAccess(u.groupScope, u.isAdmin, test.groupScope) && u.permissions.tests !== "none";
    const hasRunsheetAccess = userHasGroupAccess(u.groupScope, u.isAdmin, test.groupScope) && u.permissions.runsheets !== "none";
    let hasAccess = hasTestAccess || hasRunsheetAccess;
    if (!hasAccess && (test as any).testSkiSource === "raceskis" && (test as any).athleteId) {
      hasAccess = await storage.hasAthleteAccess((test as any).athleteId, u.id, u.isAdmin);
    }
    if (!hasAccess) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if ((test as any).testType === "Grind" && u.permissions.grinding === "none") {
      return res.status(403).json({ message: "Grinding access required" });
    }
    const entries = await storage.listEntries(testId);
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
    const sanitizedPerms = sanitizePermissions(req.body.permissions);
    const teamId = u.isAdmin === 1 ? (req.body.teamId || getActiveTeamId(req)) : u.teamId;
    const isSuperAdmin = u.isAdmin === 1;
    const created = await storage.createUser({
      email: req.body.email,
      password: req.body.password,
      name: req.body.name,
      groupScope: req.body.groupScope,
      isAdmin: isSuperAdmin && req.body.isAdmin ? 1 : 0,
      isTeamAdmin: req.body.isTeamAdmin ? 1 : 0,
      permissions: JSON.stringify(sanitizedPerms),
      teamId,
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
    if (req.body.permissions !== undefined) data.permissions = JSON.stringify(sanitizePermissions(req.body.permissions));
    if (req.body.isActive !== undefined) data.isActive = req.body.isActive ? 1 : 0;
    if (u.isAdmin === 1 && req.body.teamId !== undefined) data.teamId = req.body.teamId;
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
    const updated = await storage.updateUser(id, { password: newPassword });
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
    const list = await storage.listGrindingRecords(u.groupScope, u.isAdmin, teamId);
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
        details: `Grinding: ${record.grindType}`, createdAt: new Date().toISOString(), groupScope,
      });
    } catch (_) {}
    res.json(record);
  });

  app.put("/api/grinding/:id", requirePermission("grinding", "edit"), async (req, res) => {
    const id = parseInt(req.params.id);
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
    const deleted = await storage.deleteGrindingRecord(id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  app.get("/api/grinding-sheets", requirePermission("grinding", "view"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const sheets = await storage.listGrindingSheets(u.groupScope, u.isAdmin, teamId);
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
    if (!u.isAdmin) {
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
    if (!u.isAdmin) {
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
      const skis = await storage.listRaceSkis(ath.id);
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
    if (!u.isAdmin) return res.status(403).json({ message: "Admin only" });
    const targetId = parseInt(req.params.userId);
    const { pool } = await import("./db");
    await (pool as any).query(`DELETE FROM user_sessions WHERE sess::jsonb -> 'passport' ->> 'user' = $1`, [String(targetId)]);
    res.json({ ok: true });
  });

  // --- Athletes CRUD ---
  app.get("/api/athletes", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const teamId = getActiveTeamId(req);
    const list = await storage.listAthletes(u.id, u.isAdmin, teamId);
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
    const hasAccess = await storage.hasAthleteAccess(id, u.id, u.isAdmin);
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
    if (!u.isAdmin && athlete.createdById !== u.id) {
      return res.status(403).json({ message: "Only admin or creator can delete" });
    }
    await storage.deleteAthlete(id);
    res.json({ ok: true });
  });

  app.get("/api/athletes/:id/access", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const hasAccess = await storage.hasAthleteAccess(id, u.id, u.isAdmin);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const accessList = await storage.listAthleteAccess(id);
    res.json(accessList);
  });

  app.put("/api/athletes/:id/access", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const athlete = await storage.getAthlete(id);
    if (!athlete) return res.status(404).json({ message: "Not found" });
    if (!u.isAdmin && athlete.createdById !== u.id) {
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
    const list = await storage.listAllRaceSkisForUser(u.id, u.isAdmin);
    res.json(list);
  });

  app.get("/api/athletes/:athleteId/skis", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const athleteId = parseInt(req.params.athleteId);
    const hasAccess = await storage.hasAthleteAccess(athleteId, u.id, u.isAdmin);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const list = await storage.listRaceSkis(athleteId);
    res.json(list);
  });

  app.post("/api/athletes/:athleteId/skis", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const athleteId = parseInt(req.params.athleteId);
    const hasAccess = await storage.hasAthleteAccess(athleteId, u.id, u.isAdmin);
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
    const hasAccess = await storage.hasAthleteAccess(ski.athleteId, u.id, u.isAdmin);
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

  app.delete("/api/race-skis/:id", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const ski = await storage.getRaceSki(id);
    if (!ski) return res.status(404).json({ message: "Not found" });
    const hasAccess = await storage.hasAthleteAccess(ski.athleteId, u.id, u.isAdmin);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteRaceSki(id);
    res.json({ ok: true });
  });

  // --- Race Ski Regrinds ---
  app.get("/api/race-skis/:id/regrinds", requirePermission("raceskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const ski = await storage.getRaceSki(id);
    if (!ski) return res.status(404).json({ message: "Not found" });
    const hasAccess = await storage.hasAthleteAccess(ski.athleteId, u.id, u.isAdmin);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    const list = await storage.listRaceSkiRegrinds(id);
    res.json(list);
  });

  app.post("/api/race-skis/:id/regrinds", requirePermission("raceskis", "edit"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const ski = await storage.getRaceSki(id);
    if (!ski) return res.status(404).json({ message: "Not found" });
    const hasAccess = await storage.hasAthleteAccess(ski.athleteId, u.id, u.isAdmin);
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
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteRaceSkiRegrind(id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  // --- Test Ski Regrinds ---
  app.get("/api/series/:id/regrinds", requirePermission("testskis", "view"), async (req, res) => {
    const u = userInfo(req);
    const id = parseInt(req.params.id);
    const series = await storage.getSeries(id);
    if (!series) return res.status(404).json({ message: "Not found" });
    if (!userHasGroupAccess(u.groupScope, u.isAdmin, series.groupScope)) {
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
    if (!userHasGroupAccess(u.groupScope, u.isAdmin, series.groupScope)) {
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

  // --- Runsheet Watch Sessions (in-memory, for Garmin Connect IQ integration) ---

  type WatchHeat = { pairA: number | null; pairB: number | null; distA: string; distB: string };
  type WatchSession = {
    code: string;
    skiPairs: number[];
    bracket: WatchHeat[][];
    createdAt: number;
    userId: number;
  };

  const runsheetSessions = new Map<string, WatchSession>();

  function generateSessionCode(): string {
    let code: string;
    do {
      code = String(Math.floor(100000 + Math.random() * 900000));
    } while (runsheetSessions.has(code));
    return code;
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

  app.post("/api/runsheet/sessions", requireAuth, (req, res) => {
    const u = userInfo(req);
    const { skiPairs } = req.body;
    if (!Array.isArray(skiPairs) || skiPairs.length < 2) {
      return res.status(400).json({ message: "Need at least 2 ski pairs" });
    }
    const code = generateSessionCode();
    const session: WatchSession = {
      code,
      skiPairs: skiPairs.map(Number),
      bracket: watchInitBracket(skiPairs.map(Number)),
      createdAt: Date.now(),
      userId: u.id,
    };
    runsheetSessions.set(code, session);
    res.json({ code, bracket: session.bracket });
  });

  app.get("/api/runsheet/sessions/:code", requireAuth, (req, res) => {
    const session = runsheetSessions.get(req.params.code as string);
    if (!session) return res.status(404).json({ message: "Session not found" });
    const u = userInfo(req);
    if (session.userId !== u.id && !u.isAdmin) return res.status(403).json({ message: "Forbidden" });
    const currentHeat = watchFindCurrentHeat(session.bracket);
    const diffs = watchCalcDiffs(session.bracket);
    const results = [...diffs.entries()].sort((a, b) => a[1] - b[1]).map(([ski, diff], i, arr) => {
      let rank = 1;
      for (let j = 0; j < i; j++) { if (arr[j][1] < diff) rank = j + 2; }
      return { skiNumber: ski, diff, rank };
    });
    res.json({ bracket: session.bracket, currentHeat, results, skiPairs: session.skiPairs, complete: !currentHeat && results.length === session.skiPairs.length });
  });

  const watchRateLimits = new Map<string, { count: number; resetAt: number }>();

  function checkWatchRateLimit(code: string): boolean {
    const now = Date.now();
    let entry = watchRateLimits.get(code);
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + 60 * 1000 };
      watchRateLimits.set(code, entry);
    }
    entry.count++;
    return entry.count <= 60;
  }

  app.get("/api/runsheet/watch/:code", (req, res) => {
    const code = req.params.code as string;
    if (!checkWatchRateLimit(code)) return res.status(429).json({ message: "Too many requests" });
    const session = runsheetSessions.get(code);
    if (!session) return res.status(404).json({ message: "Invalid code" });
    const currentHeat = watchFindCurrentHeat(session.bracket);
    const diffs = watchCalcDiffs(session.bracket);
    const complete = !currentHeat && diffs.size === session.skiPairs.length;
    let champion: number | null = null;
    if (complete) {
      const sorted = [...diffs.entries()].sort((a, b) => a[1] - b[1]);
      if (sorted.length > 0) champion = sorted[0][0];
    }
    res.json({ currentHeat, complete, champion, totalPairs: session.skiPairs.length });
  });

  app.post("/api/runsheet/watch/:code/result", (req, res) => {
    const code = req.params.code as string;
    if (!checkWatchRateLimit(code)) return res.status(429).json({ message: "Too many requests" });
    const session = runsheetSessions.get(code);
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
    const nextHeat = watchFindCurrentHeat(session.bracket);
    res.json({ ok: true, nextHeat });
  });

  app.delete("/api/runsheet/sessions/:code", requireAuth, (req, res) => {
    const session = runsheetSessions.get(req.params.code as string);
    if (session) {
      const u = userInfo(req);
      if (session.userId !== u.id && !u.isAdmin) return res.status(403).json({ message: "Forbidden" });
    }
    runsheetSessions.delete(req.params.code as string);
    res.json({ ok: true });
  });

  setInterval(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [code, session] of runsheetSessions) {
      if (session.createdAt < cutoff) runsheetSessions.delete(code);
    }
  }, 60 * 60 * 1000);

  // --- AI Suggestions ---
  app.post("/api/suggestions", requirePermission("suggestions", "view"), async (req, res) => {
    const u = userInfo(req);
    const { snowTemperatureC, airTemperatureC, snowHumidityPct, airHumidityPct,
      artificialSnow, naturalSnow, grainSize, snowHumidityType, trackHardness, testType } = req.body;

    try {
      const teamId = getActiveTeamId(req);
      const allTests = await storage.listTests(u.groupScope, u.isAdmin, teamId);
      const allWeather = await storage.listWeather(u.groupScope, u.isAdmin, teamId);
      const products = await storage.listProducts(u.groupScope, u.isAdmin, teamId);
      const weatherMap = new Map(allWeather.map((w) => [w.id, w]));
      const productMap = new Map(products.map((p) => [p.id, p]));

      const testsWithWeather = allTests.filter((t) => t.weatherId && weatherMap.has(t.weatherId));

      const dataSummary: string[] = [];
      for (const test of testsWithWeather.slice(0, 100)) {
        const weather = weatherMap.get(test.weatherId!);
        if (!weather) continue;
        const entries = await storage.listEntries(test.id);
        if (entries.length === 0) continue;

        const sorted = [...entries].sort((a, b) => (a.rank0km ?? 999) - (b.rank0km ?? 999));
        const topEntries = sorted.slice(0, 3).map((e) => {
          const prod = e.productId ? productMap.get(e.productId) : null;
          return prod ? `${prod.brand} ${prod.name}` : (e.freeTextProduct || "Unknown");
        });

        dataSummary.push(
          `Test ${test.date} ${test.location} (${test.testType}): ` +
          `Snow ${weather.snowTemperatureC}°C, Air ${weather.airTemperatureC}°C, ` +
          `Snow humidity ${weather.snowHumidityPct}%, Air humidity ${weather.airHumidityPct}%, ` +
          `${weather.artificialSnow ? 'Artificial snow' : ''}${weather.naturalSnow ? 'Natural snow' : ''} ` +
          `Grain: ${weather.grainSize || 'N/A'}, Track: ${weather.trackHardness || 'N/A'} ` +
          `Top products: ${topEntries.join(", ")}`
        );
      }

      const productCatalog = products.map((p) => `${p.brand} ${p.name}`);
      const productCatalogStr = productCatalog.join("\n");

      const systemPrompt = `You are an expert ski wax/glide/structure recommendation assistant. Based on historical test data and current weather conditions, provide 4-6 product recommendations.

CRITICAL: You MUST ONLY recommend products from the available product catalog below. Do NOT invent, suggest, or reference any products that are not in this list. Each product name in the "products" array must be copied exactly from this list.

Available product catalog:
${productCatalogStr}

Return ONLY valid JSON in this format: {"suggestions": [{"title": "string", "description": "string", "products": ["${productCatalog[0] || "Brand ProductName"}"], "confidence": "High|Medium|Low"}]}`;

      const userPrompt = `Current conditions:
- Snow temperature: ${snowTemperatureC}°C
- Air temperature: ${airTemperatureC}°C
- Snow humidity: ${snowHumidityPct}%
- Air humidity: ${airHumidityPct}%
- Artificial snow: ${artificialSnow || 'N/A'}
- Natural snow: ${naturalSnow || 'N/A'}
- Grain size: ${grainSize || 'N/A'}
- Snow humidity type: ${snowHumidityType || 'N/A'}
- Track hardness: ${trackHardness || 'N/A'}
- Test type: ${testType || 'Glide'}

Historical test data (${dataSummary.length} tests):
${dataSummary.join("\n")}

Based on the above historical data and current conditions, recommend the best products. Only use products from the catalog provided in the system prompt.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      });

      const content = completion.choices[0]?.message?.content || "{}";
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      res.json(parsed);
    } catch (err: any) {
      console.error("AI suggestion error:", err);
      res.status(500).json({ message: "Failed to generate suggestions", error: err.message });
    }
  });

  return httpServer;
}
