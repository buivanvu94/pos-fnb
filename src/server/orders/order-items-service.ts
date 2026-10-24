import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems, orderItemToppings, tables, menuItems, toppings } from "@/db/schema";
import { formatErr07 } from "@/lib/error-catalog";
import { ModifyOrderItemsInput, MAX_ORDER_AMOUNT } from "./order-schema";
import { getOrderDetails } from "./order-service";
import { OrderDetail } from "./order-types";
import { calculateOrderTotal } from "./order-total-calculator";
import { TxAbortError } from "./tx-abort-error";
import { handleCancelPrintedItem } from "./cancel-item-helper";
import { recalculateOrderDiscount } from "./recalculate-discount-helper";
import { precheckItemApproval } from "./precheck-approval-helper";
import { logAudit } from "@/server/approvals/audit-log-service";
import { dispatchPrintJob } from "@/server/printing/print-service";
import type { ActingUser } from "@/server/approvals/approval-types";

export { sendKitchenOrder } from "./send-kitchen-service";
export { deleteEmptyOrder } from "./delete-order-service";
export type ModifyResult = { ok: true; order: OrderDetail } | { ok: false; error: string; status: number };

export async function modifyOrderItems(
  orderId: number,
  input: ModifyOrderItemsInput,
  actingUser?: ActingUser,
  clientIp?: string | null,
  userAgent?: string | null,
): Promise<ModifyResult> {
  const approval = await precheckItemApproval(orderId, input, actingUser, clientIp, userAgent);
  if (approval && !approval.ok) return { ok: false, error: approval.error, status: approval.status };

  const enqueuedJobIds: number[] = [];
  try {
    const res = await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for("update");
      if (!order) throw new TxAbortError("Đơn hàng không tồn tại", 404);
      if (order.status !== "DANG_PHUC_VU") throw new TxAbortError("Đơn hàng không ở trạng thái đang phục vụ", 409);
      if (order.version !== input.expectedVersion) {
        throw new TxAbortError("Đơn hàng đã được cập nhật bởi phiên làm việc khác, vui lòng tải lại", 409);
      }

      if (input.action === "delete") {
        if (!input.orderItemId) throw new TxAbortError("Thiếu mã dòng món cần xóa", 400);
        const [item] = await tx.select().from(orderItems)
          .where(and(eq(orderItems.id, input.orderItemId), eq(orderItems.orderId, orderId))).limit(1);
        if (!item) throw new TxAbortError("Dòng món không tồn tại trong đơn hàng", 404);
        if (item.isCancelled) throw new TxAbortError("Dòng món đã bị hủy, không thể chỉnh sửa hoặc xóa", 409);

        if (item.isPrintedKitchen) {
          if (!approval?.ok) {
            throw new TxAbortError("Món đã được gửi bếp trong quá trình xử lý. Vui lòng liên hệ Quản lý để duyệt hủy!", 409);
          }
          await handleCancelPrintedItem({
            tx, order, item, quantityToCancel: item.quantity,
            approval, actingUser: actingUser!, clientIp, userAgent, enqueuedJobIds,
          });
        } else {
          await tx.delete(orderItems).where(eq(orderItems.id, input.orderItemId));
          await logAudit({
            userId: actingUser?.userId ?? actingUser?.id ?? null, username: actingUser?.username, userAgent,
            action: "REMOVE_UNSENT_ITEM", entityType: "order_items", entityId: item.id,
            reason: "Xóa món chưa gửi bếp khỏi đơn hàng", metadata: { orderId, menuItemId: item.menuItemId, quantity: item.quantity },
            ipAddress: clientIp,
          }, tx);
        }
      } else {
        const isBatch = Boolean(input.items && input.items.length > 0);
        const itemsToProcess = isBatch
          ? input.items!
          : input.orderItemId !== undefined || input.menuItemId !== undefined
            ? [{ id: input.orderItemId, menuItemId: input.menuItemId, quantity: input.quantity ?? 1, notes: input.notes, toppingIds: input.toppingIds ?? [] }]
            : [];
        if (itemsToProcess.length === 0) throw new TxAbortError("Thiếu thông tin món cần thêm hoặc cập nhật", 400);

        for (const item of itemsToProcess) {
          if (item.id) {
            const [existing] = await tx.select().from(orderItems).where(and(eq(orderItems.id, item.id), eq(orderItems.orderId, orderId))).limit(1);
            if (!existing) throw new TxAbortError("Dòng món không tồn tại trong đơn hàng", 404);
            if (existing.isCancelled) throw new TxAbortError("Dòng món đã bị hủy, không thể chỉnh sửa hoặc xóa", 409);

            if (existing.isPrintedKitchen) {
              if (item.quantity < existing.quantity) {
                if (!approval?.ok) {
                  throw new TxAbortError("Món đã được gửi bếp trong quá trình xử lý. Vui lòng liên hệ Quản lý để duyệt hủy!", 409);
                }
                await handleCancelPrintedItem({
                  tx, order, item: existing, quantityToCancel: existing.quantity - item.quantity,
                  approval, actingUser: actingUser!, clientIp, userAgent, enqueuedJobIds,
                });
              } else {
                throw new TxAbortError("Không thể sửa hoặc xóa món đã gửi bếp. Vui lòng liên hệ Quản lý để hủy món!", 409);
              }
            } else {
              if (item.quantity > existing.quantity) {
                const [mItem] = await tx.select({ name: menuItems.name, status: menuItems.status }).from(menuItems).where(eq(menuItems.id, existing.menuItemId)).limit(1);
                if (mItem && mItem.status === "HET_HANG") throw new TxAbortError(formatErr07(mItem.name), 400);
              }
              if (item.quantity <= 0) {
                await tx.delete(orderItems).where(eq(orderItems.id, item.id));
                await logAudit({
                  userId: actingUser?.userId ?? actingUser?.id ?? null, username: actingUser?.username, userAgent,
                  action: "REMOVE_UNSENT_ITEM", entityType: "order_items", entityId: item.id,
                  reason: "Giảm số lượng về 0 (xóa món chưa gửi bếp)", metadata: { orderId, menuItemId: existing.menuItemId, previousQuantity: existing.quantity },
                  ipAddress: clientIp,
                }, tx);
              } else {
                await tx.update(orderItems).set({
                  quantity: item.quantity,
                  notes: item.notes !== undefined ? (item.notes && item.notes.trim() !== "" ? item.notes.trim().slice(0, 100) : null) : existing.notes,
                }).where(eq(orderItems.id, item.id));
              }
            }
          } else if (item.menuItemId) {
            const [menuItem] = await tx.select().from(menuItems).where(eq(menuItems.id, item.menuItemId)).limit(1);
            if (!menuItem) throw new TxAbortError("Món không tồn tại", 404);
            if (menuItem.status === "HET_HANG") throw new TxAbortError(formatErr07(menuItem.name), 400);

            const uniqueToppingIds = Array.from(new Set(item.toppingIds ?? [])).sort((a, b) => a - b);
            const normalizedNotes = item.notes && item.notes.trim() !== "" ? item.notes.trim().slice(0, 100) : null;
            const quantityToAdd = item.quantity > 0 ? item.quantity : 1;

            const existingUnprinted = await tx.select().from(orderItems)
              .where(and(
                eq(orderItems.orderId, orderId),
                eq(orderItems.menuItemId, menuItem.id),
                eq(orderItems.isPrintedKitchen, false),
                eq(orderItems.isCancelled, false),
              ));

            let matchedId: number | null = null;
            if (!isBatch) {
              for (const cand of existingUnprinted) {
              const candNotes = cand.notes && cand.notes.trim() !== "" ? cand.notes.trim() : null;
              if (candNotes !== normalizedNotes) continue;

              const candToppings = await tx.select({ toppingId: orderItemToppings.toppingId })
                .from(orderItemToppings)
                .where(eq(orderItemToppings.orderItemId, cand.id));
              const candToppingIds = candToppings.map((t) => t.toppingId).sort((a, b) => a - b);

              if (
                candToppingIds.length === uniqueToppingIds.length &&
                candToppingIds.every((id, idx) => id === uniqueToppingIds[idx])
              ) {
                matchedId = cand.id;
                await tx.update(orderItems)
                  .set({ quantity: cand.quantity + quantityToAdd })
                  .where(eq(orderItems.id, cand.id));
                break;
              }
            }
            }

            if (!matchedId) {
              let toppingRecords: Array<{ id: number; name: string; price: number; isAvailable: boolean }> = [];
              if (uniqueToppingIds.length > 0) {
                toppingRecords = await tx.select().from(toppings).where(inArray(toppings.id, uniqueToppingIds));
                if (toppingRecords.length !== uniqueToppingIds.length) throw new TxAbortError("Topping không tồn tại trên hệ thống", 400);
                if (toppingRecords.some((t) => !t.isAvailable)) throw new TxAbortError("Topping hiện không còn hoạt động", 400);
              }

              const [newItem] = await tx.insert(orderItems).values({
                orderId,
                menuItemId: menuItem.id,
                quantity: quantityToAdd,
                unitPrice: menuItem.price,
                notes: normalizedNotes,
                isPrintedKitchen: false,
              }).returning();

              for (const t of toppingRecords) {
                await tx.insert(orderItemToppings).values({
                  orderItemId: newItem.id,
                  toppingId: t.id,
                  toppingName: t.name,
                  toppingPrice: t.price,
                });
              }
            }
          }
        }
      }

      const calculatedTotal = await calculateOrderTotal(orderId, tx);
      if (calculatedTotal > MAX_ORDER_AMOUNT) throw new TxAbortError("Tổng tiền đơn hàng vượt quá giới hạn 2.000.000.000 VNĐ", 400);

      const { discountAmount, finalAmount } = await recalculateOrderDiscount(
        orderId, calculatedTotal, order.discountAmount, order.discountPercent, tx,
      );

      await tx.update(orders).set({
        totalAmount: calculatedTotal, discountAmount, finalAmount, version: order.version + 1, updatedAt: new Date(),
      }).where(eq(orders.id, orderId));

      if (order.tableId) {
        const [table] = await tx.select().from(tables).where(eq(tables.id, order.tableId)).limit(1);
        if (table && table.status === "CHO_THANH_TOAN") {
          await tx.update(tables).set({ status: "DANG_DUNG", updatedAt: new Date() }).where(eq(tables.id, order.tableId));
        }
      }

      const updated = await getOrderDetails(orderId, tx);
      return { ok: true as const, order: updated! };
    });

    for (const jobId of enqueuedJobIds) {
      dispatchPrintJob(jobId).catch((err) => console.error(`Error dispatching cancel job ${jobId}:`, err));
    }
    return res;
  } catch (err: any) {
    if (err instanceof TxAbortError) return { ok: false, error: err.message, status: err.status };
    throw err;
  }
}
