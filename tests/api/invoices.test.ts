import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { inArray, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { GET as invoicesHandler } from "@/app/api/v1/invoices/route";

describe("Invoices API - GET /api/v1/invoices (FR-11, FR-14)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 8);
  const tag = rand();

  let managerUserId: number;
  let managerToken: string;
  let cashierUserId: number;
  let cashierToken: string;
  let otherCashierUserId: number;
  let otherCashierToken: string;
  let waiterUserId: number;
  let waiterToken: string;

  let shift1Id: number;
  let shift2Id: number;

  const createdOrderIds: number[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    // 1. Manager
    const [manager] = await db
      .insert(schema.users)
      .values({
        username: `mgr_inv_${tag}`,
        fullName: "Quản Lý Invoices",
        role: "QUAN_LY",
        passwordHash: "dummy",
      })
      .returning();
    managerUserId = manager.id;
    managerToken = await signAuthToken({
      userId: manager.id,
      username: manager.username,
      fullName: manager.fullName,
      role: "QUAN_LY",
    });

    // 2. Primary Cashier
    const [cashier] = await db
      .insert(schema.users)
      .values({
        username: `c1_inv_${tag}`,
        fullName: "Thu Ngân 1 Invoices",
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

    // 3. Other Cashier
    const [otherCashier] = await db
      .insert(schema.users)
      .values({
        username: `c2_inv_${tag}`,
        fullName: "Thu Ngân 2 Invoices",
        role: "THU_NGAN",
        passwordHash: "dummy",
      })
      .returning();
    otherCashierUserId = otherCashier.id;
    otherCashierToken = await signAuthToken({
      userId: otherCashier.id,
      username: otherCashier.username,
      fullName: otherCashier.fullName,
      role: "THU_NGAN",
    });

    // 4. Waiter
    const [waiter] = await db
      .insert(schema.users)
      .values({
        username: `w_inv_${tag}`,
        fullName: "Phục Vụ Invoices",
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

    // 5. Open Shifts for both cashiers
    const [s1] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_INV1_${tag}`,
        cashierId: cashierUserId,
        initialCash: 100_000,
        status: "DANG_MO",
      })
      .returning();
    shift1Id = s1.id;

    const [s2] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_INV2_${tag}`,
        cashierId: otherCashierUserId,
        initialCash: 100_000,
        status: "DANG_MO",
      })
      .returning();
    shift2Id = s2.id;

    // 6. Create 2 paid orders for Shift 1
    for (let i = 0; i < 2; i++) {
      const [o] = await db
        .insert(schema.orders)
        .values({
          orderCode: `HD_INV1_${rand()}`,
          orderType: "MANG_VE",
          shiftId: shift1Id,
          totalAmount: 50_000,
          discountAmount: 0,
          finalAmount: 50_000,
          status: "DA_THANH_TOAN",
          paidAt: new Date(),
          paymentMethod: "TIEN_MAT",
          createdById: cashierUserId,
        })
        .returning();
      createdOrderIds.push(o.id);
    }

    // 7. Create 1 paid order for Shift 2
    const [o2] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_INV2_${rand()}`,
        orderType: "MANG_VE",
        shiftId: shift2Id,
        totalAmount: 90_000,
        discountAmount: 0,
        finalAmount: 90_000,
        status: "DA_THANH_TOAN",
        paidAt: new Date(),
        paymentMethod: "TIEN_MAT",
        createdById: otherCashierUserId,
      })
      .returning();
    createdOrderIds.push(o2.id);
  });

  afterAll(async () => {
    if (db) {
      if (createdOrderIds.length > 0) {
        await db.delete(schema.orders).where(inArray(schema.orders.id, createdOrderIds));
      }
      await db.delete(schema.shifts).where(inArray(schema.shifts.id, [shift1Id, shift2Id]));
      await db.delete(schema.users).where(
        inArray(schema.users.id, [managerUserId, cashierUserId, otherCashierUserId, waiterUserId]),
      );
    }
    await pool.end();
  });

  it("restricts THU_NGAN to only see invoices from their own active shift", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/invoices?scope=shift", {
      method: "GET",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
    });

    const res = await invoicesHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.length).toBe(2);
    expect(json.data.every((inv: any) => inv.shiftId === shift1Id)).toBe(true);
  });

  it("allows QUAN_LY to see invoices from all open shifts", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/invoices?scope=shift", {
      method: "GET",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}` },
    });

    const res = await invoicesHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects PHUC_VU with 403 Forbidden", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/invoices?scope=shift", {
      method: "GET",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });

    const res = await invoicesHandler(req);
    expect(res.status).toBe(403);
  });

  it("guarantees no sensitive credentials (passwords, PINs) are exposed in invoice response", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/invoices?scope=shift", {
      method: "GET",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
    });

    const res = await invoicesHandler(req);
    const text = await res.text();
    expect(text).not.toContain("password");
    expect(text).not.toContain("pinHash");
    expect(text).not.toContain("passwordHash");
  });
});
