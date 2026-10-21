import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/require-role";

/**
 * GET /api/v1/admin/summary
 * Sample admin endpoint protected by requireRole directly verifying the auth cookie.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, "QUAN_LY");
  if (!auth.authorized) {
    return auth.response;
  }

  return NextResponse.json({
    ok: true,
    message: "Admin dashboard access granted",
    data: { system: "POS F&B", status: "ONLINE", admin: auth.user.username },
  });
}
