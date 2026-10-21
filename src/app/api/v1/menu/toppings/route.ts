import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/require-role";
import { getToppings, createTopping } from "@/server/menu/menu-service";
import { createToppingSchema } from "@/server/menu/menu-schema";

/**
 * GET /api/v1/menu/toppings
 * Returns available toppings (FR-02).
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const list = await getToppings();
    return NextResponse.json({ ok: true, data: list });
  } catch (error) {
    console.error("Failed to fetch toppings:", error);
    return NextResponse.json(
      { ok: false, error: "Không thể tải danh sách topping" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/menu/toppings
 * Create a new topping. Strictly requires QUAN_LY.
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "QUAN_LY");
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const rawBody = await req.json();
    const result = createToppingSchema.safeParse(rawBody);

    if (!result.success) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error.errors[0]?.message || "Dữ liệu topping không hợp lệ",
          errors: result.error.flatten(),
        },
        { status: 400 },
      );
    }

    const created = await createTopping(result.data);
    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("Failed to create topping:", error);
    return NextResponse.json(
      { ok: false, error: "Không thể tạo topping mới" },
      { status: 500 },
    );
  }
}
