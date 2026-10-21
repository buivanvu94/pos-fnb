import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { shifts, cashEntries, printJobs } from "@/db/schema";
import { requireRole } from "@/server/auth/require-role";
import { ERROR_CATALOG } from "@/lib/error-catalog";
import { getShiftCashBalance } from "@/server/shifts/cash-balance";

/**
 * POST /api/v1/shifts/cash-transaction (API-07, FR-07, BR-05, AC-09-1, AC-09-2)
 * Records an urgent Cash In (THU) or Cash Out (CHI) entry for the cashier's active shift.
 * Restrictions:
 * - Roles: QUAN_LY, THU_NGAN only. PHUC_VU returns 403 Forbidden.
 * - Requires an active shift ('DANG_MO') belonging to the authenticated cashier.
 * - Validates: amount > 0, reason non-empty and max 255 characters.
 * - Atomically inserts cash_entry, creates print_job ('CASH_RECEIPT', 'PENDING'),
 *   and updates shifts.expected_cash in the same database transaction.
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "QUAN_LY", "THU_NGAN");
  if (!auth.authorized) {
    return auth.response;
  }

  const { user } = auth;

  let body: {
    loai?: unknown;
    entryType?: unknown;
    soTien?: unknown;
    amount?: unknown;
    lyDo?: unknown;
    reason?: unknown;
    shiftId?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Dữ liệu JSON không hợp lệ" },
      { status: 400 },
    );
  }

  // 1. Validate Entry Type (THU | CHI)
  const rawType = body.loai !== undefined ? body.loai : body.entryType;
  if (rawType !== "THU" && rawType !== "CHI") {
    return NextResponse.json(
      { ok: false, error: "Loại giao dịch không hợp lệ. Phải là 'THU' hoặc 'CHI'" },
      { status: 400 },
    );
  }
  const entryType: "THU" | "CHI" = rawType;

  // 2. Validate Amount (> 0, integer)
  const rawAmount = body.soTien !== undefined ? body.soTien : body.amount;
  if (
    typeof rawAmount !== "number" ||
    !Number.isInteger(rawAmount) ||
    rawAmount <= 0
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Số tiền thu/chi phải là số nguyên lớn hơn 0",
      },
      { status: 400 },
    );
  }
  const amount = rawAmount;

  // 3. Validate Reason (required, trimmed, max 255)
  const rawReason = body.lyDo !== undefined ? body.lyDo : body.reason;
  if (typeof rawReason !== "string" || rawReason.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "Lý do thu/chi tiền mặt là bắt buộc" },
      { status: 400 },
    );
  }
  const reason = rawReason.trim();
  if (reason.length > 255) {
    return NextResponse.json(
      { ok: false, error: "Lý do thu/chi không được vượt quá 255 ký tự" },
      { status: 400 },
    );
  }

  try {
    // 4. Verify Active Shift for current cashier
    const [activeShift] = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.cashierId, user.userId), eq(shifts.status, "DANG_MO")))
      .limit(1);

    if (!activeShift) {
      return NextResponse.json(
        {
          ok: false,
          code: ERROR_CATALOG.ERR_01.id,
          error: ERROR_CATALOG.ERR_01.message,
        },
        { status: 400 },
      );
    }

    // If shiftId is explicitly provided in body, prevent cross-shift tampering
    if (body.shiftId !== undefined && body.shiftId !== activeShift.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Không được phép thực hiện thu/chi trên ca làm việc của người khác",
        },
        { status: 403 },
      );
    }

    // 5. Execute atomic transaction: cash_entry + print_job + theoretical cash update
    const result = await db.transaction(async (tx) => {
      // a. Insert cash entry
      const [entry] = await tx
        .insert(cashEntries)
        .values({
          shiftId: activeShift.id,
          entryType,
          amount,
          reason,
          performedBy: user.userId,
        })
        .returning();

      // b. Queue print job for physical receipt & cash drawer pulse (Phase 05 queue)
      await tx.insert(printJobs).values({
        orderId: null,
        jobType: "CASH_RECEIPT",
        targetPrinter: "RECEIPT",
        payload: JSON.stringify({
          entryId: entry.id,
          shiftId: activeShift.id,
          shiftCode: activeShift.shiftCode,
          entryType,
          amount,
          reason,
          performedBy: user.userId,
          performedByName: user.fullName,
          timestamp: new Date().toISOString(),
        }),
        status: "PENDING",
      });

      // c. Dynamically re-calculate theoretical cash balance per BR-05
      const balance = await getShiftCashBalance(
        activeShift.id,
        activeShift.initialCash,
        tx,
      );

      // d. Update shift expectedCash column
      await tx
        .update(shifts)
        .set({
          expectedCash: balance.expectedCash,
          updatedAt: new Date(),
        })
        .where(eq(shifts.id, activeShift.id));

      return {
        entry,
        expectedCash: balance.expectedCash,
        breakdown: balance,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        data: result,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to record cash transaction:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi hệ thống khi ghi nhận phiếu thu/chi" },
      { status: 500 },
    );
  }
}
