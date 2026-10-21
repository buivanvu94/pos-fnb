import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { orderItems } from "@/db/schema";
import { withManagerApproval } from "@/server/approvals/with-manager-approval";
import type { ModifyOrderItemsInput } from "./order-schema";
import type { ActingUser, ApprovalResult } from "@/server/approvals/approval-types";

/**
 * Checks whether any modified/deleted items in this request are already printed to kitchen/bar.
 * If so, verifies Manager PIN approval BEFORE opening the main order transaction,
 * preventing connection pool exhaustion and deadlocks under concurrent load.
 */
export async function precheckItemApproval(
  orderId: number,
  input: ModifyOrderItemsInput,
  actingUser?: ActingUser,
  clientIp?: string | null,
  userAgent?: string | null,
): Promise<ApprovalResult | null> {
  let needsApproval = false;

  if (input.action === "delete") {
    if (input.orderItemId) {
      const [item] = await db
        .select({ isPrintedKitchen: orderItems.isPrintedKitchen, isCancelled: orderItems.isCancelled })
        .from(orderItems)
        .where(and(eq(orderItems.id, input.orderItemId), eq(orderItems.orderId, orderId)))
        .limit(1);

      if (item && item.isPrintedKitchen && !item.isCancelled) {
        needsApproval = true;
      }
    }
  } else {
    const itemsToProcess =
      input.items && input.items.length > 0
        ? input.items
        : input.orderItemId !== undefined || input.menuItemId !== undefined
          ? [{ id: input.orderItemId, quantity: input.quantity ?? 1 }]
          : [];

    for (const item of itemsToProcess) {
      if (item.id) {
        const [existing] = await db
          .select({
            quantity: orderItems.quantity,
            isPrintedKitchen: orderItems.isPrintedKitchen,
            isCancelled: orderItems.isCancelled,
          })
          .from(orderItems)
          .where(and(eq(orderItems.id, item.id), eq(orderItems.orderId, orderId)))
          .limit(1);

        if (existing && existing.isPrintedKitchen && !existing.isCancelled && (item.quantity ?? 1) < existing.quantity) {
          needsApproval = true;
          break;
        }
      }
    }
  }

  if (!needsApproval) {
    return null;
  }

  if (!actingUser) {
    return {
      ok: false,
      status: 409,
      error: "Không thể sửa hoặc xóa món đã gửi bếp. Vui lòng liên hệ Quản lý để hủy món!",
    };
  }

  return await withManagerApproval(
    actingUser,
    "CANCEL_KITCHEN_ITEM",
    { pinCode: input.pinCode, lyDo: input.lyDo ?? "" },
    clientIp,
    userAgent,
  );
}
