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

export type OutboxType = "TELEGRAM_SHIFT_CLOSE" | "CLOUD_SYNC_EVENT" | string;

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
