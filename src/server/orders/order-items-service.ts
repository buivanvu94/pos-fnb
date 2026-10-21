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
import { dispatchPrintJob } from "@/server/printing/print-service";
import type { ActingUser } from "@/server/approvals/approval-types";

export { sendKitchenOrder } from "./send-kitchen-service";
export { deleteEmptyOrder } from "./delete-order-service";

export type ModifyResult =
  | { ok: true; order: OrderDetail }
  | { ok: false; error: string; status: number };

/**
 * Modifies items in an active order (FR-02, BR-03, BR-09, ERR-07).
 * Supports adding items, changing quantity, deleting unprinted items,
 * cancelling/reducing printed items with Manager PIN approval, and optimistic locking.
 */
export async function modifyOrderItems(
  orderId: number,
  input: ModifyOrderItemsInput,
  actingUser?: ActingUser,
  clientIp?: string,
): Promise<ModifyResult> {
  const enqueuedJobIds: number[] = [];

  try {
    const res = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1)
        .for("update");

      if (!order) throw new TxAbortError("Đơn hàng không tồn tại", 404);
      if (order.status !== "DANG_PHUC_VU") {
        throw new TxAbortError("Đơn hàng không ở trạng thái đang phục vụ", 409);
      }
      if (order.version !== input.expectedVersion) {
        throw new TxAbortError("Đơn hàng đã được cập nhật bởi phiên làm việc khác, vui lòng tải lại", 409);
      }

      if (input.action === "delete") {
        if (!input.orderItemId) throw new TxAbortError("Thiếu mã dòng món cần xóa", 400);
        const [item] = await tx
          .select()
          .from(orderItems)
          .where(and(eq(orderItems.id, input.orderItemId), eq(orderItems.orderId, orderId)))
          .limit(1);
        if (!item) throw new TxAbortError("Dòng món không tồn tại trong đơn hàng", 404);
        if (item.isCancelled) throw new TxAbortError("Dòng món đã bị hủy, không thể chỉnh sửa hoặc xóa", 409);

        if (item.isPrintedKitchen) {
          await handleCancelPrintedItem({
            tx,
            order,
            item,
            quantityToCancel: item.quantity,
            pinCode: input.pinCode,
            lyDo: input.lyDo,
            actingUser,
            clientIp,
            enqueuedJobIds,
          });
        } else {
          await tx.delete(orderItems).where(eq(orderItems.id, input.orderItemId));
        }
      } else {
        const itemsToProcess =
          input.items && input.items.length > 0
            ? input.items
            : input.orderItemId !== undefined || input.menuItemId !== undefined
              ? [{ id: input.orderItemId, menuItemId: input.menuItemId, quantity: input.quantity ?? 1, notes: input.notes, toppingIds: input.toppingIds ?? [] }]
              : [];

        if (itemsToProcess.length === 0) {
          throw new TxAbortError("Thiếu thông tin món cần thêm hoặc cập nhật", 400);
        }

        for (const item of itemsToProcess) {
          if (item.id) {
            const [existing] = await tx
              .select()
              .from(orderItems)
              .where(and(eq(orderItems.id, item.id), eq(orderItems.orderId, orderId)))
              .limit(1);
            if (!existing) throw new TxAbortError("Dòng món không tồn tại trong đơn hàng", 404);
            if (existing.isCancelled) throw new TxAbortError("Dòng món đã bị hủy, không thể chỉnh sửa hoặc xóa", 409);

            if (existing.isPrintedKitchen) {
              if (item.quantity < existing.quantity) {
                await handleCancelPrintedItem({
                  tx,
                  order,
                  item: existing,
                  quantityToCancel: existing.quantity - item.quantity,
                  pinCode: input.pinCode,
                  lyDo: input.lyDo,
                  actingUser,
                  clientIp,
                  enqueuedJobIds,
                });
              } else {
                throw new TxAbortError("Không thể sửa hoặc xóa món đã gửi bếp. Vui lòng liên hệ Quản lý để hủy món!", 409);
              }
            } else {
              if (item.quantity > existing.quantity) {
                const [mItem] = await tx
                  .select({ name: menuItems.name, status: menuItems.status })
                  .from(menuItems)
                  .where(eq(menuItems.id, existing.menuItemId))
                  .limit(1);
                if (mItem && mItem.status === "HET_HANG") throw new TxAbortError(formatErr07(mItem.name), 400);
              }
              if (item.quantity <= 0) {
                await tx.delete(orderItems).where(eq(orderItems.id, item.id));
              } else {
                const nextNotes = item.notes !== undefined ? (item.notes === null || item.notes.trim() === "" ? null : item.notes.trim().slice(0, 100)) : existing.notes;
                await tx.update(orderItems).set({ quantity: item.quantity, notes: nextNotes }).where(eq(orderItems.id, item.id));
              }
            }
          } else {
            if (!item.menuItemId) throw new TxAbortError("Mã món không hợp lệ", 400);
            const [menuItem] = await tx.select().from(menuItems).where(eq(menuItems.id, item.menuItemId)).limit(1);
            if (!menuItem) throw new TxAbortError("Món ăn không tồn tại trong thực đơn", 400);
            if (menuItem.status === "HET_HANG") throw new TxAbortError(formatErr07(menuItem.name), 400);

            const uniqueToppingIds = Array.from(new Set(item.toppingIds ?? []));
            let toppingRecords: Array<{ id: number; name: string; price: number; isAvailable: boolean }> = [];
            if (uniqueToppingIds.length > 0) {
              toppingRecords = await tx.select().from(toppings).where(inArray(toppings.id, uniqueToppingIds));
              if (toppingRecords.length !== uniqueToppingIds.length) throw new TxAbortError("Topping không tồn tại trên hệ thống", 400);
              if (toppingRecords.some((t) => !t.isAvailable)) throw new TxAbortError("Topping hiện không còn hoạt động", 400);
            }

            const [newItem] = await tx
              .insert(orderItems)
              .values({
                orderId,
                menuItemId: menuItem.id,
                quantity: item.quantity > 0 ? item.quantity : 1,
                unitPrice: menuItem.price,
                notes: item.notes && item.notes.trim() !== "" ? item.notes.trim().slice(0, 100) : null,
                isPrintedKitchen: false,
              })
              .returning();

            for (const t of toppingRecords) {
              await tx.insert(orderItemToppings).values({ orderItemId: newItem.id, toppingId: t.id, toppingName: t.name, toppingPrice: t.price });
            }
          }
        }
      }

      const calculatedTotal = await calculateOrderTotal(orderId, tx);
      if (calculatedTotal > MAX_ORDER_AMOUNT) {
        throw new TxAbortError("Tổng tiền đơn hàng vượt quá giới hạn 2.000.000.000 VNĐ", 400);
      }

      const { discountAmount, finalAmount } = await recalculateOrderDiscount(
        orderId,
        calculatedTotal,
        order.discountAmount,
        tx,
      );

      await tx.update(orders).set({
        totalAmount: calculatedTotal,
        discountAmount,
        finalAmount,
        version: order.version + 1,
        updatedAt: new Date(),
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
      dispatchPrintJob(jobId).catch((err) => {
        console.error(`Error dispatching cancel print job ${jobId}:`, err);
      });
    }

    return res;
  } catch (err: any) {
    if (err instanceof TxAbortError) {
      return { ok: false, error: err.message, status: err.status };
    }
    throw err;
  }
}
