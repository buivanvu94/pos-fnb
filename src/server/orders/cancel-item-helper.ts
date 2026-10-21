import { eq } from "drizzle-orm";
import { orderItems, tables, menuItems, type Order, type OrderItem } from "@/db/schema";
import { withManagerApproval } from "@/server/approvals/with-manager-approval";
import { logAudit } from "@/server/approvals/audit-log-service";
import { enqueuePrintJob } from "@/server/printing/print-service";
import type { KotCancelPayload } from "@/server/printing/print-payload-types";
import { TxAbortError } from "./tx-abort-error";
import type { ActingUser } from "@/server/approvals/approval-types";

interface CancelPrintedItemOptions {
  tx: any;
  order: Order;
  item: OrderItem;
  quantityToCancel: number;
  pinCode?: string;
  lyDo?: string;
  actingUser?: ActingUser;
  clientIp?: string;
  enqueuedJobIds: number[];
}

/**
 * Handles cancellation or quantity reduction of items already sent to the kitchen (BR-03, FR-10).
 * Requires Manager PIN, enqueues KOT_CANCEL print job, marks cancellation/reduction, and logs audit.
 */
export async function handleCancelPrintedItem({
  tx,
  order,
  item,
  quantityToCancel,
  pinCode,
  lyDo,
  actingUser,
  clientIp,
  enqueuedJobIds,
}: CancelPrintedItemOptions): Promise<void> {
  if (!actingUser || !lyDo) {
    throw new TxAbortError("Không thể sửa hoặc xóa món đã gửi bếp. Vui lòng liên hệ Quản lý để hủy món!", 409);
  }

  const approval = await withManagerApproval(
    actingUser,
    "CANCEL_KITCHEN_ITEM",
    { pinCode, lyDo },
    clientIp,
  );

  if (!approval.ok) {
    throw new TxAbortError(approval.error, approval.status);
  }

  const userId = actingUser.userId ?? actingUser.id!;

  const [mItem] = await tx
    .select({ name: menuItems.name, targetPrinter: menuItems.targetPrinter })
    .from(menuItems)
    .where(eq(menuItems.id, item.menuItemId))
    .limit(1);

  let tableName = "Mang về";
  if (order.tableId) {
    const [tbl] = await tx
      .select({ name: tables.name })
      .from(tables)
      .where(eq(tables.id, order.tableId))
      .limit(1);
    if (tbl) tableName = tbl.name;
  }

  const isFullCancel = quantityToCancel >= item.quantity;
  const action = isFullCancel ? "CANCEL_ITEM" : "REDUCE_ITEM";

  if (isFullCancel) {
    await tx
      .update(orderItems)
      .set({
        isCancelled: true,
        cancelReason: approval.reason,
        cancelledById: userId,
      })
      .where(eq(orderItems.id, item.id));
  } else {
    await tx
      .update(orderItems)
      .set({
        quantity: item.quantity - quantityToCancel,
        cancelReason: approval.reason,
      })
      .where(eq(orderItems.id, item.id));
  }

  const station = mItem?.targetPrinter === "BAR" ? "BAR" : "KITCHEN";
  const jobType = station === "BAR" ? "KOT_BAR" : "KOT_KITCHEN";

  const payload: KotCancelPayload = {
    kind: "KOT_CANCEL",
    orderId: order.id,
    orderCode: order.orderCode,
    tableName,
    cancelledByName: actingUser.fullName,
    cancelledAt: new Date().toISOString(),
    reason: approval.reason,
    targetStation: station,
    items: [
      {
        name: mItem?.name || "Món ăn",
        quantity: quantityToCancel,
        notes: item.notes,
      },
    ],
  };

  const job = await enqueuePrintJob(
    {
      orderId: order.id,
      jobType,
      targetPrinter: station,
      payload,
    },
    tx,
  );
  enqueuedJobIds.push(job.id);

  await logAudit(
    {
      userId,
      action,
      entityType: "order_items",
      entityId: item.id,
      reason: approval.reason,
      metadata: {
        orderCode: order.orderCode,
        itemName: mItem?.name,
        quantityCancelled: quantityToCancel,
        originalQuantity: item.quantity,
        remainingQuantity: isFullCancel ? 0 : item.quantity - quantityToCancel,
        requesterId: userId,
        approverId: approval.approverId,
        approverName: approval.approverName,
      },
      ipAddress: clientIp,
    },
    tx,
  );
}
