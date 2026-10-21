import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/server/auth/jwt";

/**
 * POST /api/v1/auth/logout
 * Clears authentication cookie.
 */
export async function POST() {
  const response = NextResponse.json({ ok: true, message: "Đăng xuất thành công" });
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}
