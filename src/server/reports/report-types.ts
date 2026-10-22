/**
 * Type definitions for Revenue Report (US-11, FR-14, SCR-09).
 */

export interface RevenueReportFilter {
  fromDate: string;
  toDate: string;
  cashierId?: number;
  topLimit?: number;
}

export interface RevenueSummary {
  totalRevenue: number;
  orderCount: number;
  averageOrderValue: number;
  totalDiscount: number;
}

export interface PaymentMethodStat {
  method: "TIEN_MAT" | "VIETQR";
  name: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface ShiftRevenueStat {
  shiftId: number;
  shiftCode: string;
  cashierId: number;
  cashierName: string;
  openedAt: Date;
  closedAt: Date | null;
  status: string;
  initialCash: number;
  actualCash: number | null;
  expectedCash: number | null;
  difference: number | null;
  revenue: number;
  orderCount: number;
}

export interface StaffRevenueStat {
  staffId: number;
  staffName: string;
  username: string;
  role: string;
  orderCount: number;
  revenue: number;
}

export interface TopItemStat {
  menuItemId: number;
  menuItemName: string;
  quantity: number;
  revenue: number;
}

export interface RevenueReportData {
  filter: {
    fromDate: string;
    toDate: string;
  };
  summary: RevenueSummary;
  paymentMethods: PaymentMethodStat[];
  byShift: ShiftRevenueStat[];
  byStaff: StaffRevenueStat[];
  topItems: TopItemStat[];
}
