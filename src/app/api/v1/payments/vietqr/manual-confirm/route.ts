import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOpenShift } from "@/server/shifts/require-open-shift";
import { can } from "@/lib/permissions";
import { isVietQrEnabled } from "@/server/payments/vietqr-config";
import { withManagerApproval } from "@/server/approvals/with-manager-approval";
import { manualConfirmVietQrPayment } from "@/server/payments/vietqr-manual-confirm-service";

const manualConfirmSchema = z.object({
  orderId: z.coerce.number().int().positive({ message: "Mã đơn hàng không hợp lệ" }),
  expectedVersion: z.number().int().min(1).optional(),
  reason: z.string().optional(),
  lyDo: z.string().optional(),
  pin: z.string().optional(),
  maPin: z.string().optional(),
  printPickupTicket: z.boolean().optional(),
});

/**
 * POST /api/v1/payments/vietqr/manual-confirm
 * Emergency fallback for manual VietQR confirmation during network downtime (AC-08-2, DEC-06).
 * Protected by manager PIN approval gate and transactionally audited.
 */
export async function POST(req: NextRequest) {
  if (!isVietQrEnabled()) {
    return NextResponse.json({ ok: false, error: "Tính năng thanh toán VietQR đang bị tắt" }, { status: 403 });
  }

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

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent");
  const effectiveReason = parsed.data.lyDo || parsed.data.reason || "";
  const effectivePin = parsed.data.maPin || parsed.data.pin || "";

  // 1. Manager Approval Gate (Phase 06)
  const approval = await withManagerApproval(
    shiftAuth.user,
    "PAY_AND_PRINT_FINAL_BILL",
    { pinCode: effectivePin, lyDo: effectiveReason },
    clientIp,
    userAgent,
  );

  if (!approval.ok) {
    return NextResponse.json({ ok: false, error: approval.error }, { status: approval.status });
  }

  // 2. Execute manual confirmation
  try {
    const result = await manualConfirmVietQrPayment({
      orderId: parsed.data.orderId,
      expectedVersion: parsed.data.expectedVersion,
      shift: shiftAuth.shift,
      user: shiftAuth.user,
      reason: approval.reason!,
      approverId: approval.approverId!,
      approverName: approval.approverName!,
      printPickupTicket: parsed.data.printPickupTicket,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      data: result.data,
      ...(result.printWarning ? { printWarning: result.printWarning } : {}),
    });
  } catch (error) {
    console.error("Manual VietQR confirm API error:", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ khi xác nhận thanh toán thủ công" }, { status: 500 });
  }
}
