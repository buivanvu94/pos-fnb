import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems, tables } from "@/db/schema";
import { findTableByIdOrCode } from "@/server/tables/table-service";
import { TransferTableInput, MAX_ORDER_AMOUNT } from "./order-schema";
import { calculateOrderTotal } from "./order-total-calculator";
import { TxAbortError } from "./tx-abort-error";

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
 * Locks tables and orders in stable ID order to prevent PostgreSQL 40P01 deadlocks.
 * Transfer and merge rely on pessimistic row-level locking (FOR UPDATE) to serialize operations, so explicit expectedVersion is not required.
 */
export async function transferOrMergeTable(
  input: TransferTableInput,
): Promise<TransferResult> {
  try {
    return await db.transaction(async (tx) => {
      // 1. Resolve source and destination tables
      const sourceTable = await findTableByIdOrCode(input.banNguonId, tx);
      const destTable = await findTableByIdOrCode(input.banDichId, tx);

      if (!sourceTable || !destTable) {
        throw new TxAbortError("Bàn nguồn hoặc bàn đích không tồn tại trên hệ thống", 404);
      }
      if (sourceTable.id === destTable.id) {
        throw new TxAbortError("Bàn nguồn và bàn đích không được trùng nhau", 400);
      }

      // Lock both tables in stable order to prevent deadlocks (40P01)
      const sortedTableIds = [sourceTable.id, destTable.id].sort((a, b) => a - b);
      const lockedTables = await tx
        .select()
        .from(tables)
        .where(inArray(tables.id, sortedTableIds))
        .orderBy(tables.id)
        .for("update");

      const lockedSourceTable = lockedTables.find((t) => t.id === sourceTable.id);
      const lockedDestTable = lockedTables.find((t) => t.id === destTable.id);
      if (!lockedSourceTable || !lockedDestTable) {
        throw new TxAbortError("Không thể khóa bàn để xử lý", 409);
      }

      const mode = input.loai ?? "CHUYEN";

      // 2. Find active orders
      const [srcOrderRow] = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.tableId, sourceTable.id), eq(orders.status, "DANG_PHUC_VU")))
        .limit(1);

      if (!srcOrderRow) {
        throw new TxAbortError("Bàn nguồn không có đơn hàng đang phục vụ để chuyển/gộp", 409);
      }

      let orderIdsToLock = [srcOrderRow.id];
      let destOrderRowId: number | null = null;

      if (mode === "GOP") {
        const [dstOrderRow] = await tx
          .select({ id: orders.id })
          .from(orders)
          .where(and(eq(orders.tableId, destTable.id), eq(orders.status, "DANG_PHUC_VU")))
          .limit(1);

        if (!dstOrderRow) {
          throw new TxAbortError("Bàn đích không có đơn hàng đang phục vụ để gộp", 409);
        }
        destOrderRowId = dstOrderRow.id;
        orderIdsToLock.push(dstOrderRow.id);
      }

      // Lock orders in stable order
      const sortedOrderIds = [...new Set(orderIdsToLock)].sort((a, b) => a - b);
      const lockedOrders = await tx
        .select()
        .from(orders)
        .where(inArray(orders.id, sortedOrderIds))
        .orderBy(orders.id)
        .for("update");

      const sourceOrder = lockedOrders.find((o) => o.id === srcOrderRow.id);
      if (!sourceOrder || sourceOrder.status !== "DANG_PHUC_VU" || sourceOrder.tableId !== sourceTable.id) {
        throw new TxAbortError("Đơn hàng bàn nguồn đã thay đổi trạng thái", 409);
      }

      if (mode === "CHUYEN") {
        if (lockedDestTable.status !== "TRONG") {
          throw new TxAbortError("Bàn đích đang có khách, không thể chuyển bàn", 409);
        }

        const [existingDestOrder] = await tx
          .select({ id: orders.id })
          .from(orders)
          .where(and(eq(orders.tableId, destTable.id), eq(orders.status, "DANG_PHUC_VU")))
          .limit(1);

        if (existingDestOrder) {
          throw new TxAbortError("Bàn đích đang có khách, không thể chuyển bàn", 409);
        }

        try {
          await tx
            .update(orders)
            .set({ tableId: destTable.id, version: sourceOrder.version + 1, updatedAt: new Date() })
            .where(eq(orders.id, sourceOrder.id));

          await tx.update(tables).set({ status: "TRONG", updatedAt: new Date() }).where(eq(tables.id, sourceTable.id));
          await tx.update(tables).set({ status: "DANG_DUNG", updatedAt: new Date() }).where(eq(tables.id, destTable.id));

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
            throw new TxAbortError("Bàn đích đang có khách, không thể chuyển bàn", 409);
          }
          throw err;
        }
      } else {
        // mode === "GOP"
        if (lockedDestTable.status === "TRONG") {
          throw new TxAbortError("Bàn đích phải đang phục vụ để thực hiện gộp bàn", 409);
        }

        const destOrder = lockedOrders.find((o) => o.id === destOrderRowId);
        if (!destOrder || destOrder.status !== "DANG_PHUC_VU" || destOrder.tableId !== destTable.id) {
          throw new TxAbortError("Đơn hàng bàn đích đã thay đổi trạng thái", 409);
        }

        // Calculate new total BEFORE updating items to prevent partial merge on overflow
        const sourceTotal = await calculateOrderTotal(sourceOrder.id, tx);
        const destTotal = await calculateOrderTotal(destOrder.id, tx);
        const newTotal = sourceTotal + destTotal;

        if (newTotal > MAX_ORDER_AMOUNT) {
          throw new TxAbortError("Tổng tiền sau khi gộp bàn vượt quá giới hạn 2 tỷ VNĐ", 400);
        }

        // Move items
        await tx.update(orderItems).set({ orderId: destOrder.id }).where(eq(orderItems.orderId, sourceOrder.id));

        const finalAmount = Math.max(0, newTotal - destOrder.discountAmount);
        await tx
          .update(orders)
          .set({ totalAmount: newTotal, finalAmount, version: destOrder.version + 1, updatedAt: new Date() })
          .where(eq(orders.id, destOrder.id));

        await tx
          .update(orders)
          .set({ status: "DA_GOP", tableId: null, totalAmount: 0, finalAmount: 0, version: sourceOrder.version + 1, updatedAt: new Date() })
          .where(eq(orders.id, sourceOrder.id));

        await tx.update(tables).set({ status: "TRONG", updatedAt: new Date() }).where(eq(tables.id, sourceTable.id));
        await tx.update(tables).set({ status: "DANG_DUNG", updatedAt: new Date() }).where(eq(tables.id, destTable.id));

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
  } catch (err: any) {
    if (err instanceof TxAbortError) {
      return { ok: false, error: err.message, status: err.status };
    }
    throw err;
  }
}
