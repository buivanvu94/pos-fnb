import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems, orderItemToppings, tables } from "@/db/schema";
import { findTableByIdOrCode } from "@/server/tables/table-service";
import { TransferTableInput, MAX_ORDER_AMOUNT } from "./order-schema";

export type TransferResult =
  | {
      ok: true;
      data: {
        loai: "CHUYEN" | "GOP";
        banNguon: { id: number; name: string; status: string };
        banDich: { id: number; name: string; status: string };
        orderId: number;
        totalAmount?: number;
      };
    }
  | { ok: false; error: string; status: number };

/**
 * Handles table transfer or table merge (API-03, FR-04, BR-02, UC-03, AC-04-1, AC-04-2).
 * Executed inside a single PostgreSQL transaction with optimistic locks and 23505 conflict catches.
 */
export async function transferOrMergeTable(
  input: TransferTableInput,
): Promise<TransferResult> {
  return await db.transaction(async (tx) => {
    // 1. Resolve source and destination tables
    const sourceTable = await findTableByIdOrCode(input.banNguonId, tx as any);
    const destTable = await findTableByIdOrCode(input.banDichId, tx as any);

    if (!sourceTable || !destTable) {
      return { ok: false, error: "Bàn nguồn hoặc bàn đích không tồn tại trên hệ thống", status: 404 };
    }

    if (sourceTable.id === destTable.id) {
      return { ok: false, error: "Bàn nguồn và bàn đích không được trùng nhau", status: 400 };
    }

    // Lock source table and find its active order
    const [sourceOrder] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.tableId, sourceTable.id), eq(orders.status, "DANG_PHUC_VU")))
      .limit(1)
      .for("update");

    if (!sourceOrder) {
      return { ok: false, error: "Bàn nguồn không có đơn hàng đang phục vụ để chuyển/gộp", status: 409 };
    }

    const mode = input.loai ?? "CHUYEN";

    if (mode === "CHUYEN") {
      // Destination must be TRONG (BR-02)
      if (destTable.status !== "TRONG") {
        return { ok: false, error: "Bàn đích đang có khách, không thể chuyển bàn", status: 409 };
      }

      const [existingDestOrder] = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.tableId, destTable.id), eq(orders.status, "DANG_PHUC_VU")))
        .limit(1);

      if (existingDestOrder) {
        return { ok: false, error: "Bàn đích đang có khách, không thể chuyển bàn", status: 409 };
      }

      try {
        // Move active order to destination table
        await tx
          .update(orders)
          .set({
            tableId: destTable.id,
            version: sourceOrder.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, sourceOrder.id));

        // Update table statuses
        await tx
          .update(tables)
          .set({ status: "TRONG", updatedAt: new Date() })
          .where(eq(tables.id, sourceTable.id));

        await tx
          .update(tables)
          .set({ status: "DANG_DUNG", updatedAt: new Date() })
          .where(eq(tables.id, destTable.id));

        return {
          ok: true,
          data: {
            loai: "CHUYEN",
            banNguon: { id: sourceTable.id, name: sourceTable.name, status: "TRONG" },
            banDich: { id: destTable.id, name: destTable.name, status: "DANG_DUNG" },
            orderId: sourceOrder.id,
          },
        };
      } catch (err: any) {
        if (err?.code === "23505") {
          return { ok: false, error: "Bàn đích đang có khách, không thể chuyển bàn", status: 409 };
        }
        throw err;
      }
    } else {
      // mode === "GOP"
      // Destination table must be active (DANG_DUNG or CHO_THANH_TOAN)
      if (destTable.status === "TRONG") {
        return { ok: false, error: "Bàn đích phải đang phục vụ để thực hiện gộp bàn", status: 409 };
      }

      const [destOrder] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.tableId, destTable.id), eq(orders.status, "DANG_PHUC_VU")))
        .limit(1)
        .for("update");

      if (!destOrder) {
        return { ok: false, error: "Bàn đích không có đơn hàng đang phục vụ để gộp", status: 409 };
      }

      // Move all items from source order to destination order
      await tx
        .update(orderItems)
        .set({ orderId: destOrder.id })
        .where(eq(orderItems.orderId, sourceOrder.id));

      // Recalculate total amount for destination order
      const allDestItems = await tx
        .select({
          id: orderItems.id,
          quantity: orderItems.quantity,
          unitPrice: orderItems.unitPrice,
        })
        .from(orderItems)
        .where(and(eq(orderItems.orderId, destOrder.id), eq(orderItems.isCancelled, false)));

      let newTotal = 0;
      if (allDestItems.length > 0) {
        const destItemIds = allDestItems.map((i) => i.id);
        const toppingRows = await tx
          .select({
            orderItemId: orderItemToppings.orderItemId,
            toppingPrice: orderItemToppings.toppingPrice,
          })
          .from(orderItemToppings)
          .where(inArray(orderItemToppings.orderItemId, destItemIds));

        const toppingSumMap = new Map<number, number>();
        for (const tr of toppingRows) {
          toppingSumMap.set(tr.orderItemId, (toppingSumMap.get(tr.orderItemId) ?? 0) + tr.toppingPrice);
        }

        for (const it of allDestItems) {
          const topPrice = toppingSumMap.get(it.id) ?? 0;
          newTotal += (it.unitPrice + topPrice) * it.quantity;
        }
      }

      if (newTotal > MAX_ORDER_AMOUNT) {
        return { ok: false, error: "Tổng tiền sau khi gộp bàn vượt quá giới hạn 2 tỷ VNĐ", status: 400 };
      }

      const finalAmount = Math.max(0, newTotal - destOrder.discountAmount);

      // Update destination order with merged total and increment version
      await tx
        .update(orders)
        .set({
          totalAmount: newTotal,
          finalAmount,
          version: destOrder.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, destOrder.id));

      // Close source order: DA_GOP and detach tableId so partial unique index is released
      await tx
        .update(orders)
        .set({
          status: "DA_GOP",
          tableId: null,
          totalAmount: 0,
          finalAmount: 0,
          version: sourceOrder.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, sourceOrder.id));

      // Set source table back to TRONG
      await tx
        .update(tables)
        .set({ status: "TRONG", updatedAt: new Date() })
        .where(eq(tables.id, sourceTable.id));

      // Ensure dest table returns to DANG_DUNG (even if it was CHO_THANH_TOAN)
      await tx
        .update(tables)
        .set({ status: "DANG_DUNG", updatedAt: new Date() })
        .where(eq(tables.id, destTable.id));

      return {
        ok: true,
        data: {
          loai: "GOP",
          banNguon: { id: sourceTable.id, name: sourceTable.name, status: "TRONG" },
          banDich: { id: destTable.id, name: destTable.name, status: "DANG_DUNG" },
          orderId: destOrder.id,
          totalAmount: newTotal,
        },
      };
    }
  });
}
