/**
 * Strongly-typed payload definitions for all POS thermal print operations.
 * Covers: KOT (Kitchen/Bar), KOT_CANCEL, PROVISIONAL, FINAL_RECEIPT, CASH_RECEIPT, Z_REPORT.
 */

export interface KotItemPayload {
  name: string;
  quantity: number;
  notes?: string | null;
  toppings?: string[] | null;
  unitPrice?: number;
}

export interface KotPayload {
  kind: "KOT";
  orderId: number;
  orderCode: string;
  tableName: string;
  areaName?: string;
  senderName: string;
  sentAt: string;
  targetStation: "KITCHEN" | "BAR";
  items: KotItemPayload[];
  notes?: string | null;
}

export interface KotCancelPayload {
  kind: "KOT_CANCEL";
  orderId: number;
  orderCode: string;
  tableName: string;
  cancelledByName: string;
  approverName?: string;
  cancelledAt: string;
  reason: string;
  targetStation: "KITCHEN" | "BAR";
  items: KotItemPayload[];
}

export interface ReceiptItemPayload {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string | null;
  toppings?: string[] | null;
}

export interface ProvisionalPayload {
  kind: "PROVISIONAL";
  orderId: number;
  orderCode: string;
  tableName: string;
  cashierName: string;
  printedAt: string;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  items: ReceiptItemPayload[];
  subtotal: number;
  discount?: number;
  total: number;
}

export interface FinalReceiptPayload {
  kind: "FINAL_RECEIPT";
  orderId: number;
  orderCode: string;
  tableName?: string;
  orderType?: "TAI_BAN" | "MANG_VE";
  cashierName: string;
  printedAt: string;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  storeLogoPath?: string;
  items: ReceiptItemPayload[];
  subtotal: number;
  discount?: number;
  total: number;
  paymentMethod: "TIEN_MAT" | "VIETQR" | string;
  customerPaid?: number;
  changeDue?: number;
  wifiSsid?: string;
  wifiPassword?: string;
  wifiSecurity?: string;
  kickDrawer?: boolean;
}

/**
 * Compatible with Phase 03 payload written by /api/v1/shifts/cash-transaction
 */
export interface CashReceiptPayload {
  kind?: "CASH_RECEIPT";
  entryId: number;
  shiftId: number;
  shiftCode: string;
  entryType: "THU" | "CHI";
  amount: number;
  reason: string;
  performedBy: number;
  performedByName: string;
  timestamp: string;
  storeName?: string;
  kickDrawer?: boolean;
}

export interface ZReportPayload {
  kind: "Z_REPORT";
  shiftId: number;
  shiftCode: string;
  cashierName: string;
  managerName?: string;
  openedAt: string;
  closedAt: string;
  initialCash: number;
  cashRevenue: number;
  bankRevenue: number;
  totalRevenue: number;
  totalCashIn: number;
  totalCashOut: number;
  expectedCash: number;
  actualCash: number;
  discrepancy: number;
  explanation?: string | null;
  storeName?: string;
  invoiceCount?: number;
  orderCount?: number;
  cancelledCount?: number;
  cancelledAmount?: number;
  discountAmount?: number;
}

export interface PickupTicketPayload {
  kind: "PICKUP_TICKET";
  orderId: number;
  orderCode: string;
  queueNumber: number;
  queueDate: string;
  cashierName: string;
  printedAt: string;
  storeName?: string;
  items: ReceiptItemPayload[];
  total: number;
}

export type PrintPayload =
  | KotPayload
  | KotCancelPayload
  | ProvisionalPayload
  | FinalReceiptPayload
  | CashReceiptPayload
  | ZReportPayload
  | PickupTicketPayload;

