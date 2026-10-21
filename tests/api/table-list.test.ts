import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { GET as getTablesHandler } from "@/app/api/v1/tables/route";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { getTestDbUrl } from "../setup/test-config";

describe("Tables API - GET /api/v1/tables (FR-01, SRS 2.5)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 10);
  const tag = rand();

  let waiterToken: string;
  let cashierToken: string;
  let managerToken: string;

  let testAreaId: number;
  let table1Id: number;
  let table2Id: number;
  let table3Id: number;
  let testShiftId: number;
  let activeOrderId: number;
  let testUserId: number;

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    // 1. Create test users and tokens
    const [user] = await db
      .insert(schema.users)
      .values({
        username: `u_${tag}`,
        passwordHash: "dummy",
        fullName: "Table Test Cashier",
        role: "THU_NGAN",
      })
      .returning();
    testUserId = user.id;

    waiterToken = await signAuthToken({ userId: 101, username: `w_${tag}`, fullName: "Phục Vụ", role: "PHUC_VU" });
    cashierToken = await signAuthToken({ userId: user.id, username: user.username, fullName: user.fullName, role: "THU_NGAN" });
    managerToken = await signAuthToken({ userId: 102, username: `m_${tag}`, fullName: "Quản Lý", role: "QUAN_LY" });

    // 2. Create Area (code <= 20 chars)
    const [area] = await db
      .insert(schema.areas)
      .values({
        code: `AR_${tag}`,
        name: `Khu vực ${tag}`,
        displayOrder: 1,
      })
      .returning();
    testAreaId = area.id;

    // 3. Create Tables: Bàn 01 (TRONG), Bàn 02 (DANG_DUNG), Bàn 03 (CHO_THANH_TOAN)
    const [t1] = await db
      .insert(schema.tables)
      .values({
        code: `T1_${tag}`,
        name: `Bàn 01_${tag}`,
        areaId: testAreaId,
        capacity: 4,
        status: "TRONG",
      })
      .returning();
    table1Id = t1.id;

    const [t2] = await db
      .insert(schema.tables)
      .values({
        code: `T2_${tag}`,
        name: `Bàn 02_${tag}`,
        areaId: testAreaId,
        capacity: 2,
        status: "DANG_DUNG",
      })
      .returning();
    table2Id = t2.id;

    const [t3] = await db
      .insert(schema.tables)
      .values({
        code: `T3_${tag}`,
        name: `Bàn 03_${tag}`,
        areaId: testAreaId,
        capacity: 6,
        status: "CHO_THANH_TOAN",
      })
      .returning();
    table3Id = t3.id;

    // 4. Create Shift & Active Order for Bàn 02
    const [shift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_${tag}`,
        cashierId: testUserId,
        initialCash: 1000000,
        status: "DANG_MO",
      })
      .returning();
    testShiftId = shift.id;

    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_${tag}`,
        orderType: "TAI_BAN",
        tableId: table2Id,
        shiftId: testShiftId,
        totalAmount: 70000,
        finalAmount: 70000,
        status: "DANG_PHUC_VU",
      })
      .returning();
    activeOrderId = order.id;

    // 5. Create Category & Menu Item & Order Item
    const [cat] = await db
      .insert(schema.categories)
      .values({ code: `C_${tag}`, name: `Cat ${tag}` })
      .returning();

    const [item] = await db
      .insert(schema.menuItems)
      .values({
        code: `I_${tag}`,
        categoryId: cat.id,
        name: `Món ${tag}`,
        price: 35000,
        status: "DANG_BAN",
      })
      .returning();

    await db.insert(schema.orderItems).values({
      orderId: activeOrderId,
      menuItemId: item.id,
      quantity: 2,
      unitPrice: 35000,
    });
  });

  afterAll(async () => {
    if (db) {
      if (activeOrderId) await db.delete(schema.orderItems).where(eq(schema.orderItems.orderId, activeOrderId));
      if (activeOrderId) await db.delete(schema.orders).where(eq(schema.orders.id, activeOrderId));
      if (testShiftId) await db.delete(schema.orders).where(eq(schema.orders.shiftId, testShiftId));
      if (testShiftId) await db.delete(schema.shifts).where(eq(schema.shifts.id, testShiftId));
      if (testAreaId) await db.delete(schema.tables).where(eq(schema.tables.areaId, testAreaId));
      if (testAreaId) await db.delete(schema.areas).where(eq(schema.areas.id, testAreaId));
      if (testUserId) await db.delete(schema.users).where(eq(schema.users.id, testUserId));
    }
    await pool.end();
  });

  it("rejects unauthenticated request with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/tables");
    const res = await getTablesHandler(req);
    expect(res.status).toBe(401);
  });

  it("allows all authenticated roles (PHUC_VU, THU_NGAN, QUAN_LY) to view tables (FR-01)", async () => {
    for (const token of [waiterToken, cashierToken, managerToken]) {
      const req = new NextRequest("http://localhost:3000/api/v1/tables", {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${token}` },
      });
      const res = await getTablesHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    }
  });

  it("returns table statuses (TRONG, DANG_DUNG, CHO_THANH_TOAN) and active order details", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/tables", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });
    const res = await getTablesHandler(req);
    const json = await res.json();

    const t1 = json.data.find((t: any) => t.id === table1Id);
    expect(t1).toBeDefined();
    expect(t1.status).toBe("TRONG");
    expect(t1.activeOrderId).toBeNull();
    expect(t1.activeOrderTotal).toBe(0);

    const t2 = json.data.find((t: any) => t.id === table2Id);
    expect(t2).toBeDefined();
    expect(t2.status).toBe("DANG_DUNG");
    expect(t2.activeOrderId).toBe(activeOrderId);
    expect(t2.activeOrderTotal).toBe(70000);
    expect(t2.activeOrderItemCount).toBe(2);

    const t3 = json.data.find((t: any) => t.id === table3Id);
    expect(t3).toBeDefined();
    expect(t3.status).toBe("CHO_THANH_TOAN");
  });
});
