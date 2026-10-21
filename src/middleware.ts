import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";

/**
 * Regex matching static asset file extensions.
 * Do NOT use pathname.includes(".") as that would unintentionally bypass paths like /admin.test
 */
const STATIC_FILE_REGEX = /\.(ico|png|jpg|jpeg|svg|css|js|map|woff|woff2|webp|ttf)$/i;

/**
 * Next.js Middleware implementing role-based route protection.
 * - Strips all client-supplied x-user-* headers to prevent spoofing.
 * - Protects /admin/* and /api/v1/admin/* strictly for role 'QUAN_LY' (403 for other roles).
 * - Leaves /api/v1/reports/revenue to handler-level check via can().
 * - Protects authenticated routes and redirects logged-in users away from /login.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const isAdmin = pathname.startsWith("/admin") || pathname.startsWith("/api/v1/admin");
  const isAuthRoute =
    pathname === "/login" ||
    pathname === "/api/v1/auth/login" ||
    pathname === "/api/v1/auth/logout";

  // 1. Skip static assets and Next.js internal files (NEVER bypass /api/* or /admin/*)
  const isProtectedPrefix = isApi || pathname.startsWith("/admin");
  if (!isProtectedPrefix) {
    if (
      pathname.startsWith("/_next") ||
      pathname === "/favicon.ico" ||
      STATIC_FILE_REGEX.test(pathname)
    ) {
      return NextResponse.next();
    }
  }

  // 2. Strip any spoofed x-user-* headers sent from client
  const requestHeaders = new Headers(req.headers);
  for (const key of Array.from(requestHeaders.keys())) {
    if (key.toLowerCase().startsWith("x-user-")) {
      requestHeaders.delete(key);
    }
  }

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = token ? await verifyAuthToken(token) : null;

  // 3. Logged in users visiting /login get redirected to /tables
  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/tables", req.url));
  }

  // 4. Allow public authentication endpoints
  if (isAuthRoute) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // 5. Unauthenticated access to protected routes
  if (!user) {
    if (isApi) {
      return NextResponse.json(
        { ok: false, error: "Yêu cầu đăng nhập để truy cập tài nguyên này (401)" },
        { status: 401 },
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 6. Role-based protection: Admin management routes strictly require 'QUAN_LY'
  // Note: /api/v1/reports/revenue is handled at route handler level using can()
  if (isAdmin && user.role !== "QUAN_LY") {
    if (isApi) {
      return NextResponse.json(
        {
          ok: false,
          error: "Quyền truy cập bị từ chối: Yêu cầu vai trò Quản lý (403 Forbidden)",
        },
        { status: 403 },
      );
    }
    return new NextResponse("403 Forbidden: Quyền truy cập bị từ chối", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // 7. Inject securely verified user context headers for downstream server components
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
