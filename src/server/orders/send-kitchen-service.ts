import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems, menuItems } from "@/db/schema";
import { TxAbortError } from "./tx-abort-error";

export type SendKitchenResult =
  | {
      ok: true;
      data: {
        orderId: number;
        orderCode: string;
        sentAt: string;
        items: {
          kitchen: any[];
          bar: any[];
        };
      };
    }
  | { ok: false; error: string; status: number };

/**
 * Marks unprinted order items as sent to kitchen and groups them by station (FR-03).
 * Verifies that the order is DANG_PHUC_VU and enforces optimistic locking via expectedVersion.
 */
export async function sendKitchenOrder(
  orderId: number,
  expectedVersion?: number,
): Promise<SendKitchenResult> {
  try {
    return await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1)
        .for("update");

      if (!order) throw new TxAbortError("Đơn hàng không tồn tại", 404);

      if (order.status !== "DANG_PHUC_VU") {
        throw new TxAbortError("Đơn hàng không ở trạng thái đang phục vụ, không thể gửi bếp", 409);
      }

      if (expectedVersion !== undefined && order.version !== expectedVersion) {
        throw new TxAbortError("Đơn hàng đã được cập nhật bởi phiên làm việc khác, vui lòng tải lại", 409);
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
        throw new TxAbortError("Không có món mới để gửi bếp", 409);
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
  } catch (err: any) {
    if (err instanceof TxAbortError) {
      return { ok: false, error: err.message, status: err.status };
    }
    throw err;
  }
}
