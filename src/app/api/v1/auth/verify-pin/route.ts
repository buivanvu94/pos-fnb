import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth/require-role";
import { verifyManagerPin } from "@/server/approvals/pin-service";
import { getClientIp } from "@/server/approvals/ip-helper";

const verifyPinSchema = z.object({
  pinCode: z
    .string({ required_error: "Mã PIN là bắt buộc" })
    .regex(/^\d{4,6}$/, { message: "Mã PIN phải từ 4 đến 6 chữ số" }),
  lyDo: z
    .string({ required_error: "Lý do là bắt buộc" })
    .transform((val) => val.trim())
    .refine((val) => val.length >= 5, {
      message: "Lý do phải có tối thiểu 5 ký tự",
    })
    .refine((val) => val.length <= 255, {
      message: "Lý do không được vượt quá 255 ký tự",
    }),
  loaiThaoTac: z.string().optional(),
  action: z.string().optional(),
});

/**
 * POST /api/v1/auth/verify-pin (API-04)
 * Verifies Manager PIN for sensitive actions (FR-10, BR-04, ERR-02, ERR-03).
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return auth.response;
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = verifyPinSchema.safeParse(rawBody);

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
  const result = await verifyManagerPin(
    auth.user.userId,
    parsed.data.pinCode,
    clientIp,
  );

  if (!result.valid) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      approverId: result.approver.id,
      approverName: result.approver.fullName,
    },
  });
}
