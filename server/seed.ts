import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
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

async function seedAdmin() {
  const existing = await storage.getUserByEmail("admin@fastski.local");
  if (existing) return;

  await storage.createUser({
    email: "admin@fastski.local",
    password: "password",
    name: "Admin",
    groupScope: "Admin",
    isAdmin: 1,
  });
  log("Seeded admin account", "seed");
}

async function runMigrations() {
  const migrations: { name: string; query: ReturnType<typeof sql> }[] = [
    { name: "pair_labels on tests", query: sql`ALTER TABLE tests ADD COLUMN IF NOT EXISTS pair_labels TEXT` },
  ];
  for (const m of migrations) {
    try {
      await db.execute(m.query);
      log(`Migration OK: ${m.name}`, "seed");
    } catch (e: any) {
      log(`Migration FAILED (${m.name}): ${e.message}`, "seed");
    }
  }
}

export async function seedDatabase() {
  await runMigrations();
  await seedGroups();
  await seedAdmin();
}
