import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/require-role";
import { getMenuItemById, updateMenuItem } from "@/server/menu/menu-service";
import { updateMenuItemSchema } from "@/server/menu/menu-schema";
import { ERROR_CATALOG } from "@/lib/error-catalog";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireRole(req);
  if (!auth.authorized) return auth.response;

  const { id: rawId } = await context.params;
  const id = parseInt(rawId, 10);
  if (isNaN(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "ID món ăn không hợp lệ" }, { status: 400 });
  }

  const item = await getMenuItemById(id);
  if (!item) {
    return NextResponse.json({ ok: false, error: `Không tìm thấy món ăn với ID ${id}` }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: item });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireRole(req, "QUAN_LY");
  if (!auth.authorized) return auth.response;

  const { id: rawId } = await context.params;
  const id = parseInt(rawId, 10);
  if (isNaN(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "ID món ăn không hợp lệ" }, { status: 400 });
  }

  try {
    const rawBody = await req.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object") {
      return NextResponse.json(
        { ok: false, error: "Dữ liệu yêu cầu không hợp lệ (JSON không đúng định dạng)" },
        { status: 400 },
      );
    }

    const result = updateMenuItemSchema.safeParse(rawBody);
    if (!result.success) {
      const isNegativePrice = result.error.errors.some((e) =>
        e.message.includes(ERROR_CATALOG.ERR_12.message),
      );
      const errorMessage = isNegativePrice
        ? ERROR_CATALOG.ERR_12.message
        : result.error.errors[0]?.message || "Dữ liệu không hợp lệ";

      return NextResponse.json(
        { ok: false, error: errorMessage, errors: result.error.flatten() },
        { status: 400 },
      );
    }

    const updated = await updateMenuItem(id, result.data);
    if (!updated) {
      return NextResponse.json({ ok: false, error: `Không tìm thấy món ăn với ID ${id}` }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error("Failed to update menu item:", error);
    return NextResponse.json({ ok: false, error: "Không thể cập nhật món ăn" }, { status: 500 });
  }
}
