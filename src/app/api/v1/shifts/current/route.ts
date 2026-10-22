import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import { shifts } from "@/db/schema";
import { requireRole } from "@/server/auth/require-role";
import { getShiftFinancialReport } from "@/server/shifts/shift-financial-report";

/**
 * GET /api/v1/shifts/current
 * Returns the currently active shift ('DANG_MO' or 'CHO_DUYET') for the logged in user,
 * enriched with theoretical cash balance and financial statistics calculated dynamically per BR-05.
 * Returns null if no active or pending shift is found.
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
      .where(
        and(
          eq(shifts.cashierId, user.userId),
          inArray(shifts.status, ["DANG_MO", "CHO_DUYET"]),
        ),
      )
      .orderBy(desc(shifts.id))
      .limit(1);

    if (!currentShift) {
      return NextResponse.json({
        ok: true,
        data: null,
      });
    }

    const report = await getShiftFinancialReport(
      currentShift.id,
      currentShift.initialCash,
      db,
    );

    return NextResponse.json({
      ok: true,
      data: {
        ...currentShift,
        expectedCash: report.expectedCash,
        cashSales: report.cashSales,
        vietqrSales: report.vietqrSales,
        totalSales: report.totalSales,
        cashIn: report.cashIn,
        cashOut: report.cashOut,
        invoiceCount: report.invoiceCount,
        cancelledCount: report.cancelledCount,
        cancelledAmount: report.cancelledAmount,
        discountAmount: report.discountAmount,
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
