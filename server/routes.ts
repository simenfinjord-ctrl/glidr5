import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage, parseGroupScopes } from "./storage";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

function userInfo(req: Request) {
  const u = req.user!;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    groupScope: u.groupScope,
    isAdmin: u.isAdmin === 1,
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

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {

  app.get("/api/groups", requireAuth, async (req, res) => {
    const list = await storage.listGroups();
    res.json(list);
  });

  app.post("/api/groups", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Admin only" });
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ message: "Name is required" });
    try {
      const created = await storage.createGroup({ name });
      res.json(created);
    } catch (e: any) {
      if (e.code === "23505") return res.status(409).json({ message: "Group already exists" });
      throw e;
    }
  });

  app.put("/api/groups/:id", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Admin only" });
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
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteGroup(id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  app.get("/api/series", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const list = await storage.listSeries(u.groupScope, u.isAdmin);
    res.json(list);
  });

  app.post("/api/series", requireAuth, async (req, res) => {
    const u = userInfo(req);
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
    });
    try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "created",
        entityType: "series", entityId: result.id,
        details: `Series: ${result.name}`, createdAt: new Date().toISOString(), groupScope,
      });
    } catch (_) {}
    res.json(result);
  });

  app.put("/api/series/:id", requireAuth, async (req, res) => {
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

  app.get("/api/series/archived", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const list = await storage.listArchivedSeries(u.groupScope, u.isAdmin);
    res.json(list);
  });

  app.post("/api/series/:id/archive", requireAuth, async (req, res) => {
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

  app.post("/api/series/:id/restore", requireAuth, async (req, res) => {
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

  app.delete("/api/series/:id", requireAuth, async (req, res) => {
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

  app.get("/api/products", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const list = await storage.listProducts(u.groupScope, u.isAdmin);
    res.json(list);
  });

  app.post("/api/products", requireAuth, async (req, res) => {
    const u = userInfo(req);
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
    });
    try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "created",
        entityType: "product", entityId: result.id,
        details: `Product: ${result.brand} ${result.name}`, createdAt: new Date().toISOString(), groupScope,
      });
    } catch (_) {}
    res.json(result);
  });

  app.put("/api/products/:id", requireAuth, async (req, res) => {
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

  app.delete("/api/products/:id", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    await storage.deleteProduct(id);
    try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "deleted",
        entityType: "product", entityId: id,
        details: "Product deleted", createdAt: new Date().toISOString(), groupScope: u.groupScope,
      });
    } catch (_) {}
    res.json({ ok: true });
  });

  app.get("/api/weather", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const list = await storage.listWeather(u.groupScope, u.isAdmin);
    res.json(list);
  });

  app.get("/api/weather/find", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const { date, location } = req.query as { date: string; location: string };
    if (!date || !location) return res.status(400).json({ message: "date and location required" });
    const w = await storage.findWeather(date, location, u.groupScope);
    res.json(w || null);
  });

  app.post("/api/weather", requireAuth, async (req, res) => {
    const u = userInfo(req);
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
    });
    try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "created",
        entityType: "weather", entityId: result.id,
        details: `Weather: ${req.body.date} ${req.body.location}`, createdAt: new Date().toISOString(), groupScope,
      });
    } catch (_) {}
    res.json(result);
  });

  app.put("/api/weather/:id", requireAuth, async (req, res) => {
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

  app.delete("/api/weather/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getWeather(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const u = userInfo(req);
    if (!userHasGroupAccess(u.groupScope, u.isAdmin, existing.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteWeather(id);
    try {
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
    const canGrind = u.isAdmin || !!(req.user! as any).canAccessGrinding;
    const list = await storage.listTests(u.groupScope, u.isAdmin);
    res.json(canGrind ? list : list.filter((t: any) => t.testType !== "Grind"));
  });

  app.post("/api/tests", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (req.body.testType === "Grind" && !u.isAdmin && !(req.user! as any).canAccessGrinding) {
      return res.status(403).json({ message: "Grinding access required" });
    }
    const now = new Date().toISOString();
    const groupScope = resolveCreateGroupScope(req);
    const test = await storage.createTest({
      date: req.body.date,
      location: req.body.location.trim(),
      weatherId: req.body.weatherId || null,
      testType: req.body.testType,
      seriesId: req.body.seriesId,
      notes: req.body.notes?.trim() || null,
      distanceLabel0km: req.body.distanceLabel0km?.trim() || null,
      distanceLabelXkm: req.body.distanceLabelXkm?.trim() || null,
      distanceLabels: req.body.distanceLabels || null,
      grindParameters: req.body.grindParameters || null,
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
      groupScope,
    });
    try {
      await storage.createActivityLog({
        userId: u.id, userName: u.name, action: "created",
        entityType: "test", entityId: test.id,
        details: `Test: ${req.body.testType} on ${req.body.date}`, createdAt: new Date().toISOString(), groupScope,
      });
    } catch (_) {}

    const entries = req.body.entries || [];
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
        grindType: e.grindType || null,
        grindStone: e.grindStone || null,
        grindPattern: e.grindPattern || null,
        createdAt: now,
        createdById: u.id,
        createdByName: u.name,
        groupScope,
      });
    }

    res.json(test);
  });

  app.get("/api/tests/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const test = await storage.getTest(id);
    if (!test) return res.status(404).json({ message: "Not found" });
    const u = userInfo(req);
    if (!userHasGroupAccess(u.groupScope, u.isAdmin, test.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if ((test as any).testType === "Grind" && !u.isAdmin && !(req.user! as any).canAccessGrinding) {
      return res.status(403).json({ message: "Grinding access required" });
    }
    res.json(test);
  });

  app.put("/api/tests/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getTest(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const u = userInfo(req);
    if (!userHasGroupAccess(u.groupScope, u.isAdmin, existing.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const testData: any = {
      date: req.body.date,
      location: req.body.location?.trim(),
      weatherId: req.body.weatherId || null,
      testType: req.body.testType,
      seriesId: req.body.seriesId,
      notes: req.body.notes?.trim() || null,
      distanceLabel0km: req.body.distanceLabel0km?.trim() || null,
      distanceLabelXkm: req.body.distanceLabelXkm?.trim() || null,
      distanceLabels: req.body.distanceLabels || null,
      grindParameters: req.body.grindParameters ?? null,
    };
    if (req.body.groupScope) testData.groupScope = req.body.groupScope;
    const updated = await storage.updateTest(id, testData);

    if (req.body.entries) {
      await storage.deleteEntriesByTestId(id);
      const now = new Date().toISOString();
      const groupScope = req.body.groupScope || existing.groupScope;
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
          grindType: e.grindType || null,
          grindStone: e.grindStone || null,
          grindPattern: e.grindPattern || null,
          createdAt: now,
          createdById: u.id,
          createdByName: u.name,
          groupScope,
        });
      }
    }

    res.json(updated);
  });

  app.delete("/api/tests/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getTest(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const u = userInfo(req);
    if (!userHasGroupAccess(u.groupScope, u.isAdmin, existing.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteTest(id);
    try {
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
    if (!userHasGroupAccess(u.groupScope, u.isAdmin, test.groupScope)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if ((test as any).testType === "Grind" && !u.isAdmin && !(req.user! as any).canAccessGrinding) {
      return res.status(403).json({ message: "Grinding access required" });
    }
    const entries = await storage.listEntries(testId);
    res.json(entries);
  });

  app.get("/api/users", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Admin only" });
    const list = await storage.listUsers();
    res.json(list.map(({ password, ...rest }) => rest));
  });

  app.post("/api/users", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Admin only" });
    const existing = await storage.getUserByEmail(req.body.email);
    if (existing) return res.status(409).json({ message: "Email already in use" });
    const created = await storage.createUser({
      email: req.body.email,
      password: req.body.password,
      name: req.body.name,
      groupScope: req.body.groupScope,
      isAdmin: req.body.isAdmin ? 1 : 0,
      canAccessGrinding: req.body.canAccessGrinding ? 1 : 0,
    });
    const { password, ...safe } = created;
    res.json(safe);
  });

  app.put("/api/users/:id", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    const data: any = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.email !== undefined) data.email = req.body.email;
    if (req.body.groupScope !== undefined) data.groupScope = req.body.groupScope;
    if (req.body.isAdmin !== undefined) data.isAdmin = req.body.isAdmin ? 1 : 0;
    if (req.body.canAccessGrinding !== undefined) data.canAccessGrinding = req.body.canAccessGrinding ? 1 : 0;
    if (req.body.isActive !== undefined) data.isActive = req.body.isActive ? 1 : 0;
    const updated = await storage.updateUser(id, data);
    if (!updated) return res.status(404).json({ message: "Not found" });
    const { password, ...safe } = updated;
    res.json(safe);
  });

  app.post("/api/users/:id/reset-password", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    const newPassword = req.body.password || "password";
    const updated = await storage.updateUser(id, { password: newPassword });
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  app.delete("/api/users/:id", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id);
    if (id === u.id) return res.status(400).json({ message: "Cannot delete yourself" });
    const deleted = await storage.deleteUser(id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  app.get("/api/login-logs", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Admin only" });
    const logs = await storage.listLoginLogs();
    res.json(logs);
  });

  app.post("/api/action-log", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const { action, details } = req.body;
    if (!action) return res.status(400).json({ message: "action required" });
    const ip = req.headers["x-forwarded-for"]
      ? String(req.headers["x-forwarded-for"]).split(",")[0].trim()
      : req.socket.remoteAddress || "unknown";
    await storage.createLoginLog({
      userId: u.id,
      email: u.email,
      name: u.name,
      loginAt: new Date().toISOString(),
      ipAddress: ip,
      action,
      details: details || null,
    });
    res.json({ ok: true });
  });

  // Activity feed
  app.get("/api/activity", requireAuth, async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await storage.listActivityLogs(limit);
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
  app.get("/api/grinding", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin && !(req.user! as any).canAccessGrinding) {
      return res.status(403).json({ message: "No access to grinding" });
    }
    const list = await storage.listGrindingRecords(u.groupScope, u.isAdmin);
    res.json(list);
  });

  app.post("/api/grinding", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin && !(req.user! as any).canAccessGrinding) {
      return res.status(403).json({ message: "No access to grinding" });
    }
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
    });
    await storage.createActivityLog({
      userId: u.id, userName: u.name, action: "created",
      entityType: "grinding", entityId: record.id,
      details: `Grinding: ${record.grindType}`, createdAt: new Date().toISOString(), groupScope,
    });
    res.json(record);
  });

  app.put("/api/grinding/:id", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin && !(req.user! as any).canAccessGrinding) {
      return res.status(403).json({ message: "No access to grinding" });
    }
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

  app.delete("/api/grinding/:id", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin && !(req.user! as any).canAccessGrinding) {
      return res.status(403).json({ message: "No access to grinding" });
    }
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteGrindingRecord(id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  app.get("/api/grinding-sheets", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin && !(req.user! as any).canAccessGrinding) {
      return res.status(403).json({ message: "No access to grinding" });
    }
    const sheets = await storage.listGrindingSheets(u.groupScope, u.isAdmin);
    res.json(sheets);
  });

  app.post("/api/grinding-sheets", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin && !(req.user! as any).canAccessGrinding) {
      return res.status(403).json({ message: "No access to grinding" });
    }
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
    });
    res.json(sheet);
  });

  app.put("/api/grinding-sheets/:id", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin && !(req.user! as any).canAccessGrinding) {
      return res.status(403).json({ message: "No access to grinding" });
    }
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

  app.delete("/api/grinding-sheets/:id", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin && !(req.user! as any).canAccessGrinding) {
      return res.status(403).json({ message: "No access to grinding" });
    }
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
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Admin only" });
    const [userCount, testCount, productCount, seriesCount, weatherCount, grindingCount, loginCount, activityCount] = await Promise.all([
      storage.countTable("users"),
      storage.countTable("tests"),
      storage.countTable("products"),
      storage.countTable("testSkiSeries"),
      storage.countTable("dailyWeather"),
      storage.countTable("grindingRecords"),
      storage.countTable("loginLogs"),
      storage.countTable("activityLogs"),
    ]);
    res.json({ userCount, testCount, productCount, seriesCount, weatherCount, grindingCount, loginCount, activityCount });
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

  return httpServer;
}
