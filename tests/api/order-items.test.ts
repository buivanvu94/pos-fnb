import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql, eq, and, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { POST as modifyItemsHandler } from "@/app/api/v1/orders/[id]/items/route";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { formatErr07 } from "@/lib/error-catalog";
import { getTestDbUrl } from "../setup/test-config";

describe("Order Items API - POST /api/v1/orders/:id/items (US-02, AC-02-2, AC-02-3, BR-09, ERR-07)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 10);
  const tag = rand();

  let waiterToken: string;
  let testAreaId: number;
  let testTableId: number;
  let waitingTableId: number;
  let testShiftId: number;
  let testUserId: number;
  let testOrderId: number;
  let waitingOrderId: number;

  let cfSuaItemId: number;
  let hetHangItemId: number;
  let thachCpToppingId: number;

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const [user] = await db
      .insert(schema.users)
      .values({ username: `u_${tag}`, passwordHash: "dummy", fullName: "User", role: "THU_NGAN" })
      .returning();
    testUserId = user.id;

    waiterToken = await signAuthToken({ userId: 992, username: `w_${tag}`, fullName: "Phục Vụ", role: "PHUC_VU" });

    const [area] = await db
      .insert(schema.areas)
      .values({ code: `AR_${tag}`, name: `Area ${tag}` })
      .returning();
    testAreaId = area.id;

    const [t1] = await db
      .insert(schema.tables)
      .values({ code: `T1_${tag}`, name: `Bàn 01_${tag}`, areaId: testAreaId, capacity: 4, status: "DANG_DUNG" })
      .returning();
    testTableId = t1.id;

    const [t2] = await db
      .insert(schema.tables)
      .values({ code: `T2_${tag}`, name: `Bàn 02_${tag}`, areaId: testAreaId, capacity: 4, status: "CHO_THANH_TOAN" })
      .returning();
    waitingTableId = t2.id;

    const [shift] = await db
      .insert(schema.shifts)
      .values({ shiftCode: `CA_${tag}`, cashierId: testUserId, initialCash: 100000, status: "DANG_MO" })
      .returning();
    testShiftId = shift.id;

    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD1_${tag}`,
        orderType: "TAI_BAN",
        tableId: testTableId,
        shiftId: testShiftId,
        totalAmount: 0,
        finalAmount: 0,
        status: "DANG_PHUC_VU",
        version: 1,
      })
      .returning();
    testOrderId = order.id;

    const [wOrder] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD2_${tag}`,
        orderType: "TAI_BAN",
        tableId: waitingTableId,
        shiftId: testShiftId,
        totalAmount: 50000,
        finalAmount: 50000,
        status: "DANG_PHUC_VU",
        version: 1,
      })
      .returning();
    waitingOrderId = wOrder.id;

    const [cat] = await db
      .insert(schema.categories)
      .values({ code: `C_${tag}`, name: "Đồ uống" })
      .returning();

    // Menu Item: Cà phê sữa (35.000đ)
    const [cf] = await db
      .insert(schema.menuItems)
      .values({
        code: `CF_${tag}`,
        categoryId: cat.id,
        name: "Cà phê sữa",
        price: 35000,
        status: "DANG_BAN",
      })
      .returning();
    cfSuaItemId = cf.id;

    // Menu Item: Sinh tố bơ (HET_HANG)
    const [hh] = await db
      .insert(schema.menuItems)
      .values({
        code: `BO_${tag}`,
        categoryId: cat.id,
        name: "Sinh tố bơ",
        price: 45000,
        status: "HET_HANG",
      })
      .returning();
    hetHangItemId = hh.id;

    // Topping: Thạch cà phê (5.000đ)
    const [top] = await db
      .insert(schema.toppings)
      .values({
        name: "Thạch cà phê",
        price: 5000,
      })
      .returning();
    thachCpToppingId = top.id;
  });

  afterAll(async () => {
    if (db) {
      await db.delete(schema.orderItemToppings).where(sql`1 = 1`);
      if (testOrderId && waitingOrderId) {
        await db.delete(schema.orderItems).where(inArray(schema.orderItems.orderId, [testOrderId, waitingOrderId]));
        await db.delete(schema.orders).where(inArray(schema.orders.id, [testOrderId, waitingOrderId]));
      }
      if (testShiftId) await db.delete(schema.shifts).where(eq(schema.shifts.id, testShiftId));
      if (testAreaId) {
        await db.delete(schema.tables).where(eq(schema.tables.areaId, testAreaId));
        await db.delete(schema.areas).where(eq(schema.areas.id, testAreaId));
      }
      if (thachCpToppingId) await db.delete(schema.toppings).where(eq(schema.toppings.id, thachCpToppingId));
      if (cfSuaItemId && hetHangItemId) {
        await db.delete(schema.menuItems).where(inArray(schema.menuItems.id, [cfSuaItemId, hetHangItemId]));
      }
      if (testUserId) await db.delete(schema.users).where(eq(schema.users.id, testUserId));
    }
    await pool.end();
  });

  it("AC-02-3 & ERR-07: blocks adding an out-of-stock (HET_HANG) item with verbatim ERR-07", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        menuItemId: hetHangItemId,
        quantity: 1,
      }),
    });

    const res = await modifyItemsHandler(req, { params: Promise.resolve({ id: String(testOrderId) }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe(formatErr07("Sinh tố bơ"));
    expect(json.error).toBe("Món Sinh tố bơ hiện đã hết. Vui lòng chọn món khác!");
  });

  it("AC-02-2: adds 2 Cà phê sữa with topping Thạch cà phê and note 'Ít ngọt' across 2 lines with exact pricing", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: 1,
        items: [
          {
            menuItemId: cfSuaItemId,
            quantity: 1,
            toppingIds: [thachCpToppingId],
            notes: "Ít ngọt",
          },
          {
            menuItemId: cfSuaItemId,
            quantity: 1,
            toppingIds: [thachCpToppingId],
            notes: "Ít ngọt",
          },
        ],
      }),
    });

    const res = await modifyItemsHandler(req, { params: Promise.resolve({ id: String(testOrderId) }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    const order = json.data;
    expect(order.items).toHaveLength(2);

    for (const item of order.items) {
      expect(item.menuItemId).toBe(cfSuaItemId);
      expect(item.unitPrice).toBe(35000);
      expect(item.notes).toBe("Ít ngọt");
      expect(item.toppings).toHaveLength(1);
      expect(item.toppings[0].toppingName).toBe("Thạch cà phê");
      expect(item.toppings[0].toppingPrice).toBe(5000);
      expect(item.totalItemPrice).toBe(40000);
    }

    expect(order.totalAmount).toBe(80000);
    expect(order.finalAmount).toBe(80000);
    expect(order.version).toBe(2);
  });

  it("enforces optimistic locking: returns 409 when expectedVersion does not match", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: 1,
        menuItemId: cfSuaItemId,
        quantity: 1,
      }),
    });

    const res = await modifyItemsHandler(req, { params: Promise.resolve({ id: String(testOrderId) }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain("phiên làm việc khác");
  });

  it("reverts table status from CHO_THANH_TOAN to DANG_DUNG when adding items", async () => {
    const [tblBefore] = await db.select().from(schema.tables).where(eq(schema.tables.id, waitingTableId));
    expect(tblBefore.status).toBe("CHO_THANH_TOAN");

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${waitingOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        menuItemId: cfSuaItemId,
        quantity: 1,
      }),
    });

    const res = await modifyItemsHandler(req, { params: Promise.resolve({ id: String(waitingOrderId) }) });
    expect(res.status).toBe(200);

    const [tblAfter] = await db.select().from(schema.tables).where(eq(schema.tables.id, waitingTableId));
    expect(tblAfter.status).toBe("DANG_DUNG");
  });

  it("allows deleting unprinted items, but rejects deleting or modifying printed items with 409", async () => {
    const addReq = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        menuItemId: cfSuaItemId,
        quantity: 1,
        notes: "Xóa thử",
      }),
    });
    const addRes = await modifyItemsHandler(addReq, { params: Promise.resolve({ id: String(testOrderId) }) });
    const addJson = await addRes.json();
    const itemToDelete = addJson.data.items.find((i: any) => i.notes === "Xóa thử");
    expect(itemToDelete).toBeDefined();

    // 1. Delete unprinted item -> 200
    const delReq = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        orderItemId: itemToDelete.id,
      }),
    });
    const delRes = await modifyItemsHandler(delReq, { params: Promise.resolve({ id: String(testOrderId) }) });
    expect(delRes.status).toBe(200);

    // 2. Mark one item as printed
    const [existingItem] = await db
      .select()
      .from(schema.orderItems)
      .where(and(eq(schema.orderItems.orderId, testOrderId), eq(schema.orderItems.isCancelled, false)))
      .limit(1);

    await db
      .update(schema.orderItems)
      .set({ isPrintedKitchen: true })
      .where(eq(schema.orderItems.id, existingItem.id));

    // Try deleting printed item -> 409
    const delPrintedReq = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        orderItemId: existingItem.id,
      }),
    });
    const delPrintedRes = await modifyItemsHandler(delPrintedReq, { params: Promise.resolve({ id: String(testOrderId) }) });
    expect(delPrintedRes.status).toBe(409);
    const delPrintedJson = await delPrintedRes.json();
    expect(delPrintedJson.error).toContain("Không thể xóa món đã gửi bếp");
  });

  it("handles concurrent item additions without lost updates", async () => {
    const req1 = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ menuItemId: cfSuaItemId, quantity: 1, notes: "Concurrent 1" }),
    });

    const req2 = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ menuItemId: cfSuaItemId, quantity: 1, notes: "Concurrent 2" }),
    });

    const [res1, res2] = await Promise.all([
      modifyItemsHandler(req1, { params: Promise.resolve({ id: String(testOrderId) }) }),
      modifyItemsHandler(req2, { params: Promise.resolve({ id: String(testOrderId) }) }),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const allItems = await db
      .select()
      .from(schema.orderItems)
      .where(and(eq(schema.orderItems.orderId, testOrderId), eq(schema.orderItems.isCancelled, false)));

    const c1 = allItems.find((i) => i.notes === "Concurrent 1");
    const c2 = allItems.find((i) => i.notes === "Concurrent 2");
    expect(c1).toBeDefined();
    expect(c2).toBeDefined();
  });
});
