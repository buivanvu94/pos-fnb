import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import * as dotenv from "dotenv";
import * as schema from "@/db/schema";
import { parseMenuCsv, ParseMenuCsvResult } from "@/server/menu/csv-parser";

dotenv.config();

export interface SeedMenuOptions {
  isContent?: boolean;
  connectionString?: string;
  silent?: boolean;
}

export interface SeedMenuResult {
  total: number;
  inserted: number;
  updated: number;
  errors: ParseMenuCsvResult["errors"];
}

function generateCategoryCode(): string {
  const rand = Math.floor(100 + Math.random() * 900);
  return `CAT-${Date.now().toString().slice(-4)}${rand}`;
}

function generateItemCode(): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `MON-${Date.now().toString().slice(-4)}${rand}`;
}

/**
 * Idempotently seed menu items and categories from CSV.
 * Key constraint: Unique identity by (category, name).
 * Running multiple times updates existing items without duplicating.
 */
export async function seedMenuFromCsv(
  fileOrContent: string,
  options: SeedMenuOptions = {},
): Promise<SeedMenuResult> {
  let csvText: string;

  if (options.isContent) {
    csvText = fileOrContent;
  } else {
    const fullPath = path.resolve(process.cwd(), fileOrContent);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File không tồn tại: ${fullPath}`);
    }
    csvText = fs.readFileSync(fullPath, "utf-8");
  }

  const parseResult = parseMenuCsv(csvText);

  if (!options.silent && parseResult.errors.length > 0) {
    console.warn(`\n[Cảnh báo] Phát hiện ${parseResult.errors.length} dòng có lỗi trong CSV:`);
    for (const err of parseResult.errors) {
      console.warn(`  - Dòng ${err.line}: ${err.error}`);
    }
  }

  const connectionString =
    options.connectionString ||
    process.env.DATABASE_TEST_URL ||
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("Không tìm thấy cấu hình kết nối cơ sở dữ liệu (DATABASE_URL)");
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  let inserted = 0;
  let updated = 0;

  try {
    // Cache categories to reduce redundant queries
    const existingCats = await db.select().from(schema.categories);
    const catMap = new Map<string, number>();
    for (const cat of existingCats) {
      catMap.set(cat.name.trim().toLowerCase(), cat.id);
    }

    for (const item of parseResult.items) {
      const catKey = item.categoryName.trim().toLowerCase();
      let categoryId = catMap.get(catKey);

      // Create category if not exists
      if (!categoryId) {
        const [newCat] = await db
          .insert(schema.categories)
          .values({
            code: generateCategoryCode(),
            name: item.categoryName.trim(),
            displayOrder: catMap.size + 1,
            isActive: true,
          })
          .returning();

        categoryId = newCat.id;
        catMap.set(catKey, categoryId);
      }

      // Check if item already exists by (categoryId, name)
      const existingItems = await db
        .select()
        .from(schema.menuItems)
        .where(
          sql`${schema.menuItems.categoryId} = ${categoryId} AND LOWER(${schema.menuItems.name}) = LOWER(${item.name.trim()})`,
        )
        .limit(1);

      if (existingItems.length > 0) {
        // Update existing item
        await db
          .update(schema.menuItems)
          .set({
            price: item.price,
            unit: item.unit,
            status: item.status,
            updatedAt: sql`NOW()`,
          })
          .where(eq(schema.menuItems.id, existingItems[0].id));
        updated++;
      } else {
        // Insert new item
        await db.insert(schema.menuItems).values({
          code: generateItemCode(),
          categoryId,
          name: item.name.trim(),
          price: item.price,
          unit: item.unit,
          status: item.status,
          targetPrinter: "KITCHEN",
        });
        inserted++;
      }
    }
  } finally {
    await pool.end();
  }

  if (!options.silent) {
    console.log(`\n========================================`);
    console.log(`BÁO CÁO KẾT QUẢ NHẬP THỰC ĐƠN TỪ CSV:`);
    console.log(`- Tổng số món hợp lệ: ${parseResult.items.length}`);
    console.log(`- Món tạo mới:        ${inserted}`);
    console.log(`- Món cập nhật:       ${updated}`);
    console.log(`- Số dòng lỗi:        ${parseResult.errors.length}`);
    console.log(`========================================\n`);
  }

  return {
    total: parseResult.items.length,
    inserted,
    updated,
    errors: parseResult.errors,
  };
}

// CLI execution handling
if (process.argv[1] && process.argv[1].endsWith("seed-menu.ts")) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Cách dùng: npm run seed:menu -- <đường_dẫn_file_csv>");
    console.error("Ví dụ:    npm run seed:menu -- data/menu.csv");
    process.exit(1);
  }

  seedMenuFromCsv(filePath)
    .then(() => {
      console.log("Hoàn tất nhập thực đơn.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Lỗi khi nhập thực đơn:", err);
      process.exit(1);
    });
}
