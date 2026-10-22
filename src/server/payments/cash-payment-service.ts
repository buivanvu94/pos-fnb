import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems, payments, tables, menuItems, shifts } from "@/db/schema";
import { TxAbortError } from "@/server/orders/tx-abort-error";
import { generateNextQueueNumber } from "./queue-number-service";
import { getPrinterSettings } from "@/server/printing/settings-service";
import { enqueuePaymentPrintJobs, dispatchPaymentPrintJobs } from "./cash-payment-print-helper";
import { ERROR_CATALOG } from "@/lib/error-catalog";
import {
  MAX_CASH_AMOUNT,
  type CashPaymentParams,
  type CashPaymentResult,
} from "./cash-payment-types";

export { MAX_CASH_AMOUNT, type CashPaymentParams, type CashPaymentResult };

/**
 * Executes cash payment for an active order (FR-11, FR-13, UC-04, UC-06, AC-05-1, AC-07-2).
 * Operates in a single ACID transaction: locks order and table in consistent order,
 * records payment, updates order to DA_THANH_TOAN, frees table, generates queue number for takeaway,
 * enqueues FINAL_RECEIPT (with kickDrawer) and PICKUP_TICKET.
 * Print failure does not rollback payment (BR-12, ERR-10).
 */
export async function payOrderCash(params: CashPaymentParams): Promise<CashPaymentResult> {
  const { orderId, tienKhachDua, expectedVersion, user, shift, printPickupTicket } = params;

  if (!Number.isInteger(tienKhachDua) || tienKhachDua < 0 || tienKhachDua > MAX_CASH_AMOUNT) {
    return {
      ok: false,
      status: 400,
      error: `Số tiền khách đưa không hợp lệ (tối đa ${MAX_CASH_AMOUNT.toLocaleString("vi-VN")} VNĐ)`,
    };
  }

  const settings = await getPrinterSettings();
  let createdReceiptJobId: number | undefined;
  let createdPickupJobId: number | undefined;
  let printJobsToDispatch: number[] = [];
  let paymentResultData: any;

  try {
    await db.transaction(async (tx) => {
      // 0. Lock shift FOR SHARE to verify it is still DANG_MO (prevents payments after shift close)
      const [currentShift] = await tx
        .select({ id: shifts.id, status: shifts.status })
        .from(shifts)
        .where(eq(shifts.id, shift.id))
        .limit(1)
        .for("share");

      if (!currentShift || currentShift.status !== "DANG_MO") {
        throw new TxAbortError("Ca làm việc đã kết thúc hoặc không ở trạng thái Đang mở", 409);
      }

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

      if (order.version !== expectedVersion) {
        throw new TxAbortError("Dữ liệu đơn hàng đã bị thay đổi bởi thao tác khác. Vui lòng tải lại!", 409);
      }

      // 2. Lock table if dine-in
      if (order.tableId) {
        await tx
          .select({ id: tables.id })
          .from(tables)
          .where(eq(tables.id, order.tableId))
          .limit(1)
          .for("update");
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
        throw new TxAbortError(ERROR_CATALOG.ERR_08.message, 400);
      }

      if (tienKhachDua < order.finalAmount) {
        throw new TxAbortError(
          `Tiền khách đưa (${tienKhachDua.toLocaleString("vi-VN")} đ) không đủ để thanh toán (${order.finalAmount.toLocaleString("vi-VN")} đ)`,
          400,
        );
      }

      const cashReturned = tienKhachDua - order.finalAmount;
      const now = new Date();
      let queueNumber: number | null = null;
      let queueDate: string | null = null;

      // 4. Generate queue number for takeaway
      if (order.orderType === "MANG_VE") {
        const queueRes = await generateNextQueueNumber(tx as any, now);
        queueNumber = queueRes.queueNumber;
        queueDate = queueRes.queueDate;
      }

      const nextVersion = order.version + 1;

      // 5. Update order to DA_THANH_TOAN
      await tx
        .update(orders)
        .set({
          status: "DA_THANH_TOAN",
          paidAt: now,
          paymentMethod: "TIEN_MAT",
          queueNumber,
          queueDate,
          version: nextVersion,
          updatedAt: now,
        })
        .where(and(eq(orders.id, orderId), eq(orders.version, expectedVersion)));

      // 6. Record payment in payments table
      await tx.insert(payments).values({
        orderId: order.id,
        shiftId: shift.id,
        paymentMethod: "TIEN_MAT",
        amount: order.finalAmount,
        cashGiven: tienKhachDua,
        cashReturned,
        status: "SUCCESS",
        createdAt: now,
      });

      // 7. Free table if dine-in
      if (order.tableId) {
        await tx
          .update(tables)
          .set({
            status: "TRONG",
            updatedAt: now,
          })
          .where(eq(tables.id, order.tableId));
      }

      // 8. Enqueue print jobs (Receipt & Pickup ticket)
      const enqueued = await enqueuePaymentPrintJobs(
        {
          order,
          activeItems,
          settings,
          user,
          now,
          tienKhachDua,
          cashReturned,
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
        cashGiven: tienKhachDua,
        cashReturned,
        status: "DA_THANH_TOAN",
        paidAt: now,
        receiptJobId: createdReceiptJobId,
        pickupTicketJobId: createdPickupJobId,
      };
    });
  } catch (err: any) {
    if (err instanceof TxAbortError) {
      return { ok: false, status: err.status, error: err.message };
    }
    console.error("Cash payment transaction error:", err);
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
