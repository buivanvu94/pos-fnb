import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOpenShift } from "@/server/shifts/require-open-shift";
import { can } from "@/lib/permissions";
import { createOrRefreshVietQrPayment } from "@/server/payments/vietqr-service";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";

const createVietQrSchema = z.object({
  orderId: z.coerce.number().int().positive().optional(),
  maHoaDon: z.string().optional(),
  soTien: z.coerce.number().optional(),
  expectedVersion: z.number().int().min(1).optional(),
});

/**
 * POST /api/v1/payments/vietqr
 * Creates or refreshes a dynamic VietQR payment with 180s expiry (API-05, FR-12, AC-08-1).
 */
export async function POST(req: NextRequest) {
  const shiftAuth = await requireOpenShift(req);
  if (!shiftAuth.authorized) {
    return shiftAuth.response;
  }

  if (!can(shiftAuth.user.role, "PAY_AND_PRINT_FINAL_BILL")) {
    return NextResponse.json(
      { ok: false, error: "Quyền truy cập bị từ chối: Không có quyền thực hiện thanh toán" },
      { status: 403 },
    );
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = createVietQrSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message || "Dữ liệu yêu cầu không hợp lệ" },
      { status: 400 },
    );
  }

  let targetOrderId = parsed.data.orderId;

  // Fallback: lookup order by maHoaDon if orderId was not provided
  if (!targetOrderId && parsed.data.maHoaDon) {
    const [found] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.orderCode, parsed.data.maHoaDon.trim()))
      .limit(1);
    if (found) {
      targetOrderId = found.id;
    }
  }

  if (!targetOrderId) {
    return NextResponse.json(
      { ok: false, error: "Thiếu thông tin mã đơn hàng hợp lệ" },
      { status: 400 },
    );
  }

  try {
    const result = await createOrRefreshVietQrPayment({
      orderId: targetOrderId,
      expectedVersion: parsed.data.expectedVersion,
      shiftId: shiftAuth.shift.id,
      userId: shiftAuth.user.userId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({
      ok: true,
      data: result.data,
    });
  } catch (error) {
    console.error("VietQR creation API error:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi máy chủ khi tạo mã VietQR" },
      { status: 500 },
    );
  }
}
