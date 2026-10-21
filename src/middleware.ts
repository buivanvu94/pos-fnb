import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";

/**
 * Next.js Middleware implementing role-based route protection.
 * - Protects /admin/* and /api/v1/admin/* for role 'QUAN_LY' only (returns 403 for other roles).
 * - Protects authenticated routes (/tables, /counter, /payment, /shifts).
 * - Redirects logged-in users away from /login to main screen.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const isAuthRoute = pathname === "/login" || pathname.startsWith("/api/v1/auth/login");

  // Skip static resources and Next internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = token ? await verifyAuthToken(token) : null;

  // 1. Logged in users visiting /login get redirected to /tables
  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/tables", req.url));
  }

  // 2. Allow public auth route
  if (isAuthRoute) {
    return NextResponse.next();
  }

  // 3. Unauthenticated access to protected routes
  if (!user) {
    if (isApi) {
      return NextResponse.json(
        { ok: false, error: "Yêu cầu đăng nhập để truy cập tài nguyên này" },
        { status: 401 },
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Role-based protection: Admin and general reports strictly require 'QUAN_LY'
  const isAdminRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/v1/admin") ||
    pathname.startsWith("/api/v1/reports/revenue");

  if (isAdminRoute && user.role !== "QUAN_LY") {
    if (isApi) {
      return NextResponse.json(
        {
          ok: false,
          error: "Quyền truy cập bị từ chối: Yêu cầu vai trò Quản lý (403 Forbidden)",
        },
        { status: 403 },
      );
    }
    // For page routes, redirect to a 403 forbidden page or tables with error
    return new NextResponse("403 Forbidden: Quyền truy cập bị từ chối", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // 5. Pass authenticated user context via request headers
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-user-id", String(user.userId));
  requestHeaders.set("x-user-role", user.role);
  requestHeaders.set("x-user-name", encodeURIComponent(user.fullName));

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
