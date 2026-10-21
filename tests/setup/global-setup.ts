import { Client } from "pg";
import { runMigrations } from "@/db/migrate";
import { getTestDbUrl } from "./test-config";

/**
 * Vitest Global Setup:
 * 1. Connects to postgres database to ensure target test database exists.
 * 2. Runs pending Drizzle migrations cleanly before tests execute.
 */
export async function setup() {
  const testDbUrl = getTestDbUrl();
  const parsed = new URL(testDbUrl);
  const targetDbName = parsed.pathname.replace(/^\//, "");

  // Connect to default 'postgres' database on the same host
  parsed.pathname = "/postgres";
  const maintenanceClient = new Client({ connectionString: parsed.toString() });
  await maintenanceClient.connect();

  try {
    const checkDb = await maintenanceClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [targetDbName],
    );
    if (checkDb.rowCount === 0) {
      await maintenanceClient.query(`CREATE DATABASE "${targetDbName}"`);
      console.log(`Created test database "${targetDbName}".`);
    }
  } finally {
    await maintenanceClient.end();
  }

  // Run migrations against target test database
  await runMigrations(testDbUrl);
}
