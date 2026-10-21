import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems, tables } from "@/db/schema";
import { logAudit } from "@/server/approvals/audit-log-service";
import { TxAbortError } from "./tx-abort-error";
import type { ActingUser } from "@/server/approvals/approval-types";

export type DeleteOrderResult =
  | { ok: true; message: string }
  | { ok: false; error: string; status: number };

/**
 * Cancels an empty active order that has no line items sent to the kitchen.
 * Enforces status check (must be DANG_PHUC_VU), empty order check, and optimistic locking.
 * Resets table status to TRONG and logs DELETE_EMPTY_ORDER audit record.
 */
export async function deleteEmptyOrder(
  orderId: number,
  expectedVersion?: number,
  actingUser?: ActingUser,
  clientIp?: string | null,
  userAgent?: string | null,
): Promise<DeleteOrderResult> {
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
        throw new TxAbortError("Đơn hàng không ở trạng thái đang phục vụ, không thể hủy đơn", 409);
      }

      if (expectedVersion !== undefined && order.version !== expectedVersion) {
        throw new TxAbortError("Đơn hàng đã được cập nhật bởi phiên làm việc khác, vui lòng tải lại", 409);
      }

      const activeItems = await tx
        .select({ id: orderItems.id, isPrintedKitchen: orderItems.isPrintedKitchen })
        .from(orderItems)
        .where(and(eq(orderItems.orderId, orderId), eq(orderItems.isCancelled, false)));

      if (activeItems.some((i) => i.isPrintedKitchen)) {
        throw new TxAbortError("Không thể hủy đơn đã có món gửi bếp. Vui lòng liên hệ Quản lý!", 409);
      }

      if (activeItems.length > 0) {
        throw new TxAbortError("Đơn hàng không rỗng, vui lòng xóa hết các món chưa gửi bếp trước khi hủy đơn!", 409);
      }

      if (order.tableId) {
        const [servingOrder] = await tx
          .select({ id: orders.id })
          .from(orders)
          .where(and(eq(orders.tableId, order.tableId), eq(orders.status, "DANG_PHUC_VU")))
          .limit(1);

        if (servingOrder && servingOrder.id === orderId) {
          await tx
            .update(tables)
            .set({ status: "TRONG", updatedAt: new Date() })
            .where(eq(tables.id, order.tableId));
        }
      }

      await tx
        .update(orders)
        .set({
          status: "DA_HUY",
          tableId: null,
          version: order.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));

      await logAudit(
        {
          userId: actingUser?.userId ?? actingUser?.id ?? null,
          username: actingUser?.username,
          userAgent,
          action: "DELETE_EMPTY_ORDER",
          entityType: "orders",
          entityId: orderId,
          reason: "Hủy đơn hàng rỗng",
          metadata: {
            orderCode: order.orderCode,
            tableId: order.tableId,
          },
          ipAddress: clientIp,
        },
        tx,
      );

      return { ok: true, message: "Hủy đơn hàng thành công" };
    });
  } catch (err: any) {
    if (err instanceof TxAbortError) {
      return { ok: false, error: err.message, status: err.status };
    }
    throw err;
  }
}
