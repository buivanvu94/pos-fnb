export type {
  SyncInvoicePayload,
  SyncShiftPayload,
  SyncCashTxnPayload,
  SyncAuditPayload,
  SyncOutboxType,
} from "@/server/outbox/outbox-types";
export { SYNC_OUTBOX_TYPES } from "@/server/outbox/outbox-types";

export interface ProcessSyncOutboxOptions {
  batchSize?: number;
  maxAttempts?: number;
  initialBackoffSeconds?: number;
  targetUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}

export interface ProcessSyncOutboxResult {
  processed: number;
  sent: number;
  failed: number;
  configured: boolean;
  pending?: number;
}

export interface SyncStatusResult {
  pending: number;
  failed: number;
  lastSyncedAt: string | null;
  configured: boolean;
}
