import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { printJobs } from "@/db/schema";
import { requireRole } from "@/server/auth/require-role";
import { retryPrintJob } from "@/server/printing/print-service";
import { isStaleSendingJob } from "@/server/printing/print-stale-sweeper";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/print-jobs/:id/retry (AC-03-2, BR-12)
 * Retries a previously failed or crashed thermal print job.
 * Point 1: Accepts FAILED status, or SENDING status with updatedAt > 60s.
 * Fresh SENDING returns 409 Conflict with in-progress message.
 * PHUC_VU can only retry kitchen/bar tickets; QUAN_LY and THU_NGAN can retry all.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId) || jobId <= 0) {
    return NextResponse.json(
      { ok: false, error: "Mã lệnh in không hợp lệ" },
      { status: 400 },
    );
  }

  const [job] = await db
    .select()
    .from(printJobs)
    .where(eq(printJobs.id, jobId))
    .limit(1);

  if (!job) {
    return NextResponse.json(
      { ok: false, error: "Không tìm thấy lệnh in" },
      { status: 404 },
    );
  }

  // Point 1: Allow FAILED or stale SENDING (> 60s)
  if (job.status !== "FAILED") {
    if (job.status === "SENDING") {
      if (!isStaleSendingJob(job)) {
        return NextResponse.json(
          { ok: false, error: "Lệnh in đang được xử lý, vui lòng chờ" },
          { status: 409 },
        );
      }
    } else {
      return NextResponse.json(
        {
          ok: false,
          error: `Không thể thử in lại lệnh in ở trạng thái ${job.status} (chỉ cho phép FAILED hoặc SENDING quá 60s)`,
        },
        { status: 409 },
      );
    }
  }

  // Point 2: PHUC_VU can only retry kitchen/bar tickets
  if (auth.user.role === "PHUC_VU") {
    const isKitchenOrBar =
      job.targetPrinter === "KITCHEN" ||
      job.targetPrinter === "BAR" ||
      job.jobType === "KOT_KITCHEN" ||
      job.jobType === "KOT_BAR";

    if (!isKitchenOrBar) {
      return NextResponse.json(
        { ok: false, error: "Nhân viên phục vụ chỉ được phép thử in lại phiếu bếp hoặc phiếu pha chế" },
        { status: 403 },
      );
    }
  }

  try {
    const result = await retryPrintJob(jobId);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          warningMessage: result.warningMessage,
          data: result,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    console.error("Failed to retry print job:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi máy chủ khi thử in lại" },
      { status: 500 },
    );
  }
}
