import { sql } from "drizzle-orm";
import type { DbOrTx } from "@/server/tables/table-service";

/**
 * Returns current date formatted as YYYY-MM-DD in Vietnam timezone (GMT+7).
 */
export function formatQueueDateVietnam(date: Date = new Date()): string {
  const vnTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const year = vnTime.getUTCFullYear();
  const month = String(vnTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(vnTime.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export interface NextQueueResult {
  queueNumber: number;
  queueDate: string;
}

/**
 * Generates the next sequential takeaway queue number for a given date.
 * Uses PostgreSQL advisory transaction lock to serialize generation safely under high concurrency.
 *
 * MUST be executed inside a database transaction so the advisory lock auto-releases on commit/rollback.
 *
 * @param tx - Active Drizzle transaction
 * @param date - Date of the queue (defaults to current date)
 */
export async function generateNextQueueNumber(
  tx: DbOrTx,
  date: Date = new Date(),
): Promise<NextQueueResult> {
  const queueDate = formatQueueDateVietnam(date);

  // Advisory transaction lock per date to serialize concurrent takeaway checkouts
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`queue_number_${queueDate}`}))`,
  );

  const result = await tx.execute<{ max_queue: number | string }>(
    sql`SELECT COALESCE(MAX(queue_number), 0) AS max_queue
        FROM orders
        WHERE queue_date = ${queueDate}`,
  );

  const maxQueue = Number(result.rows[0]?.max_queue ?? 0);
  const queueNumber = maxQueue + 1;

  return { queueNumber, queueDate };
}
