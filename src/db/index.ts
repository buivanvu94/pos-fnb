import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL || "postgres://pos:pos_dev_pw@127.0.0.1:15450/pos";

/**
 * Singleton database pool connection for PostgreSQL.
 */
const globalForDb = globalThis as unknown as {
  posPool: Pool | undefined;
};

export const pool =
  globalForDb.posPool ??
  new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.posPool = pool;
}

export const db = drizzle(pool, { schema });
export type Database = typeof db;
