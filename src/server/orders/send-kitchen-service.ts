import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems, menuItems, tables } from "@/db/schema";
import { ERROR_CATALOG } from "@/lib/error-catalog";
import { enqueuePrintJob, dispatchPrintJob } from "@/server/printing/print-service";
import type { KotPayload } from "@/server/printing/print-payload-types";
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
        printWarning?: {
          message: string;
          failedJobs: Array<{ id: number; error: string }>;
        };
      };
      printWarning?: {
        message: string;
        failedJobs: Array<{ id: number; error: string }>;
      };
    }
  | { ok: false; error: string; status: number };

/**
 * Marks unprinted order items as sent to kitchen and groups them by station (FR-03).
 * Enqueues print jobs for KITCHEN and BAR in the same transaction, then dispatches
 * them after commit. Catches printer communication failures and attaches printWarning
 * with ERR-06 verbatim without failing the order (AC-03-2, DEC-07).
 */
export async function sendKitchenOrder(
  orderId: number,
  expectedVersion?: number,
  senderName?: string,
): Promise<SendKitchenResult> {
  let createdJobIds: number[] = [];
  let txResult: {
    orderCode: string;
    sentAt: string;
    items: {
      kitchen: any[];
      bar: any[];
    };
  };

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

      // Query table name if available
      let tableName = "Mang về";
      if (order.tableId) {
        const [tableRow] = await tx
          .select({ name: tables.name })
          .from(tables)
          .where(eq(tables.id, order.tableId))
          .limit(1);
        if (tableRow?.name) {
          tableName = tableRow.name;
        }
      }

      const jobIds: number[] = [];

      // Enqueue Kitchen ticket if items exist
      if (kitchenItems.length > 0) {
        const kitchenPayload: KotPayload = {
          kind: "KOT",
          orderId,
          orderCode: order.orderCode,
          tableName,
          senderName: senderName || "Nhân viên phục vụ",
          sentAt: now.toISOString(),
          targetStation: "KITCHEN",
          items: kitchenItems.map((i) => ({
            name: i.name || "Món ăn",
            quantity: i.quantity,
            notes: i.notes,
            unitPrice: i.unitPrice,
          })),
        };

        const kJob = await enqueuePrintJob(
          {
            orderId,
            jobType: "KOT_KITCHEN",
            targetPrinter: "KITCHEN",
            payload: kitchenPayload,
          },
          tx,
        );
        jobIds.push(kJob.id);
      }

      // Enqueue Bar ticket if items exist
      if (barItems.length > 0) {
        const barPayload: KotPayload = {
          kind: "KOT",
          orderId,
          orderCode: order.orderCode,
          tableName,
          senderName: senderName || "Nhân viên phục vụ",
          sentAt: now.toISOString(),
          targetStation: "BAR",
          items: barItems.map((i) => ({
            name: i.name || "Đồ uống",
            quantity: i.quantity,
            notes: i.notes,
            unitPrice: i.unitPrice,
          })),
        };

        const bJob = await enqueuePrintJob(
          {
            orderId,
            jobType: "KOT_BAR",
            targetPrinter: "BAR",
            payload: barPayload,
          },
          tx,
        );
        jobIds.push(bJob.id);
      }

      return {
        jobIds,
        orderCode: order.orderCode,
        sentAt: now.toISOString(),
        items: {
          kitchen: kitchenItems,
          bar: barItems,
        },
      };
    });

    createdJobIds = res.jobIds;
    txResult = res;
  } catch (err: any) {
    if (err instanceof TxAbortError) {
      return { ok: false, error: err.message, status: err.status };
    }
    throw err;
  }

  // Dispatch queued print jobs outside transaction (after commit)
  const failedJobs: Array<{ id: number; error: string }> = [];

  for (const jId of createdJobIds) {
    const dispatchRes = await dispatchPrintJob(jId);
    if (!dispatchRes.ok) {
      failedJobs.push({
        id: jId,
        error: dispatchRes.error || ERROR_CATALOG.ERR_06.message,
      });
    }
  }

  const printWarning =
    failedJobs.length > 0
      ? {
          message: ERROR_CATALOG.ERR_06.message,
          failedJobs,
        }
      : undefined;

  return {
    ok: true,
    data: {
      orderId,
      orderCode: txResult.orderCode,
      sentAt: txResult.sentAt,
      items: txResult.items,
      ...(printWarning ? { printWarning } : {}),
    },
    ...(printWarning ? { printWarning } : {}),
  };
}
