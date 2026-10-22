import { eq, and, ne } from "drizzle-orm";
import { db } from "@/db";
import { orders, payments, shifts } from "@/db/schema";
import { generateVietQrString, formatVietqrTransferContent } from "./vietqr-generator";
import type {
  CreateVietQrPaymentParams,
  CreateVietQrPaymentResult,
  VietQrStatusResult,
} from "./vietqr-types";

export const VIETQR_EXPIRY_SECONDS = 180; // 3 minutes per BR-11

export async function createOrRefreshVietQrPayment(
  params: CreateVietQrPaymentParams,
): Promise<CreateVietQrPaymentResult> {
  const { orderId, expectedVersion, shiftId } = params;

  return await db.transaction(async (tx) => {
    // 0. Resolve target shift and acquire FOR SHARE first to enforce global lock order (shifts -> orders)
    let targetShiftId = shiftId;
    if (!targetShiftId) {
      const [orderMeta] = await tx
        .select({ shiftId: orders.shiftId })
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      targetShiftId = orderMeta?.shiftId;
    }

    if (targetShiftId) {
      const [currentShift] = await tx
        .select({ id: shifts.id, status: shifts.status })
        .from(shifts)
        .where(eq(shifts.id, targetShiftId))
        .limit(1)
        .for("share");

      if (!currentShift || currentShift.status !== "DANG_MO") {
        return { ok: false, status: 409, error: "Ca làm việc đã kết thúc hoặc không ở trạng thái Đang mở" };
      }
    }

    // 1. Lock order for update
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)
      .for("update");

    if (!order) {
      return { ok: false, status: 404, error: "Đơn hàng không tồn tại" };
    }

    if (order.status !== "DANG_PHUC_VU") {
      const error = order.status === "DA_THANH_TOAN"
        ? "Hóa đơn này đã được thanh toán trước đó"
        : "Trạng thái đơn hàng không hợp lệ để tạo mã VietQR";
      return { ok: false, status: 409, error };
    }

    if (expectedVersion !== undefined && order.version !== expectedVersion) {
      return { ok: false, status: 409, error: "Dữ liệu đơn hàng đã bị thay đổi bởi thao tác khác" };
    }

    if (order.finalAmount <= 0) {
      return { ok: false, status: 400, error: "Tổng tiền thanh toán phải lớn hơn 0" };
    }

    // 2. Lock and verify existing payment
    const [existingPayment] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, orderId), eq(payments.paymentMethod, "VIETQR")))
      .orderBy(payments.id)
      .limit(1)
      .for("update");

    if (existingPayment && existingPayment.status === "SUCCESS") {
      return { ok: false, status: 409, error: "Hóa đơn này đã được thanh toán trước đó" };
    }

    const bankBin = process.env.VIETQR_BANK_BIN || "970422";
    const accountNo = process.env.VIETQR_ACCOUNT_NO || "0123456789";
    const transferContent = formatVietqrTransferContent(order.orderCode);
    const qrContent = generateVietQrString({
      bankBin,
      accountNo,
      amount: order.finalAmount,
      transferContent,
      isDynamic: true,
    });
    const now = new Date();
    const expiresAt = new Date(now.getTime() + VIETQR_EXPIRY_SECONDS * 1000);

    let paymentId: number;
    if (existingPayment) {
      await tx
        .update(payments)
        .set({ amount: order.finalAmount, qrContent, vietqrRef: transferContent, status: "PENDING", expiresAt, shiftId })
        .where(and(eq(payments.id, existingPayment.id), ne(payments.status, "SUCCESS")));
      paymentId = existingPayment.id;
    } else {
      const [inserted] = await tx
        .insert(payments)
        .values({
          orderId: order.id,
          shiftId,
          paymentMethod: "VIETQR",
          amount: order.finalAmount,
          vietqrRef: transferContent,
          qrContent,
          status: "PENDING",
          expiresAt,
          createdAt: now,
        })
        .returning({ id: payments.id });
      paymentId = inserted.id;
    }

    return {
      ok: true,
      status: 200,
      data: {
        paymentId,
        orderId: order.id,
        orderCode: order.orderCode,
        transferContent,
        amount: order.finalAmount,
        qrContent,
        expiresAt: expiresAt.toISOString(),
        remainingSeconds: VIETQR_EXPIRY_SECONDS,
      },
    };
  });
}

export async function getVietQrPaymentStatus(paymentId: number): Promise<VietQrStatusResult> {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);

  if (!payment) {
    return { ok: false, status: 404, error: "Giao dịch thanh toán không tồn tại" };
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, payment.orderId))
    .limit(1);

  const now = new Date();
  let currentStatus = payment.status;
  let remainingSeconds = 0;

  if (payment.expiresAt) {
    const diffMs = payment.expiresAt.getTime() - now.getTime();
    remainingSeconds = Math.max(0, Math.floor(diffMs / 1000));
  }

  // If still PENDING but expired time has passed -> transition to EXPIRED with atomic guard
  if (currentStatus === "PENDING" && remainingSeconds <= 0 && payment.expiresAt) {
    const updated = await db
      .update(payments)
      .set({ status: "EXPIRED" })
      .where(and(eq(payments.id, payment.id), eq(payments.status, "PENDING")))
      .returning({ status: payments.status });

    if (updated.length > 0) {
      currentStatus = "EXPIRED";
    } else {
      const [refreshed] = await db.select({ status: payments.status }).from(payments).where(eq(payments.id, payment.id));
      if (refreshed) currentStatus = refreshed.status;
    }
  }

  return {
    ok: true,
    status: 200,
    data: {
      paymentId: payment.id,
      orderId: payment.orderId,
      orderCode: order?.orderCode || "",
      orderType: order?.orderType || "",
      status: currentStatus,
      amount: payment.amount,
      expiresAt: payment.expiresAt ? payment.expiresAt.toISOString() : null,
      remainingSeconds,
      isExpired: currentStatus === "EXPIRED",
      paidAt: order?.paidAt ? order.paidAt.toISOString() : null,
      queueNumber: order?.queueNumber || null,
    },
  };
}
