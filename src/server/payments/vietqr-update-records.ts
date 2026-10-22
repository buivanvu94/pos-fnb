import { eq, and } from "drizzle-orm";
import { orders, payments, tables, type Order } from "@/db/schema";
import type { db } from "@/db";

export interface UpdateVietQrRecordsParams {
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0];
  order: Order;
  expectedVersion?: number;
  shiftId: number;
  sepayTransactionId?: string;
  paymentId?: number;
  queueNumber: number | null;
  queueDate: string | null;
  now: Date;
}

export async function updateVietQrOrderAndPayment(params: UpdateVietQrRecordsParams): Promise<number> {
  const { tx, order, expectedVersion, shiftId, sepayTransactionId, paymentId, queueNumber, queueDate, now } = params;

  // 1. Update order to DA_THANH_TOAN
  await tx
    .update(orders)
    .set({
      status: "DA_THANH_TOAN",
      paidAt: now,
      paymentMethod: "VIETQR",
      queueNumber,
      queueDate,
      version: order.version + 1,
      updatedAt: now,
    })
    .where(
      expectedVersion !== undefined
        ? and(eq(orders.id, order.id), eq(orders.version, expectedVersion))
        : eq(orders.id, order.id),
    );

  // 2. Find target payment ID if not provided
  let targetPaymentId = paymentId;
  if (!targetPaymentId) {
    const [existing] = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.orderId, order.id), eq(payments.paymentMethod, "VIETQR")))
      .orderBy(payments.id)
      .limit(1);
    if (existing) {
      targetPaymentId = existing.id;
    }
  }

  // 3. Update or insert payment
  if (targetPaymentId) {
    await tx
      .update(payments)
      .set({
        status: "SUCCESS",
        sepayTransactionId: sepayTransactionId || null,
        amount: order.finalAmount,
        shiftId,
      })
      .where(eq(payments.id, targetPaymentId));
  } else {
    const [inserted] = await tx
      .insert(payments)
      .values({
        orderId: order.id,
        shiftId,
        paymentMethod: "VIETQR",
        amount: order.finalAmount,
        sepayTransactionId: sepayTransactionId || null,
        status: "SUCCESS",
        createdAt: now,
      })
      .returning({ id: payments.id });
    targetPaymentId = inserted.id;
  }

  // 4. Free table if dine-in
  if (order.tableId) {
    await tx
      .update(tables)
      .set({
        status: "TRONG",
        updatedAt: now,
      })
      .where(eq(tables.id, order.tableId));
  }

  return targetPaymentId;
}
