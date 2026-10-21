import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import * as schema from "./schema";
import {
  initialAreas,
  initialTableTemplates,
  initialCategories,
  initialMenuItemTemplates,
  initialSettings,
} from "./seed-data";

dotenv.config();

/**
 * Idempotent seed function.
 * Refuses to run in production unless explicit --force flag is passed.
 * Does NOT overwrite existing user passwords, PINs, or roles.
 */
export async function runSeed(customUrl?: string, force = false): Promise<void> {
  const isProduction = process.env.NODE_ENV === "production";
  const hasForceFlag = force || process.argv.includes("--force");

  if (isProduction && !hasForceFlag) {
    throw new Error(
      "Refusing to execute seed in production without explicit --force flag.",
    );
  }

  const connectionString = customUrl || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is missing for running seed.");
  }

  const seedPassword =
    process.env.SEED_ADMIN_PASSWORD || (isProduction ? "" : "123456");
  const seedPin = process.env.SEED_ADMIN_PIN || (isProduction ? "" : "1234");

  if (isProduction && (!seedPassword || !seedPin)) {
    throw new Error(
      "SEED_ADMIN_PASSWORD and SEED_ADMIN_PIN must be supplied in production.",
    );
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  console.log("Seeding data (idempotent)...");

  // 1. Seed Users (Do NOT overwrite existing credentials or roles)
  const defaultPasswordHash = await bcrypt.hash(seedPassword, 10);
  const managerPinHash = await bcrypt.hash(seedPin, 10);

  const initialUsers: schema.NewUser[] = [
    {
      username: "quanly",
      fullName: "Nguyễn Văn Quản Lý",
      role: "QUAN_LY",
      passwordHash: defaultPasswordHash,
      pinHash: managerPinHash,
    },
    {
      username: "thungan",
      fullName: "Trần Thị Thu Ngân",
      role: "THU_NGAN",
      passwordHash: defaultPasswordHash,
    },
    {
      username: "phucvu",
      fullName: "Lê Văn Phục Vụ",
      role: "PHUC_VU",
      passwordHash: defaultPasswordHash,
    },
  ];

  for (const u of initialUsers) {
    await db
      .insert(schema.users)
      .values(u)
      .onConflictDoNothing({ target: schema.users.username });
  }

  // 2. Seed Areas
  for (const a of initialAreas) {
    await db
      .insert(schema.areas)
      .values(a)
      .onConflictDoUpdate({
        target: schema.areas.code,
        set: { name: a.name, displayOrder: a.displayOrder },
      });
  }

  const seededAreas = await db.select().from(schema.areas);
  const areaMap = new Map(seededAreas.map((a) => [a.code, a.id]));

  // 3. Seed Tables
  for (const t of initialTableTemplates) {
    const areaId = areaMap.get(t.areaCode);
    if (!areaId) continue;
    await db
      .insert(schema.tables)
      .values({
        code: t.code,
        name: t.name,
        areaId,
        capacity: t.capacity,
        status: t.status,
      })
      .onConflictDoUpdate({
        target: schema.tables.code,
        set: { name: t.name, areaId, capacity: t.capacity },
      });
  }

  // 4. Seed Categories
  for (const c of initialCategories) {
    await db
      .insert(schema.categories)
      .values(c)
      .onConflictDoUpdate({
        target: schema.categories.code,
        set: { name: c.name, displayOrder: c.displayOrder },
      });
  }

  const seededCats = await db.select().from(schema.categories);
  const catMap = new Map(seededCats.map((c) => [c.code, c.id]));

  // 5. Seed Menu Items
  for (const item of initialMenuItemTemplates) {
    const categoryId = catMap.get(item.categoryCode);
    if (!categoryId) continue;
    await db
      .insert(schema.menuItems)
      .values({
        code: item.code,
        name: item.name,
        categoryId,
        price: item.price,
        unit: item.unit,
        status: item.status,
        targetPrinter: item.targetPrinter,
      })
      .onConflictDoUpdate({
        target: schema.menuItems.code,
        set: {
          name: item.name,
          price: item.price,
          unit: item.unit,
          status: item.status,
          targetPrinter: item.targetPrinter,
        },
      });
  }

  // 6. Seed Settings
  for (const s of initialSettings) {
    await db
      .insert(schema.settings)
      .values(s)
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: { value: s.value, description: s.description },
      });
  }

  await pool.end();
  console.log("Seeding finished successfully.");
}

if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed error:", err);
      process.exit(1);
    });
}
