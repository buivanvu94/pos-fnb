import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { formatVietqrTransferContent } from "@/server/payments/vietqr-generator";

export interface SepayTestContext {
  db: ReturnType<typeof drizzle<typeof schema>>;
  testUserId: number;
  testAreaId: number;
  testShiftId: number;
  testMenuItemId: number;
}

export async function setupSepayTestContext(db: ReturnType<typeof drizzle<typeof schema>>): Promise<SepayTestContext> {
  const rand = () => Math.random().toString(36).slice(2, 8);
  const tag = rand();

  const [user] = await db.insert(schema.users).values({
    username: `u_sp_${tag}`,
    fullName: "User Test SePay",
    role: "THU_NGAN",
    passwordHash: "dummy",
  }).returning();

  const [area] = await db.insert(schema.areas).values({ code: `AR_SP_${tag}`, name: `Khu SP ${tag}` }).returning();

  const [shift] = await db.insert(schema.shifts).values({
    shiftCode: `CA_SP_${tag}`,
    cashierId: user.id,
    initialCash: 100_000,
    status: "DANG_MO",
  }).returning();

  const [cat] = await db.insert(schema.categories).values({ code: `CAT_SP_${tag}`, name: "Menu SP" }).returning();
  const [item] = await db.insert(schema.menuItems).values({
    code: `MI_SP_${tag}`,
    categoryId: cat.id,
    name: "Bạc xỉu",
    price: 90_000,
    targetPrinter: "BAR",
  }).returning();

  return { db, testUserId: user.id, testAreaId: area.id, testShiftId: shift.id, testMenuItemId: item.id };
}

export async function createOrderWithPendingPayment(
  ctx: SepayTestContext,
  code: string,
  amount: number = 90000,
  isExpired: boolean = false,
) {
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
    createdById: ctx.testUserId,
  }).returning();

  await ctx.db.insert(schema.orderItems).values({
    orderId: order.id,
    menuItemId: ctx.testMenuItemId,
    quantity: 1,
    unitPrice: amount,
  });

  const compactCode = formatVietqrTransferContent(code);
  const [payment] = await ctx.db.insert(schema.payments).values({
    orderId: order.id,
    shiftId: ctx.testShiftId,
    paymentMethod: "VIETQR",
    amount,
    vietqrRef: compactCode,
    status: isExpired ? "EXPIRED" : "PENDING",
    expiresAt: isExpired ? new Date(Date.now() - 10000) : new Date(Date.now() + 180000),
  }).returning();

  return { order, table, payment, compactCode };
}
