import { NextRequest, NextResponse } from "next/server";
import { signAuthToken, AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE, isCookieSecure } from "@/server/auth/jwt";
import { authenticateUser } from "@/server/auth/login-lockout-service";
import { getClientIp, getUserAgent } from "@/server/approvals/ip-helper";
import type { Role } from "@/lib/permissions";

/**
 * POST /api/v1/auth/login
 * Handles user authentication with username and password.
 * Protected against brute-force attacks via atomic lockout after 5 consecutive failures.
 * Sets 12-hour session JWT cookie.
 */
export async function POST(req: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Dữ liệu yêu cầu không hợp lệ (lỗi parse JSON)" },
      { status: 400 },
    );
  }

  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return NextResponse.json(
      { ok: false, error: "Dữ liệu yêu cầu không hợp lệ (body phải là object)" },
      { status: 400 },
    );
  }

  const body = rawBody as Record<string, unknown>;

  try {
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: "Vui lòng nhập tên đăng nhập và mật khẩu" },
        { status: 400 },
      );
    }

    const clientIp = getClientIp(req);
    const userAgent = getUserAgent(req);

    const authResult = await authenticateUser(
      String(username),
      String(password),
      clientIp,
      userAgent,
    );

    if (!authResult.ok) {
      return NextResponse.json(
        { ok: false, error: authResult.error },
        { status: authResult.status },
      );
    }

    const user = authResult.user;

    const token = await signAuthToken({
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role as Role,
    });

    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_COOKIE_MAX_AGE,
    });

    return response;
  } catch (error) {
    console.error("Login route error:", error);
    return NextResponse.json(
      { ok: false, error: "Đã có lỗi xảy ra trong quá trình đăng nhập" },
      { status: 500 },
    );
  }
}
