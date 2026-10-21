import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken, AUTH_COOKIE_NAME, TokenPayload } from "./jwt";
import type { Role } from "@/lib/permissions";

export type RequireRoleResult =
  | { authorized: true; user: TokenPayload }
  | { authorized: false; response: NextResponse };

/**
 * Shared authentication and authorization helper for API routes.
 * Directly extracts and cryptographically verifies the pos_token cookie
 * instead of trusting incoming request headers.
 *
 * @param req - NextRequest object
 * @param allowedRoles - Optional list of permitted roles. If empty, any authenticated user is allowed.
 * @returns Result object containing either authorized user payload or a 401/403 NextResponse
 */
export async function requireRole(
  req: NextRequest,
  ...allowedRoles: Role[]
): Promise<RequireRoleResult> {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return {
      authorized: false,
      response: NextResponse.json(
        { ok: false, error: "Yêu cầu đăng nhập để truy cập tài nguyên này (401)" },
        { status: 401 },
      ),
    };
  }

  const user = await verifyAuthToken(token);
  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { ok: false, error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn (401)" },
        { status: 401 },
      ),
    };
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Quyền truy cập bị từ chối: Không đủ thẩm quyền (403 Forbidden)",
        },
        { status: 403 },
      ),
    };
  }

  return { authorized: true, user };
}
