import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/require-role";
import { getCategories, createCategory } from "@/server/menu/menu-service";
import { createCategorySchema } from "@/server/menu/menu-schema";

/**
 * GET /api/v1/menu/categories
 * Returns active categories. Accessible to all staff.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const list = await getCategories();
    return NextResponse.json({ ok: true, data: list });
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return NextResponse.json(
      { ok: false, error: "Không thể tải danh sách danh mục" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/menu/categories
 * Create a new category. Strictly requires QUAN_LY.
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "QUAN_LY");
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const rawBody = await req.json();
    const result = createCategorySchema.safeParse(rawBody);

    if (!result.success) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error.errors[0]?.message || "Dữ liệu danh mục không hợp lệ",
          errors: result.error.flatten(),
        },
        { status: 400 },
      );
    }

    const created = await createCategory(result.data);
    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (error: unknown) {
    console.error("Failed to create category:", error);
    const pgError = error as { code?: string; message?: string };
    if (pgError?.code === "23505") {
      return NextResponse.json(
        { ok: false, error: "Mã danh mục đã tồn tại" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "Không thể tạo danh mục mới" },
      { status: 500 },
    );
  }
}
