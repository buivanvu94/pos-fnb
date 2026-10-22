import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/require-role";
import { approveShift } from "@/server/shifts/approve-shift-service";
import { getClientIp, getUserAgent } from "@/server/approvals/ip-helper";
import { AUTH_COOKIE_NAME } from "@/server/auth/jwt";

/**
 * POST /api/v1/shifts/approve (API-08, FR-09, BR-05, BR-07, AC-10-2)
 * Manager PIN approval gate to officially close a shift.
 * Transition: CHO_DUYET -> DA_DONG.
 * Locks the shift, queues Z-Report for printing, audits the ca_lam_viec_da_dong event,
 * enqueues Telegram outbox message, and deactivates cashier session (logout).
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "QUAN_LY", "THU_NGAN");
  if (!auth.authorized) {
    return auth.response;
  }

  const { user } = auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Dữ liệu JSON không hợp lệ" },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, error: "Dữ liệu JSON phải là một đối tượng hợp lệ" },
      { status: 400 },
    );
  }

  const { shiftId, pin, pinCode, lyDo, reason } = body as Record<string, unknown>;

  if (shiftId !== undefined) {
    if (typeof shiftId !== "number" || !Number.isInteger(shiftId) || shiftId <= 0) {
      return NextResponse.json(
        { ok: false, error: "shiftId phải là số nguyên dương" },
        { status: 400 },
      );
    }
  }

  const effectivePin = typeof pin === "string" ? pin : typeof pinCode === "string" ? pinCode : "";
  const effectiveReason = typeof lyDo === "string" ? lyDo : typeof reason === "string" ? reason : undefined;
  const parsedShiftId = shiftId as number | undefined;

  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);

  try {
    const result = await approveShift({
      shiftId: parsedShiftId,
      pinCode: effectivePin,
      lyDo: effectiveReason,
      user,
      clientIp,
      userAgent,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }

    const response = NextResponse.json({
      ok: true,
      data: result.data,
      message: "Ca làm việc đã được đóng và duyệt thành công",
    });

    // Deactivate cashier session: clear authentication cookie (FR-09)
    response.cookies.delete(AUTH_COOKIE_NAME);

    return response;
  } catch (error) {
    console.error("Failed to approve shift close:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi hệ thống khi phê duyệt đóng ca làm việc" },
      { status: 500 },
    );
  }
}
