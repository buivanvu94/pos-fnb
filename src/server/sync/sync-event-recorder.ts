import { enqueueOutboxItem, type DbOrTx } from "@/server/outbox/outbox-service";
import type {
  SyncInvoicePayload,
  SyncShiftPayload,
  SyncCashTxnPayload,
  SyncAuditPayload,
} from "./sync-types";

/**
 * Records a SYNC_INVOICE event into outbox inside the caller's transaction.
 * Idempotency key is derived from orderId and entity version.
 */
export async function recordSyncInvoiceEvent(
  payload: SyncInvoicePayload,
  tx?: DbOrTx,
) {
  const idempotencyKey = `sync_invoice_${payload.orderId}_v${payload.version}`;
  return enqueueOutboxItem("SYNC_INVOICE", payload, idempotencyKey, tx);
}

/**
 * Records a SYNC_SHIFT event into outbox inside the caller's transaction.
 * Idempotency key is derived from shiftId and shift status.
 */
export async function recordSyncShiftEvent(
  payload: SyncShiftPayload,
  tx?: DbOrTx,
) {
  const idempotencyKey = `sync_shift_${payload.shiftId}_${payload.status}`;
  return enqueueOutboxItem("SYNC_SHIFT", payload, idempotencyKey, tx);
}

/**
 * Records a SYNC_CASH_TXN event into outbox inside the caller's transaction.
 * Idempotency key is derived from cash entry id.
 */
export async function recordSyncCashTxnEvent(
  payload: SyncCashTxnPayload,
  tx?: DbOrTx,
) {
  const idempotencyKey = `sync_cash_txn_${payload.id}`;
  return enqueueOutboxItem("SYNC_CASH_TXN", payload, idempotencyKey, tx);
}

/**
 * Records a SYNC_AUDIT event into outbox inside the caller's transaction.
 * Idempotency key is derived from audit log id.
 */
export async function recordSyncAuditEvent(
  payload: SyncAuditPayload,
  tx?: DbOrTx,
) {
  const idempotencyKey = `sync_audit_${payload.id}`;
  return enqueueOutboxItem("SYNC_AUDIT", payload, idempotencyKey, tx);
}
