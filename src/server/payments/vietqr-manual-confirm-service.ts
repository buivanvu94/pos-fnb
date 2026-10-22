import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { executeVietQrPaymentCompletion } from "./vietqr-complete-helper";
import type { TokenPayload } from "@/server/auth/jwt";

export interface ManualConfirmParams {
  orderId: number;
  expectedVersion?: number;
  shift: { id: number };
  user: TokenPayload;
  reason?: string;
  printPickupTicket?: boolean;
}

/**
 * Manually confirms VietQR payment when network is down or webhook delayed (AC-08-2, DEC-06).
 * Fallback operation requiring audit logging in audit_logs table.
 */
export async function manualConfirmVietQrPayment(params: ManualConfirmParams) {
  const { orderId, expectedVersion, shift, user, reason, printPickupTicket } = params;

  const result = await executeVietQrPaymentCompletion({
    orderId,
    expectedVersion,
    shiftId: shift.id,
    user,
    printPickupTicket,
  });

  if (!result.ok) {
    return result;
  }

  // Record audit log for fallback manual confirmation
  try {
    await db.insert(auditLogs).values({
      userId: user.userId,
      action: "MANUAL_VIETQR_CONFIRM",
      entityType: "ORDER",
      entityId: String(orderId),
      reason: reason || "Thu ngân xác nhận nhận tiền chuyển khoản thủ công (dự phòng mất mạng)",
      metadata: JSON.stringify({
        orderId,
        orderCode: result.data?.orderCode,
        finalAmount: result.data?.finalAmount,
        paymentMethod: "VIETQR",
        manual: true,
      }),
    });
  } catch (auditErr) {
    console.error("Failed to write audit log for MANUAL_VIETQR_CONFIRM:", auditErr);
  }

  return result;
}
