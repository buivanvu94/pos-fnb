import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/require-role";
import { can } from "@/lib/permissions";
import { modifyOrderItemsSchema } from "@/server/orders/order-schema";
import { modifyOrderItems } from "@/server/orders/order-items-service";
import { getClientIp, getUserAgent } from "@/server/approvals/ip-helper";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/orders/:id/items
 * Adds items, changes quantity, selects toppings, and updates notes (FR-02, BR-09, ERR-07).
 * Allows deleting or reducing printed items with valid Manager PIN approval (BR-03, FR-10).
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return auth.response;
  }

  if (!can(auth.user.role, "CREATE_ORDER_AT_TABLE")) {
    return NextResponse.json(
      { ok: false, error: "Quyền truy cập bị từ chối: Không có quyền sửa đổi món" },
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

  const rawBody = await req.json().catch(() => null);
  const parsed = modifyOrderItemsSchema.safeParse(rawBody);

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
    const clientIp = getClientIp(req);
    const userAgent = getUserAgent(req);
    const result = await modifyOrderItems(
      orderId,
      parsed.data,
      auth.user,
      clientIp,
      userAgent,
    );

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ ok: true, data: result.order });
  } catch (error) {
    console.error("Failed to modify order items:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi máy chủ khi cập nhật món trong đơn hàng" },
      { status: 500 },
    );
  }
}
