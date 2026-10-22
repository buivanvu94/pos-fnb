import { eq, and, inArray, sql, desc, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { outbox } from "@/db/schema";
import { SYNC_OUTBOX_TYPES, type SyncStatusResult } from "./sync-types";

/**
 * Retrieves aggregate synchronization status for the logged-in user UI.
 * Returns pending count, failed count, last successful sync timestamp, and configured status.
 */
export async function getSyncStatus(): Promise<SyncStatusResult> {
  const configured = Boolean(
    process.env.SYNC_TARGET_URL && process.env.SYNC_TARGET_URL.trim().length > 0,
  );

  const [pendingRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(outbox)
    .where(
      and(
        eq(outbox.status, "PENDING"),
        inArray(outbox.type, [...SYNC_OUTBOX_TYPES]),
      ),
    );

  const [failedRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(outbox)
    .where(
      and(
        eq(outbox.status, "FAILED"),
        inArray(outbox.type, [...SYNC_OUTBOX_TYPES]),
      ),
    );

  const [lastSentRow] = await db
    .select({ sentAt: outbox.sentAt })
    .from(outbox)
    .where(
      and(
        eq(outbox.status, "SENT"),
        inArray(outbox.type, [...SYNC_OUTBOX_TYPES]),
        isNotNull(outbox.sentAt),
      ),
    )
    .orderBy(desc(outbox.sentAt))
    .limit(1);

  return {
    pending: pendingRow?.count ?? 0,
    failed: failedRow?.count ?? 0,
    lastSyncedAt: lastSentRow?.sentAt ? lastSentRow.sentAt.toISOString() : null,
    configured,
  };
}
