import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { executeVietQrPaymentCompletion } from "./vietqr-complete-helper";
import type { TokenPayload } from "@/server/auth/jwt";

export interface ManualConfirmParams {
  orderId: number;
  expectedVersion?: number;
  shift: { id: number };
  user: TokenPayload;
  reason: string;
  approverId: number;
  approverName: string;
  printPickupTicket?: boolean;
}

/**
 * Manually confirms VietQR payment when network is down or webhook delayed (AC-08-2, DEC-06).
 * Fallback operation requiring manager approval, reason >= 5 chars, and transactional audit logging.
 */
export async function manualConfirmVietQrPayment(params: ManualConfirmParams) {
  const { orderId, expectedVersion, shift, user, reason, approverId, approverName, printPickupTicket } = params;

  const trimmedReason = (reason || "").trim();
  if (trimmedReason.length < 5) {
    return { ok: false, status: 400, error: "Lý do xác nhận thủ công tối thiểu 5 ký tự" };
  }

  // 1. Verify that order has a VietQR payment in PENDING or EXPIRED state
  const [targetPayment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.orderId, orderId),
        eq(payments.paymentMethod, "VIETQR"),
        inArray(payments.status, ["PENDING", "EXPIRED"]),
      ),
    )
    .orderBy(payments.id)
    .limit(1);

  if (!targetPayment) {
    return {
      ok: false,
      status: 409,
      error: "Không tìm thấy giao dịch VietQR đang chờ thanh toán hoặc đã hết hạn",
    };
  }

  // 2. Execute completion with audit log written within the same database transaction
  const result = await executeVietQrPaymentCompletion({
    orderId,
    expectedVersion,
    shiftId: shift.id,
    user,
    paymentId: targetPayment.id,
    printPickupTicket,
    auditLog: {
      userId: approverId,
      action: "MANUAL_VIETQR_CONFIRM",
      reason: trimmedReason,
      metadata: {
        orderId,
        approverName,
        confirmedByUserId: user.userId,
        confirmedByUsername: user.username,
        paymentId: targetPayment.id,
        manual: true,
      },
    },
  });

  return result;
}
