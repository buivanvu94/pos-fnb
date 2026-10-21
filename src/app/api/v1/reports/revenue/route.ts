import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/require-role";
import { can } from "@/lib/permissions";

/**
 * GET /api/v1/reports/revenue
 * Revenue report endpoint verifying role permissions via can():
 * - QUAN_LY: Can view general revenue report across all shifts.
 * - THU_NGAN: Can ONLY view revenue within their own work shift (requires isSelf context).
 * - PHUC_VU: 403 Forbidden.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return auth.response;
  }

  const { searchParams } = req.nextUrl;
  const targetCashierId = searchParams.get("cashierId");
  const isSelf = targetCashierId
    ? Number(targetCashierId) === auth.user.userId
    : auth.user.role === "THU_NGAN";

  // 1. Quản lý has full permission to view general revenue report (501 in Phase 01)
  if (can(auth.user.role, "VIEW_GENERAL_REVENUE_REPORT")) {
    return NextResponse.json(
      {
        ok: false,
        scope: "ALL_REVENUE",
        error: "Chức năng báo cáo doanh thu sẽ được triển khai trong Phase 10",
        code: "NOT_IMPLEMENTED",
      },
      { status: 501 },
    );
  }

  // 2. Thu ngân can only view revenue for their own shift (501 in Phase 01)
  if (can(auth.user.role, "VIEW_OWN_SHIFT_REVENUE", { isSelf })) {
    return NextResponse.json(
      {
        ok: false,
        scope: "OWN_SHIFT_REVENUE",
        error: "Chức năng báo cáo doanh thu sẽ được triển khai trong Phase 10",
        code: "NOT_IMPLEMENTED",
      },
      { status: 501 },
    );
  }

  // 3. Phục vụ or Thu ngân attempting to view general / other cashier's revenue gets 403
  return NextResponse.json(
    {
      ok: false,
      error: "Quyền truy cập bị từ chối: Không có quyền xem báo cáo doanh thu này (403 Forbidden)",
    },
    { status: 403 },
  );
}
