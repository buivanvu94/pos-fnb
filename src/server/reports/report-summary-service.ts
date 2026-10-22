import { sql, eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { orders, shifts } from "@/db/schema";
import type { RevenueSummary, PaymentMethodStat } from "./report-types";

interface SummaryQueryParams {
  startUtc: Date;
  endUtc: Date;
  cashierId?: number;
}

/**
 * Calculates net revenue, order count, average order value, and total discount.
 * Strictly excludes cancelled / voided orders (status != 'DA_THANH_TOAN').
 */
export async function queryRevenueSummary(params: SummaryQueryParams): Promise<RevenueSummary> {
  const { startUtc, endUtc, cashierId } = params;

  const conditions = [
    eq(orders.status, "DA_THANH_TOAN"),
    gte(orders.paidAt, startUtc),
    lte(orders.paidAt, endUtc),
  ];

  if (cashierId !== undefined) {
    conditions.push(eq(shifts.cashierId, cashierId));
  }

  const [row] = await db
    .select({
      totalRevenue: sql<string>`COALESCE(SUM(${orders.finalAmount}), 0)`,
      totalDiscount: sql<string>`COALESCE(SUM(${orders.discountAmount}), 0)`,
      orderCount: sql<string>`COUNT(${orders.id})`,
    })
    .from(orders)
    .innerJoin(shifts, eq(orders.shiftId, shifts.id))
    .where(and(...conditions));

  const totalRevenue = Number(row?.totalRevenue ?? 0);
  const totalDiscount = Number(row?.totalDiscount ?? 0);
  const orderCount = Number(row?.orderCount ?? 0);
  const averageOrderValue = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;

  return {
    totalRevenue,
    orderCount,
    averageOrderValue,
    totalDiscount,
  };
}

/**
 * Calculates breakdown by payment method (Tiền mặt vs VietQR).
 */
export async function queryPaymentMethods(
  params: SummaryQueryParams,
  totalRevenue: number,
): Promise<PaymentMethodStat[]> {
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
      method: orders.paymentMethod,
      amount: sql<string>`COALESCE(SUM(${orders.finalAmount}), 0)`,
      count: sql<string>`COUNT(${orders.id})`,
    })
    .from(orders)
    .innerJoin(shifts, eq(orders.shiftId, shifts.id))
    .where(and(...conditions))
    .groupBy(orders.paymentMethod);

  const statsMap: Record<string, { amount: number; count: number }> = {
    TIEN_MAT: { amount: 0, count: 0 },
    VIETQR: { amount: 0, count: 0 },
  };

  for (const r of rows) {
    if (r.method && statsMap[r.method]) {
      statsMap[r.method] = {
        amount: Number(r.amount),
        count: Number(r.count),
      };
    }
  }

  const result: PaymentMethodStat[] = [
    {
      method: "TIEN_MAT",
      name: "Tiền mặt",
      amount: statsMap.TIEN_MAT.amount,
      count: statsMap.TIEN_MAT.count,
      percentage:
        totalRevenue > 0
          ? Number(((statsMap.TIEN_MAT.amount / totalRevenue) * 100).toFixed(1))
          : 0,
    },
    {
      method: "VIETQR",
      name: "VietQR",
      amount: statsMap.VIETQR.amount,
      count: statsMap.VIETQR.count,
      percentage:
        totalRevenue > 0
          ? Number(((statsMap.VIETQR.amount / totalRevenue) * 100).toFixed(1))
          : 0,
    },
  ];

  return result;
}
