import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { shifts } from "@/db/schema";
import { requireRole } from "@/server/auth/require-role";
import { ERROR_CATALOG, formatErr04, formatErr05 } from "@/lib/error-catalog";
import { getShiftCashBalance } from "@/server/shifts/cash-balance";
import { countUnpaidTables } from "@/server/shifts/shift-tables-check";
import { recordSyncShiftEvent } from "@/server/sync";

const MAX_MONEY = 2_000_000_000;

/**
 * POST /api/v1/shifts/close (API-08, FR-08, BR-05, BR-06, BR-07, AC-10-1, AC-10-3)
 * Submits cashier cash count at end of shift and transitions status from DANG_MO to CHO_DUYET.
 * Executes atomically in a transaction: selects shift FOR UPDATE, checks unpaid tables (ERR-04),
 * calculates theoretical cash (BR-05), mandates explanation if discrepancy != 0 (ERR-05),
 * and updates shift to CHO_DUYET.
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
    return NextResponse.json({ ok: false, error: "Dữ liệu JSON không hợp lệ" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Dữ liệu JSON phải là một đối tượng hợp lệ" }, { status: 400 });
  }

  const { tienThucDem, giaiTrinh, shiftId } = body as Record<string, unknown>;

  // 1. Validate shiftId
  if (shiftId !== undefined) {
    if (typeof shiftId !== "number" || !Number.isInteger(shiftId) || shiftId <= 0) {
      return NextResponse.json({ ok: false, error: "shiftId phải là số nguyên dương" }, { status: 400 });
    }
  }

  // 2. Validate counted cash
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

  // 3. Validate explanation length
  if (giaiTrinh !== undefined && typeof giaiTrinh === "string" && giaiTrinh.length > 255) {
    return NextResponse.json(
      { ok: false, error: "Lý do giải trình không được vượt quá 255 ký tự" },
      { status: 400 },
    );
  }

  const cleanExplanation = typeof giaiTrinh === "string" ? giaiTrinh.trim() : "";

  try {
    const shiftCondition =
      shiftId !== undefined && user.role === "QUAN_LY"
        ? eq(shifts.id, shiftId as number)
        : and(eq(shifts.cashierId, user.userId), eq(shifts.status, "DANG_MO"));

    const result = await db.transaction(async (tx) => {
      // a. Lock shift row with FOR UPDATE
      const [activeShift] = await tx
        .select()
        .from(shifts)
        .where(shiftCondition)
        .limit(1)
        .for("update");

      if (!activeShift) {
        return {
          ok: false,
          status: 404,
          code: ERROR_CATALOG.ERR_01.id,
          error: "Không tìm thấy ca làm việc đang mở để kết ca",
        };
      }

      if (activeShift.status !== "DANG_MO") {
        return {
          ok: false,
          status: 409,
          error: `Ca làm việc không ở trạng thái Đang mở (trạng thái hiện tại: ${activeShift.status})`,
        };
      }

      // b. Rule BR-07 & ERR-04: Check if any tables are unpaid (AC-10-1)
      const unpaidTableCount = await countUnpaidTables(activeShift.id, tx);
      if (unpaidTableCount > 0) {
        return {
          ok: false,
          status: 409,
          code: ERROR_CATALOG.ERR_04.id,
          error: formatErr04(unpaidTableCount),
        };
      }

      // c. Rule BR-05: Compute theoretical cash
      const cashBalance = await getShiftCashBalance(
        activeShift.id,
        activeShift.initialCash,
        tx,
      );

      const expectedCash = cashBalance.expectedCash;
      const difference = tienThucDem - expectedCash;

      // d. Rule BR-06 & ERR-05: Mandate explanation if difference != 0 (AC-10-3)
      if (difference !== 0 && cleanExplanation.length === 0) {
        return {
          ok: false,
          status: 422,
          code: ERROR_CATALOG.ERR_05.id,
          error: formatErr05(difference),
          difference,
          expectedCash,
          actualCash: tienThucDem,
        };
      }

      // e. Transition status to CHO_DUYET
      const [updatedShift] = await tx
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

      await recordSyncShiftEvent(
        {
          shiftId: updatedShift.id,
          shiftCode: updatedShift.shiftCode,
          cashierId: updatedShift.cashierId,
          initialCash: updatedShift.initialCash,
          actualCash: updatedShift.actualCash,
          expectedCash: updatedShift.expectedCash,
          difference: updatedShift.difference,
          explanation: updatedShift.explanation,
          status: updatedShift.status,
          openedAt: updatedShift.openedAt.toISOString(),
          closedAt: updatedShift.closedAt ? updatedShift.closedAt.toISOString() : null,
          approvedById: null,
        },
        tx as any,
      );

      return {
        ok: true,
        status: 200,
        data: updatedShift,
      };
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          code: (result as any).code,
          error: result.error,
          difference: (result as any).difference,
          expectedCash: (result as any).expectedCash,
          actualCash: (result as any).actualCash,
        },
        { status: result.status },
      );
    }

    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    console.error("Failed to close shift:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi hệ thống khi gửi kiểm đếm kết ca" },
      { status: 500 },
    );
  }
}
