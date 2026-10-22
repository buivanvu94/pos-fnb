import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth/require-role";
import { voidPaidBill } from "@/server/payments/void-bill-service";

const voidBillSchema = z.object({
  expectedVersion: z
    .number({
      required_error: "expectedVersion là bắt buộc",
      invalid_type_error: "expectedVersion phải là số nguyên",
    })
    .int()
    .min(1, { message: "expectedVersion phải lớn hơn 0" }),
  lyDo: z
    .string({ required_error: "Lý do hủy hóa đơn là bắt buộc" })
    .min(5, { message: "Lý do phải có tối thiểu 5 ký tự" }),
  pinCode: z.string().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/orders/:id/void
 * Voids a previously paid bill with manager approval (DEC-12, BR-08).
 * Accessible by QUAN_LY (no PIN) and THU_NGAN (requires Manager PIN).
 * PHUC_VU is rejected with 403.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requireRole(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json(
      { ok: false, error: "Mã đơn hàng không hợp lệ" },
      { status: 400 },
    );
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = voidBillSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message || "Dữ liệu yêu cầu không hợp lệ",
      },
      { status: 400 },
    );
  }

  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
  const userAgent = req.headers.get("user-agent");

  try {
    const result = await voidPaidBill({
      orderId,
      expectedVersion: parsed.data.expectedVersion,
      lyDo: parsed.data.lyDo,
      pinCode: parsed.data.pinCode,
      user: auth.user,
      clientIp,
      userAgent,
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
    });
  } catch (error) {
    console.error("Void bill error:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi máy chủ khi hủy hóa đơn" },
      { status: 500 },
    );
  }
}
