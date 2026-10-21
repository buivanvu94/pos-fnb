import { sql, eq, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { payments, cashEntries } from "@/db/schema";

export interface CashBalanceSummary {
  initialCash: number;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number;
}

/**
 * Pure function computing theoretical cash according to Rule BR-05:
 * Tiền mặt lý thuyết = Tiền đầu ca + Tiền mặt thu bán hàng + Thu vặt - Chi vặt
 *
 * @param initialCash - Opening cash balance (TienDauCa)
 * @param cashSales - Real cash sales from orders (TienMatThuBanHang)
 * @param cashIn - Urgent cash additions (ThuVat)
 * @param cashOut - Urgent cash withdrawals (ChiVat)
 * @returns Theoretical cash balance (VND)
 */
export function computeTheoreticalCash(
  initialCash: number,
  cashSales: number,
  cashIn: number,
  cashOut: number,
): number {
  return initialCash + cashSales + cashIn - cashOut;
}

/**
 * Queries real database records (payments and cash_entries) to compute
 * the current theoretical cash balance for a shift.
 *
 * @param shiftId - ID of the target shift
 * @param initialCash - Opening cash of the shift
 * @param client - Optional database or transaction client (defaults to global db)
 * @returns Detailed breakdown and total expected cash
 */
export async function getShiftCashBalance(
  shiftId: number,
  initialCash: number,
  client: NodePgDatabase<typeof schema> | typeof db = db,
): Promise<CashBalanceSummary> {
  // 1. Calculate cash sales from real payments table
  const salesResult = await client
    .select({
      total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.shiftId, shiftId),
        eq(payments.paymentMethod, "TIEN_MAT"),
        eq(payments.status, "SUCCESS"),
      ),
    );

  const cashSales = Number(salesResult[0]?.total ?? 0);

  // 2. Calculate cash-in (THU) entries
  const cashInResult = await client
    .select({
      total: sql<string>`COALESCE(SUM(${cashEntries.amount}), 0)`,
    })
    .from(cashEntries)
    .where(
      and(
        eq(cashEntries.shiftId, shiftId),
        eq(cashEntries.entryType, "THU"),
      ),
    );

  const cashIn = Number(cashInResult[0]?.total ?? 0);

  // 3. Calculate cash-out (CHI) entries
  const cashOutResult = await client
    .select({
      total: sql<string>`COALESCE(SUM(${cashEntries.amount}), 0)`,
    })
    .from(cashEntries)
    .where(
      and(
        eq(cashEntries.shiftId, shiftId),
        eq(cashEntries.entryType, "CHI"),
      ),
    );

  const cashOut = Number(cashOutResult[0]?.total ?? 0);

  const expectedCash = computeTheoreticalCash(initialCash, cashSales, cashIn, cashOut);

  return {
    initialCash,
    cashSales,
    cashIn,
    cashOut,
    expectedCash,
  };
}
