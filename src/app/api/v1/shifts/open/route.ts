import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { shifts } from "@/db/schema";
import { requireRole } from "@/server/auth/require-role";
import { generateShiftCode } from "@/db/code-generator";

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

  let body: { tienDauCa?: unknown; initialCash?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Dữ liệu JSON không hợp lệ" },
      { status: 400 },
    );
  }

  const rawAmount = body.tienDauCa !== undefined ? body.tienDauCa : body.initialCash;

  if (
    typeof rawAmount !== "number" ||
    !Number.isInteger(rawAmount) ||
    rawAmount < 0
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Số tiền đầu ca phải là số nguyên lớn hơn hoặc bằng 0",
      },
      { status: 400 },
    );
  }

  const initialCash = rawAmount;

  try {
    // Check if cashier already has an active shift before starting transaction
    const [existingShift] = await db
      .select({ id: shifts.id, shiftCode: shifts.shiftCode })
      .from(shifts)
      .where(and(eq(shifts.cashierId, user.userId), eq(shifts.status, "DANG_MO")))
      .limit(1);

    if (existingShift) {
      return NextResponse.json(
        {
          ok: false,
          error: `Nhân viên đang có ca làm việc đang mở (${existingShift.shiftCode}). Không thể mở thêm ca mới.`,
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
          status: "DANG_MO",
          openedAt: new Date(),
        })
        .returning();

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
