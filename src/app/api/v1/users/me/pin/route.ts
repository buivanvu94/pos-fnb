import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireRole } from "@/server/auth/require-role";

const updatePinSchema = z.object({
  currentPassword: z.string({ required_error: "Mật khẩu hiện tại là bắt buộc" }),
  newPin: z
    .string({ required_error: "Mã PIN mới là bắt buộc" })
    .regex(/^\d{4,6}$/, { message: "Mã PIN phải từ 4 đến 6 chữ số" }),
});

/**
 * PUT /api/v1/users/me/pin
 * Manager sets or changes their own PIN after verifying current password.
 * Resets failed count and lockout upon successful PIN change.
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

  const [user] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.id, auth.user.userId))
    .limit(1);

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Tài khoản không tồn tại" },
      { status: 404 },
    );
  }

  const passwordMatches = await bcrypt.compare(
    parsed.data.currentPassword,
    user.passwordHash,
  );

  if (!passwordMatches) {
    return NextResponse.json(
      { ok: false, error: "Mật khẩu hiện tại không chính xác" },
      { status: 400 },
    );
  }

  const newPinHash = await bcrypt.hash(parsed.data.newPin, 10);

  await db
    .update(users)
    .set({
      pinHash: newPinHash,
      pinFailedCount: 0,
      pinLockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return NextResponse.json({
    ok: true,
    message: "Cập nhật mã PIN thành công",
  });
}
