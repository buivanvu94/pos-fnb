import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth/require-role";
import { applyOrderDiscount } from "@/server/orders/discount-service";
import { getClientIp } from "@/server/approvals/ip-helper";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const discountSchema = z.object({
  amount: z
    .number({ invalid_type_error: "Số tiền giảm giá phải là số nguyên" })
    .int()
    .min(0, { message: "Số tiền giảm giá không được nhỏ hơn 0 VNĐ" })
    .max(2_000_000_000, { message: "Số tiền không được vượt quá 2 tỷ VNĐ" })
    .optional(),
  percent: z
    .number({ invalid_type_error: "Phần trăm giảm giá phải là số" })
    .min(0, { message: "Phần trăm giảm giá không được âm" })
    .max(100, { message: "Phần trăm giảm giá không được vượt quá 100%" })
    .optional(),
  lyDo: z
    .string({ required_error: "Lý do giảm giá là bắt buộc" })
    .transform((val) => val.trim())
    .refine((val) => val.length >= 5, {
      message: "Lý do phải có tối thiểu 5 ký tự",
    })
    .refine((val) => val.length <= 255, {
      message: "Lý do không được vượt quá 255 ký tự",
    }),
  pinCode: z.string().optional(),
  expectedVersion: z.number().int().positive().optional(),
});

/**
 * POST /api/v1/orders/:id/discount
 * Applies an amount or percentage discount with Manager approval (FR-10, BR-03).
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return auth.response;
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
  const parsed = discountSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message || "Dữ liệu yêu cầu không hợp lệ",
      },
      { status: 400 },
    );
  }

  const clientIp = getClientIp(req);
  const result = await applyOrderDiscount(
    orderId,
    parsed.data,
    auth.user,
    clientIp,
  );

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true, data: result.order });
}
