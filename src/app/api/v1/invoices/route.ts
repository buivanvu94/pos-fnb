import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth/require-role";
import { listInvoices } from "@/server/payments/invoice-service";

const querySchema = z.object({
  scope: z.string().optional().default("shift"),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

/**
 * GET /api/v1/invoices
 * Retrieves paginated list of paid/voided invoices in the current shift (FR-11, FR-14).
 * Accessible by QUAN_LY and THU_NGAN.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) return auth.response;

  if (auth.user.role === "PHUC_VU") {
    return NextResponse.json(
      { ok: false, error: "Quyền truy cập bị từ chối: Không có quyền xem danh sách hóa đơn" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    scope: searchParams.get("scope") ?? "shift",
    page: searchParams.get("page") ?? 1,
    limit: searchParams.get("limit") ?? 20,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Tham số truy vấn không hợp lệ" },
      { status: 400 },
    );
  }

  try {
    const result = await listInvoices({
      scope: parsed.data.scope,
      page: parsed.data.page,
      limit: parsed.data.limit,
      user: auth.user,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("List invoices error:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi máy chủ khi lấy danh sách hóa đơn" },
      { status: 500 },
    );
  }
}
