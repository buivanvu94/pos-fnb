import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql, eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { POST as transferHandler } from "@/app/api/v1/tables/transfer/route";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { getTestDbUrl } from "../setup/test-config";

describe("Table Transfer and Merge API - POST /api/v1/tables/transfer (API-03, US-04, FR-04, AC-04-1, AC-04-2, BR-02)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 10);
  const tag = rand();

  let waiterToken: string;
  let testAreaId: number;
  let table01Id: number;
  let table02Id: number;
  let table05Id: number;
  let tableWaitingId: number;
  let testShiftId: number;
  let testUserId: number;

  let order01Id: number;
  let order02Id: number;
  let orderWaitingId: number;
  let menuItemAId: number;
  let menuItemBId: number;
  let toppingId: number;

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const [user] = await db
      .insert(schema.users)
      .values({ username: `u_${tag}`, passwordHash: "dummy", fullName: "User", role: "THU_NGAN" })
      .returning();
    testUserId = user.id;

    waiterToken = await signAuthToken({ userId: 994, username: `w_${tag}`, fullName: "Phục Vụ", role: "PHUC_VU" });

    const [area] = await db
      .insert(schema.areas)
      .values({ code: `AR_${tag}`, name: `Area ${tag}` })
      .returning();
    testAreaId = area.id;

    // Create tables (code <= 20 chars)
    const [t1] = await db
      .insert(schema.tables)
      .values({ code: `T1_${tag}`, name: `Bàn 01_${tag}`, areaId: testAreaId, capacity: 4, status: "DANG_DUNG" })
      .returning();
    table01Id = t1.id;

    const [t2] = await db
      .insert(schema.tables)
      .values({ code: `T2_${tag}`, name: `Bàn 02_${tag}`, areaId: testAreaId, capacity: 4, status: "DANG_DUNG" })
      .returning();
    table02Id = t2.id;

    const [t5] = await db
      .insert(schema.tables)
      .values({ code: `T5_${tag}`, name: `Bàn 05_${tag}`, areaId: testAreaId, capacity: 4, status: "TRONG" })
      .returning();
    table05Id = t5.id;

    const [tw] = await db
      .insert(schema.tables)
      .values({ code: `TW_${tag}`, name: `Bàn Chờ_${tag}`, areaId: testAreaId, capacity: 4, status: "CHO_THANH_TOAN" })
      .returning();
    tableWaitingId = tw.id;

    const [shift] = await db
      .insert(schema.shifts)
      .values({ shiftCode: `CA_${tag}`, cashierId: testUserId, initialCash: 100000, status: "DANG_MO" })
      .returning();
    testShiftId = shift.id;

    const [cat] = await db
      .insert(schema.categories)
      .values({ code: `C_${tag}`, name: "Cat" })
      .returning();

    const [mA] = await db
      .insert(schema.menuItems)
      .values({ code: `MA_${tag}`, categoryId: cat.id, name: "Món A", price: 50000, status: "DANG_BAN" })
      .returning();
    menuItemAId = mA.id;

    const [mB] = await db
      .insert(schema.menuItems)
      .values({ code: `MB_${tag}`, categoryId: cat.id, name: "Món B", price: 100000, status: "DANG_BAN" })
      .returning();
    menuItemBId = mB.id;

    const [top] = await db
      .insert(schema.toppings)
      .values({ name: "Topping Thêm", price: 10000 })
      .returning();
    toppingId = top.id;

    // Order 01: 3 items totaling 150k
    const [ord1] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD1_${tag}`,
        orderType: "TAI_BAN",
        tableId: table01Id,
        shiftId: testShiftId,
        totalAmount: 150000,
        finalAmount: 150000,
        status: "DANG_PHUC_VU",
        version: 1,
      })
      .returning();
    order01Id = ord1.id;

    await db.insert(schema.orderItems).values([
      { orderId: order01Id, menuItemId: menuItemAId, quantity: 1, unitPrice: 50000 },
      { orderId: order01Id, menuItemId: menuItemAId, quantity: 1, unitPrice: 50000 },
      { orderId: order01Id, menuItemId: menuItemAId, quantity: 1, unitPrice: 50000 },
    ]);

    // Order 02: 2 items totaling 200k
    const [ord2] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD2_${tag}`,
        orderType: "TAI_BAN",
        tableId: table02Id,
        shiftId: testShiftId,
        totalAmount: 200000,
        finalAmount: 200000,
        status: "DANG_PHUC_VU",
        version: 1,
      })
      .returning();
    order02Id = ord2.id;

    await db.insert(schema.orderItems).values([
      { orderId: order02Id, menuItemId: menuItemBId, quantity: 1, unitPrice: 100000 },
      { orderId: order02Id, menuItemId: menuItemBId, quantity: 1, unitPrice: 100000 },
    ]);

    // Order Waiting: 1 item 50k
    const [ordW] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HDW_${tag}`,
        orderType: "TAI_BAN",
        tableId: tableWaitingId,
        shiftId: testShiftId,
        totalAmount: 50000,
        finalAmount: 50000,
        status: "DANG_PHUC_VU",
        version: 1,
      })
      .returning();
    orderWaitingId = ordW.id;

    await db.insert(schema.orderItems).values([
      { orderId: orderWaitingId, menuItemId: menuItemAId, quantity: 1, unitPrice: 50000 },
    ]);
  });

  afterAll(async () => {
    if (db) {
      await db.delete(schema.orderItemToppings).where(sql`1 = 1`);
      if (order01Id && order02Id && orderWaitingId) {
        await db.delete(schema.orderItems).where(inArray(schema.orderItems.orderId, [order01Id, order02Id, orderWaitingId]));
        await db.delete(schema.orders).where(inArray(schema.orders.id, [order01Id, order02Id, orderWaitingId]));
      }
      if (testShiftId) await db.delete(schema.shifts).where(eq(schema.shifts.id, testShiftId));
      if (testAreaId) {
        await db.delete(schema.tables).where(eq(schema.tables.areaId, testAreaId));
        await db.delete(schema.areas).where(eq(schema.areas.id, testAreaId));
      }
      if (toppingId) await db.delete(schema.toppings).where(eq(schema.toppings.id, toppingId));
      if (menuItemAId && menuItemBId) {
        await db.delete(schema.menuItems).where(inArray(schema.menuItems.id, [menuItemAId, menuItemBId]));
      }
      if (testUserId) await db.delete(schema.users).where(eq(schema.users.id, testUserId));
    }
    await pool.end();
  });

  it("rejects transfer when destination table is already occupied with 409", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/tables/transfer", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        banNguonId: table01Id,
        banDichId: table02Id,
        loai: "CHUYEN",
      }),
    });

    const res = await transferHandler(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain("Bàn đích đang có khách");
  });

  it("AC-04-1: transfers 3 items from Table 01 to Table 05 (empty); Table 05 becomes DANG_DUNG, Table 01 becomes TRONG", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/tables/transfer", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        banNguonId: table01Id,
        banDichId: table05Id,
        loai: "CHUYEN",
      }),
    });

    const res = await transferHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.loai).toBe("CHUYEN");

    const [t1] = await db.select().from(schema.tables).where(eq(schema.tables.id, table01Id));
    expect(t1.status).toBe("TRONG");

    const [t5] = await db.select().from(schema.tables).where(eq(schema.tables.id, table05Id));
    expect(t5.status).toBe("DANG_DUNG");

    const [o1] = await db.select().from(schema.orders).where(eq(schema.orders.id, order01Id));
    expect(o1.tableId).toBe(table05Id);

    const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order01Id));
    expect(items).toHaveLength(3);
  });

  it("AC-04-2: merges Table 02 (200k) into Table 05 (150k); Table 05 now has 5 items totaling 350.000 VNĐ, Table 02 becomes TRONG", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/tables/transfer", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        banNguonId: table02Id,
        banDichId: table05Id,
        loai: "GOP",
      }),
    });

    const res = await transferHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.loai).toBe("GOP");
    expect(json.data.totalAmount).toBe(350000);

    const [t2] = await db.select().from(schema.tables).where(eq(schema.tables.id, table02Id));
    expect(t2.status).toBe("TRONG");

    const [t5] = await db.select().from(schema.tables).where(eq(schema.tables.id, table05Id));
    expect(t5.status).toBe("DANG_DUNG");

    const [destOrder] = await db.select().from(schema.orders).where(eq(schema.orders.id, order01Id));
    expect(destOrder.totalAmount).toBe(350000);
    expect(destOrder.finalAmount).toBe(350000);

    const [srcOrder] = await db.select().from(schema.orders).where(eq(schema.orders.id, order02Id));
    expect(srcOrder.status).toBe("DA_GOP");
    expect(srcOrder.tableId).toBeNull();

    const mergedItems = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order01Id));
    expect(mergedItems).toHaveLength(5);
  });

  it("merges into table in CHO_THANH_TOAN and reverts destination table to DANG_DUNG", async () => {
    const [twBefore] = await db.select().from(schema.tables).where(eq(schema.tables.id, tableWaitingId));
    expect(twBefore.status).toBe("CHO_THANH_TOAN");

    const req = new NextRequest("http://localhost:3000/api/v1/tables/transfer", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        banNguonId: table05Id,
        banDichId: tableWaitingId,
        loai: "GOP",
      }),
    });

    const res = await transferHandler(req);
    expect(res.status).toBe(200);

    const [twAfter] = await db.select().from(schema.tables).where(eq(schema.tables.id, tableWaitingId));
    expect(twAfter.status).toBe("DANG_DUNG");

    const [wOrder] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderWaitingId));
    expect(wOrder.totalAmount).toBe(400000);

    const [t5] = await db.select().from(schema.tables).where(eq(schema.tables.id, table05Id));
    expect(t5.status).toBe("TRONG");
  });
});
