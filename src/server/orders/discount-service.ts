import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { withManagerApproval } from "@/server/approvals/with-manager-approval";
import { logAudit } from "@/server/approvals/audit-log-service";
import { getOrderDetails } from "./order-service";
import { TxAbortError } from "./tx-abort-error";
import type { ActingUser } from "@/server/approvals/approval-types";
import type { OrderDetail } from "./order-types";

export interface ApplyDiscountInput {
  amount?: number;
  percent?: number;
  lyDo: string;
  pinCode?: string;
  expectedVersion: number;
}

export type DiscountResult =
  | { ok: true; order: OrderDetail }
  | { ok: false; error: string; status: number };

/**
 * Applies a discount to an active order with Manager approval (FR-10, BR-03).
 * Persists discount_percent on percentage discounts, or null on fixed amount discounts.
 * Enforces expectedVersion optimistic concurrency control (409 on mismatch).
 */
export async function applyOrderDiscount(
  orderId: number,
  input: ApplyDiscountInput,
  actingUser: ActingUser,
  clientIp?: string | null,
  userAgent?: string | null,
): Promise<DiscountResult> {
  const approval = await withManagerApproval(
    actingUser,
    "DISCOUNT_ORDER",
    { pinCode: input.pinCode, lyDo: input.lyDo },
    clientIp,
    userAgent,
  );

  if (!approval.ok) {
    return { ok: false, error: approval.error, status: approval.status };
  }

  const userId = actingUser.userId ?? actingUser.id!;

  try {
    return await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1)
        .for("update");

      if (!order) throw new TxAbortError("Đơn hàng không tồn tại", 404);
      if (order.status !== "DANG_PHUC_VU") {
        throw new TxAbortError("Đơn hàng không ở trạng thái đang phục vụ, không thể giảm giá", 409);
      }
      if (order.version !== input.expectedVersion) {
        throw new TxAbortError("Đơn hàng đã được cập nhật bởi phiên làm việc khác, vui lòng tải lại", 409);
      }

      if (input.amount !== undefined && input.percent !== undefined) {
        throw new TxAbortError("Không thể áp dụng đồng thời cả số tiền và phần trăm giảm giá", 400);
      }
      if (input.amount === undefined && input.percent === undefined) {
        throw new TxAbortError("Cần cung cấp số tiền giảm giá hoặc phần trăm giảm giá", 400);
      }

      let discountAmount = 0;
      let discountPercent: number | null = null;

      if (input.percent !== undefined) {
        if (input.percent < 0 || input.percent > 100) {
          throw new TxAbortError("Phần trăm giảm giá phải từ 0% đến 100%", 400);
        }
        discountPercent = input.percent;
        discountAmount = Math.round(order.totalAmount * (input.percent / 100));
      } else if (input.amount !== undefined) {
        if (input.amount < 0) {
          throw new TxAbortError("Số tiền giảm giá không được nhỏ hơn 0 VNĐ", 400);
        }
        discountPercent = null;
        discountAmount = input.amount;
      }

      if (discountAmount > order.totalAmount) {
        throw new TxAbortError("Số tiền giảm giá không được vượt quá tổng tiền hóa đơn", 400);
      }

      const finalAmount = Math.max(0, order.totalAmount - discountAmount);

      await tx
        .update(orders)
        .set({
          discountAmount,
          discountPercent,
          finalAmount,
          version: order.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));

      await logAudit(
        {
          userId,
          username: actingUser.username,
          userAgent,
          action: "DISCOUNT",
          entityType: "orders",
          entityId: orderId,
          reason: approval.reason,
          metadata: {
            orderCode: order.orderCode,
            totalAmount: order.totalAmount,
            discountAmount,
            finalAmount,
            percent: input.percent,
            amount: input.amount,
            requesterId: userId,
            approverId: approval.approverId,
            approverName: approval.approverName,
          },
          ipAddress: clientIp,
        },
        tx,
      );

      const updated = await getOrderDetails(orderId, tx);
      return { ok: true, order: updated! };
    });
  } catch (err: any) {
    if (err instanceof TxAbortError) {
      return { ok: false, error: err.message, status: err.status };
    }
    throw err;
  }
}
