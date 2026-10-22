import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOpenShift } from "@/server/shifts/require-open-shift";
import { can } from "@/lib/permissions";
import { manualConfirmVietQrPayment } from "@/server/payments/vietqr-manual-confirm-service";

const manualConfirmSchema = z.object({
  orderId: z.coerce.number().int().positive({ message: "Mã đơn hàng không hợp lệ" }),
  expectedVersion: z.number().int().min(1).optional(),
  reason: z.string().min(5, { message: "Lý do xác nhận thủ công tối thiểu 5 ký tự" }).optional(),
  printPickupTicket: z.boolean().optional(),
});

/**
 * POST /api/v1/payments/vietqr/manual-confirm
 * Emergency fallback for manual VietQR confirmation during network downtime (AC-08-2, DEC-06).
 * Audited in audit_logs.
 */
export async function POST(req: NextRequest) {
  const shiftAuth = await requireOpenShift(req);
  if (!shiftAuth.authorized) {
    return shiftAuth.response;
  }

  if (!can(shiftAuth.user.role, "PAY_AND_PRINT_FINAL_BILL")) {
    return NextResponse.json(
      { ok: false, error: "Quyền truy cập bị từ chối: Không có quyền thực hiện thanh toán" },
      { status: 403 },
    );
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = manualConfirmSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message || "Dữ liệu yêu cầu không hợp lệ" },
      { status: 400 },
    );
  }

  try {
    const result = await manualConfirmVietQrPayment({
      orderId: parsed.data.orderId,
      expectedVersion: parsed.data.expectedVersion,
      shift: shiftAuth.shift,
      user: shiftAuth.user,
      reason: parsed.data.reason,
      printPickupTicket: parsed.data.printPickupTicket,
    });

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
    console.error("Manual VietQR confirm API error:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi máy chủ khi xác nhận thanh toán thủ công" },
      { status: 500 },
    );
  }
}
