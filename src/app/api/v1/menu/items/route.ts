import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/require-role";
import { getMenuItems, createMenuItem, updateMenuItem } from "@/server/menu/menu-service";
import { createMenuItemSchema, updateMenuItemSchema } from "@/server/menu/menu-schema";
import { ERROR_CATALOG } from "@/lib/error-catalog";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) return auth.response;

  try {
    const url = new URL(req.url);
    const categoryIdParam = url.searchParams.get("categoryId");
    let categoryId: number | undefined;

    if (categoryIdParam !== null && categoryIdParam !== "") {
      categoryId = parseInt(categoryIdParam, 10);
      if (isNaN(categoryId) || categoryId <= 0) {
        return NextResponse.json(
          { ok: false, error: "Mã danh mục categoryId không hợp lệ" },
          { status: 400 },
        );
      }
    }

    const statusParam = url.searchParams.get("status") as "DANG_BAN" | "HET_HANG" | null;
    const searchParam = url.searchParams.get("search") || undefined;

    const items = await getMenuItems({
      categoryId,
      status: statusParam || undefined,
      search: searchParam,
    });

    return NextResponse.json({ ok: true, data: items });
  } catch (error) {
    console.error("Failed to fetch menu items:", error);
    return NextResponse.json({ ok: false, error: "Không thể tải danh sách thực đơn" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "QUAN_LY");
  if (!auth.authorized) return auth.response;

  try {
    const rawBody = await req.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object") {
      return NextResponse.json(
        { ok: false, error: "Dữ liệu yêu cầu không hợp lệ (JSON không đúng định dạng)" },
        { status: 400 },
      );
    }

    const result = createMenuItemSchema.safeParse(rawBody);
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

    const created = await createMenuItem(result.data);
    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (error: unknown) {
    console.error("Failed to create menu item:", error);
    const pgError = error as { code?: string; message?: string };
    if (pgError?.code === "23505") {
      return NextResponse.json({ ok: false, error: "Mã món ăn đã tồn tại, vui lòng chọn mã khác" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: "Không thể tạo món ăn mới" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRole(req, "QUAN_LY");
  if (!auth.authorized) return auth.response;

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

    const id = result.data.id || (rawBody as Record<string, unknown>).id;
    if (!id || typeof id !== "number" || isNaN(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: "Yêu cầu id món ăn hợp lệ để cập nhật" }, { status: 400 });
    }

    const updated = await updateMenuItem(id, result.data);
    if (!updated) {
      return NextResponse.json({ ok: false, error: `Không tìm thấy món ăn với ID ${id}` }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: updated });
  } catch (error: unknown) {
    console.error("Failed to update menu item:", error);
    return NextResponse.json({ ok: false, error: "Không thể cập nhật món ăn" }, { status: 500 });
  }
}
