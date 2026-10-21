import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/admin/summary
 * Sample admin endpoint protected by middleware requiring QUAN_LY role.
 */
export async function GET(req: NextRequest) {
  const role = req.headers.get("x-user-role");

  if (role !== "QUAN_LY") {
    return NextResponse.json(
      { ok: false, error: "Quyền truy cập bị từ chối: Yêu cầu vai trò Quản lý" },
      { status: 403 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Admin dashboard access granted",
    data: { system: "POS F&B", status: "ONLINE" },
  });
}
