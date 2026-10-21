import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@/db";
import { printJobs, orders } from "@/db/schema";
import { requireRole } from "@/server/auth/require-role";

/**
 * GET /api/v1/print-jobs?status=FAILED (AC-03-2, BR-12)
 * Lists print jobs by status.
 * - QUAN_LY sees all jobs.
 * - THU_NGAN & PHUC_VU see jobs matching their own operations.
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
    const conditions = [];
    if (statusParam) {
      conditions.push(eq(printJobs.status, statusParam));
    }

    const rows = await db
      .select({
        id: printJobs.id,
        orderId: printJobs.orderId,
        jobType: printJobs.jobType,
        targetPrinter: printJobs.targetPrinter,
        payload: printJobs.payload,
        status: printJobs.status,
        retryCount: printJobs.retryCount,
        errorMessage: printJobs.errorMessage,
        createdAt: printJobs.createdAt,
        updatedAt: printJobs.updatedAt,
        orderCreatorId: orders.createdById,
      })
      .from(printJobs)
      .leftJoin(orders, eq(printJobs.orderId, orders.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(printJobs.id))
      .limit(limitParam);

    // If QUAN_LY, return all matching jobs
    if (auth.user.role === "QUAN_LY") {
      return NextResponse.json({ ok: true, data: rows });
    }

    // Otherwise, filter to jobs belonging to current staff
    const filtered = rows.filter((r) => {
      if (r.orderCreatorId === auth.user.userId) return true;
      try {
        const p = JSON.parse(r.payload);
        if (p.performedBy === auth.user.userId) return true;
        if (p.senderName === auth.user.fullName) return true;
      } catch {
        // Ignore JSON parse errors
      }
      return false;
    });

    return NextResponse.json({ ok: true, data: filtered });
  } catch (error) {
    console.error("Failed to list print jobs:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi máy chủ khi lấy danh sách lệnh in" },
      { status: 500 },
    );
  }
}
