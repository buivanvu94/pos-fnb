import { eq, and, or, isNull, lte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { outbox, OutboxItem } from "@/db/schema";
import {
  SYNC_OUTBOX_TYPES,
  type ProcessSyncOutboxOptions,
  type ProcessSyncOutboxResult,
} from "./sync-types";
import {
  isTransientSyncError,
  calculateBackoffSeconds,
  requeueFailedSyncItems,
} from "./sync-retry-policy";
import { dispatchWithConcurrency } from "./concurrency-pool";

export { requeueFailedSyncItems };

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_BACKOFF_SECONDS = 5;
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_CONCURRENCY = 5;

/**
 * Worker process that dispatches pending cloud sync events to SYNC_TARGET_URL.
 * Supports bounded exponential backoff, atomic FOR UPDATE SKIP LOCKED claim,
 * parallel batch dispatching with concurrency limit, and graceful fallback.
 */
export async function processSyncOutbox(
  options?: ProcessSyncOutboxOptions,
): Promise<ProcessSyncOutboxResult> {
  const targetUrl = options?.targetUrl ?? process.env.SYNC_TARGET_URL;
  const apiKey = options?.apiKey ?? process.env.SYNC_API_KEY;
  const batchSize = options?.batchSize || DEFAULT_BATCH_SIZE;
  const backoffSec = options?.initialBackoffSeconds || DEFAULT_BACKOFF_SECONDS;
  const timeoutMs = options?.timeoutMs || DEFAULT_TIMEOUT_MS;
  const concurrency = DEFAULT_CONCURRENCY;

  // If SYNC_TARGET_URL is not configured: keep events PENDING and count them
  if (!targetUrl || targetUrl.trim().length === 0) {
    const [pendingRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(outbox)
      .where(
        and(
          eq(outbox.status, "PENDING"),
          inArray(outbox.type, [...SYNC_OUTBOX_TYPES]),
        ),
      );

    return {
      processed: 0,
      sent: 0,
      failed: 0,
      configured: false,
      pending: pendingRow?.count ?? 0,
    };
  }

  const now = new Date();
  const maxBatchDurationMs = Math.ceil(batchSize / concurrency) * timeoutMs;
  const leaseMs = Math.max(60000, maxBatchDurationMs + 60000);

  // Atomically claim sync items with SKIP LOCKED and guaranteed lease
  const claimedItems = await db.transaction(async (tx) => {
    const candidates = await tx
      .select()
      .from(outbox)
      .where(
        and(
          eq(outbox.status, "PENDING"),
          inArray(outbox.type, [...SYNC_OUTBOX_TYPES]),
          or(isNull(outbox.nextAttemptAt), lte(outbox.nextAttemptAt, now)),
        ),
      )
      .orderBy(outbox.id)
      .limit(batchSize)
      .for("update", { skipLocked: true });

    if (candidates.length === 0) {
      return [];
    }

    const leaseUntil = new Date(Date.now() + leaseMs);
    const itemIds = candidates.map((i) => i.id);

    await tx
      .update(outbox)
      .set({ nextAttemptAt: leaseUntil })
      .where(inArray(outbox.id, itemIds));

    return candidates;
  });

  if (claimedItems.length === 0) {
    return { processed: 0, sent: 0, failed: 0, configured: true };
  }

  let sent = 0;
  let failed = 0;

  async function dispatchItem(item: OutboxItem): Promise<boolean> {
    let success = false;
    let httpStatus: number | undefined;
    let fetchError: unknown | undefined;
    let errorMessage: string | undefined;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Idempotency-Key": item.idempotencyKey || String(item.id),
      };

      if (apiKey && apiKey.trim().length > 0) {
        headers["x-api-key"] = apiKey;
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const res = await fetch(targetUrl!, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: item.id,
          type: item.type,
          idempotencyKey: item.idempotencyKey,
          payload: item.payload,
          createdAt: item.createdAt,
        }),
        signal: controller.signal,
      });

      httpStatus = res.status;
      if (res.ok) {
        success = true;
      } else {
        success = false;
        errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      }
    } catch (err: unknown) {
      success = false;
      fetchError = err;
      errorMessage = err instanceof Error ? err.message : String(err);
    } finally {
      clearTimeout(timer);
    }

    if (success) {
      await db
        .update(outbox)
        .set({
          status: "SENT",
          sentAt: new Date(),
          lastError: null,
        })
        .where(eq(outbox.id, item.id));
      return true;
    }

    const transient = isTransientSyncError(httpStatus, fetchError);
    const isPermanent = !transient;
    const delaySec = calculateBackoffSeconds(item.attempts, backoffSec);
    const nextAttempt = isPermanent ? null : new Date(Date.now() + delaySec * 1000);

    await db
      .update(outbox)
      .set({
        attempts: sql<number>`${outbox.attempts} + 1`,
        status: isPermanent ? "FAILED" : "PENDING",
        nextAttemptAt: nextAttempt,
        lastError: errorMessage?.slice(0, 500) || "Sync dispatch error",
      })
      .where(eq(outbox.id, item.id));

    return false;
  }

  // Process items in parallel with concurrency limit using Promise.allSettled
  const results = await dispatchWithConcurrency(claimedItems, concurrency, dispatchItem);
  for (const res of results) {
    if (res.status === "fulfilled" && res.value === true) {
      sent++;
    } else {
      failed++;
    }
  }

  return {
    processed: claimedItems.length,
    sent,
    failed,
    configured: true,
  };
}
