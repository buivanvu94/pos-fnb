import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/require-role";
import { can } from "@/lib/permissions";
import { getTablesWithActiveOrders } from "@/server/tables/table-service";

/**
 * GET /api/v1/tables
 * Returns active table list with corresponding area details, real-time status (TRONG, DANG_DUNG, CHO_THANH_TOAN),
 * active order id, total money, and item count. Accessible to all authenticated staff (FR-01, SRS 2.5).
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return auth.response;
  }

  if (!can(auth.user.role, "VIEW_TABLES")) {
    return NextResponse.json(
      { ok: false, error: "Quyền truy cập bị từ chối: Không có quyền xem sơ đồ bàn" },
      { status: 403 },
    );
  }

  try {
    const tableList = await getTablesWithActiveOrders();
    return NextResponse.json({
      ok: true,
      data: tableList,
    });
  } catch (error) {
    console.error("Failed to fetch tables:", error);
    return NextResponse.json(
      { ok: false, error: "Không thể tải danh sách bàn từ cơ sở dữ liệu" },
      { status: 500 },
    );
  }
}
