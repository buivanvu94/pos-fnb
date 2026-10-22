import { sql, eq, and, ne } from "drizzle-orm";
import { db } from "@/db";
import { payments, orders, cashEntries } from "@/db/schema";
import { getShiftCashBalance } from "./cash-balance";

export type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface ShiftFinancialReport {
  initialCash: number;
  cashSales: number;
  vietqrSales: number;
  totalSales: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number;
  invoiceCount: number;
  cancelledCount: number;
  cancelledAmount: number;
  discountAmount: number;
}

/**
 * Computes complete financial figures for a shift to produce Z-Report and Telegram summary.
 * Strictly adheres to Rule BR-05 and excludes cancelled orders or voided payments.
 */
export async function getShiftFinancialReport(
  shiftId: number,
  initialCash: number,
  client: DbOrTx = db,
): Promise<ShiftFinancialReport> {
  // 1. Cash balance breakdown (cashSales, cashIn, cashOut, expectedCash)
  const cashSummary = await getShiftCashBalance(shiftId, initialCash, client as any);

  // 2. VietQR sales from SUCCESS payments joined with orders, excluding cancelled orders
  const vietqrResult = await client
    .select({
      total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
    })
    .from(payments)
    .innerJoin(orders, eq(payments.orderId, orders.id))
    .where(
      and(
        eq(payments.shiftId, shiftId),
        eq(payments.paymentMethod, "VIETQR"),
        eq(payments.status, "SUCCESS"),
        ne(orders.status, "DA_HUY"),
      ),
    );

  const vietqrSales = Number(vietqrResult[0]?.total ?? 0);
  const totalSales = cashSummary.cashSales + vietqrSales;

  // 3. Paid orders / invoices count and discounts
  const ordersSummary = await client
    .select({
      count: sql<string>`COUNT(${orders.id})`,
      totalDiscount: sql<string>`COALESCE(SUM(${orders.discountAmount}), 0)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.shiftId, shiftId),
        eq(orders.status, "DA_THANH_TOAN"),
      ),
    );

  const invoiceCount = Number(ordersSummary[0]?.count ?? 0);
  const discountAmount = Number(ordersSummary[0]?.totalDiscount ?? 0);

  // 4. Cancelled orders in this shift
  const cancelledSummary = await client
    .select({
      count: sql<string>`COUNT(${orders.id})`,
      totalAmount: sql<string>`COALESCE(SUM(${orders.finalAmount}), 0)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.shiftId, shiftId),
        eq(orders.status, "DA_HUY"),
      ),
    );

  const cancelledCount = Number(cancelledSummary[0]?.count ?? 0);
  const cancelledAmount = Number(cancelledSummary[0]?.totalAmount ?? 0);

  return {
    initialCash,
    cashSales: cashSummary.cashSales,
    vietqrSales,
    totalSales,
    cashIn: cashSummary.cashIn,
    cashOut: cashSummary.cashOut,
    expectedCash: cashSummary.expectedCash,
    invoiceCount,
    cancelledCount,
    cancelledAmount,
    discountAmount,
  };
}
