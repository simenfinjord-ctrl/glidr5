import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";

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
    name: u.name,
    groupScope: u.groupScope,
    isAdmin: u.isAdmin === 1,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {

  app.get("/api/series", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const list = await storage.listSeries(u.groupScope, u.isAdmin);
    res.json(list);
  });

  app.post("/api/series", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const now = new Date().toISOString();
    const result = await storage.createSeries({
      name: req.body.name,
      type: req.body.type,
      grind: req.body.grind || null,
      numberOfSkis: req.body.numberOfSkis ?? 8,
      lastRegrind: req.body.lastRegrind || null,
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
      groupScope: u.groupScope,
    });
    res.json(result);
  });

  app.put("/api/series/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getSeries(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const u = userInfo(req);
    if (!u.isAdmin && existing.groupScope !== u.groupScope) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const updated = await storage.updateSeries(id, {
      name: req.body.name,
      type: req.body.type,
      grind: req.body.grind || null,
      numberOfSkis: req.body.numberOfSkis,
      lastRegrind: req.body.lastRegrind || null,
    });
    res.json(updated);
  });

  app.get("/api/products", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const list = await storage.listProducts(u.groupScope, u.isAdmin);
    res.json(list);
  });

  app.post("/api/products", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const now = new Date().toISOString();
    const result = await storage.createProduct({
      category: req.body.category,
      brand: req.body.brand.trim(),
      name: req.body.name.trim(),
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
      groupScope: u.groupScope,
    });
    res.json(result);
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
    const result = await storage.createWeather({
      date: req.body.date,
      time: req.body.time,
      location: req.body.location.trim(),
      airTemperatureC: req.body.airTemperatureC,
      airHumidityPct: req.body.airHumidityPct,
      snowTemperatureC: req.body.snowTemperatureC,
      snowHumidityPct: req.body.snowHumidityPct,
      snowType: req.body.snowType.trim(),
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
      groupScope: u.groupScope,
    });
    res.json(result);
  });

  app.put("/api/weather/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getWeather(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const u = userInfo(req);
    if (!u.isAdmin && existing.groupScope !== u.groupScope) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const updated = await storage.updateWeather(id, {
      date: req.body.date,
      time: req.body.time,
      location: req.body.location.trim(),
      airTemperatureC: req.body.airTemperatureC,
      airHumidityPct: req.body.airHumidityPct,
      snowTemperatureC: req.body.snowTemperatureC,
      snowHumidityPct: req.body.snowHumidityPct,
      snowType: req.body.snowType.trim(),
    });
    res.json(updated);
  });

  app.get("/api/tests", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const list = await storage.listTests(u.groupScope, u.isAdmin);
    res.json(list);
  });

  app.post("/api/tests", requireAuth, async (req, res) => {
    const u = userInfo(req);
    const now = new Date().toISOString();
    const test = await storage.createTest({
      date: req.body.date,
      location: req.body.location.trim(),
      weatherId: req.body.weatherId || null,
      testType: req.body.testType,
      seriesId: req.body.seriesId,
      notes: req.body.notes?.trim() || null,
      createdAt: now,
      createdById: u.id,
      createdByName: u.name,
      groupScope: u.groupScope,
    });

    const entries = req.body.entries || [];
    for (const e of entries) {
      await storage.createEntry({
        testId: test.id,
        skiNumber: e.skiNumber,
        productId: e.productId || null,
        freeTextProduct: e.freeTextProduct || null,
        methodology: e.methodology || "",
        result0kmCmBehind: e.result0kmCmBehind ?? null,
        rank0km: e.rank0km ?? null,
        resultXkmCmBehind: e.resultXkmCmBehind ?? null,
        rankXkm: e.rankXkm ?? null,
        createdAt: now,
        createdById: u.id,
        createdByName: u.name,
        groupScope: u.groupScope,
      });
    }

    res.json(test);
  });

  app.get("/api/tests/:id/entries", requireAuth, async (req, res) => {
    const testId = parseInt(req.params.id);
    const entries = await storage.listEntries(testId);
    res.json(entries);
  });

  app.get("/api/users", requireAuth, async (req, res) => {
    const u = userInfo(req);
    if (!u.isAdmin) return res.status(403).json({ message: "Admin only" });
    const list = await storage.listUsers();
    res.json(list.map(({ password, ...rest }) => rest));
  });

  return httpServer;
}
