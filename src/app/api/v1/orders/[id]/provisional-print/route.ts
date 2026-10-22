import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth/require-role";
import { can } from "@/lib/permissions";
import { printProvisionalBill } from "@/server/payments/provisional-print-service";

const provisionalPrintSchema = z.object({
  expectedVersion: z
    .number({
      required_error: "expectedVersion là bắt buộc",
      invalid_type_error: "expectedVersion phải là số nguyên",
    })
    .int()
    .min(1, { message: "expectedVersion phải lớn hơn 0" }),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/orders/:id/provisional-print
 * Prints provisional bill and marks dine-in table as CHO_THANH_TOAN (yellow).
 * Accessible by QUAN_LY, THU_NGAN, and PHUC_VU (FR-13, UC-06, AC-07-1).
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requireRole(req);
  if (!auth.authorized) return auth.response;

  if (!can(auth.user.role, "PRINT_PROVISIONAL_BILL")) {
    return NextResponse.json(
      { ok: false, error: "Quyền truy cập bị từ chối: Không có quyền in phiếu tạm tính" },
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

  const rawBody = await req.json().catch(() => null);
  const parsed = provisionalPrintSchema.safeParse(rawBody);
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
    const result = await printProvisionalBill(
      orderId,
      parsed.data.expectedVersion,
      auth.user,
    );

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
    console.error("Provisional print error:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi máy chủ khi in tạm tính" },
      { status: 500 },
    );
  }
}
