import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/require-role";
import { getVietQrPaymentStatus } from "@/server/payments/vietqr-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/payments/:id
 * Polling endpoint for checking VietQR payment status (FR-12, AC-08-2, AC-08-3).
 * Transitions payment to EXPIRED when remainingSeconds reaches 0.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  const paymentId = Number(id);

  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    return NextResponse.json(
      { ok: false, error: "Mã thanh toán không hợp lệ" },
      { status: 400 },
    );
  }

  try {
    const result = await getVietQrPaymentStatus(paymentId);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({
      ok: true,
      data: result.data,
    });
  } catch (error) {
    console.error("Payment status polling API error:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi máy chủ khi tra cứu trạng thái thanh toán" },
      { status: 500 },
    );
  }
}
