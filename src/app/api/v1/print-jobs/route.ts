import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { printJobs, orders } from "@/db/schema";
import { requireRole } from "@/server/auth/require-role";
import { sweepStaleSendingJobs, STALE_SENDING_THRESHOLD_MS } from "@/server/printing/print-stale-sweeper";

/**
 * GET /api/v1/print-jobs?status=FAILED (AC-03-2, BR-12)
 * Lists print jobs by status.
 * Point 1: Automatically invokes sweepStaleSendingJobs and treats stale SENDING (> 60s) as FAILED.
 * Point 9: SQL-level role filtering before LIMIT, omits payload field.
 * - QUAN_LY sees all jobs.
 * - Other staff only see jobs matching their own orders.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return auth.response;
  }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const limitParam = Math.min(Number(searchParams.get("limit")) || 50, 100);

  try {
    // Point 1: Sweep stale jobs stuck in SENDING on each listing request
    await sweepStaleSendingJobs();

    const conditions = [];
    if (statusParam === "FAILED") {
      const staleThreshold = new Date(Date.now() - STALE_SENDING_THRESHOLD_MS);
      conditions.push(
        or(
          eq(printJobs.status, "FAILED"),
          and(
            eq(printJobs.status, "SENDING"),
            sql`${printJobs.updatedAt} < ${staleThreshold}`,
          ),
        ),
      );
    } else if (statusParam) {
      conditions.push(eq(printJobs.status, statusParam));
    }

    // Role filtering in SQL using true ownership column (orders.createdById)
    if (auth.user.role !== "QUAN_LY") {
      conditions.push(eq(orders.createdById, auth.user.userId));
    }

    const rows = await db
      .select({
        id: printJobs.id,
        orderId: printJobs.orderId,
        jobType: printJobs.jobType,
        targetPrinter: printJobs.targetPrinter,
        status: printJobs.status,
        retryCount: printJobs.retryCount,
        errorMessage: printJobs.errorMessage,
        createdAt: printJobs.createdAt,
        updatedAt: printJobs.updatedAt,
      })
      .from(printJobs)
      .leftJoin(orders, eq(printJobs.orderId, orders.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(printJobs.id))
      .limit(limitParam);

    return NextResponse.json({ ok: true, data: rows });
  } catch (error) {
    console.error("Failed to list print jobs:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi máy chủ khi lấy danh sách lệnh in" },
      { status: 500 },
    );
  }
}
