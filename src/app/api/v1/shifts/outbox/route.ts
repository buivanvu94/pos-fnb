import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/require-role";
import { processOutbox } from "@/server/outbox/outbox-service";

/**
 * POST /api/v1/shifts/outbox
 * Internal route to manually trigger processing of pending outbox messages.
 * Permitted for QUAN_LY.
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "QUAN_LY");
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const result = await processOutbox();
    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    console.error("Failed to process outbox:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi hệ thống khi xử lý hàng đợi outbox" },
      { status: 500 },
    );
  }
}
