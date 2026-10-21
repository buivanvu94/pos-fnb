import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { POST as createOrderHandler } from "@/app/api/v1/orders/route";
import { GET as getOrderHandler } from "@/app/api/v1/orders/[id]/route";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { ERROR_CATALOG } from "@/lib/error-catalog";
import { getTestDbUrl } from "../setup/test-config";

describe("Order Creation API - POST /api/v1/orders (US-02, AC-02-1, BR-02, ERR-01)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 10);
  const tag = rand();

  let waiterToken: string;
  let cashierToken: string;
  let otherCashierToken: string;

  let testAreaId: number;
  let emptyTableId: number;
  let occupiedTableId: number;
  let testShiftId: number;
  let cashierUserId: number;
  let otherCashierUserId: number;
  let waiterUserId: number;

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    // Cashier user with open shift
    const [cashier] = await db
      .insert(schema.users)
      .values({
        username: `c_${tag}`,
        passwordHash: "dummy",
        fullName: "Cashier",
        role: "THU_NGAN",
      })
      .returning();
    cashierUserId = cashier.id;

    // Cashier user WITHOUT open shift
    const [otherCashier] = await db
      .insert(schema.users)
      .values({
        username: `oc_${tag}`,
        passwordHash: "dummy",
        fullName: "Other Cashier",
        role: "THU_NGAN",
      })
      .returning();
    otherCashierUserId = otherCashier.id;

    // Waiter user
    const [waiter] = await db
      .insert(schema.users)
      .values({
        username: `w_${tag}`,
        passwordHash: "dummy",
        fullName: "Phục Vụ",
        role: "PHUC_VU",
      })
      .returning();
    waiterUserId = waiter.id;

    waiterToken = await signAuthToken({ userId: waiter.id, username: waiter.username, fullName: waiter.fullName, role: "PHUC_VU" });
    cashierToken = await signAuthToken({ userId: cashier.id, username: cashier.username, fullName: cashier.fullName, role: "THU_NGAN" });
    otherCashierToken = await signAuthToken({ userId: otherCashier.id, username: otherCashier.username, fullName: otherCashier.fullName, role: "THU_NGAN" });

    // Create Area & Tables (code <= 20 chars)
    const [area] = await db
      .insert(schema.areas)
      .values({ code: `AR_${tag}`, name: `Area ${tag}` })
      .returning();
    testAreaId = area.id;

    const [t1] = await db
      .insert(schema.tables)
      .values({ code: `T1_${tag}`, name: `Bàn 01_${tag}`, areaId: testAreaId, capacity: 4, status: "TRONG" })
      .returning();
    emptyTableId = t1.id;

    const [t2] = await db
      .insert(schema.tables)
      .values({ code: `T2_${tag}`, name: `Bàn 02_${tag}`, areaId: testAreaId, capacity: 4, status: "DANG_DUNG" })
      .returning();
    occupiedTableId = t2.id;

    // Create Open Shift for cashierUserId
    const [shift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_${tag}`,
        cashierId: cashierUserId,
        initialCash: 500000,
        status: "DANG_MO",
      })
      .returning();
    testShiftId = shift.id;
  });

  afterAll(async () => {
    if (db) {
      if (emptyTableId) await db.delete(schema.orders).where(eq(schema.orders.tableId, emptyTableId));
      if (testShiftId) await db.delete(schema.orders).where(eq(schema.orders.shiftId, testShiftId));
      if (testShiftId) await db.delete(schema.shifts).where(eq(schema.shifts.id, testShiftId));
      if (testAreaId) await db.delete(schema.tables).where(eq(schema.tables.areaId, testAreaId));
      if (testAreaId) await db.delete(schema.areas).where(eq(schema.areas.id, testAreaId));
      if (cashierUserId) await db.delete(schema.users).where(eq(schema.users.id, cashierUserId));
      if (otherCashierUserId) await db.delete(schema.users).where(eq(schema.users.id, otherCashierUserId));
      if (waiterUserId) await db.delete(schema.users).where(eq(schema.users.id, waiterUserId));
    }
    await pool.end();
  });

  it("returns 401 when request is not authenticated", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId: emptyTableId }),
    });
    const res = await createOrderHandler(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for null body or invalid tableId", async () => {
    const badJsonReq = new NextRequest("http://localhost:3000/api/v1/orders", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: "not json",
    });
    expect((await createOrderHandler(badJsonReq)).status).toBe(400);

    const invalidIdReq = new NextRequest("http://localhost:3000/api/v1/orders", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tableId: -99 }),
    });
    expect((await createOrderHandler(invalidIdReq)).status).toBe(400);
  });

  it("returns 400 with verbatim ERR-01 when user has no active open shift", async () => {
    // otherCashier has no open shift
    const req = new NextRequest("http://localhost:3000/api/v1/orders", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${otherCashierToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tableId: emptyTableId }),
    });
    const res = await createOrderHandler(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("ERR-01");
    expect(json.error).toBe(ERROR_CATALOG.ERR_01.message);
  });

  it("AC-02-1: selects empty table, opens order with empty cart and updates table to DANG_DUNG", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/orders", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tableId: emptyTableId }),
    });

    const res = await createOrderHandler(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.orderCode).toMatch(/^HD-\d{8}-\d{4}$/);
    expect(json.data.tableId).toBe(emptyTableId);
    expect(json.data.status).toBe("DANG_PHUC_VU");
    expect(json.data.totalAmount).toBe(0);
    expect(json.data.items).toEqual([]);

    // Check table status in DB
    const [t1] = await db.select().from(schema.tables).where(eq(schema.tables.id, emptyTableId));
    expect(t1.status).toBe("DANG_DUNG");

    // Verify GET /api/v1/orders/:id returns the created order
    const getReq = new NextRequest(`http://localhost:3000/api/v1/orders/${json.data.id}`, {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });
    const getRes = await getOrderHandler(getReq, { params: Promise.resolve({ id: String(json.data.id) }) });
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.data.id).toBe(json.data.id);
    expect(getJson.data.items).toEqual([]);
  });

  it("BR-02: rejects opening a new order on an occupied table with 409", async () => {
    // emptyTableId is now DANG_DUNG from the previous test
    const req1 = new NextRequest("http://localhost:3000/api/v1/orders", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tableId: emptyTableId }),
    });
    const res1 = await createOrderHandler(req1);
    expect(res1.status).toBe(409);

    // occupiedTableId was created with DANG_DUNG
    const req2 = new NextRequest("http://localhost:3000/api/v1/orders", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tableId: occupiedTableId }),
    });
    const res2 = await createOrderHandler(req2);
    expect(res2.status).toBe(409);
  });
});
