import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { POST as openShiftHandler } from "@/app/api/v1/shifts/open/route";
import { GET as currentShiftHandler } from "@/app/api/v1/shifts/current/route";
import { requireOpenShift, shiftLookup } from "@/server/shifts/require-open-shift";
import { ERROR_CATALOG } from "@/lib/error-catalog";

describe("Shift Open API - POST /api/v1/shifts/open & GET /api/v1/shifts/current", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  let cashierUserId: number;
  let cashierToken: string;
  let managerUserId: number;
  let managerToken: string;
  let waiterUserId: number;
  let waiterToken: string;

  const rand = () => Math.random().toString(36).slice(2, 8);

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    // 1. Create Cashier
    const [cashier] = await db
      .insert(schema.users)
      .values({
        username: `thungan_${rand()}`,
        fullName: "Test Cashier Thu Ngan",
        role: "THU_NGAN",
        passwordHash: "dummy",
      })
      .returning({ id: schema.users.id, username: schema.users.username, fullName: schema.users.fullName });
    cashierUserId = cashier.id;
    cashierToken = await signAuthToken({
      userId: cashier.id,
      username: cashier.username,
      fullName: cashier.fullName,
      role: "THU_NGAN",
    });

    // 2. Create Manager
    const [manager] = await db
      .insert(schema.users)
      .values({
        username: `quanly_${rand()}`,
        fullName: "Test Manager Quan Ly",
        role: "QUAN_LY",
        passwordHash: "dummy",
      })
      .returning({ id: schema.users.id, username: schema.users.username, fullName: schema.users.fullName });
    managerUserId = manager.id;
    managerToken = await signAuthToken({
      userId: manager.id,
      username: manager.username,
      fullName: manager.fullName,
      role: "QUAN_LY",
    });

    // 3. Create Waiter
    const [waiter] = await db
      .insert(schema.users)
      .values({
        username: `phucvu_${rand()}`,
        fullName: "Test Waiter Phuc Vu",
        role: "PHUC_VU",
        passwordHash: "dummy",
      })
      .returning({ id: schema.users.id, username: schema.users.username, fullName: schema.users.fullName });
    waiterUserId = waiter.id;
    waiterToken = await signAuthToken({
      userId: waiter.id,
      username: waiter.username,
      fullName: waiter.fullName,
      role: "PHUC_VU",
    });
  });

  afterAll(async () => {
    if (db) {
      await db.delete(schema.cashEntries).where(
        sql`performed_by IN (${cashierUserId}, ${managerUserId}, ${waiterUserId})`,
      );
      await db.delete(schema.shifts).where(
        sql`cashier_id IN (${cashierUserId}, ${managerUserId}, ${waiterUserId})`,
      );
      await db.delete(schema.users).where(
        sql`id IN (${cashierUserId}, ${managerUserId}, ${waiterUserId})`,
      );
    }
    await pool.end();
  });

  it("fails guard requireOpenShift with verbatim ERR-01 before opening shift (AC-01-2)", async () => {
    const getActiveSpy = vi.spyOn(shiftLookup, "getActiveShift").mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost:3000/api/v1/orders", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
    });

    const guardResult = await requireOpenShift(req);
    expect(guardResult.authorized).toBe(false);
    if (!guardResult.authorized) {
      expect(guardResult.response.status).toBe(400);
      const data = await guardResult.response.json();
      expect(data.ok).toBe(false);
      expect(data.code).toBe("ERR-01");
      expect(data.error).toBe(
        "Ca làm việc chưa được mở. Vui lòng mở ca và nhập số dư tiền mặt đầu ca để bắt đầu.",
      );
      expect(data.error).toBe(ERROR_CATALOG.ERR_01.message);
    }
    getActiveSpy.mockRestore();
  });

  it("Item 1: PHUC_VU receives ERR-01 when no shift is open anywhere in the store", async () => {
    // Before any shift is opened in the store: spy on getAnyActiveShift returning null
    const getAnySpy = vi.spyOn(shiftLookup, "getAnyActiveShift").mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost:3000/api/v1/orders", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });

    const guardResult = await requireOpenShift(req);
    expect(guardResult.authorized).toBe(false);
    if (!guardResult.authorized) {
      expect(guardResult.response.status).toBe(400);
      const data = await guardResult.response.json();
      expect(data.error).toBe(ERROR_CATALOG.ERR_01.message);
    }
    getAnySpy.mockRestore();
  });

  it("blocks PHUC_VU role from opening shift with 403 Forbidden", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/shifts/open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
      },
      body: JSON.stringify({ tienDauCa: 1_000_000 }),
    });

    const res = await openShiftHandler(req);
    expect(res.status).toBe(403);
  });

  it("Item 5: rejects valid JSON that is null, array, or string with 400 Bad Request", async () => {
    // 1. Body is null
    const nullReq = new NextRequest("http://localhost:3000/api/v1/shifts/open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify(null),
    });
    expect((await openShiftHandler(nullReq)).status).toBe(400);

    // 2. Body is an array
    const arrayReq = new NextRequest("http://localhost:3000/api/v1/shifts/open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify([1, 2, 3]),
    });
    expect((await openShiftHandler(arrayReq)).status).toBe(400);

    // 3. Body is a primitive string
    const stringReq = new NextRequest("http://localhost:3000/api/v1/shifts/open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify("tienDauCa"),
    });
    expect((await openShiftHandler(stringReq)).status).toBe(400);
  });

  it("Item 6: blocks negative amount and amounts exceeding 2,000,000,000 with 400", async () => {
    // Negative amount
    const negReq = new NextRequest("http://localhost:3000/api/v1/shifts/open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({ tienDauCa: -50_000 }),
    });
    const negRes = await openShiftHandler(negReq);
    expect(negRes.status).toBe(400);

    // Exceeding 2,000,000,000
    const overReq = new NextRequest("http://localhost:3000/api/v1/shifts/open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({ tienDauCa: 2_000_000_001 }),
    });
    const overRes = await openShiftHandler(overReq);
    expect(overRes.status).toBe(400);
    const overData = await overRes.json();
    expect(overData.error).toContain("2.000.000.000 VNĐ");
  });

  it("opens shift with valid initial cash 1,000,000 and returns 201 (AC-01-1)", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/shifts/open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({ tienDauCa: 1_000_000 }),
    });

    const res = await openShiftHandler(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.status).toBe("DANG_MO");
    expect(body.data.initialCash).toBe(1_000_000);
    expect(body.data.cashierId).toBe(cashierUserId);
    // Shift code pattern: CA-YYYYMMDD-nn+ (2 or more digits)
    expect(body.data.shiftCode).toMatch(/^CA-\d{8}-\d{2,}$/);
    expect(body.data.openedAt).toBeTruthy();
  });

  it("Item 1: PHUC_VU can access table diagram / orders once ANY cashier has an open shift", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/orders", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });

    const guardResult = await requireOpenShift(req);
    expect(guardResult.authorized).toBe(true);
    if (guardResult.authorized) {
      expect(guardResult.user.role).toBe("PHUC_VU");
      expect(guardResult.shift.status).toBe("DANG_MO");
    }
  });

  it("blocks opening a second shift when a shift is already open with 409 Conflict", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/shifts/open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({ tienDauCa: 500_000 }),
    });

    const res = await openShiftHandler(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("đang mở");
  });

  it("GET /api/v1/shifts/current returns active shift and theoretical cash balance", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/shifts/current", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
    });

    const res = await currentShiftHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).not.toBeNull();
    expect(body.data.status).toBe("DANG_MO");
    expect(body.data.initialCash).toBe(1_000_000);
    expect(body.data.expectedCash).toBe(1_000_000);
    expect(body.data.cashSales).toBe(0);
    expect(body.data.cashIn).toBe(0);
    expect(body.data.cashOut).toBe(0);
  });

  it("supports tienDauCa = 0 as valid opening balance (edge case UC-01)", async () => {
    // Open shift for manager with tienDauCa = 0
    const req = new NextRequest("http://localhost:3000/api/v1/shifts/open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
      },
      body: JSON.stringify({ tienDauCa: 0 }),
    });

    const res = await openShiftHandler(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.initialCash).toBe(0);
    expect(body.data.status).toBe("DANG_MO");
  });

  it("handles race condition: two concurrent open shift calls result in only one 201 and one 409", async () => {
    // Create new cashier specifically for concurrency test
    const [concurrentCashier] = await db
      .insert(schema.users)
      .values({
        username: `conc_${rand()}`,
        fullName: "Concurrent Test Cashier",
        role: "THU_NGAN",
        passwordHash: "dummy",
      })
      .returning();

    const concurrentToken = await signAuthToken({
      userId: concurrentCashier.id,
      username: concurrentCashier.username,
      fullName: concurrentCashier.fullName,
      role: "THU_NGAN",
    });

    const makeRequest = () =>
      openShiftHandler(
        new NextRequest("http://localhost:3000/api/v1/shifts/open", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `${AUTH_COOKIE_NAME}=${concurrentToken}`,
          },
          body: JSON.stringify({ tienDauCa: 200_000 }),
        }),
      );

    const [res1, res2] = await Promise.all([makeRequest(), makeRequest()]);
    const statuses = [res1.status, res2.status].sort();

    expect(statuses).toEqual([201, 409]);
  });
});
