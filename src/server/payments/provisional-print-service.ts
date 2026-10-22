import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { orders, tables } from "@/db/schema";
import { getOrderDetails, type OrderDetail } from "@/server/orders/order-service";
import { enqueuePrintJob, dispatchPrintJob } from "@/server/printing/print-service";
import { getPrinterSettings } from "@/server/printing/settings-service";
import type { ProvisionalPayload, ReceiptItemPayload } from "@/server/printing/print-payload-types";
import { ERROR_CATALOG } from "@/lib/error-catalog";
import type { TokenPayload } from "@/server/auth/jwt";

export interface ProvisionalPrintResult {
  ok: boolean;
  status: number;
  error?: string;
  data?: {
    orderId: number;
    orderCode: string;
    tableStatus: string;
    version: number;
    jobId: number;
  };
  printWarning?: {
    message: string;
    jobId: number;
  };
}

/**
 * Executes provisional bill print for an active dine-in table (FR-13, UC-06, AC-07-1).
 * Sets table status to CHO_THANH_TOAN (yellow) and enqueues RECEIPT_TEMP job.
 * Printer failures do not fail the request; returns HTTP 200 with printWarning (ERR-10).
 */
export async function printProvisionalBill(
  orderId: number,
  expectedVersion: number,
  user: TokenPayload,
): Promise<ProvisionalPrintResult> {
  const order = await getOrderDetails(orderId);
  if (!order) {
    return { ok: false, status: 404, error: "Đơn hàng không tồn tại" };
  }

  if (order.status !== "DANG_PHUC_VU") {
    return {
      ok: false,
      status: 409,
      error: "Hóa đơn không ở trạng thái đang phục vụ, không thể in tạm tính",
    };
  }

  if (order.orderType !== "TAI_BAN" || !order.tableId) {
    return {
      ok: false,
      status: 400,
      error: "Chỉ áp dụng in tạm tính cho đơn phục vụ tại bàn",
    };
  }

  if (order.version !== expectedVersion) {
    return {
      ok: false,
      status: 409,
      error: "Dữ liệu đơn hàng đã bị thay đổi bởi thao tác khác. Vui lòng tải lại!",
    };
  }

  const activeItems = order.items.filter((item) => !item.isCancelled);
  if (activeItems.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "Đơn hàng chưa có món ăn để in tạm tính",
    };
  }

  const settings = await getPrinterSettings();
  const nextVersion = order.version + 1;

  const receiptItems: ReceiptItemPayload[] = activeItems.map((item) => ({
    name: item.menuItemName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalItemPrice,
    notes: item.notes,
    toppings: item.toppings?.map((t) => t.toppingName),
  }));

  const payload: ProvisionalPayload = {
    kind: "PROVISIONAL",
    orderId: order.id,
    orderCode: order.orderCode,
    tableName: order.tableName ?? "Tại bàn",
    cashierName: user.fullName || user.username,
    printedAt: new Date().toISOString(),
    storeName: settings.storeName,
    storeAddress: settings.storeAddress,
    storePhone: settings.storePhone,
    items: receiptItems,
    subtotal: order.totalAmount,
    discount: order.discountAmount,
    total: order.finalAmount,
  };

  let createdJobId = 0;

  try {
    await db.transaction(async (tx) => {
      // 1. Update order version
      const [updatedOrder] = await tx
        .update(orders)
        .set({
          version: nextVersion,
          updatedAt: new Date(),
        })
        .where(and(eq(orders.id, orderId), eq(orders.version, expectedVersion)))
        .returning({ id: orders.id });

      if (!updatedOrder) {
        throw new Error("CONCURRENCY_CONFLICT");
      }

      // 2. Update table to CHO_THANH_TOAN (yellow)
      await tx
        .update(tables)
        .set({
          status: "CHO_THANH_TOAN",
          updatedAt: new Date(),
        })
        .where(eq(tables.id, order.tableId!));

      // 3. Enqueue RECEIPT_TEMP job
      const job = await enqueuePrintJob(
        {
          orderId: order.id,
          jobType: "RECEIPT_TEMP",
          targetPrinter: "RECEIPT",
          payload,
        },
        tx,
      );
      createdJobId = job.id;
    });
  } catch (err: any) {
    if (err?.message === "CONCURRENCY_CONFLICT") {
      return {
        ok: false,
        status: 409,
        error: "Dữ liệu đơn hàng đã bị thay đổi bởi thao tác khác. Vui lòng tải lại!",
      };
    }
    throw err;
  }

  // 4. Dispatch print job post-commit
  let printWarning: { message: string; jobId: number } | undefined;
  if (createdJobId > 0) {
    try {
      const dispatchResult = await dispatchPrintJob(createdJobId);
      if (!dispatchResult.ok || dispatchResult.status === "FAILED") {
        printWarning = {
          message: ERROR_CATALOG.ERR_10.message,
          jobId: createdJobId,
        };
      }
    } catch (printErr) {
      console.error("Provisional print dispatch error:", printErr);
      printWarning = {
        message: ERROR_CATALOG.ERR_10.message,
        jobId: createdJobId,
      };
    }
  }

  return {
    ok: true,
    status: 200,
    data: {
      orderId: order.id,
      orderCode: order.orderCode,
      tableStatus: "CHO_THANH_TOAN",
      version: nextVersion,
      jobId: createdJobId,
    },
    ...(printWarning ? { printWarning } : {}),
  };
}
