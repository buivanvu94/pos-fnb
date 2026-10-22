/**
 * Outbox queue types and payload interfaces.
 * Supports generic outbox dispatching (Phase 09: Telegram; Phase 11: Cloud Sync).
 */

export interface ShiftCloseTelegramPayload {
  shiftId: number;
  shiftCode: string;
  cashierName: string;
  approverName?: string;
  openedAt: string;
  closedAt: string;
  initialCash: number;
  cashSales: number;
  vietqrSales: number;
  totalSales: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  explanation?: string | null;
  invoiceCount: number;
  cancelledCount?: number;
  cancelledAmount?: number;
  discountAmount?: number;
}

export const SYNC_OUTBOX_TYPES = [
  "SYNC_INVOICE",
  "SYNC_SHIFT",
  "SYNC_CASH_TXN",
  "SYNC_AUDIT",
] as const;

export type SyncOutboxType = (typeof SYNC_OUTBOX_TYPES)[number];

export type OutboxType =
  | "TELEGRAM_SHIFT_CLOSE"
  | SyncOutboxType
  | string;

export interface SyncInvoicePayload {
  orderId: number;
  orderCode: string;
  orderType: string;
  status: string;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  paymentMethod: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  queueNumber: number | null;
  shiftId: number | null;
  version: number;
}

export interface SyncShiftPayload {
  shiftId: number;
  shiftCode: string;
  cashierId: number;
  initialCash: number;
  actualCash: number | null;
  expectedCash: number | null;
  difference: number | null;
  explanation: string | null;
  status: string;
  openedAt: string;
  closedAt: string | null;
  approvedById: number | null;
}

export interface SyncCashTxnPayload {
  id: number;
  shiftId: number;
  entryType: "THU" | "CHI";
  amount: number;
  reason: string;
  performedBy: number;
  createdAt: string;
}

export interface SyncAuditPayload {
  id: number;
  userId: number | null;
  action: string;
  entityType: string;
  entityId: string | null;
  reason: string | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface ProcessOutboxOptions {
  batchSize?: number;
  maxAttempts?: number;
  initialBackoffSeconds?: number;
  apiBaseUrl?: string;
  botToken?: string;
  chatId?: string;
}

export interface ProcessOutboxResult {
  processed: number;
  sent: number;
  failed: number;
}
