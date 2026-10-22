import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orders, payments, shifts, users } from "@/db/schema";
import { formatVietqrTransferContent } from "./vietqr-generator";

export interface CandidateMatchResult {
  matchedOrder?: typeof orders.$inferSelect;
  matchedPayment?: typeof payments.$inferSelect;
  creatorUser?: typeof users.$inferSelect;
  error?: string;
}

/**
 * Finds and validates an unambiguous order candidate for SePay webhook reconciliation.
 */
export async function matchOrderAndPayment(
  extractedCode: string | null,
  transferAmount: number,
): Promise<CandidateMatchResult> {
  if (!extractedCode) {
    return { error: "Không tìm thấy mã hóa đơn trong nội dung chuyển khoản" };
  }

  const compactCode = formatVietqrTransferContent(extractedCode);
  let matchedOrder: typeof orders.$inferSelect | undefined;
  let matchedPayment: typeof payments.$inferSelect | undefined;

  // 1. Candidate lookup: pending/expired payments of active orders (DANG_PHUC_VU), newest first
  const candidates = await db
    .select({ payment: payments, order: orders })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(
      and(
        eq(payments.vietqrRef, compactCode),
        eq(payments.paymentMethod, "VIETQR"),
        inArray(payments.status, ["PENDING", "EXPIRED"]),
        eq(orders.status, "DANG_PHUC_VU"),
      ),
    )
    .orderBy(desc(payments.id));

  if (candidates.length > 1) {
    return { error: `Xung đột mã hóa đơn trùng lặp giữa các đơn đang mở (${candidates.length} đơn trùng mã)` };
  }

  if (candidates.length === 1) {
    matchedPayment = candidates[0].payment;
    matchedOrder = candidates[0].order;
  } else {
    // Check direct match on orders table
    const [direct] = await db
      .select()
      .from(orders)
      .where(eq(orders.orderCode, extractedCode))
      .limit(1);

    if (direct) {
      if (direct.status === "DA_THANH_TOAN") {
        return { matchedOrder: direct, error: "Hóa đơn đã được thanh toán trước đó (tiền mặt/khác)" };
      }
      if (direct.status === "DA_HUY") {
        return { matchedOrder: direct, error: "Hóa đơn đã bị hủy" };
      }
      if (direct.status !== "DANG_PHUC_VU") {
        return { matchedOrder: direct, error: `Hóa đơn ở trạng thái ${direct.status}, không thể tự động thanh toán` };
      }
      matchedOrder = direct;
      const [p] = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.orderId, direct.id),
            eq(payments.paymentMethod, "VIETQR"),
            inArray(payments.status, ["PENDING", "EXPIRED"]),
          ),
        )
        .orderBy(desc(payments.id))
        .limit(1);
      matchedPayment = p;
    } else {
      // Check past orders by compact code (e.g. race condition where order was paid by cash)
      const past = await db
        .select({ payment: payments, order: orders })
        .from(payments)
        .innerJoin(orders, eq(orders.id, payments.orderId))
        .where(and(eq(payments.vietqrRef, compactCode), eq(payments.paymentMethod, "VIETQR")))
        .orderBy(desc(payments.id))
        .limit(1);

      if (past.length > 0) {
        const { payment: pastP, order: pastO } = past[0];
        if (pastO.status === "DA_THANH_TOAN") {
          return { matchedOrder: pastO, matchedPayment: pastP, error: "Hóa đơn đã được thanh toán trước đó (tiền mặt/khác)" };
        }
        if (pastO.status === "DA_HUY") {
          return { matchedOrder: pastO, matchedPayment: pastP, error: "Hóa đơn đã bị hủy" };
        }
        return { matchedOrder: pastO, matchedPayment: pastP, error: `Hóa đơn ${pastO.orderCode} ở trạng thái ${pastO.status}, không thể tự động thanh toán` };
      }

      return { error: "Không tìm thấy hóa đơn phù hợp hoặc đang phục vụ với nội dung chuyển khoản" };
    }
  }

  // 2. Shift validation
  const targetShiftId = matchedPayment?.shiftId || matchedOrder!.shiftId;
  const [shiftRecord] = await db.select().from(shifts).where(eq(shifts.id, targetShiftId)).limit(1);
  if (!shiftRecord || shiftRecord.status !== "DANG_MO") {
    return {
      matchedOrder,
      matchedPayment,
      error: `Ca làm việc của đơn hàng đã đóng (trạng thái ${shiftRecord?.status || "KHONG_TON_TAI"}), không thể tự động thanh toán`,
    };
  }

  // 3. Amount validation (both underpayment and overpayment flagged)
  if (transferAmount < matchedOrder!.finalAmount) {
    return {
      matchedOrder,
      matchedPayment,
      error: `Số tiền không đủ (chuyển ${transferAmount.toLocaleString("vi-VN")} đ, cần ${matchedOrder!.finalAmount.toLocaleString("vi-VN")} đ)`,
    };
  }
  if (transferAmount > matchedOrder!.finalAmount) {
    return {
      matchedOrder,
      matchedPayment,
      error: `Số tiền thừa (chuyển ${transferAmount.toLocaleString("vi-VN")} đ, cần ${matchedOrder!.finalAmount.toLocaleString("vi-VN")} đ)`,
    };
  }

  // 4. Creator user validation
  if (!matchedOrder!.createdById) {
    return { matchedOrder, matchedPayment, error: "Không tìm thấy người tạo đơn hàng để hoàn tất thanh toán" };
  }
  const [creatorUser] = await db.select().from(users).where(eq(users.id, matchedOrder!.createdById)).limit(1);
  if (!creatorUser) {
    return { matchedOrder, matchedPayment, error: "Người tạo đơn hàng không còn tồn tại trong hệ thống" };
  }

  return { matchedOrder, matchedPayment, creatorUser };
}
