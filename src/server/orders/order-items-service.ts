import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  orders,
  orderItems,
  orderItemToppings,
  tables,
  menuItems,
  toppings,
} from "@/db/schema";
import { formatErr07 } from "@/lib/error-catalog";
import { ModifyOrderItemsInput, MAX_ORDER_AMOUNT } from "./order-schema";
import { getOrderDetails } from "./order-service";
import { OrderDetail } from "./order-types";
import { calculateOrderTotal } from "./order-total-calculator";

export { sendKitchenOrder } from "./send-kitchen-service";
export { deleteEmptyOrder } from "./delete-order-service";

export type ModifyResult =
  | { ok: true; order: OrderDetail }
  | { ok: false; error: string; status: number };

/**
 * Modifies items in an active order (FR-02, BR-09, ERR-07).
 * Supports adding items, changing quantity, deleting unprinted items, and optimistic locking.
 */
export async function modifyOrderItems(
  orderId: number,
  input: ModifyOrderItemsInput,
): Promise<ModifyResult> {
  return await db.transaction(async (tx) => {
    // 1. Fetch order with row-level lock
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)
      .for("update");

    if (!order) {
      return { ok: false, error: "Đơn hàng không tồn tại", status: 404 };
    }

    if (order.status !== "DANG_PHUC_VU") {
      return { ok: false, error: "Đơn hàng không ở trạng thái đang phục vụ", status: 409 };
    }

    // 2. Optimistic locking check
    if (input.expectedVersion !== undefined && order.version !== input.expectedVersion) {
      return {
        ok: false,
        error: "Đơn hàng đã được cập nhật bởi phiên làm việc khác, vui lòng tải lại",
        status: 409,
      };
    }

    // 3. Handle explicit item deletion
    if (input.action === "delete" && input.orderItemId) {
      const [item] = await tx
        .select()
        .from(orderItems)
        .where(and(eq(orderItems.id, input.orderItemId), eq(orderItems.orderId, orderId)))
        .limit(1);

      if (!item) {
        return { ok: false, error: "Dòng món không tồn tại trong đơn hàng", status: 404 };
      }

      if (item.isPrintedKitchen) {
        return {
          ok: false,
          error: "Không thể xóa món đã gửi bếp. Vui lòng liên hệ Quản lý để hủy món!",
          status: 409,
        };
      }

      await tx.delete(orderItems).where(eq(orderItems.id, input.orderItemId));
    } else {
      // 4. Normalize items to process
      const itemsToProcess =
        input.items && input.items.length > 0
          ? input.items
          : input.menuItemId
            ? [
                {
                  id: input.orderItemId,
                  menuItemId: input.menuItemId,
                  quantity: input.quantity ?? 1,
                  notes: input.notes,
                  toppingIds: input.toppingIds ?? [],
                },
              ]
            : [];

      for (const item of itemsToProcess) {
        if (item.id) {
          // Update existing item
          const [existing] = await tx
            .select()
            .from(orderItems)
            .where(and(eq(orderItems.id, item.id), eq(orderItems.orderId, orderId)))
            .limit(1);

          if (!existing) {
            return { ok: false, error: "Dòng món không tồn tại trong đơn hàng", status: 404 };
          }

          if (existing.isPrintedKitchen) {
            return {
              ok: false,
              error: "Không thể sửa hoặc xóa món đã gửi bếp. Vui lòng liên hệ Quản lý để hủy món!",
              status: 409,
            };
          }

          if (item.quantity <= 0) {
            await tx.delete(orderItems).where(eq(orderItems.id, item.id));
          } else {
            await tx
              .update(orderItems)
              .set({
                quantity: item.quantity,
                notes: item.notes ? item.notes.trim().slice(0, 100) : existing.notes,
              })
              .where(eq(orderItems.id, item.id));
          }
        } else {
          // Add new item
          const [menuItem] = await tx
            .select()
            .from(menuItems)
            .where(eq(menuItems.id, item.menuItemId))
            .limit(1);

          if (!menuItem) {
            return { ok: false, error: "Món ăn không tồn tại trong thực đơn", status: 400 };
          }

          // Check HET_HANG constraint (BR-09, ERR-07)
          if (menuItem.status === "HET_HANG") {
            return {
              ok: false,
              error: formatErr07(menuItem.name),
              status: 400,
            };
          }

          // Insert order item with snapshot price
          const [newItem] = await tx
            .insert(orderItems)
            .values({
              orderId,
              menuItemId: menuItem.id,
              quantity: item.quantity > 0 ? item.quantity : 1,
              unitPrice: menuItem.price,
              notes: item.notes ? item.notes.trim().slice(0, 100) : null,
              isPrintedKitchen: false,
            })
            .returning();

          // Insert toppings if any
          if (item.toppingIds && item.toppingIds.length > 0) {
            const toppingRecords = await tx
              .select()
              .from(toppings)
              .where(inArray(toppings.id, item.toppingIds));

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

    // 5. Recalculate order total amount
    const calculatedTotal = await calculateOrderTotal(orderId, tx);

    if (calculatedTotal > MAX_ORDER_AMOUNT) {
      return { ok: false, error: "Tổng tiền đơn hàng vượt quá giới hạn 2.000.000.000 VNĐ", status: 400 };
    }

    const finalAmount = Math.max(0, calculatedTotal - order.discountAmount);
    const nextVersion = order.version + 1;

    // Update order with new total and version
    await tx
      .update(orders)
      .set({
        totalAmount: calculatedTotal,
        finalAmount,
        version: nextVersion,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    // If table is in CHO_THANH_TOAN, revert to DANG_DUNG per SRS 8.1
    if (order.tableId) {
      const [table] = await tx
        .select()
        .from(tables)
        .where(eq(tables.id, order.tableId))
        .limit(1);

      if (table && table.status === "CHO_THANH_TOAN") {
        await tx
          .update(tables)
          .set({ status: "DANG_DUNG", updatedAt: new Date() })
          .where(eq(tables.id, order.tableId));
      }
    }

    const updated = await getOrderDetails(orderId, tx);
    return { ok: true, order: updated! };
  });
}
