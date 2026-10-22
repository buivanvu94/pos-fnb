import { db } from "@/db";
import { unmatchedTransactions } from "@/db/schema";
import type { SepayWebhookPayload } from "./vietqr-types";

export interface LogUnmatchedParams {
  payload: SepayWebhookPayload;
  gatewayTxId: string;
  amount: number;
  content: string;
  orderCode?: string | null;
  orderId?: number | null;
  reason: string;
}

/**
 * Durably records unmatched transactions with idempotent ON CONFLICT guard.
 */
export async function logUnmatchedTransaction(params: LogUnmatchedParams): Promise<void> {
  await db
    .insert(unmatchedTransactions)
    .values({
      gateway: (params.payload.gateway || "SEPAY").slice(0, 50),
      gatewayTransactionId: params.gatewayTxId,
      amount: params.amount,
      content: params.content.slice(0, 255),
      transferType: "IN",
      orderCode: params.orderCode || null,
      orderId: params.orderId || null,
      reason: params.reason,
      rawPayload: JSON.stringify(params.payload),
      status: "UNRESOLVED",
    })
    .onConflictDoNothing({ target: unmatchedTransactions.gatewayTransactionId });
}
