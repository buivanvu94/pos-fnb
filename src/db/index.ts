import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Returns the PostgreSQL connection string.
 * Strictly throws if DATABASE_URL is not defined, without hardcoded fallback credentials.
 */
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL environment variable is strictly required in production");
    }
    throw new Error(
      "DATABASE_URL environment variable is missing. Please configure it in .env file.",
    );
  }
  return url;
}

const globalForDb = globalThis as unknown as {
  posPool: Pool | undefined;
};

export const pool =
  globalForDb.posPool ??
  new Pool({
    connectionString: getDatabaseUrl(),
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.posPool = pool;
}

export const db = drizzle(pool, { schema });
export type Database = typeof db;
