import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { printJobs } from "@/db/schema";

export const STALE_SENDING_THRESHOLD_MS = 60000;

/**
 * Checks whether a print job in SENDING state has exceeded the 60-second crash threshold.
 */
export function isStaleSendingJob(job: { status: string; updatedAt: Date | string }): boolean {
  if (job.status !== "SENDING") return false;
  const updatedTime = new Date(job.updatedAt).getTime();
  return Date.now() - updatedTime > STALE_SENDING_THRESHOLD_MS;
}

/**
 * Sweeps print jobs that have been stuck in SENDING for longer than 60 seconds
 * (e.g. after a process crash or unhandled timeout) and marks them FAILED.
 * Point 1: Lightweight recovery invoked on first dispatch after startup and on GET print-jobs.
 */
export async function sweepStaleSendingJobs(): Promise<number> {
  try {
    const staleThreshold = new Date(Date.now() - STALE_SENDING_THRESHOLD_MS);
    const updated = await db
      .update(printJobs)
      .set({
        status: "FAILED",
        errorMessage: "Lệnh in bị gián đoạn hoặc quá thời gian xử lý (quá 60 giây)",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(printJobs.status, "SENDING"),
          sql`${printJobs.updatedAt} < ${staleThreshold}`,
        ),
      )
      .returning({ id: printJobs.id });

    return updated.length;
  } catch (err) {
    console.error("Error sweeping stale sending print jobs:", err);
    return 0;
  }
}
