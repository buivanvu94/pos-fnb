import { runMigrations } from "@/db/migrate";

/**
 * Vitest Global Setup:
 * Ensures test database schema is cleanly migrated before test suites run.
 */
export async function setup() {
  const testDbUrl =
    process.env.DATABASE_TEST_URL ||
    "postgres://pos:pos_dev_pw@127.0.0.1:15450/pos_test_p01";
  await runMigrations(testDbUrl);
}
