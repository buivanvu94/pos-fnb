import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { shifts } from "@/db/schema";
import { requireRole } from "@/server/auth/require-role";
import { ERROR_CATALOG, formatErr04, formatErr05 } from "@/lib/error-catalog";
import { getShiftCashBalance } from "@/server/shifts/cash-balance";
import { countUnpaidTables } from "@/server/shifts/shift-tables-check";

const MAX_MONEY = 2_000_000_000;

/**
 * POST /api/v1/shifts/close (API-08, FR-08, BR-05, BR-06, BR-07, AC-10-1, AC-10-3)
 * Submits cashier cash count at end of shift and transitions status from DANG_MO to CHO_DUYET.
 * Checks for unpaid tables (ERR-04), calculates theoretical cash (BR-05),
 * and mandates explanation if discrepancy != 0 (ERR-05).
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

  const { tienThucDem, giaiTrinh, shiftId } = body as Record<string, unknown>;

  // 1. Validate counted cash
  if (
    typeof tienThucDem !== "number" ||
    !Number.isInteger(tienThucDem) ||
    tienThucDem < 0 ||
    tienThucDem > MAX_MONEY
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Số tiền thực đếm phải là số nguyên không âm và không vượt quá 2.000.000.000 VNĐ",
      },
      { status: 400 },
    );
  }

  try {
    // 2. Find target shift (active shift DANG_MO)
    const shiftCondition =
      shiftId !== undefined && user.role === "QUAN_LY"
        ? eq(shifts.id, Number(shiftId))
        : and(eq(shifts.cashierId, user.userId), eq(shifts.status, "DANG_MO"));

    const [activeShift] = await db
      .select()
      .from(shifts)
      .where(shiftCondition)
      .limit(1);

    if (!activeShift) {
      return NextResponse.json(
        {
          ok: false,
          code: ERROR_CATALOG.ERR_01.id,
          error: "Không tìm thấy ca làm việc đang mở để kết ca",
        },
        { status: 404 },
      );
    }

    if (activeShift.status !== "DANG_MO") {
      return NextResponse.json(
        {
          ok: false,
          error: `Ca làm việc không ở trạng thái Đang mở (trạng thái hiện tại: ${activeShift.status})`,
        },
        { status: 409 },
      );
    }

    // 3. Rule BR-07 & ERR-04: Check if any tables are unpaid (AC-10-1)
    const unpaidTableCount = await countUnpaidTables(activeShift.id, db);
    if (unpaidTableCount > 0) {
      return NextResponse.json(
        {
          ok: false,
          code: ERROR_CATALOG.ERR_04.id,
          error: formatErr04(unpaidTableCount),
        },
        { status: 409 },
      );
    }

    // 4. Rule BR-05: Compute theoretical cash
    const cashBalance = await getShiftCashBalance(
      activeShift.id,
      activeShift.initialCash,
      db,
    );

    const expectedCash = cashBalance.expectedCash;
    const difference = tienThucDem - expectedCash;

    // 5. Rule BR-06 & ERR-05: Mandate explanation if difference != 0 (AC-10-3)
    const cleanExplanation =
      typeof giaiTrinh === "string" ? giaiTrinh.trim() : "";

    if (difference !== 0 && cleanExplanation.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          code: ERROR_CATALOG.ERR_05.id,
          error: formatErr05(difference),
          difference,
          expectedCash,
          actualCash: tienThucDem,
        },
        { status: 422 },
      );
    }

    // 6. Transition status to CHO_DUYET
    const [updatedShift] = await db
      .update(shifts)
      .set({
        actualCash: tienThucDem,
        expectedCash,
        difference,
        explanation: cleanExplanation || null,
        status: "CHO_DUYET",
        updatedAt: new Date(),
      })
      .where(eq(shifts.id, activeShift.id))
      .returning();

    return NextResponse.json({
      ok: true,
      data: updatedShift,
    });
  } catch (error) {
    console.error("Failed to close shift:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi hệ thống khi gửi kiểm đếm kết ca" },
      { status: 500 },
    );
  }
}
