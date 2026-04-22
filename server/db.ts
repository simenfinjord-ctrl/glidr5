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
});

export const db = drizzle(pool, { schema });
