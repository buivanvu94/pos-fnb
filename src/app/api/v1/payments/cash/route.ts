import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOpenShift } from "@/server/shifts/require-open-shift";
import { can } from "@/lib/permissions";
import { payOrderCash } from "@/server/payments/cash-payment-service";

const cashPaymentSchema = z.object({
  orderId: z.coerce.number().int().positive({ message: "Mã đơn hàng không hợp lệ" }),
  tienKhachDua: z.coerce
    .number({ invalid_type_error: "Tiền khách đưa phải là số" })
    .int({ message: "Tiền khách đưa phải là số nguyên" })
    .min(0, { message: "Tiền khách đưa không được âm" }),
  expectedVersion: z
    .number({
      required_error: "expectedVersion là bắt buộc",
      invalid_type_error: "expectedVersion phải là số nguyên",
    })
    .int()
    .min(1, { message: "expectedVersion phải lớn hơn 0" }),
  printPickupTicket: z.boolean().optional(),
});

/**
 * POST /api/v1/payments/cash
 * Processes cash payment for an order and triggers final receipt printing (FR-11, FR-13, API-06).
 * Restricted to QUAN_LY and THU_NGAN with an active open shift (ERR-01, AC-05-1, AC-07-2).
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
  const parsed = cashPaymentSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message || "Dữ liệu yêu cầu không hợp lệ",
      },
      { status: 400 },
    );
  }

  try {
    const result = await payOrderCash({
      orderId: parsed.data.orderId,
      tienKhachDua: parsed.data.tienKhachDua,
      expectedVersion: parsed.data.expectedVersion,
      user: shiftAuth.user,
      shift: shiftAuth.shift,
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
    console.error("Cash payment API error:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi máy chủ khi xử lý thanh toán tiền mặt" },
      { status: 500 },
    );
  }
}
