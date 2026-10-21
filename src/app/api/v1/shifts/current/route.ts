import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { shifts } from "@/db/schema";
import { requireRole } from "@/server/auth/require-role";
import { getShiftCashBalance } from "@/server/shifts/cash-balance";

/**
 * GET /api/v1/shifts/current
 * Returns the currently active shift ('DANG_MO') for the logged in user,
 * enriched with theoretical cash balance calculated dynamically per BR-05.
 * Returns null if no active shift is currently open.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return auth.response;
  }

  const { user } = auth;

  try {
    const [currentShift] = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.cashierId, user.userId), eq(shifts.status, "DANG_MO")))
      .limit(1);

    if (!currentShift) {
      return NextResponse.json({
        ok: true,
        data: null,
      });
    }

    const balance = await getShiftCashBalance(
      currentShift.id,
      currentShift.initialCash,
      db,
    );

    return NextResponse.json({
      ok: true,
      data: {
        ...currentShift,
        expectedCash: balance.expectedCash,
        cashSales: balance.cashSales,
        cashIn: balance.cashIn,
        cashOut: balance.cashOut,
      },
    });
  } catch (error) {
    console.error("Failed to fetch current shift:", error);
    return NextResponse.json(
      { ok: false, error: "Không thể lấy thông tin ca làm việc hiện tại" },
      { status: 500 },
    );
  }
}
