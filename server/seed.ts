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

export async function seedDatabase() {
  await seedGroups();
  await seedAdmin();
}
