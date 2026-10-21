import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth/require-role";
import { can } from "@/lib/permissions";
import { sendKitchenOrder } from "@/server/orders/send-kitchen-service";

const kitchenPrintSchema = z.object({
  orderId: z.number().int().positive({ message: "Mã đơn hàng không hợp lệ" }),
  expectedVersion: z.number().int().optional(),
});

/**
 * POST /api/v1/orders/kitchen-print (API-02, FR-03, UC-02)
 * Sends unprinted order items to Kitchen/Bar thermal printers over LAN.
 * Delegates to the same sendKitchenOrder service as /api/v1/orders/:id/send-kitchen.
 */
export async function POST(req: NextRequest) {
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

  const rawBody = await req.json().catch(() => null);
  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json(
      { ok: false, error: "Dữ liệu JSON không hợp lệ" },
      { status: 400 },
    );
  }

  const parsed = kitchenPrintSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message || "orderId là bắt buộc",
      },
      { status: 400 },
    );
  }

  try {
    const result = await sendKitchenOrder(
      parsed.data.orderId,
      parsed.data.expectedVersion,
      auth.user.fullName,
    );

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to execute kitchen print:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi máy chủ khi phát lệnh in phiếu bếp" },
      { status: 500 },
    );
  }
}
