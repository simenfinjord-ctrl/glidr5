// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  console.error("==============================================");
  console.error("FATAL ERROR: DATABASE_URL is not set.");
  console.error("Please add a PostgreSQL database in Railway:");
  console.error("  1. Go to your Railway project");
  console.error("  2. Click '+ New' -> Database -> Add PostgreSQL");
  console.error("  3. The DATABASE_URL will be linked automatically");
  console.error("==============================================");
  process.exit(1);
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 20,                      // tåler 20 samtidige brukere komfortabelt
  idleTimeoutMillis: 30000,     // frigjør idle-tilkoblinger etter 30 sek
  connectionTimeoutMillis: 5000, // feil raskt hvis pool er full
});

// Sett statement_timeout for alle nye tilkoblinger — hindrer hengende queries
pool.on("connect", (client) => {
  client.query("SET statement_timeout = '30s'").catch(() => {});
});

export const db = drizzle(pool, { schema });
