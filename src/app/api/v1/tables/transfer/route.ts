import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/require-role";
import { can } from "@/lib/permissions";
import { transferTableSchema } from "@/server/orders/order-schema";
import { transferOrMergeTable } from "@/server/orders/transfer-service";

/**
 * POST /api/v1/tables/transfer (API-03)
 * Transfers active order to an empty table or merges multiple active tables into one (FR-04, BR-02, UC-03).
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return auth.response;
  }

  if (!can(auth.user.role, "TRANSFER_MERGE_TABLE")) {
    return NextResponse.json(
      { ok: false, error: "Quyền truy cập bị từ chối: Không có quyền chuyển hoặc gộp bàn" },
      { status: 403 },
    );
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = transferTableSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message || "Dữ liệu yêu cầu chuyển/gộp bàn không hợp lệ",
      },
      { status: 400 },
    );
  }

  try {
    const result = await transferOrMergeTable(parsed.data);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to transfer or merge table:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi máy chủ khi chuyển hoặc gộp bàn" },
      { status: 500 },
    );
  }
}
