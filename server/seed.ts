import { storage } from "./storage";
import { log } from "./index";
import { hashPassword } from "./auth";

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

  const hashed = await hashPassword("password");
  await storage.createUser({
    email: "admin@fastski.local",
    password: hashed,
    name: "Admin",
    groupScope: "Admin",
    isAdmin: 1,
  });
  log("Seeded admin account", "seed");
}

async function migratePasswords() {
  const allUsers = await storage.listUsers();
  for (const u of allUsers) {
    if (!u.password.startsWith("$2")) {
      const hashed = await hashPassword(u.password);
      await storage.updateUser(u.id, { password: hashed });
      log(`Migrated password for user ${u.email}`, "seed");
    }
  }
}

export async function seedDatabase() {
  await seedGroups();
  await seedAdmin();
  await migratePasswords();
}
