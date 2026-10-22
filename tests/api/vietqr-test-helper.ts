import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { signAuthToken } from "@/server/auth/jwt";

export interface VietQrTestContext {
  db: ReturnType<typeof drizzle<typeof schema>>;
  cashierUserId: number;
  cashierToken: string;
  managerUserId: number;
  managerPin: string;
  testAreaId: number;
  testShiftId: number;
  testMenuItemId: number;
}

export async function setupVietQrTestContext(db: ReturnType<typeof drizzle<typeof schema>>): Promise<VietQrTestContext> {
  const rand = () => Math.random().toString(36).slice(2, 8);
  const tag = rand();
  const managerPin = String(Math.floor(10000 + Math.random() * 89999));
  const pinHash = await bcrypt.hash(managerPin, 10);

  const [manager] = await db.insert(schema.users).values({
    username: `m_vqr_${tag}`,
    fullName: "Quản Lý Test VietQR",
    role: "QUAN_LY",
    passwordHash: "dummy",
    pinHash,
  }).returning();

  const [cashier] = await db.insert(schema.users).values({
    username: `c_vqr_${tag}`,
    fullName: "Thu Ngân Test VietQR",
    role: "THU_NGAN",
    passwordHash: "dummy",
  }).returning();

  const cashierToken = await signAuthToken({
    userId: cashier.id,
    username: cashier.username,
    fullName: cashier.fullName,
    role: "THU_NGAN",
  });

  const [area] = await db.insert(schema.areas).values({ code: `AR_VQR_${tag}`, name: `Khu VQR ${tag}` }).returning();

  const [shift] = await db.insert(schema.shifts).values({
    shiftCode: `CA_VQR_${tag}`,
    cashierId: cashier.id,
    initialCash: 100_000,
    status: "DANG_MO",
  }).returning();

  const [cat] = await db.insert(schema.categories).values({ code: `CAT_VQR_${tag}`, name: "Menu VQR" }).returning();
  const [item] = await db.insert(schema.menuItems).values({
    code: `MI_VQR_${tag}`,
    categoryId: cat.id,
    name: "Cà phê sữa đá",
    price: 150_000,
    targetPrinter: "BAR",
  }).returning();

  return {
    db,
    cashierUserId: cashier.id,
    cashierToken,
    managerUserId: manager.id,
    managerPin,
    testAreaId: area.id,
    testShiftId: shift.id,
    testMenuItemId: item.id,
  };
}

export async function createVietQrTestOrder(ctx: VietQrTestContext, code: string, amount: number = 150000) {
  const existing = await ctx.db.select({ id: schema.orders.id }).from(schema.orders).where(eq(schema.orders.orderCode, code));
  for (const row of existing) {
    await ctx.db.delete(schema.payments).where(eq(schema.payments.orderId, row.id));
    await ctx.db.delete(schema.orderItems).where(eq(schema.orderItems.orderId, row.id));
    await ctx.db.delete(schema.orders).where(eq(schema.orders.id, row.id));
  }

  const rand = () => Math.random().toString(36).slice(2, 8);
  const [table] = await ctx.db.insert(schema.tables).values({
    code: `TB_${rand()}`,
    areaId: ctx.testAreaId,
    name: `Bàn ${rand()}`,
    capacity: 4,
    status: "DANG_DUNG",
  }).returning();

  const [order] = await ctx.db.insert(schema.orders).values({
    orderCode: code,
    orderType: "TAI_BAN",
    tableId: table.id,
    shiftId: ctx.testShiftId,
    totalAmount: amount,
    finalAmount: amount,
    status: "DANG_PHUC_VU",
    createdById: ctx.cashierUserId,
  }).returning();

  await ctx.db.insert(schema.orderItems).values({
    orderId: order.id,
    menuItemId: ctx.testMenuItemId,
    quantity: 1,
    unitPrice: amount,
  });
  return order;
}
