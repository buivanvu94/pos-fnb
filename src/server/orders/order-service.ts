import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { orders, tables, shifts, Shift } from "@/db/schema";
import { generateOrderCode } from "@/db/code-generator";
import { TokenPayload } from "@/server/auth/jwt";
import { OrderItemDetail, OrderDetail } from "./order-types";
import { getOrderDetails } from "./order-details-query";

export type { OrderItemDetail, OrderDetail };
export { getOrderDetails };

/**
 * Creates a new active order for an empty table (TAI_BAN) (FR-01, FR-02, BR-02).
 * Verifies that the shift is still active ('DANG_MO') under a FOR SHARE lock.
 */
export async function createTableOrder(
  tableId: number,
  user: TokenPayload,
  shift: Shift,
): Promise<{ ok: true; order: OrderDetail } | { ok: false; error: string; status: number }> {
  return await db.transaction(async (tx) => {
    // 0. Verify shift is still open under FOR SHARE lock
    const [currentShift] = await tx
      .select({ id: shifts.id, status: shifts.status })
      .from(shifts)
      .where(eq(shifts.id, shift.id))
      .limit(1)
      .for("share");

    if (!currentShift || currentShift.status !== "DANG_MO") {
      return { ok: false, error: "Ca làm việc đã kết thúc hoặc không ở trạng thái Đang mở", status: 409 };
    }

    const [targetTable] = await tx
      .select()
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1)
      .for("update");

    if (!targetTable) {
      return { ok: false, error: "Bàn không tồn tại trên hệ thống", status: 404 };
    }

    if (targetTable.status !== "TRONG") {
      return { ok: false, error: "Bàn đang có khách, không thể mở đơn mới", status: 409 };
    }

    const [existingOrder] = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.tableId, tableId), eq(orders.status, "DANG_PHUC_VU")))
      .limit(1);

    if (existingOrder) {
      return { ok: false, error: "Bàn đang có khách, không thể mở đơn mới", status: 409 };
    }

    const orderCode = await generateOrderCode(tx as any);

    try {
      const [newOrder] = await tx
        .insert(orders)
        .values({
          orderCode,
          orderType: "TAI_BAN",
          tableId,
          shiftId: shift.id,
          totalAmount: 0,
          discountAmount: 0,
          finalAmount: 0,
          status: "DANG_PHUC_VU",
          version: 1,
          createdById: user.userId,
        })
        .returning();

      await tx
        .update(tables)
        .set({ status: "DANG_DUNG", updatedAt: new Date() })
        .where(eq(tables.id, tableId));

      return {
        ok: true,
        order: {
          id: newOrder.id,
          orderCode: newOrder.orderCode,
          orderType: newOrder.orderType,
          tableId: newOrder.tableId,
          tableName: targetTable.name,
          areaId: targetTable.areaId,
          areaName: null,
          shiftId: newOrder.shiftId,
          totalAmount: 0,
          discountAmount: 0,
          finalAmount: 0,
          paymentMethod: null,
          status: newOrder.status,
          version: newOrder.version,
          createdAt: newOrder.createdAt,
          items: [],
        },
      };
    } catch (err: any) {
      if (err?.code === "23505") {
        return { ok: false, error: "Bàn đang có khách, không thể mở đơn mới", status: 409 };
      }
      throw err;
    }
  });
}

/**
 * Creates a new active takeaway order (MANG_VE) without a table (FR-05, UC-04).
 * Verifies that the shift is still active ('DANG_MO') under a FOR SHARE lock.
 */
export async function createTakeawayOrder(
  user: TokenPayload,
  shift: Shift,
): Promise<{ ok: true; order: OrderDetail } | { ok: false; error: string; status: number }> {
  return await db.transaction(async (tx) => {
    // 0. Verify shift is still open under FOR SHARE lock
    const [currentShift] = await tx
      .select({ id: shifts.id, status: shifts.status })
      .from(shifts)
      .where(eq(shifts.id, shift.id))
      .limit(1)
      .for("share");

    if (!currentShift || currentShift.status !== "DANG_MO") {
      return { ok: false, error: "Ca làm việc đã kết thúc hoặc không ở trạng thái Đang mở", status: 409 };
    }

    const orderCode = await generateOrderCode(tx as any);

    const [newOrder] = await tx
      .insert(orders)
      .values({
        orderCode,
        orderType: "MANG_VE",
        tableId: null,
        shiftId: shift.id,
        totalAmount: 0,
        discountAmount: 0,
        finalAmount: 0,
        status: "DANG_PHUC_VU",
        version: 1,
        createdById: user.userId,
      })
      .returning();

    return {
      ok: true,
      order: {
        id: newOrder.id,
        orderCode: newOrder.orderCode,
        orderType: newOrder.orderType,
        tableId: null,
        tableName: null,
        areaId: null,
        areaName: null,
        shiftId: newOrder.shiftId,
        totalAmount: 0,
        discountAmount: 0,
        finalAmount: 0,
        paymentMethod: null,
        status: newOrder.status,
        version: newOrder.version,
        createdAt: newOrder.createdAt,
        items: [],
      },
    };
  });
}
