import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { signAuthToken, AUTH_COOKIE_NAME, isCookieSecure } from "@/server/auth/jwt";
import type { Role } from "@/lib/permissions";

/**
 * POST /api/v1/auth/login
 * Handles user authentication with username and password, returns JWT in httpOnly cookie.
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

    const foundUsers = await db
      .select()
      .from(users)
      .where(eq(users.username, String(username).trim()))
      .limit(1);

    const user = foundUsers[0];
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Tên đăng nhập hoặc mật khẩu không chính xác" },
        { status: 401 },
      );
    }

    const isValidPassword = await bcrypt.compare(String(password), user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { ok: false, error: "Tên đăng nhập hoặc mật khẩu không chính xác" },
        { status: 401 },
      );
    }

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
      maxAge: 60 * 60 * 24 * 7, // 7 days
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
