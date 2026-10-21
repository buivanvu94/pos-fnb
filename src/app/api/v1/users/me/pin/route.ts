import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireRole } from "@/server/auth/require-role";
import { verifyUserPassword } from "@/server/auth/login-lockout-service";
import { validatePinPolicy } from "@/server/approvals/pin-policy";
import { logAudit } from "@/server/approvals/audit-log-service";
import { getClientIp, getUserAgent } from "@/server/approvals/ip-helper";

const updatePinSchema = z.object({
  currentPassword: z.string({ required_error: "Mật khẩu hiện tại là bắt buộc" }),
  newPin: z
    .string({ required_error: "Mã PIN mới là bắt buộc" })
    .regex(/^\d{4,6}$/, { message: "Mã PIN phải từ 4 đến 6 chữ số" }),
});

/**
 * PUT /api/v1/users/me/pin
 * Manager sets or changes their own PIN after verifying current password.
 * Enforces PIN complexity policy and lockout on wrong password attempts.
 * Records PIN_CHANGED audit log (never plaintext PIN).
 */
export async function PUT(req: NextRequest) {
  const auth = await requireRole(req, "QUAN_LY");
  if (!auth.authorized) {
    return auth.response;
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = updatePinSchema.safeParse(rawBody);

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
  const userAgent = getUserAgent(req);

  // 1. Password verification with shared login failure/lockout tracking
  const passwordResult = await verifyUserPassword(
    auth.user.userId,
    parsed.data.currentPassword,
    clientIp,
    userAgent,
  );

  if (!passwordResult.ok) {
    return NextResponse.json(
      { ok: false, error: passwordResult.error },
      { status: passwordResult.status },
    );
  }

  // 2. PIN complexity and collision policy check
  const policyResult = await validatePinPolicy(
    parsed.data.newPin,
    auth.user.userId,
  );

  if (!policyResult.valid) {
    return NextResponse.json(
      { ok: false, error: policyResult.error || "Mã PIN không hợp lệ" },
      { status: 400 },
    );
  }

  // 3. Update hashed PIN and reset PIN counters
  const newPinHash = await bcrypt.hash(parsed.data.newPin, 10);

  await db
    .update(users)
    .set({
      pinHash: newPinHash,
      pinFailedCount: 0,
      pinLockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, auth.user.userId));

  // 4. Audit log (never store or log PIN)
  await logAudit({
    userId: auth.user.userId,
    username: auth.user.username,
    userAgent,
    action: "PIN_CHANGED",
    entityType: "users",
    entityId: auth.user.userId,
    reason: "Quản lý cập nhật mã PIN phê duyệt",
    metadata: {
      userId: auth.user.userId,
    },
    ipAddress: clientIp,
  });

  return NextResponse.json({
    ok: true,
    message: "Cập nhật mã PIN thành công",
  });
}
