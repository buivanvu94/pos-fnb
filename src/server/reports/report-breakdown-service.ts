import { sql, eq, and, gte, lte, or, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems, shifts, users, menuItems } from "@/db/schema";
import type { ShiftRevenueStat, StaffRevenueStat, TopItemStat } from "./report-types";

interface BreakdownQueryParams {
  startUtc: Date;
  endUtc: Date;
  cashierId?: number;
  topLimit?: number;
}

/**
 * Queries revenue per shift including cash difference if recorded.
 */
export async function queryRevenueByShift(
  params: BreakdownQueryParams,
): Promise<ShiftRevenueStat[]> {
  const { startUtc, endUtc, cashierId } = params;

  // 1. Identify relevant shift IDs
  const orderConditions = [
    eq(orders.status, "DA_THANH_TOAN"),
    gte(orders.paidAt, startUtc),
    lte(orders.paidAt, endUtc),
  ];
  if (cashierId !== undefined) {
    orderConditions.push(eq(shifts.cashierId, cashierId));
  }

  const shiftOrders = await db
    .select({
      shiftId: orders.shiftId,
      revenue: sql<string>`COALESCE(SUM(${orders.finalAmount}), 0)`,
      orderCount: sql<string>`COUNT(${orders.id})`,
    })
    .from(orders)
    .innerJoin(shifts, eq(orders.shiftId, shifts.id))
    .where(and(...orderConditions))
    .groupBy(orders.shiftId);

  const orderStatsMap = new Map<number, { revenue: number; orderCount: number }>();
  const shiftIdsFromOrders: number[] = [];
  for (const s of shiftOrders) {
    orderStatsMap.set(s.shiftId, {
      revenue: Number(s.revenue),
      orderCount: Number(s.orderCount),
    });
    shiftIdsFromOrders.push(s.shiftId);
  }

  // 2. Query shifts opened in the range or containing orders in the range
  const shiftConditions = [
    or(
      and(gte(shifts.openedAt, startUtc), lte(shifts.openedAt, endUtc)),
      shiftIdsFromOrders.length > 0 ? inArray(shifts.id, shiftIdsFromOrders) : sql`FALSE`,
    ),
  ];
  if (cashierId !== undefined) {
    shiftConditions.push(eq(shifts.cashierId, cashierId));
  }

  const shiftRows = await db
    .select({
      shift: shifts,
      cashier: users,
    })
    .from(shifts)
    .innerJoin(users, eq(shifts.cashierId, users.id))
    .where(and(...shiftConditions))
    .orderBy(desc(shifts.openedAt));

  return shiftRows.map(({ shift, cashier }) => {
    const stats = orderStatsMap.get(shift.id) ?? { revenue: 0, orderCount: 0 };
    return {
      shiftId: shift.id,
      shiftCode: shift.shiftCode,
      cashierId: cashier.id,
      cashierName: cashier.fullName || cashier.username,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      status: shift.status,
      initialCash: shift.initialCash,
      actualCash: shift.actualCash,
      expectedCash: shift.expectedCash,
      difference: shift.difference,
      revenue: stats.revenue,
      orderCount: stats.orderCount,
    };
  });
}

/**
 * Queries revenue per cashier / staff.
 */
export async function queryRevenueByStaff(
  params: BreakdownQueryParams,
): Promise<StaffRevenueStat[]> {
  const { startUtc, endUtc, cashierId } = params;

  const conditions = [
    eq(orders.status, "DA_THANH_TOAN"),
    gte(orders.paidAt, startUtc),
    lte(orders.paidAt, endUtc),
  ];
  if (cashierId !== undefined) {
    conditions.push(eq(shifts.cashierId, cashierId));
  }

  const rows = await db
    .select({
      staffId: users.id,
      staffName: users.fullName,
      username: users.username,
      role: users.role,
      orderCount: sql<string>`COUNT(${orders.id})`,
      revenue: sql<string>`COALESCE(SUM(${orders.finalAmount}), 0)`,
    })
    .from(orders)
    .innerJoin(shifts, eq(orders.shiftId, shifts.id))
    .innerJoin(users, eq(shifts.cashierId, users.id))
    .where(and(...conditions))
    .groupBy(users.id, users.fullName, users.username, users.role)
    .orderBy(desc(sql`COALESCE(SUM(${orders.finalAmount}), 0)`));

  return rows.map((r) => ({
    staffId: r.staffId,
    staffName: r.staffName || r.username,
    username: r.username,
    role: r.role,
    orderCount: Number(r.orderCount),
    revenue: Number(r.revenue),
  }));
}

/**
 * Queries top selling items (default top 5).
 */
export async function queryTopItems(
  params: BreakdownQueryParams,
): Promise<TopItemStat[]> {
  const { startUtc, endUtc, cashierId, topLimit = 5 } = params;

  const conditions = [
    eq(orders.status, "DA_THANH_TOAN"),
    gte(orders.paidAt, startUtc),
    lte(orders.paidAt, endUtc),
    eq(orderItems.isCancelled, false),
  ];
  if (cashierId !== undefined) {
    conditions.push(eq(shifts.cashierId, cashierId));
  }

  const rows = await db
    .select({
      menuItemId: menuItems.id,
      menuItemName: menuItems.name,
      quantity: sql<string>`COALESCE(SUM(${orderItems.quantity}), 0)`,
      revenue: sql<string>`COALESCE(SUM(${orderItems.quantity} * ${orderItems.unitPrice}), 0)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(shifts, eq(orders.shiftId, shifts.id))
    .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
    .where(and(...conditions))
    .groupBy(menuItems.id, menuItems.name)
    .orderBy(
      desc(sql`COALESCE(SUM(${orderItems.quantity}), 0)`),
      desc(sql`COALESCE(SUM(${orderItems.quantity} * ${orderItems.unitPrice}), 0)`),
    )
    .limit(topLimit);

  return rows.map((r) => ({
    menuItemId: r.menuItemId,
    menuItemName: r.menuItemName,
    quantity: Number(r.quantity),
    revenue: Number(r.revenue),
  }));
}
