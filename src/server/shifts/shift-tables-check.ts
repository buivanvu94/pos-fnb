import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";

export type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Counts the number of tables currently serving active orders in the shift (BR-07, ERR-04, AC-10-1).
 * Adheres strictly to Rule BR-07: "Không được phép đóng ca khi vẫn còn hóa đơn bàn đang phục vụ
 * chưa hoàn tất thanh toán hoặc chưa được chuyển sang ca tiếp theo."
 */
export async function countUnpaidTables(shiftId: number, client: DbOrTx = db): Promise<number> {
  const activeOrders = await client
    .select({ tableId: orders.tableId })
    .from(orders)
    .where(
      and(
        eq(orders.shiftId, shiftId),
        eq(orders.status, "DANG_PHUC_VU"),
        isNotNull(orders.tableId),
      ),
    );

  const uniqueTableIds = new Set(activeOrders.map((o) => o.tableId));
  return uniqueTableIds.size;
}
