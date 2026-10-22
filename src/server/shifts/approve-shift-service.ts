import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { shifts, users, printJobs, auditLogs } from "@/db/schema";
import { verifyManagerPin } from "@/server/approvals/pin-service";
import { getShiftFinancialReport } from "./shift-financial-report";
import { countUnpaidTables } from "./shift-tables-check";
import { formatErr04 } from "@/lib/error-catalog";
import { enqueueOutboxItem, processOutbox } from "@/server/outbox";
import { recordSyncShiftEvent } from "@/server/sync";
import { logAudit } from "@/server/approvals/audit-log-service";
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
 * Handles manager approval to close a shift (FR-09, BR-05, BR-07, DEC-02, AC-10-2).
 * Transition: strictly CHO_DUYET -> DA_DONG (409 if DANG_MO or DA_DONG).
 * Requires manager PIN verification directly (retaining lockout and failed attempts).
 * Serializes concurrent approvals using SELECT ... FOR UPDATE inside a single transaction.
 */
export async function approveShift(params: ApproveShiftParams): Promise<ApproveShiftResult> {
  const { shiftId, pinCode, lyDo, user, clientIp, userAgent } = params;

  // 1. PIN is strictly required for manager approval (DEC-02)
  if (!pinCode || typeof pinCode !== "string" || !pinCode.trim()) {
    return {
      ok: false,
      status: 400,
      error: "Vui lòng nhập mã PIN Quản lý để ký duyệt",
    };
  }

  const pinResult = await verifyManagerPin(user.userId, pinCode.trim(), clientIp, userAgent);
  if (!pinResult.valid) {
    return {
      ok: false,
      status: pinResult.status || 403,
      error: pinResult.error,
    };
  }

  const approver = pinResult.approver!;
  const effectiveReason = (lyDo ?? "Ký duyệt chốt ca làm việc").trim() || "Ký duyệt chốt ca làm việc";

  const shiftCondition =
    shiftId !== undefined
      ? eq(shifts.id, shiftId)
      : and(eq(shifts.cashierId, user.userId), eq(shifts.status, "CHO_DUYET"));

  let zReportResult: ZReportPayload | null = null;
  let printJobIdToDispatch: number | undefined;

  // 2. Transaction with row lock to serialize concurrent approvals
  const txResult = await db.transaction(async (tx) => {
    const [lockedShift] = await tx
      .select()
      .from(shifts)
      .where(shiftCondition)
      .limit(1)
      .for("update");

    if (!lockedShift) {
      return { ok: false, status: 404, error: "Không tìm thấy ca làm việc cần duyệt chốt ca" };
    }

    if (lockedShift.status === "DA_DONG") {
      return { ok: false, status: 409, error: "Ca làm việc này đã được chốt và đóng trước đó" };
    }

    if (lockedShift.status !== "CHO_DUYET") {
      return {
        ok: false,
        status: 409,
        error: "Ca làm việc chưa được kiểm đếm (phải kiểm đếm trước khi Quản lý duyệt)",
      };
    }

    if (lockedShift.actualCash === null || lockedShift.actualCash === undefined) {
      return { ok: false, status: 409, error: "Ca làm việc chưa hoàn tất kiểm đếm tiền mặt" };
    }

    const unpaidTableCount = await countUnpaidTables(lockedShift.id, tx);
    if (unpaidTableCount > 0) {
      return { ok: false, status: 409, error: formatErr04(unpaidTableCount) };
    }

    const financial = await getShiftFinancialReport(lockedShift.id, lockedShift.initialCash, tx);

    const [cashier] = await tx
      .select({ id: users.id, username: users.username, fullName: users.fullName })
      .from(users)
      .where(eq(users.id, lockedShift.cashierId))
      .limit(1);

    const cashierName = cashier?.fullName || cashier?.username || "Thu ngân";
    const now = new Date();
    const shiftDurationSeconds = Math.round((now.getTime() - lockedShift.openedAt.getTime()) / 1000);
    const actualCash = lockedShift.actualCash;
    const difference = lockedShift.difference ?? (actualCash - financial.expectedCash);

    const { zReportPayload, telegramPayload } = buildCloseShiftPayloads({
      shift: lockedShift,
      financial,
      cashierName,
      approverName: approver.fullName || approver.username,
      now,
      actualCash,
      difference,
    });

    zReportResult = zReportPayload;

    const [updated] = await tx
      .update(shifts)
      .set({
        status: "DA_DONG",
        closedAt: now,
        approvedById: approver.id,
        updatedAt: now,
      })
      .where(eq(shifts.id, lockedShift.id))
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

    printJobIdToDispatch = job?.id;

    await logAudit(
      {
        userId: user.userId,
        action: "CLOSE_SHIFT_APPROVE",
        entityType: "SHIFT",
        entityId: lockedShift.id,
        reason: effectiveReason,
        metadata: {
          event: "ca_lam_viec_da_dong",
          maCa: lockedShift.shiftCode,
          nhanVienId: lockedShift.cashierId,
          doLechTien: difference,
          thoiGianCa: shiftDurationSeconds,
          approverId: approver.id,
          approverName: approver.fullName || approver.username,
        },
        ipAddress: clientIp,
      },
      tx as any,
    );

    await enqueueOutboxItem("TELEGRAM_SHIFT_CLOSE", telegramPayload, `telegram_shift_close_${lockedShift.id}`, tx);

    await recordSyncShiftEvent(
      {
        shiftId: updated.id,
        shiftCode: updated.shiftCode,
        cashierId: updated.cashierId,
        initialCash: updated.initialCash,
        actualCash: updated.actualCash,
        expectedCash: updated.expectedCash,
        difference: updated.difference,
        explanation: updated.explanation,
        status: updated.status,
        openedAt: updated.openedAt.toISOString(),
        closedAt: updated.closedAt ? updated.closedAt.toISOString() : null,
        approvedById: updated.approvedById,
      },
      tx as any,
    );

    return { ok: true, status: 200, shift: updated };
  });

  if (!txResult.ok) {
    return { ok: false, status: txResult.status, error: txResult.error };
  }

  // 3. Non-blocking side effects after commit
  if (printJobIdToDispatch) {
    dispatchPrintJob(printJobIdToDispatch).catch((err) => console.error("Print dispatch error:", err));
  }
  processOutbox().catch((err) => console.error("Outbox process error:", err));

  return {
    ok: true,
    status: 200,
    data: { shift: txResult.shift!, zReport: zReportResult! },
  };
}
