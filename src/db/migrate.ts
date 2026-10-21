import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config();

/**
 * Runs pending Drizzle migrations against the target database.
 * Supports passing a custom connection string (e.g. for testing).
 *
 * @param customUrl - Optional database connection string
 */
export async function runMigrations(customUrl?: string): Promise<void> {
  const connectionString =
    customUrl ||
    process.env.DATABASE_URL ||
    "postgres://pos:pos_dev_pw@127.0.0.1:15450/pos";

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  const migrationsFolder = path.resolve(process.cwd(), "src/db/migrations");
  console.log(`Running migrations from ${migrationsFolder}...`);

  await migrate(db, { migrationsFolder });
  await pool.end();
  console.log("Migrations completed successfully.");
}

// Direct execution via `npm run db:migrate`
if (process.argv[1] && process.argv[1].endsWith("migrate.ts")) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration error:", err);
      process.exit(1);
    });
}
