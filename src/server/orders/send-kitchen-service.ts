import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems, menuItems } from "@/db/schema";

/**
 * Marks unprinted order items as sent to kitchen and groups them by station (FR-03).
 */
export async function sendKitchenOrder(orderId: number) {
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

    const unprintedItems = await tx
      .select({
        id: orderItems.id,
        menuItemId: orderItems.menuItemId,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        notes: orderItems.notes,
        name: menuItems.name,
        targetPrinter: menuItems.targetPrinter,
      })
      .from(orderItems)
      .leftJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
      .where(
        and(
          eq(orderItems.orderId, orderId),
          eq(orderItems.isPrintedKitchen, false),
          eq(orderItems.isCancelled, false),
        ),
      );

    if (unprintedItems.length === 0) {
      return { ok: false, error: "Không có món mới để gửi bếp", status: 409 };
    }

    const now = new Date();
    const unprintedIds = unprintedItems.map((i) => i.id);

    await tx
      .update(orderItems)
      .set({ isPrintedKitchen: true, sentAt: now })
      .where(inArray(orderItems.id, unprintedIds));

    await tx
      .update(orders)
      .set({ version: order.version + 1, updatedAt: now })
      .where(eq(orders.id, orderId));

    const kitchenItems = unprintedItems.filter((i) => (i.targetPrinter ?? "KITCHEN") === "KITCHEN");
    const barItems = unprintedItems.filter((i) => (i.targetPrinter ?? "KITCHEN") === "BAR");

    return {
      ok: true,
      data: {
        orderId,
        orderCode: order.orderCode,
        sentAt: now.toISOString(),
        items: {
          kitchen: kitchenItems,
          bar: barItems,
        },
      },
    };
  });
}
