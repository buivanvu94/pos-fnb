import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/require-role";
import { processSyncOutbox, requeueFailedSyncItems } from "@/server/sync";

/**
 * POST /api/v1/sync/run (NFR-04, DEC-10)
 * Manually or programmatically triggers sync worker processing.
 * Also requeues any previously failed items back to PENDING.
 * Restricted to QUAN_LY only.
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "QUAN_LY");
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const requeuedCount = await requeueFailedSyncItems();
    const result = await processSyncOutbox();
    return NextResponse.json(
      { ok: true, data: { ...result, requeuedCount } },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("Failed to execute sync worker:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi hệ thống khi thực thi đồng bộ outbox" },
      { status: 500 },
    );
  }
}
