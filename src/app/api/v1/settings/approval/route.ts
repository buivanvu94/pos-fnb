import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth/require-role";
import {
  isPinRequired,
  setPinRequired,
  APPROVAL_PIN_REQUIRED_KEY,
} from "@/server/approvals/approval-settings-service";
import { logAudit } from "@/server/approvals/audit-log-service";
import { getClientIp, getUserAgent } from "@/server/approvals/ip-helper";

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
 * In production: disabling PIN requirement is forbidden (403).
 * Always logs SETTINGS_CHANGED audit entry with previous and new values.
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

  if (process.env.NODE_ENV === "production" && parsed.data.pinRequired === false) {
    return NextResponse.json(
      {
        ok: false,
        error: "Không thể tắt yêu cầu mã PIN trong môi trường production",
      },
      { status: 403 },
    );
  }

  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const previousValue = await isPinRequired();

  await setPinRequired(parsed.data.pinRequired);

  await logAudit({
    userId: auth.user.userId,
    username: auth.user.username,
    userAgent,
    action: "SETTINGS_CHANGED",
    entityType: "settings",
    entityId: APPROVAL_PIN_REQUIRED_KEY,
    reason: `Thay đổi cấu hình ${APPROVAL_PIN_REQUIRED_KEY} từ ${previousValue} thành ${parsed.data.pinRequired}`,
    metadata: {
      key: APPROVAL_PIN_REQUIRED_KEY,
      previousValue,
      newValue: parsed.data.pinRequired,
      changedById: auth.user.userId,
      changedByUsername: auth.user.username,
    },
    ipAddress: clientIp,
  });

  return NextResponse.json({
    ok: true,
    data: { pinRequired: parsed.data.pinRequired },
    message: "Cập nhật cấu hình phê duyệt thành công",
  });
}
