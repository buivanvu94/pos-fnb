import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems, tables, menuItems, auditLogs } from "@/db/schema";
import { TxAbortError } from "@/server/orders/tx-abort-error";
import { generateNextQueueNumber } from "./queue-number-service";
import { getPrinterSettings } from "@/server/printing/settings-service";
import { enqueuePaymentPrintJobs, dispatchPaymentPrintJobs } from "./cash-payment-print-helper";
import { updateVietQrOrderAndPayment } from "./vietqr-update-records";
import type { TokenPayload } from "@/server/auth/jwt";

export interface CompleteVietQrPaymentTxParams {
  orderId: number;
  expectedVersion?: number;
  shiftId: number;
  user: TokenPayload;
  sepayTransactionId?: string;
  paymentId?: number;
  printPickupTicket?: boolean;
  auditLog?: {
    userId: number;
    action: string;
    reason: string;
    metadata?: Record<string, unknown>;
  };
}

export interface CompleteVietQrPaymentResult {
  ok: boolean;
  status: number;
  error?: string;
  data?: any;
  printWarning?: { message: string; failedJobs?: number[] };
}

/**
 * Shared atomic transaction helper for completing VietQR payments (DEC-06, DEC-11, FR-12).
 * Reuses Phase 07 completion logic: locks order and table, frees table, generates queue number,
 * updates payment to SUCCESS, writes audit logs inside tx, enqueues RECEIPT_FINAL and PICKUP_TICKET.
 */
export async function executeVietQrPaymentCompletion(
  params: CompleteVietQrPaymentTxParams,
): Promise<CompleteVietQrPaymentResult> {
  const { orderId, expectedVersion, shiftId, user, sepayTransactionId, paymentId, printPickupTicket, auditLog } = params;
  const settings = await getPrinterSettings();

  let createdReceiptJobId: number | undefined;
  let createdPickupJobId: number | undefined;
  let printJobsToDispatch: number[] = [];
  let paymentResultData: any;

  try {
    await db.transaction(async (tx) => {
      // 1. Lock order for update
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1)
        .for("update");

      if (!order) {
        throw new TxAbortError("Đơn hàng không tồn tại", 404);
      }
      if (order.status !== "DANG_PHUC_VU") {
        if (order.status === "DA_THANH_TOAN") {
          throw new TxAbortError("Hóa đơn này đã được thanh toán trước đó", 409);
        }
        throw new TxAbortError("Trạng thái đơn hàng không hợp lệ để thanh toán", 409);
      }
      if (expectedVersion !== undefined && order.version !== expectedVersion) {
        throw new TxAbortError("Dữ liệu đơn hàng đã bị thay đổi bởi thao tác khác. Vui lòng tải lại!", 409);
      }

      // 2. Lock table if dine-in
      if (order.tableId) {
        await tx.select({ id: tables.id }).from(tables).where(eq(tables.id, order.tableId)).limit(1).for("update");
      }

      // 3. Verify active items
      const activeItems = await tx
        .select({
          id: orderItems.id,
          name: menuItems.name,
          quantity: orderItems.quantity,
          unitPrice: orderItems.unitPrice,
          isCancelled: orderItems.isCancelled,
        })
        .from(orderItems)
        .leftJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
        .where(and(eq(orderItems.orderId, orderId), eq(orderItems.isCancelled, false)));

      if (activeItems.length === 0 || order.finalAmount <= 0) {
        throw new TxAbortError("Đơn hàng chưa có món ăn hoặc tổng tiền không hợp lệ", 400);
      }

      const now = new Date();
      let queueNumber: number | null = null;
      let queueDate: string | null = null;

      // 4. Generate queue number for takeaway
      if (order.orderType === "MANG_VE") {
        const queueRes = await generateNextQueueNumber(tx as any, now);
        queueNumber = queueRes.queueNumber;
        queueDate = queueRes.queueDate;
      }

      // 5. Update order and payment records, and free table
      const targetPaymentId = await updateVietQrOrderAndPayment({
        tx,
        order,
        expectedVersion,
        shiftId,
        sepayTransactionId,
        paymentId,
        queueNumber,
        queueDate,
        now,
      });

      // 6. Write audit log atomically inside transaction if provided
      if (auditLog) {
        await tx.insert(auditLogs).values({
          userId: auditLog.userId,
          action: auditLog.action,
          entityType: "ORDER",
          entityId: String(order.id),
          reason: auditLog.reason,
          metadata: auditLog.metadata ? JSON.stringify(auditLog.metadata) : null,
        });
      }

      // 7. Enqueue print jobs (Receipt with drawer kick and Pickup ticket)
      const enqueued = await enqueuePaymentPrintJobs(
        {
          order,
          activeItems,
          settings,
          user,
          now,
          tienKhachDua: order.finalAmount,
          cashReturned: 0,
          queueNumber,
          queueDate,
          printPickupTicket,
        },
        tx,
      );
      createdReceiptJobId = enqueued.receiptJobId;
      createdPickupJobId = enqueued.pickupTicketJobId;
      printJobsToDispatch = enqueued.printJobsToDispatch;

      paymentResultData = {
        orderId: order.id,
        orderCode: order.orderCode,
        orderType: order.orderType,
        queueNumber,
        queueDate,
        totalAmount: order.totalAmount,
        discountAmount: order.discountAmount,
        finalAmount: order.finalAmount,
        paymentMethod: "VIETQR",
        status: "DA_THANH_TOAN",
        paidAt: now,
        paymentId: targetPaymentId,
        receiptJobId: createdReceiptJobId,
        pickupTicketJobId: createdPickupJobId,
      };
    });
  } catch (err: any) {
    if (err instanceof TxAbortError) {
      return { ok: false, status: err.status, error: err.message };
    }
    console.error("VietQR payment completion transaction error:", err);
    throw err;
  }

  // Post-commit print dispatching
  const printWarning = await dispatchPaymentPrintJobs(printJobsToDispatch);

  return {
    ok: true,
    status: 200,
    data: paymentResultData,
    ...(printWarning ? { printWarning } : {}),
  };
}
