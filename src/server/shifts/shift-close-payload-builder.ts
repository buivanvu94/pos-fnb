import type { shifts } from "@/db/schema";
import type { ShiftFinancialReport } from "./shift-financial-report";
import type { ZReportPayload } from "@/server/printing/print-payload-types";
import type { ShiftCloseTelegramPayload } from "@/server/outbox/outbox-types";

export interface BuildClosePayloadsInput {
  shift: typeof shifts.$inferSelect;
  financial: ShiftFinancialReport;
  cashierName: string;
  approverName: string;
  now: Date;
  actualCash: number;
  difference: number;
}

export interface BuiltClosePayloads {
  zReportPayload: ZReportPayload;
  telegramPayload: ShiftCloseTelegramPayload;
}

/**
 * Builds structured payloads for physical printing (Z-Report)
 * and external notification (Telegram outbox).
 */
export function buildCloseShiftPayloads(input: BuildClosePayloadsInput): BuiltClosePayloads {
  const { shift, financial, cashierName, approverName, now, actualCash, difference } = input;

  const zReportPayload: ZReportPayload = {
    kind: "Z_REPORT",
    shiftId: shift.id,
    shiftCode: shift.shiftCode,
    cashierName,
    managerName: approverName,
    openedAt: shift.openedAt.toISOString(),
    closedAt: now.toISOString(),
    initialCash: shift.initialCash,
    cashRevenue: financial.cashSales,
    bankRevenue: financial.vietqrSales,
    totalRevenue: financial.totalSales,
    totalCashIn: financial.cashIn,
    totalCashOut: financial.cashOut,
    expectedCash: shift.expectedCash ?? financial.expectedCash,
    actualCash,
    discrepancy: difference,
    explanation: shift.explanation,
    invoiceCount: financial.invoiceCount,
    orderCount: financial.invoiceCount,
    cancelledCount: financial.cancelledCount,
    cancelledAmount: financial.cancelledAmount,
    discountAmount: financial.discountAmount,
    storeName: "POS Cafe & Restaurant",
  };

  const telegramPayload: ShiftCloseTelegramPayload = {
    shiftId: shift.id,
    shiftCode: shift.shiftCode,
    cashierName,
    approverName,
    openedAt: shift.openedAt.toISOString(),
    closedAt: now.toISOString(),
    initialCash: shift.initialCash,
    cashSales: financial.cashSales,
    vietqrSales: financial.vietqrSales,
    totalSales: financial.totalSales,
    cashIn: financial.cashIn,
    cashOut: financial.cashOut,
    expectedCash: shift.expectedCash ?? financial.expectedCash,
    actualCash,
    difference,
    explanation: shift.explanation,
    invoiceCount: financial.invoiceCount,
    cancelledCount: financial.cancelledCount,
    cancelledAmount: financial.cancelledAmount,
    discountAmount: financial.discountAmount,
  };

  return { zReportPayload, telegramPayload };
}
