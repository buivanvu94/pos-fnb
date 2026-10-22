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

export async function createOrderWithPendingPayment(
  ctx: SepayTestContext,
  code: string,
  amount: number = 90000,
  isExpired: boolean = false,
) {
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
