import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/require-role";
import { updateMenuItemAvailability } from "@/server/menu/menu-service";
import { updateAvailabilitySchema } from "@/server/menu/menu-schema";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/v1/menu/items/:id/availability
 * Toggles product availability between DANG_BAN and HET_HANG (FR-15, BR-09).
 * Strictly requires QUAN_LY.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireRole(req, "QUAN_LY");
  if (!auth.authorized) {
    return auth.response;
  }

  const { id: rawId } = await Promise.resolve(context.params);
  const id = parseInt(rawId, 10);
  if (isNaN(id) || id <= 0) {
    return NextResponse.json(
      { ok: false, error: "ID món ăn không hợp lệ" },
      { status: 400 },
    );
  }

  try {
    const rawBody = await req.json();
    const result = updateAvailabilitySchema.safeParse(rawBody);

    if (!result.success) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error.errors[0]?.message || "Trạng thái không hợp lệ",
          errors: result.error.flatten(),
        },
        { status: 400 },
      );
    }

    let targetStatus: "DANG_BAN" | "HET_HANG";
    if (result.data.status) {
      targetStatus = result.data.status;
    } else {
      targetStatus = result.data.isAvailable ? "DANG_BAN" : "HET_HANG";
    }

    const updated = await updateMenuItemAvailability(id, targetStatus);
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: `Không tìm thấy món ăn với ID ${id}` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: updated,
      message: `Đã đổi trạng thái món sang ${targetStatus === "DANG_BAN" ? "Đang bán" : "Hết hàng"}`,
    });
  } catch (error) {
    console.error("Failed to update menu item availability:", error);
    return NextResponse.json(
      { ok: false, error: "Không thể cập nhật trạng thái món ăn" },
      { status: 500 },
    );
  }
}
