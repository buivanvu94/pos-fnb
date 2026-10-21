import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth/require-role";
import { isPinRequired, setPinRequired } from "@/server/approvals/approval-settings-service";

const updateApprovalSettingSchema = z.object({
  pinRequired: z.boolean({
    required_error: "pinRequired (boolean) là bắt buộc",
    invalid_type_error: "pinRequired phải là kiểu boolean",
  }),
});

/**
 * GET /api/v1/settings/approval
 * Retrieves the current Manager PIN approval requirement setting.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return auth.response;
  }

  const pinRequired = await isPinRequired();
  return NextResponse.json({
    ok: true,
    data: { pinRequired },
  });
}

/**
 * PUT /api/v1/settings/approval
 * Sets whether Manager PIN approval is required (restricted to QUAN_LY).
 * WARNING: Disabling PIN requirement is strictly intended for testing environments only.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireRole(req, "QUAN_LY");
  if (!auth.authorized) {
    return auth.response;
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = updateApprovalSettingSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message || "Dữ liệu yêu cầu không hợp lệ",
      },
      { status: 400 },
    );
  }

  await setPinRequired(parsed.data.pinRequired);

  return NextResponse.json({
    ok: true,
    data: { pinRequired: parsed.data.pinRequired },
    message: "Cập nhật cấu hình phê duyệt thành công",
  });
}
