import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { POST as openShiftHandler } from "@/app/api/v1/shifts/open/route";
import { GET as currentShiftHandler } from "@/app/api/v1/shifts/current/route";
import { requireOpenShift } from "@/server/shifts/require-open-shift";
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

  it("blocks negative or invalid tienDauCa amount with 400 Bad Request", async () => {
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

    // Non-integer amount
    const floatReq = new NextRequest("http://localhost:3000/api/v1/shifts/open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({ tienDauCa: 100.5 }),
    });
    const floatRes = await openShiftHandler(floatReq);
    expect(floatRes.status).toBe(400);
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
    // Shift code pattern: CA-YYYYMMDD-nn
    expect(body.data.shiftCode).toMatch(/^CA-\d{8}-\d{2}$/);
    expect(body.data.openedAt).toBeTruthy();
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

  it("guard requireOpenShift succeeds after shift is open", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/orders", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
    });

    const guardResult = await requireOpenShift(req);
    expect(guardResult.authorized).toBe(true);
    if (guardResult.authorized) {
      expect(guardResult.user.userId).toBe(cashierUserId);
      expect(guardResult.shift.status).toBe("DANG_MO");
      expect(guardResult.shift.initialCash).toBe(1_000_000);
    }
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
