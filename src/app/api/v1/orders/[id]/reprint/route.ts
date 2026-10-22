import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/require-role";
import { can } from "@/lib/permissions";
import { reprintFinalReceipt } from "@/server/payments/reprint-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/orders/:id/reprint
 * Reprints final receipt for a paid order (QUAN_LY and THU_NGAN only).
 * Does not kick cash drawer (reprint only).
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requireRole(req);
  if (!auth.authorized) return auth.response;

  if (!can(auth.user.role, "PAY_AND_PRINT_FINAL_BILL")) {
    return NextResponse.json(
      { ok: false, error: "Quyền truy cập bị từ chối: Không có quyền in lại hóa đơn" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json(
      { ok: false, error: "Mã đơn hàng không hợp lệ" },
      { status: 400 },
    );
  }

  try {
    const result = await reprintFinalReceipt(orderId, auth.user);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({
      ok: true,
      data: result.data,
      ...(result.printWarning ? { printWarning: result.printWarning } : {}),
    });
  } catch (error) {
    console.error("Reprint receipt error:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi máy chủ khi in lại hóa đơn" },
      { status: 500 },
    );
  }
}
