import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import * as schema from "./schema";

dotenv.config();

/**
 * Idempotent seed function populating users, areas, tables, categories and menu items.
 * Can be run repeatedly without duplicating data or throwing conflict errors.
 */
export async function runSeed(customUrl?: string): Promise<void> {
  const connectionString =
    customUrl ||
    process.env.DATABASE_URL ||
    "postgres://pos:pos_dev_pw@127.0.0.1:15450/pos";

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  console.log("Seeding initial data...");

  // 1. Seed Users (1 Quan ly, 1 Thu ngan, 1 Phuc vu)
  const defaultPasswordHash = await bcrypt.hash("123456", 10);
  const managerPinHash = await bcrypt.hash("1234", 10);

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
      .onConflictDoUpdate({
        target: schema.users.username,
        set: {
          fullName: u.fullName,
          role: u.role,
          passwordHash: u.passwordHash,
          pinHash: u.pinHash,
        },
      });
  }

  // 2. Seed Areas (Khu vuc mau)
  const initialAreas: schema.NewArea[] = [
    { code: "KV-T1", name: "Tầng 1 (Trong nhà)", displayOrder: 1 },
    { code: "KV-T2", name: "Tầng 2 (Máy lạnh)", displayOrder: 2 },
    { code: "KV-SV", name: "Sân vườn", displayOrder: 3 },
  ];

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

  // 3. Seed Tables (Ban mau)
  const t1Id = areaMap.get("KV-T1")!;
  const t2Id = areaMap.get("KV-T2")!;
  const svId = areaMap.get("KV-SV")!;

  const initialTables: schema.NewTable[] = [
    { code: "BAN-01", name: "Bàn 01", areaId: t1Id, capacity: 4, status: "TRONG" },
    { code: "BAN-02", name: "Bàn 02", areaId: t1Id, capacity: 4, status: "TRONG" },
    { code: "BAN-03", name: "Bàn 03", areaId: t1Id, capacity: 4, status: "TRONG" },
    { code: "BAN-04", name: "Bàn 04", areaId: t1Id, capacity: 4, status: "TRONG" },
    { code: "BAN-05", name: "Bàn 05", areaId: t2Id, capacity: 4, status: "TRONG" },
    { code: "BAN-06", name: "Bàn 06", areaId: t2Id, capacity: 6, status: "TRONG" },
    { code: "BAN-07", name: "Bàn 07", areaId: t2Id, capacity: 6, status: "TRONG" },
    { code: "BAN-08", name: "Bàn 08", areaId: svId, capacity: 8, status: "TRONG" },
  ];

  for (const t of initialTables) {
    await db
      .insert(schema.tables)
      .values(t)
      .onConflictDoUpdate({
        target: schema.tables.code,
        set: { name: t.name, areaId: t.areaId, capacity: t.capacity },
      });
  }

  // 4. Seed Categories & Menu Items
  const initialCategories: schema.NewCategory[] = [
    { code: "CAT-CF", name: "Cà phê", displayOrder: 1 },
    { code: "CAT-TRA", name: "Trà & Trà sữa", displayOrder: 2 },
    { code: "CAT-AN", name: "Món ăn nhẹ", displayOrder: 3 },
  ];

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

  const initialItems: schema.NewMenuItem[] = [
    {
      code: "CF-DEN",
      name: "Cà phê đen đá",
      categoryId: catMap.get("CAT-CF")!,
      price: 25000,
      unit: "Ly",
      status: "DANG_BAN",
      targetPrinter: "BAR",
    },
    {
      code: "CF-SUA",
      name: "Cà phê sữa đá",
      categoryId: catMap.get("CAT-CF")!,
      price: 29000,
      unit: "Ly",
      status: "DANG_BAN",
      targetPrinter: "BAR",
    },
    {
      code: "TRA-DAO",
      name: "Trà đào cam sả",
      categoryId: catMap.get("CAT-TRA")!,
      price: 35000,
      unit: "Ly",
      status: "DANG_BAN",
      targetPrinter: "BAR",
    },
    {
      code: "BANH-MI",
      name: "Bánh mì chảo",
      categoryId: catMap.get("CAT-AN")!,
      price: 45000,
      unit: "Phần",
      status: "DANG_BAN",
      targetPrinter: "KITCHEN",
    },
  ];

  for (const item of initialItems) {
    await db
      .insert(schema.menuItems)
      .values(item)
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

  // 5. Seed Settings
  const initialSettings: schema.NewSetting[] = [
    { key: "STORE_NAME", value: "POS F&B Quán Việt", description: "Tên quán hiển thị" },
    { key: "STORE_ADDRESS", value: "123 Đường Ẩm Thực, Quận 1, TP. HCM", description: "Địa chỉ quán" },
    { key: "STORE_PHONE", value: "0901234567", description: "Số điện thoại hotline" },
  ];

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

// Direct execution via `npm run db:seed`
if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed error:", err);
      process.exit(1);
    });
}
