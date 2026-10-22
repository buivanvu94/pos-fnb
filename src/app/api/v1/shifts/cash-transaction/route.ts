import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { shifts, cashEntries, printJobs } from "@/db/schema";
import { requireRole } from "@/server/auth/require-role";
import { ERROR_CATALOG } from "@/lib/error-catalog";
import { getShiftCashBalance } from "@/server/shifts/cash-balance";
import { dispatchPrintJob } from "@/server/printing/print-service";
import { recordSyncCashTxnEvent } from "@/server/sync";

const MAX_MONEY = 2_000_000_000;

class CashTransactionError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "CashTransactionError";
  }
}

/**
 * POST /api/v1/shifts/cash-transaction (API-07, FR-07, BR-05, AC-09-1, AC-09-2)
 * Records an urgent Cash In (THU) or Cash Out (CHI) entry for the cashier's active shift.
 * Restrictions:
 * - Roles: QUAN_LY, THU_NGAN only. PHUC_VU returns 403 Forbidden.
 * - Requires an active shift ('DANG_MO') belonging to the authenticated cashier.
 * - Concurrency: Locks shift row with SELECT ... FOR UPDATE inside transaction to prevent races.
 * - Validates: amount > 0 and <= 2,000,000,000; reason non-empty and max 255 chars.
 * - Checks that expectedCash does not overflow 2,000,000,000.
 * - Atomically inserts cash_entry, queues print_job ('CASH_RECEIPT', 'PENDING'),
 *   and updates shifts.expected_cash in the same database transaction.
 * - Dispatches thermal print job after commit without failing business request (DEC-11).
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

  // 1. Validate that body is a non-null, non-array object
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, error: "Dữ liệu JSON phải là một đối tượng hợp lệ" },
      { status: 400 },
    );
  }

  const { loai, soTien, lyDo, shiftId } = body as Record<string, unknown>;

  // 2. Validate Entry Type (THU | CHI) - Strictly require 'loai'
  if (loai !== "THU" && loai !== "CHI") {
    return NextResponse.json(
      { ok: false, error: "Loại giao dịch không hợp lệ. Phải là 'THU' hoặc 'CHI'" },
      { status: 400 },
    );
  }
  const entryType: "THU" | "CHI" = loai;

  // 3. Validate Amount (> 0, integer, <= 2,000,000,000)
  if (
    typeof soTien !== "number" ||
    !Number.isInteger(soTien) ||
    soTien <= 0 ||
    soTien > MAX_MONEY
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Số tiền thu/chi phải là số nguyên lớn hơn 0 và không vượt quá 2.000.000.000 VNĐ",
      },
      { status: 400 },
    );
  }
  const amount = soTien;

  // 4. Validate Reason (required, trimmed, max 255)
  if (typeof lyDo !== "string" || lyDo.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "Lý do thu/chi tiền mặt là bắt buộc" },
      { status: 400 },
    );
  }
  const reason = lyDo.trim();
  if (reason.length > 255) {
    return NextResponse.json(
      { ok: false, error: "Lý do thu/chi không được vượt quá 255 ký tự" },
      { status: 400 },
    );
  }

  try {
    // 5. Execute atomic transaction with pessimistic row lock (SELECT ... FOR UPDATE)
    const result = await db.transaction(async (tx) => {
      // Lock shift row to serialize concurrent cash transactions for this cashier
      const [activeShift] = await tx
        .select()
        .from(shifts)
        .where(
          and(
            eq(shifts.cashierId, user.userId),
            eq(shifts.status, "DANG_MO"),
          ),
        )
        .for("update");

      if (!activeShift) {
        throw new CashTransactionError(
          ERROR_CATALOG.ERR_01.id,
          400,
          ERROR_CATALOG.ERR_01.message,
        );
      }

      // If shiftId is explicitly sent, verify it matches activeShift.id
      if (shiftId !== undefined && shiftId !== activeShift.id) {
        throw new CashTransactionError(
          "CROSS_SHIFT_FORBIDDEN",
          403,
          "Không được phép thực hiện thu/chi trên ca làm việc của người khác",
        );
      }

      // a. Insert cash entry - strictly use user.userId from token (cannot be tampered)
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

      // a2. Enqueue cloud sync cash transaction event in same tx
      await recordSyncCashTxnEvent(
        {
          id: entry.id,
          shiftId: entry.shiftId,
          entryType: entry.entryType as "THU" | "CHI",
          amount: entry.amount,
          reason: entry.reason,
          performedBy: entry.performedBy,
          createdAt: entry.createdAt.toISOString(),
        },
        tx as any,
      );

      // b. Queue print job for thermal printer & cash drawer kick
      const [job] = await tx
        .insert(printJobs)
        .values({
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
            kickDrawer: true,
          }),
          status: "PENDING",
        })
        .returning();

      // c. Recalculate theoretical cash balance per BR-05 within the transaction
      const balance = await getShiftCashBalance(
        activeShift.id,
        activeShift.initialCash,
        tx,
      );

      // d. Check for integer overflow (limit: 2,000,000,000 VNĐ)
      if (balance.expectedCash > MAX_MONEY) {
        throw new CashTransactionError(
          "EXPECTED_CASH_OVERFLOW",
          400,
          "Tổng tiền mặt lý thuyết vượt quá giới hạn cho phép (tối đa 2.000.000.000 VNĐ)",
        );
      }

      // e. Update shift expectedCash column
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
        jobId: job?.id,
      };
    });

    // Dispatch print job after commit; failures do not break the cash transaction response
    if (result.jobId) {
      dispatchPrintJob(result.jobId).catch((err) => {
        console.error("Non-blocking cash receipt dispatch error:", err);
      });
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          entry: result.entry,
          expectedCash: result.expectedCash,
          breakdown: result.breakdown,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof CashTransactionError) {
      return NextResponse.json(
        {
          ok: false,
          code: error.code,
          error: error.message,
        },
        { status: error.status },
      );
    }

    console.error("Failed to record cash transaction:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi hệ thống khi ghi nhận phiếu thu/chi" },
      { status: 500 },
    );
  }
}
