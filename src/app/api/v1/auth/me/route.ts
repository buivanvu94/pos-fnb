import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/server/auth/jwt";

/**
 * GET /api/v1/auth/me
 * Returns current authenticated user information from session cookie.
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  }

  const payload = await verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ ok: false, error: "Phiên đăng nhập không hợp lệ" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: payload.userId,
      username: payload.username,
      fullName: payload.fullName,
      role: payload.role,
    },
  });
}
