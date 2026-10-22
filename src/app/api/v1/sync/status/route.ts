import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/require-role";
import { getSyncStatus } from "@/server/sync";

/**
 * GET /api/v1/sync/status (NFR-04, DEC-10)
 * Returns current outbox sync status { pending, failed, lastSyncedAt, configured }
 * Available to all authenticated roles (QUAN_LY, THU_NGAN, PHUC_VU).
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, "QUAN_LY", "THU_NGAN", "PHUC_VU");
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const status = await getSyncStatus();
    return NextResponse.json({ ok: true, data: status }, { status: 200 });
  } catch (error: unknown) {
    console.error("Failed to fetch sync status:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi hệ thống khi lấy trạng thái đồng bộ" },
      { status: 500 },
    );
  }
}
