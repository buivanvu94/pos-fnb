import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/require-role";
import { can } from "@/lib/permissions";
import { deleteOrderSchema } from "@/server/orders/order-schema";
import { getOrderDetails } from "@/server/orders/order-service";
import { deleteEmptyOrder } from "@/server/orders/delete-order-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/orders/:id
 * Retrieves full order details including line items, toppings, and totals.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json(
      { ok: false, error: "Mã đơn hàng không hợp lệ" },
      { status: 400 },
    );
  }

  try {
    const order = await getOrderDetails(orderId);
    if (!order) {
      return NextResponse.json(
        { ok: false, error: "Đơn hàng không tồn tại" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, data: order });
  } catch (error) {
    console.error("Failed to fetch order:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi máy chủ khi tải thông tin đơn hàng" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/v1/orders/:id
 * Cancels an empty active order that has not had any items sent to the kitchen.
 * Returns table to TRONG. Enforces status DANG_PHUC_VU and expectedVersion lock.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  // Permission verified via requireRole/can; order is already bound to shiftId established at opening
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return auth.response;
  }

  if (!can(auth.user.role, "CREATE_ORDER_AT_TABLE")) {
    return NextResponse.json(
      { ok: false, error: "Quyền truy cập bị từ chối: Không có quyền thao tác đơn hàng" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json(
      { ok: false, error: "Mã đơn hàng không hợp lệ" },
      { status: 400 },
    );
  }

  const rawBody = await req.json().catch(() => ({}));
  const parsed = deleteOrderSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message || "expectedVersion là bắt buộc",
      },
      { status: 400 },
    );
  }

  try {
    const result = await deleteEmptyOrder(orderId, parsed.data.expectedVersion);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ ok: true, message: result.message });
  } catch (error) {
    console.error("Failed to delete order:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi máy chủ khi hủy đơn hàng" },
      { status: 500 },
    );
  }
}
