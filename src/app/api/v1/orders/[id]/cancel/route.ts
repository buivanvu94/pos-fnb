import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth/require-role";
import { cancelOrderWithApproval } from "@/server/orders/cancel-order-service";
import { getClientIp } from "@/server/approvals/ip-helper";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const cancelOrderSchema = z.object({
  lyDo: z
    .string({ required_error: "Lý do hủy đơn là bắt buộc" })
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
 * POST /api/v1/orders/:id/cancel
 * Cancels an active order with kitchen-printed items via Manager approval (FR-10, BR-03).
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
  const parsed = cancelOrderSchema.safeParse(rawBody);

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
  const result = await cancelOrderWithApproval(
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

  return NextResponse.json({ ok: true, message: result.message });
}
