import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { shifts, users, printJobs, auditLogs } from "@/db/schema";
import { withManagerApproval } from "@/server/approvals/with-manager-approval";
import { getShiftFinancialReport } from "./shift-financial-report";
import { countUnpaidTables } from "./shift-tables-check";
import { formatErr04 } from "@/lib/error-catalog";
import { enqueueOutboxItem, processOutbox } from "@/server/outbox";
import { dispatchPrintJob } from "@/server/printing/print-service";
import { buildCloseShiftPayloads } from "./shift-close-payload-builder";
import type { TokenPayload } from "@/server/auth/jwt";
import type { ZReportPayload } from "@/server/printing/print-payload-types";

export interface ApproveShiftParams {
  shiftId?: number;
  pinCode?: string;
  lyDo?: string;
  user: TokenPayload;
  clientIp?: string | null;
  userAgent?: string | null;
}

export interface ApproveShiftResult {
  ok: boolean;
  status: number;
  error?: string;
  data?: {
    shift: typeof shifts.$inferSelect;
    zReport: ZReportPayload;
  };
}

/**
 * Handles manager approval to close a shift (FR-09, BR-05, BR-07, AC-10-2).
 * Transition: CHO_DUYET (or DANG_MO) -> DA_DONG.
 * Queues Z-Report in print_jobs, audits ca_lam_viec_da_dong event,
 * enqueues outbox message for Telegram, and triggers non-blocking processing.
 */
export async function approveShift(params: ApproveShiftParams): Promise<ApproveShiftResult> {
  const { shiftId, pinCode, lyDo, user, clientIp, userAgent } = params;

  // 1. Locate the target shift
  const shiftCondition =
    shiftId !== undefined
      ? eq(shifts.id, shiftId)
      : and(eq(shifts.cashierId, user.userId), eq(shifts.status, "CHO_DUYET"));

  const [shift] = await db.select().from(shifts).where(shiftCondition).limit(1);

  if (!shift) {
    return {
      ok: false,
      status: 404,
      error: "Không tìm thấy ca làm việc cần duyệt chốt ca",
    };
  }

  if (shift.status === "DA_DONG") {
    return {
      ok: false,
      status: 409,
      error: "Ca làm việc này đã được chốt và đóng trước đó",
    };
  }

  // 2. Check for unpaid tables before proceeding (BR-07, ERR-04)
  const unpaidTableCount = await countUnpaidTables(shift.id, db);
  if (unpaidTableCount > 0) {
    return {
      ok: false,
      status: 409,
      error: formatErr04(unpaidTableCount),
    };
  }

  // 3. Manager PIN approval gate (Phase 06)
  const effectiveReason = (lyDo ?? "Ký duyệt chốt ca làm việc").trim();
  const approval = await withManagerApproval(
    {
      userId: user.userId,
      id: user.userId,
      username: user.username,
      fullName: user.fullName || user.username,
      role: user.role,
    },
    "APPROVE_CLOSE_SHIFT",
    { pinCode, lyDo: effectiveReason },
    clientIp,
    userAgent,
  );

  if (!approval.ok) {
    return { ok: false, status: approval.status, error: approval.error };
  }

  // 4. Compute financial metrics for Z-Report and Telegram
  const financial = await getShiftFinancialReport(shift.id, shift.initialCash, db);

  const [cashier] = await db
    .select({ id: users.id, username: users.username, fullName: users.fullName })
    .from(users)
    .where(eq(users.id, shift.cashierId))
    .limit(1);

  const cashierName = cashier?.fullName || cashier?.username || "Thu ngân";
  const now = new Date();
  const shiftDurationSeconds = Math.round((now.getTime() - shift.openedAt.getTime()) / 1000);
  const actualCash = shift.actualCash ?? financial.expectedCash;
  const difference = shift.difference ?? actualCash - financial.expectedCash;

  const { zReportPayload, telegramPayload } = buildCloseShiftPayloads({
    shift,
    financial,
    cashierName,
    approverName: approval.approverName,
    now,
    actualCash,
    difference,
  });

  // 5. Atomic database transaction
  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(shifts)
      .set({
        status: "DA_DONG",
        closedAt: now,
        approvedById: approval.approverId,
        updatedAt: now,
      })
      .where(eq(shifts.id, shift.id))
      .returning();

    const [job] = await tx
      .insert(printJobs)
      .values({
        jobType: "Z_REPORT",
        targetPrinter: "RECEIPT",
        payload: JSON.stringify(zReportPayload),
        status: "PENDING",
      })
      .returning();

    await tx.insert(auditLogs).values({
      userId: user.userId,
      action: "CLOSE_SHIFT_APPROVE",
      entityType: "SHIFT",
      entityId: String(shift.id),
      reason: approval.reason,
      metadata: JSON.stringify({
        event: "ca_lam_viec_da_dong",
        maCa: shift.shiftCode,
        nhanVienId: shift.cashierId,
        doLechTien: difference,
        thoiGianCa: shiftDurationSeconds,
        approverId: approval.approverId,
        approverName: approval.approverName,
      }),
      ipAddress: clientIp,
    });

    await enqueueOutboxItem("TELEGRAM_SHIFT_CLOSE", telegramPayload, `telegram_shift_close_${shift.id}`, tx);

    return { updated, jobId: job?.id };
  });

  // 6. Non-blocking side effects after commit
  if (result.jobId) {
    dispatchPrintJob(result.jobId).catch((err) => console.error("Print dispatch error:", err));
  }
  processOutbox().catch((err) => console.error("Outbox process error:", err));

  return {
    ok: true,
    status: 200,
    data: { shift: result.updated, zReport: zReportPayload },
  };
}
