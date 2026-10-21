import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems, tables, menuItems } from "@/db/schema";
import { withManagerApproval } from "@/server/approvals/with-manager-approval";
import { logAudit } from "@/server/approvals/audit-log-service";
import { enqueuePrintJob, dispatchPrintJob } from "@/server/printing/print-service";
import type { KotCancelPayload } from "@/server/printing/print-payload-types";
import { TxAbortError } from "./tx-abort-error";
import type { ActingUser } from "@/server/approvals/approval-types";

export interface CancelOrderInput {
  lyDo: string;
  pinCode?: string;
  expectedVersion?: number;
}

export type CancelOrderResult =
  | { ok: true; message: string }
  | { ok: false; error: string; status: number };

/**
 * Cancels an order that may contain kitchen-printed items (FR-10, BR-03, BR-08).
 * Requires Manager approval, enqueues KOT_CANCEL print jobs, sets status DA_HUY,
 * resets table to TRONG, and records audit logs.
 */
export async function cancelOrderWithApproval(
  orderId: number,
  input: CancelOrderInput,
  actingUser: ActingUser,
  clientIp?: string,
): Promise<CancelOrderResult> {
  const approval = await withManagerApproval(
    actingUser,
    "CANCEL_ORDER",
    { pinCode: input.pinCode, lyDo: input.lyDo },
    clientIp,
  );

  if (!approval.ok) {
    return { ok: false, error: approval.error, status: approval.status };
  }

  const userId = actingUser.userId ?? actingUser.id!;
  const enqueuedJobIds: number[] = [];

  try {
    const res = await db.transaction(async (tx) => {
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
      if (input.expectedVersion !== undefined && order.version !== input.expectedVersion) {
        throw new TxAbortError("Đơn hàng đã được cập nhật bởi phiên làm việc khác, vui lòng tải lại", 409);
      }

      let tableName = "Mang về";
      if (order.tableId) {
        const [tbl] = await tx
          .select({ name: tables.name })
          .from(tables)
          .where(eq(tables.id, order.tableId))
          .limit(1)
          .for("update");
        if (tbl) tableName = tbl.name;
      }

      const activeItems = await tx
        .select({
          id: orderItems.id,
          quantity: orderItems.quantity,
          notes: orderItems.notes,
          isPrintedKitchen: orderItems.isPrintedKitchen,
          menuItemName: menuItems.name,
          targetPrinter: menuItems.targetPrinter,
        })
        .from(orderItems)
        .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
        .where(and(eq(orderItems.orderId, orderId), eq(orderItems.isCancelled, false)));

      // Enqueue cancel slips for items that were already sent to kitchen/bar
      const printedItems = activeItems.filter((i) => i.isPrintedKitchen);
      const kitchenItems = printedItems.filter((i) => i.targetPrinter !== "BAR");
      const barItems = printedItems.filter((i) => i.targetPrinter === "BAR");

      const enqueueCancelSlip = async (
        station: "KITCHEN" | "BAR",
        itemsList: typeof printedItems,
      ) => {
        if (itemsList.length === 0) return;
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
          items: itemsList.map((i) => ({
            name: i.menuItemName,
            quantity: i.quantity,
            notes: i.notes,
          })),
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
      };

      await enqueueCancelSlip("KITCHEN", kitchenItems);
      await enqueueCancelSlip("BAR", barItems);

      // Cancel all active items in order
      if (activeItems.length > 0) {
        await tx
          .update(orderItems)
          .set({
            isCancelled: true,
            cancelReason: approval.reason,
            cancelledById: userId,
          })
          .where(and(eq(orderItems.orderId, orderId), eq(orderItems.isCancelled, false)));
      }

      // Reset table status to TRONG if this is the active serving order
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

      // Mark order DA_HUY
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
          userId,
          action: "CANCEL_ORDER",
          entityType: "orders",
          entityId: orderId,
          reason: approval.reason,
          metadata: {
            orderCode: order.orderCode,
            totalAmount: order.totalAmount,
            requesterId: userId,
            approverId: approval.approverId,
            approverName: approval.approverName,
            cancelledItemsCount: activeItems.length,
            printedItemsCount: printedItems.length,
          },
          ipAddress: clientIp,
        },
        tx,
      );

      return { ok: true as const, message: "Hủy đơn hàng thành công" };
    });

    // Dispatch print jobs after commit; printer errors do not abort business response
    for (const jobId of enqueuedJobIds) {
      dispatchPrintJob(jobId).catch((err) => {
        console.error(`Error dispatching cancel print job ${jobId}:`, err);
      });
    }

    return res;
  } catch (err: any) {
    if (err instanceof TxAbortError) {
      return { ok: false, error: err.message, status: err.status };
    }
    throw err;
  }
}
