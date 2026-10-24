import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  posPool: Pool | undefined;
  posDb: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

/**
 * Lazily retrieves or instantiates the PostgreSQL pool.
 * Only validates and reads DATABASE_URL when a database operation is actually invoked,
 * allowing static builds (`next build`) to succeed even when DATABASE_URL is unset.
 */
export function getPool(): Pool {
  if (globalForDb.posPool) {
    return globalForDb.posPool;
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL environment variable is strictly required in production");
    }
    throw new Error(
      "DATABASE_URL environment variable is missing. Please configure it in .env file.",
    );
  }

  const createdPool = new Pool({
    connectionString: url,
    max: 25,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  globalForDb.posPool = createdPool;

  return createdPool;
}

/**
 * Lazily retrieves or instantiates the Drizzle ORM client.
 * Connects directly to the REAL Pool instance (not a proxy) so that
 * Drizzle node-postgres transaction connection checkout works atomically.
 */
export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!globalForDb.posDb) {
    const realPool = getPool();
    globalForDb.posDb = drizzle(realPool, { schema });
  }
  return globalForDb.posDb;
}

/**
 * Lazy proxy around PostgreSQL connection pool.
 */
export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const activePool = getPool();
    const val = (activePool as unknown as Record<string, unknown>)[prop as string];
    if (typeof val === "function") {
      return (val as (...args: unknown[]) => unknown).bind(activePool);
    }
    return val;
  },
});

/**
 * Lazy proxy around Drizzle ORM client instance.
 * Delegates to the real Drizzle instance built on the real Pool.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    const activeDb = getDb();
    const val = (activeDb as unknown as Record<string, unknown>)[prop as string];
    if (typeof val === "function") {
      return (val as (...args: unknown[]) => unknown).bind(activeDb);
    }
    return val;
  },
});

export type Database = typeof db;
