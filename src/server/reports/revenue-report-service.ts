import { getGmt7DateBoundaries } from "./report-date-helper";
import { queryRevenueSummary, queryPaymentMethods } from "./report-summary-service";
import {
  queryRevenueByShift,
  queryRevenueByStaff,
  queryTopItems,
} from "./report-breakdown-service";
import type { RevenueReportFilter, RevenueReportData } from "./report-types";

export { type RevenueReportFilter, type RevenueReportData };

/**
 * Orchestrates full revenue report generation for Phase 10 (US-11, FR-14).
 * Enforces GMT+7 date boundaries, aggregates metrics, breakdowns by payment method,
 * work shift, cashier/staff, and top 5 items.
 */
export async function getRevenueReport(
  filter: RevenueReportFilter,
): Promise<RevenueReportData> {
  const { fromDate, toDate, cashierId, topLimit = 5 } = filter;
  const { startUtc, endUtc } = getGmt7DateBoundaries(fromDate, toDate);

  const queryParams = { startUtc, endUtc, cashierId, topLimit };

  // 1. Query summary statistics
  const summary = await queryRevenueSummary(queryParams);

  // 2. Query payment methods breakdown (Cash vs VietQR)
  const paymentMethods = await queryPaymentMethods(queryParams, summary.totalRevenue);

  // 3. Query breakdowns in parallel
  const [byShift, byStaff, topItems] = await Promise.all([
    queryRevenueByShift(queryParams),
    queryRevenueByStaff(queryParams),
    queryTopItems(queryParams),
  ]);

  return {
    filter: {
      fromDate,
      toDate,
    },
    summary,
    paymentMethods,
    byShift,
    byStaff,
    topItems,
  };
}
