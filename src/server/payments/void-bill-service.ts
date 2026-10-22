import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { orders, payments, shifts } from "@/db/schema";
import { TxAbortError } from "@/server/orders/tx-abort-error";
import { withManagerApproval } from "@/server/approvals/with-manager-approval";
import { logAudit } from "@/server/approvals/audit-log-service";
import type { TokenPayload } from "@/server/auth/jwt";

export interface VoidBillParams {
  orderId: number;
  expectedVersion: number;
  lyDo: string;
  pinCode?: string;
  user: TokenPayload;
  clientIp?: string | null;
  userAgent?: string | null;
}

export interface VoidBillResult {
  ok: boolean;
  status: number;
  error?: string;
  data?: {
    orderId: number;
    orderCode: string;
    status: string;
    voidedAt: Date;
    approverName?: string;
  };
}

/**
 * Voids a previously paid bill (DEC-12, BR-08).
 * Requires manager approval (PIN check for THU_NGAN, reason min 5 chars, PHUC_VU 403).
 * Verification occurs BEFORE transaction.
 * The order's shift must still be open (DANG_MO); if closed, returns HTTP 409.
 * Sets order to DA_HUY and payment to VOIDED. Cash balance automatically excludes it (BR-05).
 */
export async function voidPaidBill(params: VoidBillParams): Promise<VoidBillResult> {
  const { orderId, expectedVersion, lyDo, pinCode, user, clientIp, userAgent } = params;

  // 1. Verify existence and current state
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return { ok: false, status: 404, error: "Đơn hàng không tồn tại" };
  }

  if (order.status !== "DA_THANH_TOAN") {
    return {
      ok: false,
      status: 409,
      error: "Chỉ có thể hủy hóa đơn đã thanh toán hoàn tất",
    };
  }

  if (order.version !== expectedVersion) {
    return {
      ok: false,
      status: 409,
      error: "Dữ liệu đơn hàng đã bị thay đổi bởi thao tác khác. Vui lòng tải lại!",
    };
  }

  // 2. Check if the order's shift is still open
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, order.id))
    .limit(1);

  if (payment) {
    const [shiftRow] = await db
      .select({ id: shifts.id, status: shifts.status })
      .from(shifts)
      .where(eq(shifts.id, payment.shiftId))
      .limit(1);

    if (shiftRow && shiftRow.status !== "DANG_MO") {
      return {
        ok: false,
        status: 409,
        error: "Không thể hủy hóa đơn vì ca làm việc của hóa đơn này đã đóng!",
      };
    }
  }

  // 3. Manager approval verification (executed BEFORE transaction)
  const approval = await withManagerApproval(
    {
      userId: user.userId,
      id: user.userId,
      username: user.username,
      fullName: user.fullName || user.username,
      role: user.role,
    },
    "CANCEL_ORDER",
    { lyDo, pinCode },
    clientIp,
    userAgent,
  );

  if (!approval.ok) {
    return {
      ok: false,
      status: approval.status,
      error: approval.error,
    };
  }

  const now = new Date();
  const nextVersion = order.version + 1;

  // 4. ACID Transaction to void bill
  try {
    await db.transaction(async (tx) => {
      const [lockedOrder] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1)
        .for("update");

      if (!lockedOrder || lockedOrder.status !== "DA_THANH_TOAN" || lockedOrder.version !== expectedVersion) {
        throw new TxAbortError("Dữ liệu đơn hàng đã bị thay đổi bởi thao tác khác. Vui lòng tải lại!", 409);
      }

      // Mark order as DA_HUY
      await tx
        .update(orders)
        .set({
          status: "DA_HUY",
          voidedAt: now,
          voidedById: user.userId,
          voidReason: approval.reason,
          version: nextVersion,
          updatedAt: now,
        })
        .where(eq(orders.id, orderId));

      // Mark payments as VOIDED
      await tx
        .update(payments)
        .set({
          status: "VOIDED",
        })
        .where(eq(payments.orderId, orderId));

      // Persist audit log
      await logAudit(
        {
          userId: user.userId,
          username: user.username,
          action: "VOID_BILL",
          entityType: "ORDER",
          entityId: order.id,
          reason: approval.reason,
          ipAddress: clientIp,
          userAgent,
          metadata: {
            orderCode: order.orderCode,
            totalAmount: order.totalAmount,
            finalAmount: order.finalAmount,
            approverId: approval.approverId,
            approverName: approval.approverName,
            shiftId: payment?.shiftId,
          },
        },
        tx as any,
      );
    });
  } catch (err: any) {
    if (err instanceof TxAbortError) {
      return { ok: false, status: err.status, error: err.message };
    }
    console.error("Void bill transaction error:", err);
    throw err;
  }

  return {
    ok: true,
    status: 200,
    data: {
      orderId: order.id,
      orderCode: order.orderCode,
      status: "DA_HUY",
      voidedAt: now,
      approverName: approval.approverName,
    },
  };
}
