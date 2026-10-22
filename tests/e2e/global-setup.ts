import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/db/schema";
import { getTestDbUrl } from "../setup/test-config";

export interface E2eContext {
  tag: string;
  password: string;
  managerUsername: string;
  managerPin: string;
  cashierUsername: string;
  waiterUsername: string;
  tableAId: number;
  tableBId: number;
  menuItemId: number;
  menuItemPrice: number;
}

/** Số ngẫu nhiên có độ dài cố định, tránh PIN yếu (số lặp, dãy liên tiếp, năm sinh phổ biến). */
function randomSafePin(): string {
  const digits = "2357";
  let pin = "";
  while (pin.length < 6) pin += digits[Math.floor(Math.random() * digits.length)];
  return pin[0] === pin[1] && pin[1] === pin[2] ? `${pin.slice(0, 2)}9${pin.slice(3)}` : pin;
}

/** Tạo dữ liệu riêng cho lượt chạy e2e; mỗi lượt dùng tag mới nên không đụng dữ liệu cũ. */
export default async function globalSetup(): Promise<void> {
  const pool = new Pool({ connectionString: getTestDbUrl() });
  const db = drizzle(pool, { schema });
  const tag = Math.random().toString(36).slice(2, 8);
  const password = `E2e-${tag}-pass`;
  const managerPin = randomSafePin();

  const passwordHash = await bcrypt.hash(password, 10);
  const pinHash = await bcrypt.hash(managerPin, 10);

  const [manager] = await db
    .insert(schema.users)
    .values({ username: `e2e_mgr_${tag}`, fullName: "E2E Quản Lý", role: "QUAN_LY", passwordHash, pinHash })
    .returning();
  const [cashier] = await db
    .insert(schema.users)
    .values({ username: `e2e_cash_${tag}`, fullName: "E2E Thu Ngân", role: "THU_NGAN", passwordHash })
    .returning();
  const [waiter] = await db
    .insert(schema.users)
    .values({ username: `e2e_wait_${tag}`, fullName: "E2E Phục Vụ", role: "PHUC_VU", passwordHash })
    .returning();

  const [area] = await db.insert(schema.areas).values({ code: `E2E_${tag}`, name: `Khu E2E ${tag}` }).returning();
  const [tableA] = await db
    .insert(schema.tables)
    .values({ code: `EA_${tag}`, name: `Bàn E2E A ${tag}`, areaId: area.id })
    .returning();
  const [tableB] = await db
    .insert(schema.tables)
    .values({ code: `EB_${tag}`, name: `Bàn E2E B ${tag}`, areaId: area.id })
    .returning();

  const [category] = await db.insert(schema.categories).values({ code: `EC_${tag}`, name: `Nhóm E2E ${tag}` }).returning();
  const menuItemPrice = 50_000;
  const [item] = await db
    .insert(schema.menuItems)
    .values({ code: `EM_${tag}`, categoryId: category.id, name: `Cà phê E2E ${tag}`, price: menuItemPrice })
    .returning();

  await pool.end();

  const context: E2eContext = {
    tag,
    password,
    managerUsername: manager.username,
    managerPin,
    cashierUsername: cashier.username,
    waiterUsername: waiter.username,
    tableAId: tableA.id,
    tableBId: tableB.id,
    menuItemId: item.id,
    menuItemPrice,
  };
  // Worker của Playwright thừa hưởng biến môi trường đặt tại đây.
  process.env.E2E_CONTEXT = JSON.stringify(context);
}
