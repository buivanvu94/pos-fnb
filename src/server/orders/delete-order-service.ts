import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems, tables } from "@/db/schema";

/**
 * Cancels an empty order that has not had any items sent to the kitchen.
 */
export async function deleteEmptyOrder(orderId: number) {
  return await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)
      .for("update");

    if (!order) {
      return { ok: false, error: "Đơn hàng không tồn tại", status: 404 };
    }

    const printedItems = await tx
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(
        and(
          eq(orderItems.orderId, orderId),
          eq(orderItems.isPrintedKitchen, true),
          eq(orderItems.isCancelled, false),
        ),
      )
      .limit(1);

    if (printedItems.length > 0) {
      return {
        ok: false,
        error: "Không thể hủy đơn đã có món gửi bếp. Vui lòng liên hệ Quản lý!",
        status: 409,
      };
    }

    await tx
      .update(orders)
      .set({ status: "DA_HUY", tableId: null, updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    if (order.tableId) {
      await tx
        .update(tables)
        .set({ status: "TRONG", updatedAt: new Date() })
        .where(eq(tables.id, order.tableId));
    }

    return { ok: true, message: "Hủy đơn hàng thành công" };
  });
}
