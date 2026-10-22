import { eq, and, or, isNull, lte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { outbox, OutboxItem } from "@/db/schema";
import { sendTelegramNotification } from "./telegram-sender";
import type {
  ProcessOutboxOptions,
  ProcessOutboxResult,
  ShiftCloseTelegramPayload,
} from "./outbox-types";

export type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BACKOFF_SECONDS = 5;

/**
 * Enqueues a generic event into the outbox table.
 * Phase 09 uses type 'TELEGRAM_SHIFT_CLOSE'; Phase 11 will extend for cloud sync.
 */
export async function enqueueOutboxItem(
  type: string,
  payload: unknown,
  idempotencyKey?: string,
  tx: DbOrTx = db,
): Promise<OutboxItem | null> {
  const [item] = await tx
    .insert(outbox)
    .values({
      type,
      idempotencyKey: idempotencyKey || null,
      payload: payload as any,
      status: "PENDING",
      attempts: 0,
    })
    .onConflictDoNothing()
    .returning();

  return item ?? null;
}

/**
 * Processes pending items in the outbox queue.
 * Claims items atomically using SELECT ... FOR UPDATE SKIP LOCKED with a 60-second lease
 * to prevent duplicate sends when multiple workers run concurrently.
 * Implements exponential backoff retry on failure.
 */
export async function processOutbox(
  options?: ProcessOutboxOptions,
): Promise<ProcessOutboxResult> {
  const batchSize = options?.batchSize || DEFAULT_BATCH_SIZE;
  const maxAttempts = options?.maxAttempts || DEFAULT_MAX_ATTEMPTS;
  const backoffSec = options?.initialBackoffSeconds || DEFAULT_BACKOFF_SECONDS;

  const now = new Date();

  // Atomically claim pending items with SKIP LOCKED and lease
  const claimedItems = await db.transaction(async (tx) => {
    const candidateItems = await tx
      .select()
      .from(outbox)
      .where(
        and(
          eq(outbox.status, "PENDING"),
          eq(outbox.type, "TELEGRAM_SHIFT_CLOSE"),
          or(isNull(outbox.nextAttemptAt), lte(outbox.nextAttemptAt, now)),
        ),
      )
      .orderBy(outbox.id)
      .limit(batchSize)
      .for("update", { skipLocked: true });

    if (candidateItems.length === 0) {
      return [];
    }

    const leaseUntil = new Date(Date.now() + 60 * 1000);
    const itemIds = candidateItems.map((i) => i.id);

    await tx
      .update(outbox)
      .set({ nextAttemptAt: leaseUntil })
      .where(inArray(outbox.id, itemIds));

    return candidateItems;
  });

  if (claimedItems.length === 0) {
    return { processed: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const item of claimedItems) {
    let success = false;
    let errorMessage: string | undefined;

    try {
      if (item.type === "TELEGRAM_SHIFT_CLOSE") {
        const payload = item.payload as ShiftCloseTelegramPayload;
        const res = await sendTelegramNotification(payload, {
          apiBaseUrl: options?.apiBaseUrl,
          botToken: options?.botToken,
          chatId: options?.chatId,
        });
        success = res.ok;
        errorMessage = res.error;
      } else {
        errorMessage = `Unsupported outbox item type: ${item.type}`;
      }
    } catch (err: unknown) {
      success = false;
      errorMessage = err instanceof Error ? err.message : String(err);
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
  };
}
