import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

/**
 * Formats a Date object into YYYYMMDD string in Vietnam timezone (GMT+7).
 */
export function formatYmdVietnam(date: Date = new Date()): string {
  // Vietnam timezone is UTC+7
  const vnTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const year = vnTime.getUTCFullYear();
  const month = String(vnTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(vnTime.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * Generates next shift code in format CA-YYYYMMDD-nn inside a transaction.
 * Uses PostgreSQL advisory transaction lock and integer MAX to avoid string order bug at 99 -> 100.
 *
 * // Must be executed inside a PostgreSQL transaction (tx) so pg_advisory_xact_lock is scoped and auto-releases on commit/rollback
 *
 * @param tx - Drizzle transaction or database instance
 * @param date - Date of the shift (defaults to current date)
 * @returns Generated shift code, e.g. "CA-20261021-01"
 */
export async function generateShiftCode(
  tx: NodePgDatabase<typeof schema>,
  date: Date = new Date(),
): Promise<string> {
  const ymd = formatYmdVietnam(date);
  const prefix = `CA-${ymd}-`;

  // Acquire advisory xact lock for the date string to serialize generation
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`shift_code_${ymd}`}))`,
  );

  // Cast suffix to integer and take MAX to prevent string sorting bugs (e.g. '99' > '100')
  const result = await tx.execute<{ max_seq: number | string }>(
    sql`SELECT COALESCE(MAX(CAST(SPLIT_PART(shift_code, '-', 3) AS integer)), 0) AS max_seq
        FROM shifts
        WHERE shift_code LIKE ${prefix + "%"}`,
  );

  const maxSeq = Number(result.rows[0]?.max_seq ?? 0);
  const nextSequence = maxSeq + 1;
  const paddedSequence = String(nextSequence).padStart(2, "0");
  return `${prefix}${paddedSequence}`;
}

/**
 * Generates next order code in format HD-YYYYMMDD-nnnn inside a transaction.
 * Uses PostgreSQL advisory transaction lock and integer MAX to avoid string order bug at 9999 -> 10000.
 *
 * // Must be executed inside a PostgreSQL transaction (tx) so pg_advisory_xact_lock is scoped and auto-releases on commit/rollback
 *
 * @param tx - Drizzle transaction or database instance
 * @param date - Date of the order (defaults to current date)
 * @returns Generated order code, e.g. "HD-20261021-0001"
 */
export async function generateOrderCode(
  tx: NodePgDatabase<typeof schema>,
  date: Date = new Date(),
): Promise<string> {
  const ymd = formatYmdVietnam(date);
  const prefix = `HD-${ymd}-`;

  // Acquire advisory xact lock for the date string to serialize generation
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`order_code_${ymd}`}))`,
  );

  // Cast suffix to integer and take MAX to prevent string sorting bugs
  const result = await tx.execute<{ max_seq: number | string }>(
    sql`SELECT COALESCE(MAX(CAST(SPLIT_PART(order_code, '-', 3) AS integer)), 0) AS max_seq
        FROM orders
        WHERE order_code LIKE ${prefix + "%"}`,
  );

  const maxSeq = Number(result.rows[0]?.max_seq ?? 0);
  const nextSequence = maxSeq + 1;
  const paddedSequence = String(nextSequence).padStart(4, "0");
  return `${prefix}${paddedSequence}`;
}
