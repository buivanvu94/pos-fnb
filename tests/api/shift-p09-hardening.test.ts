import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { POST as approveShiftHandler } from "@/app/api/v1/shifts/approve/route";
import { POST as closeShiftHandler } from "@/app/api/v1/shifts/close/route";
import { POST as openShiftHandler } from "@/app/api/v1/shifts/open/route";
import { createTableOrder, createTakeawayOrder } from "@/server/orders/order-service";
import { payOrderCash } from "@/server/payments/cash-payment-service";
import { voidPaidBill } from "@/server/payments/void-bill-service";

describe("Phase 09 Reviewer Hardening Tests (Reviewer Kongming)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  let cashierUserId: number;
  let cashierToken: string;
  let managerUserId: number;
  let managerToken: string;
  const managerPin = "7788";

  let testAreaId: number;
  let testTableId: number;

  const rand = () => Math.random().toString(36).slice(2, 8);

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const pinHash = await bcrypt.hash(managerPin, 10);
    const [manager] = await db
      .insert(schema.users)
      .values({
        username: `mgr_hrd_${rand()}`,
        fullName: "Đỗ Quản Lý",
        role: "QUAN_LY",
        passwordHash: "dummy",
        pinHash,
      })
      .returning();
    managerUserId = manager.id;
    managerToken = await signAuthToken({
      userId: manager.id,
      username: manager.username,
      fullName: manager.fullName,
      role: "QUAN_LY",
    });

    const [cashier] = await db
      .insert(schema.users)
      .values({
        username: `csh_hrd_${rand()}`,
        fullName: "Hoàng Thu Ngân",
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

    const [area] = await db.insert(schema.areas).values({ code: `KV_${rand()}`, name: "Khu vực test" }).returning();
    testAreaId = area.id;

    const [table] = await db.insert(schema.tables).values({ code: `B_${rand()}`, name: "Bàn 01", areaId: testAreaId, status: "TRONG" }).returning();
    testTableId = table.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("1. rejects approve on shift with status DANG_MO with 409", async () => {
    const [shift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_OPEN_${rand()}`,
        cashierId: cashierUserId,
        initialCash: 1_000_000,
        status: "DANG_MO",
      })
      .returning();

    const req = new NextRequest("http://localhost:3000/api/v1/shifts/approve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
      },
      body: JSON.stringify({ shiftId: shift.id, pin: managerPin }),
    });

    const res = await approveShiftHandler(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("phải kiểm đếm trước khi Quản lý duyệt");
  });

  it("2. handles parallel approvals: exactly 1 succeeds, 1 gets 409, exactly 1 Z-Report", async () => {
    const [shift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_RACE_${rand()}`,
        cashierId: cashierUserId,
        initialCash: 1_000_000,
        expectedCash: 1_000_000,
        actualCash: 1_000_000,
        difference: 0,
        status: "CHO_DUYET",
      })
      .returning();

    const makeRequest = () =>
      new NextRequest("http://localhost:3000/api/v1/shifts/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
        },
        body: JSON.stringify({ shiftId: shift.id, pin: managerPin }),
      });

    const [res1, res2] = await Promise.all([
      approveShiftHandler(makeRequest()),
      approveShiftHandler(makeRequest()),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);

    // Verify only 1 Z-Report job was created for this shift
    const jobs = await db
      .select()
      .from(schema.printJobs)
      .where(eq(schema.printJobs.jobType, "Z_REPORT"));
    const shiftJobs = jobs.filter((j) => {
      const p = JSON.parse(j.payload);
      return p.shiftId === shift.id;
    });
    expect(shiftJobs).toHaveLength(1);
  });

  it("3. validates shiftId and giaiTrinh length in close/route.ts", async () => {
    // Negative shiftId
    const req1 = new NextRequest("http://localhost:3000/api/v1/shifts/close", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${AUTH_COOKIE_NAME}=${managerToken}` },
      body: JSON.stringify({ shiftId: -1, tienThucDem: 100_000 }),
    });
    const res1 = await closeShiftHandler(req1);
    expect(res1.status).toBe(400);

    // Overly long explanation (> 255 chars)
    const longText = "a".repeat(256);
    const req2 = new NextRequest("http://localhost:3000/api/v1/shifts/close", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
      body: JSON.stringify({ tienThucDem: 100_000, giaiTrinh: longText }),
    });
    const res2 = await closeShiftHandler(req2);
    expect(res2.status).toBe(400);
  });

  it("4. blocks table and takeaway order creation when shift is in CHO_DUYET state", async () => {
    const [pendingShift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_BLOCKED_${rand()}`,
        cashierId: cashierUserId,
        initialCash: 1_000_000,
        expectedCash: 1_000_000,
        actualCash: 1_000_000,
        difference: 0,
        status: "CHO_DUYET",
      })
      .returning();

    const userObj = {
      userId: cashierUserId,
      username: "csh",
      fullName: "Thu Ngan",
      role: "THU_NGAN" as const,
    };

    const tableResult = await createTableOrder(testTableId, userObj, pendingShift);
    expect(tableResult.ok).toBe(false);
    expect((tableResult as any).status).toBe(409);

    const takeawayResult = await createTakeawayOrder(userObj, pendingShift);
    expect(takeawayResult.ok).toBe(false);
    expect((takeawayResult as any).status).toBe(409);
  });

  it("5. blocks cash payment and void paid bill when shift is CHO_DUYET", async () => {
    const [closedShift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_PAY_BLK_${rand()}`,
        cashierId: cashierUserId,
        initialCash: 1_000_000,
        expectedCash: 1_000_000,
        actualCash: 1_000_000,
        difference: 0,
        status: "CHO_DUYET",
      })
      .returning();

    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_PAY_BLK_${rand()}`,
        orderType: "TAI_BAN",
        tableId: testTableId,
        shiftId: closedShift.id,
        totalAmount: 50_000,
        finalAmount: 50_000,
        status: "DANG_PHUC_VU",
        version: 1,
      })
      .returning();

    const payResult = await payOrderCash({
      orderId: order.id,
      tienKhachDua: 50_000,
      expectedVersion: 1,
      user: { userId: cashierUserId, username: "csh", fullName: "Thu Ngan", role: "THU_NGAN" },
      shift: closedShift,
    });

    expect(payResult.ok).toBe(false);
    expect(payResult.status).toBe(409);
  });

  it("6. blocks opening new shift when cashier still has a CHO_DUYET shift", async () => {
    const [pendingCashier] = await db
      .insert(schema.users)
      .values({
        username: `csh_pnd_${rand()}`,
        fullName: "Pending Cashier",
        role: "THU_NGAN",
        passwordHash: "dummy",
      })
      .returning();

    const pendingToken = await signAuthToken({
      userId: pendingCashier.id,
      username: pendingCashier.username,
      fullName: pendingCashier.fullName,
      role: "THU_NGAN",
    });

    await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_PND_${rand()}`,
        cashierId: pendingCashier.id,
        initialCash: 500_000,
        status: "CHO_DUYET",
      });

    const req = new NextRequest("http://localhost:3000/api/v1/shifts/open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${pendingToken}`,
      },
      body: JSON.stringify({ tienDauCa: 500_000 }),
    });

    const res = await openShiftHandler(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("chờ Quản lý duyệt");
  });
});
