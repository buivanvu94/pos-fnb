import { NextRequest, NextResponse } from "next/server";
import { requireOpenShift } from "@/server/shifts/require-open-shift";
import { can } from "@/lib/permissions";
import { createOrderSchema } from "@/server/orders/order-schema";
import { createTableOrder } from "@/server/orders/order-service";

/**
 * POST /api/v1/orders
 * Opens an active dine-in order (TAI_BAN) for an empty table (FR-01, FR-02, BR-02, AC-02-1).
 * Requires an open shift (ERR-01) and sets table status to DANG_DUNG.
 */
export async function POST(req: NextRequest) {
  const shiftAuth = await requireOpenShift(req);
  if (!shiftAuth.authorized) {
    return shiftAuth.response;
  }

  if (!can(shiftAuth.user.role, "CREATE_ORDER_AT_TABLE")) {
    return NextResponse.json(
      { ok: false, error: "Quyền truy cập bị từ chối: Không có quyền tạo đơn tại bàn" },
      { status: 403 },
    );
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = createOrderSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message || "Dữ liệu yêu cầu không hợp lệ",
      },
      { status: 400 },
    );
  }

  try {
    const result = await createTableOrder(
      parsed.data.tableId,
      shiftAuth.user,
      shiftAuth.shift,
    );

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(
      { ok: true, data: result.order },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create order:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi máy chủ khi tạo đơn hàng mới" },
      { status: 500 },
    );
  }
}
