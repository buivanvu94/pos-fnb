import { eq, and, sql, asc } from "drizzle-orm";
import { db } from "@/db";
import { tables, areas, orders, orderItems } from "@/db/schema";

export type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface TableWithOrderInfo {
  id: number;
  code: string;
  name: string;
  capacity: number;
  status: "TRONG" | "DANG_DUNG" | "CHO_THANH_TOAN";
  areaId: number;
  areaName: string | null;
  areaDisplayOrder: number;
  activeOrderId: number | null;
  activeOrderCode: string | null;
  activeOrderTotal: number;
  activeOrderItemCount: number;
  activeOrderVersion: number | null;
}

/**
 * Retrieves all tables grouped by area with their real-time order status (FR-01).
 * Includes active order ID, total money, and item count if table is occupied.
 */
export async function getTablesWithActiveOrders(): Promise<TableWithOrderInfo[]> {
  // Query all tables with their areas
  const tableRows = await db
    .select({
      id: tables.id,
      code: tables.code,
      name: tables.name,
      capacity: tables.capacity,
      status: tables.status,
      areaId: tables.areaId,
      areaName: areas.name,
      areaDisplayOrder: areas.displayOrder,
      activeOrderId: orders.id,
      activeOrderCode: orders.orderCode,
      activeOrderTotal: orders.totalAmount,
      activeOrderVersion: orders.version,
    })
    .from(tables)
    .leftJoin(areas, eq(tables.areaId, areas.id))
    .leftJoin(
      orders,
      and(
        eq(orders.tableId, tables.id),
        eq(orders.status, "DANG_PHUC_VU"),
      ),
    )
    .orderBy(asc(areas.displayOrder), asc(tables.code));

  // Compute item count for active orders
  const activeOrderIds = tableRows
    .map((r) => r.activeOrderId)
    .filter((id): id is number => id !== null);

  const itemCountMap = new Map<number, number>();

  if (activeOrderIds.length > 0) {
    const counts = await db
      .select({
        orderId: orderItems.orderId,
        count: sql<number>`cast(coalesce(sum(${orderItems.quantity}), 0) as int)`,
      })
      .from(orderItems)
      .where(
        and(
          sql`${orderItems.orderId} IN ${activeOrderIds}`,
          eq(orderItems.isCancelled, false),
        ),
      )
      .groupBy(orderItems.orderId);

    for (const c of counts) {
      itemCountMap.set(c.orderId, c.count);
    }
  }

  return tableRows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    capacity: row.capacity,
    status: row.status as "TRONG" | "DANG_DUNG" | "CHO_THANH_TOAN",
    areaId: row.areaId,
    areaName: row.areaName,
    areaDisplayOrder: row.areaDisplayOrder ?? 0,
    activeOrderId: row.activeOrderId,
    activeOrderCode: row.activeOrderCode,
    activeOrderTotal: row.activeOrderTotal ?? 0,
    activeOrderItemCount: row.activeOrderId ? (itemCountMap.get(row.activeOrderId) ?? 0) : 0,
    activeOrderVersion: row.activeOrderVersion,
  }));
}

/**
 * Resolves a table record by either numeric ID, string ID, code, or name.
 */
export async function findTableByIdOrCode(
  identifier: number | string,
  tx: DbOrTx = db,
) {
  if (typeof identifier === "number") {
    const [found] = await tx.select().from(tables).where(eq(tables.id, identifier)).limit(1);
    return found ?? null;
  }

  const parsedId = Number(identifier);
  if (!Number.isNaN(parsedId) && String(parsedId) === identifier.trim()) {
    const [found] = await tx.select().from(tables).where(eq(tables.id, parsedId)).limit(1);
    if (found) return found;
  }

  const [foundByCode] = await tx
    .select()
    .from(tables)
    .where(eq(tables.code, identifier.trim()))
    .limit(1);

  if (foundByCode) return foundByCode;

  const [foundByName] = await tx
    .select()
    .from(tables)
    .where(eq(tables.name, identifier.trim()))
    .limit(1);

  return foundByName ?? null;
}
