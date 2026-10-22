import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { POST as closeShiftHandler } from "@/app/api/v1/shifts/close/route";
import { ERROR_CATALOG } from "@/lib/error-catalog";

describe("Shift Close API - POST /api/v1/shifts/close (US-10, FR-08, BR-05, BR-06, BR-07)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  let cashierUserId: number;
  let cashierToken: string;
  let waiterUserId: number;
  let waiterToken: string;

  let testAreaId: number;
  let testTableId: number;
  let activeShiftId: number;

  const rand = () => Math.random().toString(36).slice(2, 8);

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const [cashier] = await db
      .insert(schema.users)
      .values({
        username: `cashier_close_${rand()}`,
        fullName: "Cashier Close Test",
        role: "THU_NGAN",
        passwordHash: "dummy",
      })
      .returning();
    cashierUserId = cashier.id;
    cashierToken = await signAuthToken({
      userId: cashier.id,
      username: cashier.username,
      fullName: cashier.fullName,
      role: "THU_NGAN",
    });

    const [waiter] = await db
      .insert(schema.users)
      .values({
        username: `waiter_close_${rand()}`,
        fullName: "Waiter Close Test",
        role: "PHUC_VU",
        passwordHash: "dummy",
      })
      .returning();
    waiterUserId = waiter.id;
    waiterToken = await signAuthToken({
      userId: waiter.id,
      username: waiter.username,
      fullName: waiter.fullName,
      role: "PHUC_VU",
    });

    const [area] = await db
      .insert(schema.areas)
      .values({
        code: `KV_${rand()}`,
        name: "Khu vực kiểm thử",
      })
      .returning();
    testAreaId = area.id;

    const [table] = await db
      .insert(schema.tables)
      .values({
        code: `B_${rand()}`,
        name: "Bàn 04",
        areaId: testAreaId,
        status: "TRONG",
      })
      .returning();
    testTableId = table.id;

    const [shift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_CL_${rand()}`,
        cashierId: cashierUserId,
        initialCash: 3_500_000,
        expectedCash: 3_500_000,
        status: "DANG_MO",
      })
      .returning();
    activeShiftId = shift.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("AC-10-1: blocks shift close with 409 and ERR-04 verbatim when 1 table is unpaid", async () => {
    // Create an active order at Table 04 in this shift
    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_${rand()}`,
        orderType: "TAI_BAN",
        tableId: testTableId,
        shiftId: activeShiftId,
        status: "DANG_PHUC_VU",
      })
      .returning();

    const req = new NextRequest("http://localhost:3000/api/v1/shifts/close", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({ tienThucDem: 3_500_000 }),
    });

    const res = await closeShiftHandler(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.code).toBe(ERROR_CATALOG.ERR_04.id);
    expect(body.error).toContain("Vẫn còn 1 bàn");
    expect(body.error).toBe(
      "Không thể đóng ca! Vẫn còn 1 bàn chưa hoàn tất thanh toán. Vui lòng thanh toán hoặc bàn giao bàn.",
    );

    // Complete the order so table is paid
    await db
      .update(schema.orders)
      .set({ status: "DA_THANH_TOAN" })
      .where(eq(schema.orders.id, order.id));
  });

  it("AC-10-3: blocks shift close with 422 and ERR-05 when missing 50,000 without explanation", async () => {
    // Expected: 3,500,000. Actual counted: 3,450,000 (short 50,000)
    const req = new NextRequest("http://localhost:3000/api/v1/shifts/close", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        tienThucDem: 3_450_000,
      }),
    });

    const res = await closeShiftHandler(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.ok).toBe(false);
    expect(body.code).toBe(ERROR_CATALOG.ERR_05.id);
    expect(body.error).toMatch(/Tiền mặt thực tế bị lệch -50[.,]000 VNĐ/);
    expect(body.error).toContain("Vui lòng nhập lý do giải trình để tiếp tục!");
  });

  it("blocks shift close with 422 and ERR-05 when cash surplus without explanation", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/shifts/close", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        tienThucDem: 3_550_000,
        giaiTrinh: "   ",
      }),
    });

    const res = await closeShiftHandler(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.code).toBe("ERR-05");
  });

  it("allows shift close with discrepancy when explanation is provided -> CHO_DUYET", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/shifts/close", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        tienThucDem: 3_450_000,
        giaiTrinh: "Thối nhầm tiền cho bàn 3",
      }),
    });

    const res = await closeShiftHandler(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("CHO_DUYET");
    expect(body.data.actualCash).toBe(3_450_000);
    expect(body.data.difference).toBe(-50_000);
    expect(body.data.explanation).toBe("Thối nhầm tiền cho bàn 3");
  });

  it("blocks PHUC_VU role with 403 Forbidden", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/shifts/close", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
      },
      body: JSON.stringify({ tienThucDem: 3_500_000 }),
    });

    const res = await closeShiftHandler(req);
    expect(res.status).toBe(403);
  });
});
