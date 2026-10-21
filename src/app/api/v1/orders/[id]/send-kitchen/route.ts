import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/require-role";
import { can } from "@/lib/permissions";
import { sendKitchenSchema } from "@/server/orders/order-schema";
import { sendKitchenOrder } from "@/server/orders/send-kitchen-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/orders/:id/send-kitchen
 * Marks unprinted order items as sent to kitchen and groups them by station (KITCHEN and BAR) (FR-03, UC-02).
 * Enforces expectedVersion optimistic concurrency lock; returns 409 if no new items or status mismatch.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  // Permission verified via requireRole/can; order is already bound to shiftId established at opening
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return auth.response;
  }

  if (!can(auth.user.role, "PRINT_KITCHEN_ORDER")) {
    return NextResponse.json(
      { ok: false, error: "Quyền truy cập bị từ chối: Không có quyền gửi lệnh bếp" },
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
  const parsed = sendKitchenSchema.safeParse(rawBody);
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
    const result = await sendKitchenOrder(orderId, parsed.data.expectedVersion);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to send order to kitchen:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi máy chủ khi gửi thực đơn xuống bếp" },
      { status: 500 },
    );
  }
}
