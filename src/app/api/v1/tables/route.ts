import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tables, areas } from "@/db/schema";
import { requireRole } from "@/server/auth/require-role";

/**
 * GET /api/v1/tables
 * Returns active table list with corresponding area details.
 * Read-only endpoint accessible to all authenticated staff (FR-01).
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const tableList = await db
      .select({
        id: tables.id,
        code: tables.code,
        name: tables.name,
        capacity: tables.capacity,
        status: tables.status,
        areaId: tables.areaId,
        areaName: areas.name,
      })
      .from(tables)
      .leftJoin(areas, eq(tables.areaId, areas.id))
      .orderBy(areas.displayOrder, tables.code);

    return NextResponse.json({
      ok: true,
      data: tableList,
    });
  } catch (error) {
    console.error("Failed to fetch tables:", error);
    return NextResponse.json(
      { ok: false, error: "Không thể tải danh sách bàn từ cơ sở dữ liệu" },
      { status: 500 },
    );
  }
}
