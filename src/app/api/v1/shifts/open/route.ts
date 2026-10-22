import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { shifts } from "@/db/schema";
import { requireRole } from "@/server/auth/require-role";
import { generateShiftCode } from "@/db/code-generator";
import { recordSyncShiftEvent } from "@/server/sync";

const MAX_MONEY = 2_000_000_000;

/**
 * POST /api/v1/shifts/open (API-01, FR-06, BR-01, AC-01-1)
 * Opens a new cashier shift with recorded initial cash.
 * Permitted roles: QUAN_LY, THU_NGAN. (PHUC_VU blocked with 403).
 * Generates sequential shift code CA-YYYYMMDD-nn in transaction.
 * Maps Postgres 23505 (partial unique index) to 409 Conflict.
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

  // Validate that body is a non-null, non-array object
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, error: "Dữ liệu JSON phải là một đối tượng hợp lệ" },
      { status: 400 },
    );
  }

  const { tienDauCa } = body as Record<string, unknown>;

  if (
    typeof tienDauCa !== "number" ||
    !Number.isInteger(tienDauCa) ||
    tienDauCa < 0 ||
    tienDauCa > MAX_MONEY
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Số tiền đầu ca phải là số nguyên không âm và không vượt quá 2.000.000.000 VNĐ",
      },
      { status: 400 },
    );
  }

  const initialCash = tienDauCa;

  try {
    // Check if cashier already has an active or pending approval shift before starting transaction
    const [existingShift] = await db
      .select({ id: shifts.id, shiftCode: shifts.shiftCode, status: shifts.status })
      .from(shifts)
      .where(and(eq(shifts.cashierId, user.userId), inArray(shifts.status, ["DANG_MO", "CHO_DUYET"])))
      .limit(1);

    if (existingShift) {
      const statusText = existingShift.status === "DANG_MO" ? "đang mở" : "chờ Quản lý duyệt";
      return NextResponse.json(
        {
          ok: false,
          error: `Nhân viên đang có ca làm việc ${statusText} (${existingShift.shiftCode}). Không thể mở thêm ca mới.`,
        },
        { status: 409 },
      );
    }

    // Atomically generate shift code and insert new shift inside a transaction
    const newShift = await db.transaction(async (tx) => {
      const shiftCode = await generateShiftCode(tx);
      const [inserted] = await tx
        .insert(shifts)
        .values({
          shiftCode,
          cashierId: user.userId,
          initialCash,
          expectedCash: initialCash,
          status: "DANG_MO",
          openedAt: new Date(),
        })
        .returning();

      await recordSyncShiftEvent(
        {
          shiftId: inserted.id,
          shiftCode: inserted.shiftCode,
          cashierId: inserted.cashierId,
          initialCash: inserted.initialCash,
          actualCash: inserted.actualCash,
          expectedCash: inserted.expectedCash,
          difference: inserted.difference,
          explanation: inserted.explanation,
          status: inserted.status,
          openedAt: inserted.openedAt.toISOString(),
          closedAt: null,
          approvedById: null,
        },
        tx as any,
      );

      return inserted;
    });

    return NextResponse.json(
      {
        ok: true,
        data: newShift,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const pgError = error as { code?: string; message?: string };
    if (pgError.code === "23505") {
      return NextResponse.json(
        {
          ok: false,
          error: "Xung đột: Thu ngân đã có ca làm việc đang mở hoặc trùng mã ca.",
        },
        { status: 409 },
      );
    }

    console.error("Failed to open shift:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi hệ thống khi mở ca làm việc" },
      { status: 500 },
    );
  }
}
