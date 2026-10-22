import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { outbox } from "@/db/schema";
import { SYNC_OUTBOX_TYPES } from "./sync-types";

export const MAX_BACKOFF_SECONDS = 300;
export const DEFAULT_BACKOFF_SECONDS = 5;

/**
 * Classifies whether a dispatch failure is transient (retryable indefinitely)
 * or permanent (marked FAILED).
 * - Network failure, timeout, connection refusal, 5xx, 408, 429 are transient.
 * - Other 4xx responses indicate permanent rejection by the target receiver.
 */
export function isTransientSyncError(
  httpStatus?: number,
  error?: unknown,
): boolean {
  if (error !== undefined && error !== null) {
    return true;
  }
  if (httpStatus === undefined || httpStatus === null) {
    return true;
  }
  if (httpStatus === 408 || httpStatus === 429 || httpStatus >= 500) {
    return true;
  }
  if (httpStatus >= 400 && httpStatus < 500) {
    return false;
  }
  return false;
}

/**
 * Calculates exponential backoff with a hard 300-second cap:
 * min(initialBackoff * 2^attempts, 300) seconds.
 */
export function calculateBackoffSeconds(
  attempts: number,
  initialBackoffSeconds = DEFAULT_BACKOFF_SECONDS,
  maxCapSeconds = MAX_BACKOFF_SECONDS,
): number {
  return Math.min(
    initialBackoffSeconds * Math.pow(2, attempts),
    maxCapSeconds,
  );
}

/**
 * Requeues all SYNC_* items currently in FAILED status back to PENDING.
 * Resets attempts to 0, nextAttemptAt to now, and clears lastError.
 * Returns the count of requeued items.
 */
export async function requeueFailedSyncItems(): Promise<number> {
  const result = await db
    .update(outbox)
    .set({
      status: "PENDING",
      attempts: 0,
      nextAttemptAt: new Date(),
      lastError: null,
    })
    .where(
      and(
        eq(outbox.status, "FAILED"),
        inArray(outbox.type, [...SYNC_OUTBOX_TYPES]),
      ),
    )
    .returning({ id: outbox.id });

  return result.length;
}
