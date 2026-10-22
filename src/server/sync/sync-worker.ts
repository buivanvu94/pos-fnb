import { eq, and, or, isNull, lte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { outbox, OutboxItem } from "@/db/schema";
import {
  SYNC_OUTBOX_TYPES,
  type ProcessSyncOutboxOptions,
  type ProcessSyncOutboxResult,
} from "./sync-types";

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BACKOFF_SECONDS = 5;
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Worker process that dispatches pending cloud sync events to SYNC_TARGET_URL.
 * Supports bounded exponential backoff, atomic FOR UPDATE SKIP LOCKED claim,
 * and graceful fallback when unconfigured.
 */
export async function processSyncOutbox(
  options?: ProcessSyncOutboxOptions,
): Promise<ProcessSyncOutboxResult> {
  const targetUrl = options?.targetUrl ?? process.env.SYNC_TARGET_URL;
  const apiKey = options?.apiKey ?? process.env.SYNC_API_KEY;
  const batchSize = options?.batchSize || DEFAULT_BATCH_SIZE;
  const maxAttempts = options?.maxAttempts || DEFAULT_MAX_ATTEMPTS;
  const backoffSec = options?.initialBackoffSeconds || DEFAULT_BACKOFF_SECONDS;
  const timeoutMs = options?.timeoutMs || DEFAULT_TIMEOUT_MS;

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

  // Atomically claim sync items with SKIP LOCKED and 60-second lease
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

    const leaseUntil = new Date(Date.now() + 60 * 1000);
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

  for (const item of claimedItems) {
    let success = false;
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

      const res = await fetch(targetUrl, {
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

      if (res.ok) {
        success = true;
      } else {
        success = false;
        errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      }
    } catch (err: unknown) {
      success = false;
      errorMessage = err instanceof Error ? err.message : String(err);
    } finally {
      clearTimeout(timer);
    }

    const currentAttempts = item.attempts + 1;

    if (success) {
      await db
        .update(outbox)
        .set({
          status: "SENT",
          sentAt: new Date(),
          lastError: null,
        })
        .where(eq(outbox.id, item.id));
      sent++;
    } else {
      const isExhausted = currentAttempts >= maxAttempts;
      const nextDelaySeconds = backoffSec * Math.pow(2, currentAttempts - 1);
      const nextAttempt = new Date(Date.now() + nextDelaySeconds * 1000);

      await db
        .update(outbox)
        .set({
          attempts: currentAttempts,
          status: isExhausted ? "FAILED" : "PENDING",
          nextAttemptAt: isExhausted ? null : nextAttempt,
          lastError: errorMessage?.slice(0, 500) || "Unknown error",
        })
        .where(eq(outbox.id, item.id));
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
