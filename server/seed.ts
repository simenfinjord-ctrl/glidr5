import { storage } from "./storage";
import { log } from "./index";

async function seedGroups() {
  const existing = await storage.listGroups();
  if (existing.length > 0) return;
  const defaults = ["Admin", "World Cup", "U23", "Biathlon"];
  for (const name of defaults) {
    await storage.createGroup({ name });
  }
  log("Seeded default groups", "seed");
}

export async function seedDatabase() {
  await seedGroups();

  const existing = await storage.getUserByEmail("admin@fastski.local");
  if (existing) {
    log("Database already seeded, skipping", "seed");
    return;
  }

  log("Seeding database with demo data...", "seed");

  const admin = await storage.createUser({
    email: "admin@fastski.local",
    password: "password",
    name: "Admin",
    groupScope: "Admin",
    isAdmin: 1,
  });

  const u23Coach = await storage.createUser({
    email: "u23@fastski.local",
    password: "password",
    name: "U23 Coach",
    groupScope: "U23",
    isAdmin: 0,
  });

  await storage.createUser({
    email: "wc@fastski.local",
    password: "password",
    name: "World Cup Tech",
    groupScope: "World Cup",
    isAdmin: 0,
  });

  await storage.createUser({
    email: "biathlon@fastski.local",
    password: "password",
    name: "Biathlon Tech",
    groupScope: "Biathlon",
    isAdmin: 0,
  });

  const now = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);

  await storage.createSeries({
    name: "Testskis Blue 1",
    type: "Glide",
    grind: null,
    numberOfSkis: 8,
    lastRegrind: null,
    createdAt: now,
    createdById: admin.id,
    createdByName: admin.name,
    groupScope: "Admin",
  });

  await storage.createSeries({
    name: "U23 Structure Set",
    type: "Structure",
    grind: "R3",
    numberOfSkis: 6,
    lastRegrind: "2025-12-01",
    createdAt: now,
    createdById: u23Coach.id,
    createdByName: u23Coach.name,
    groupScope: "U23",
  });

  await storage.createProduct({
    category: "Glide product",
    brand: "Swix",
    name: "HS10",
    createdAt: now,
    createdById: admin.id,
    createdByName: admin.name,
    groupScope: "Admin",
  });

  await storage.createProduct({
    category: "Topping product",
    brand: "Toko",
    name: "Top Finish",
    createdAt: now,
    createdById: admin.id,
    createdByName: admin.name,
    groupScope: "Admin",
  });

  await storage.createProduct({
    category: "Structure tool",
    brand: "SVST",
    name: "1.0 mm linear",
    createdAt: now,
    createdById: admin.id,
    createdByName: admin.name,
    groupScope: "Admin",
  });

  await storage.createWeather({
    date: today,
    time: "09:30",
    location: "Park City",
    airTemperatureC: -6,
    airHumidityPct: 55,
    snowTemperatureC: -9,
    snowHumidityPct: 40,
    snowType: "New snow",
    createdAt: now,
    createdById: admin.id,
    createdByName: admin.name,
    groupScope: "Admin",
  });

  log("Seeding complete", "seed");
}
