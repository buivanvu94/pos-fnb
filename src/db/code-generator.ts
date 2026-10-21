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
 * Uses PostgreSQL advisory transaction lock to prevent race conditions.
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

  const result = await tx.execute<{ shift_code: string }>(
    sql`SELECT shift_code FROM shifts 
        WHERE shift_code LIKE ${prefix + "%"} 
        ORDER BY shift_code DESC LIMIT 1`,
  );

  let nextSequence = 1;
  if (result.rows.length > 0 && result.rows[0]?.shift_code) {
    const latestCode = result.rows[0].shift_code;
    const parts = latestCode.split("-");
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSequence = lastNum + 1;
    }
  }

  const paddedSequence = String(nextSequence).padStart(2, "0");
  return `${prefix}${paddedSequence}`;
}

/**
 * Generates next order code in format HD-YYYYMMDD-nnnn inside a transaction.
 * Uses PostgreSQL advisory transaction lock to prevent race conditions.
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

  const result = await tx.execute<{ order_code: string }>(
    sql`SELECT order_code FROM orders 
        WHERE order_code LIKE ${prefix + "%"} 
        ORDER BY order_code DESC LIMIT 1`,
  );

  let nextSequence = 1;
  if (result.rows.length > 0 && result.rows[0]?.order_code) {
    const latestCode = result.rows[0].order_code;
    const parts = latestCode.split("-");
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSequence = lastNum + 1;
    }
  }

  const paddedSequence = String(nextSequence).padStart(4, "0");
  return `${prefix}${paddedSequence}`;
}
