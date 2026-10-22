import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/require-role";
import { validateRevenueDateRange } from "@/server/reports/report-date-helper";
import { getRevenueReport } from "@/server/reports/revenue-report-service";

/**
 * GET /api/v1/reports/revenue
 * Phase 10: Tra cứu báo cáo doanh thu theo ca, phương thức thanh toán và top món (API-09, FR-14).
 *
 * Role Matrix:
 * - QUAN_LY: Xem tất cả doanh thu, có thể lọc cashierId nếu muốn.
 * - THU_NGAN: Chỉ xem doanh thu ca của chính mình (server tự áp đặt auth.user.userId, chặn xem ca người khác).
 * - PHUC_VU: 403 Forbidden.
 *
 * Validation:
 * - Kiểm tra fromDate <= toDate ở server (BR-13 / ERR-11).
 * - Cắt ngày theo GMT+7 (Asia/Ho_Chi_Minh).
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return auth.response;
  }

  // 1. Phục vụ không có quyền truy cập báo cáo doanh thu (403)
  if (auth.user.role === "PHUC_VU") {
    return NextResponse.json(
      {
        ok: false,
        error: "Quyền truy cập bị từ chối: Không có quyền xem báo cáo doanh thu này (403 Forbidden)",
      },
      { status: 403 },
    );
  }

  // 2. Phân quyền và phạm vi dữ liệu
  let effectiveCashierId: number | undefined;

  if (auth.user.role === "THU_NGAN") {
    const paramCashierId = req.nextUrl.searchParams.get("cashierId");
    // Thu ngân chỉ xem ca của chính mình; cố ý xem thu ngân khác bị chặn 403
    if (paramCashierId && Number(paramCashierId) !== auth.user.userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Quyền truy cập bị từ chối: Không có quyền xem báo cáo doanh thu của thu ngân khác (403 Forbidden)",
        },
        { status: 403 },
      );
    }
    effectiveCashierId = auth.user.userId;
  } else if (auth.user.role === "QUAN_LY") {
    // Quản lý xem toàn bộ hoặc lọc theo cashierId nếu truyền
    const paramCashierId = req.nextUrl.searchParams.get("cashierId");
    if (paramCashierId && !isNaN(Number(paramCashierId))) {
      effectiveCashierId = Number(paramCashierId);
    }
  }

  // 3. Xử lý và validate fromDate, toDate (mặc định hôm nay nếu cả hai để trống)
  let fromDate = req.nextUrl.searchParams.get("fromDate");
  let toDate = req.nextUrl.searchParams.get("toDate");

  if (!fromDate && !toDate) {
    const todayGmt7 = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    fromDate = todayGmt7;
    toDate = todayGmt7;
  }

  const validation = validateRevenueDateRange(fromDate, toDate);
  if (!validation.valid) {
    return NextResponse.json(
      {
        ok: false,
        error: validation.error,
        code: validation.code,
      },
      { status: 400 },
    );
  }

  const topLimitParam = req.nextUrl.searchParams.get("limit");
  const topLimit = topLimitParam && !isNaN(Number(topLimitParam))
    ? Math.max(1, Math.min(100, Number(topLimitParam)))
    : 5;

  try {
    const reportData = await getRevenueReport({
      fromDate: fromDate!,
      toDate: toDate!,
      cashierId: effectiveCashierId,
      topLimit,
    });

    return NextResponse.json({
      ok: true,
      data: reportData,
    });
  } catch (error) {
    console.error("Revenue report error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Lỗi máy chủ khi tạo báo cáo doanh thu",
      },
      { status: 500 },
    );
  }
}
