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

describe("Order Items API - POST /api/v1/orders/:id/items", () => {
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
  let waiterUserId: number;
  let testOrderId: number;
  let waitingOrderId: number;

  let cfSuaItemId: number;
  let hetHangItemId: number;
  let luxuryItemId: number;
  let thachCpToppingId: number;
  let inactiveToppingId: number;

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const [cashier] = await db
      .insert(schema.users)
      .values({ username: `u_${tag}`, passwordHash: "dummy", fullName: "User", role: "THU_NGAN" })
      .returning();
    testUserId = cashier.id;

    const [waiter] = await db
      .insert(schema.users)
      .values({ username: `w_${tag}`, passwordHash: "dummy", fullName: "Phục Vụ", role: "PHUC_VU" })
      .returning();
    waiterUserId = waiter.id;

    waiterToken = await signAuthToken({ userId: waiter.id, username: waiter.username, fullName: waiter.fullName, role: "PHUC_VU" });

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

    const [cf] = await db
      .insert(schema.menuItems)
      .values({ code: `CF_${tag}`, categoryId: cat.id, name: "Cà phê sữa", price: 35000, status: "DANG_BAN" })
      .returning();
    cfSuaItemId = cf.id;

    const [hh] = await db
      .insert(schema.menuItems)
      .values({ code: `BO_${tag}`, categoryId: cat.id, name: "Sinh tố bơ", price: 45000, status: "HET_HANG" })
      .returning();
    hetHangItemId = hh.id;

    const [lux] = await db
      .insert(schema.menuItems)
      .values({ code: `LUX_${tag}`, categoryId: cat.id, name: "Rượu vang cao cấp", price: 5000000, status: "DANG_BAN" })
      .returning();
    luxuryItemId = lux.id;

    const [top1] = await db
      .insert(schema.toppings)
      .values({ name: "Thạch cà phê", price: 5000, isAvailable: true })
      .returning();
    thachCpToppingId = top1.id;

    const [top2] = await db
      .insert(schema.toppings)
      .values({ name: "Trân châu hoàng kim", price: 10000, isAvailable: false })
      .returning();
    inactiveToppingId = top2.id;
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
      if (thachCpToppingId && inactiveToppingId) {
        await db.delete(schema.toppings).where(inArray(schema.toppings.id, [thachCpToppingId, inactiveToppingId]));
      }
      if (cfSuaItemId && hetHangItemId && luxuryItemId) {
        await db.delete(schema.menuItems).where(inArray(schema.menuItems.id, [cfSuaItemId, hetHangItemId, luxuryItemId]));
      }
      if (testUserId && waiterUserId) {
        await db.delete(schema.users).where(inArray(schema.users.id, [testUserId, waiterUserId]));
      }
    }
    await pool.end();
  });

  it("requires expectedVersion in body: returns 400 when missing", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ menuItemId: cfSuaItemId, quantity: 1 }),
    });
    const res = await modifyItemsHandler(req, { params: Promise.resolve({ id: String(testOrderId) }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("expectedVersion");
  });

  it("blocks adding an out-of-stock (HET_HANG) item with verbatim ERR-07", async () => {
    const [ord] = await db.select().from(schema.orders).where(eq(schema.orders.id, testOrderId));
    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: ord.version, menuItemId: hetHangItemId, quantity: 1 }),
    });

    const res = await modifyItemsHandler(req, { params: Promise.resolve({ id: String(testOrderId) }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe(formatErr07("Sinh tố bơ"));
  });

  it("Item 1 (BLOCKER): rolls back fully when 2nd item is HET_HANG so 1st item is NOT saved", async () => {
    const [ord] = await db.select().from(schema.orders).where(eq(schema.orders.id, testOrderId));
    const countBefore = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, testOrderId));

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: ord.version,
        items: [
          { menuItemId: cfSuaItemId, quantity: 1, notes: "Rollback test 1" },
          { menuItemId: hetHangItemId, quantity: 1, notes: "Rollback test 2" },
        ],
      }),
    });

    const res = await modifyItemsHandler(req, { params: Promise.resolve({ id: String(testOrderId) }) });
    expect(res.status).toBe(400);

    // Verify 1st item was completely rolled back and does not exist in DB
    const countAfter = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, testOrderId));
    expect(countAfter.length).toBe(countBefore.length);
    const leakedItem = countAfter.find((i) => i.notes === "Rollback test 1");
    expect(leakedItem).toBeUndefined();
  });

  it("Item 1 (BLOCKER): rolls back fully when order total exceeds 2 billion VNĐ", async () => {
    const [ord] = await db.select().from(schema.orders).where(eq(schema.orders.id, testOrderId));
    const countBefore = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, testOrderId));

    // 500 * 5,000,000 = 2.5 billion VND > 2 billion limit
    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: ord.version,
        menuItemId: luxuryItemId,
        quantity: 500,
        notes: "Exceed ceiling",
      }),
    });

    const res = await modifyItemsHandler(req, { params: Promise.resolve({ id: String(testOrderId) }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("vượt quá giới hạn");

    const countAfter = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, testOrderId));
    expect(countAfter.length).toBe(countBefore.length);
  });

  it("adds items with toppings and notes, updating order version", async () => {
    const [ord] = await db.select().from(schema.orders).where(eq(schema.orders.id, testOrderId));
    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: ord.version,
        items: [
          { menuItemId: cfSuaItemId, quantity: 1, toppingIds: [thachCpToppingId], notes: "Ít ngọt" },
          { menuItemId: cfSuaItemId, quantity: 1, toppingIds: [thachCpToppingId], notes: "Ít ngọt" },
        ],
      }),
    });

    const res = await modifyItemsHandler(req, { params: Promise.resolve({ id: String(testOrderId) }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    const order = json.data;
    expect(order.items).toHaveLength(2);
    expect(order.totalAmount).toBe(80000);
    expect(order.version).toBe(ord.version + 1);
  });

  it("Item 6: checks HET_HANG when increasing quantity of existing item", async () => {
    const [ord] = await db.select().from(schema.orders).where(eq(schema.orders.id, testOrderId));
    const [targetItem] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, testOrderId)).limit(1);

    // Mark menuItem as HET_HANG
    await db.update(schema.menuItems).set({ status: "HET_HANG" }).where(eq(schema.menuItems.id, cfSuaItemId));

    // Increasing quantity must fail with ERR-07
    const increaseReq = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: ord.version,
        orderItemId: targetItem.id,
        quantity: targetItem.quantity + 1,
      }),
    });
    const incRes = await modifyItemsHandler(increaseReq, { params: Promise.resolve({ id: String(testOrderId) }) });
    expect(incRes.status).toBe(400);
    const incJson = await incRes.json();
    expect(incJson.error).toBe(formatErr07("Cà phê sữa"));

    // Keeping quantity or reducing must succeed
    const keepReq = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: ord.version,
        orderItemId: targetItem.id,
        quantity: targetItem.quantity,
      }),
    });
    const keepRes = await modifyItemsHandler(keepReq, { params: Promise.resolve({ id: String(testOrderId) }) });
    expect(keepRes.status).toBe(200);

    // Revert menuItem status back to DANG_BAN
    await db.update(schema.menuItems).set({ status: "DANG_BAN" }).where(eq(schema.menuItems.id, cfSuaItemId));
  });

  it("Item 7: updates item without menuItemId, clears notes with empty string, rejects isCancelled items", async () => {
    const [ord] = await db.select().from(schema.orders).where(eq(schema.orders.id, testOrderId));
    const [item] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, testOrderId));

    // Update quantity and clear notes without passing menuItemId
    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: ord.version,
        orderItemId: item.id,
        quantity: 3,
        notes: "",
      }),
    });
    const res = await modifyItemsHandler(req, { params: Promise.resolve({ id: String(testOrderId) }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    const updatedItem = json.data.items.find((i: any) => i.id === item.id);
    expect(updatedItem.quantity).toBe(3);
    expect(updatedItem.notes).toBeNull();

    // Cancel an item in DB and verify subsequent edit is rejected with 409
    await db.update(schema.orderItems).set({ isCancelled: true }).where(eq(schema.orderItems.id, item.id));

    const [freshOrd] = await db.select().from(schema.orders).where(eq(schema.orders.id, testOrderId));
    const cancelReq = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: freshOrd.version,
        orderItemId: item.id,
        quantity: 1,
      }),
    });
    const cancelRes = await modifyItemsHandler(cancelReq, { params: Promise.resolve({ id: String(testOrderId) }) });
    expect(cancelRes.status).toBe(409);

    // Restore item
    await db.update(schema.orderItems).set({ isCancelled: false }).where(eq(schema.orderItems.id, item.id));
  });

  it("Item 8: deduplicates toppingIds, rejects invalid or inactive toppings", async () => {
    const [ord] = await db.select().from(schema.orders).where(eq(schema.orders.id, testOrderId));

    // 1. Invalid topping ID -> 400
    const invalidTopReq = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: ord.version,
        menuItemId: cfSuaItemId,
        quantity: 1,
        toppingIds: [999999],
      }),
    });
    const invalidRes = await modifyItemsHandler(invalidTopReq, { params: Promise.resolve({ id: String(testOrderId) }) });
    expect(invalidRes.status).toBe(400);
    const invalidJson = await invalidRes.json();
    expect(invalidJson.error).toContain("Topping không tồn tại");

    // 2. Inactive topping -> 400
    const inactiveTopReq = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: ord.version,
        menuItemId: cfSuaItemId,
        quantity: 1,
        toppingIds: [inactiveToppingId],
      }),
    });
    const inactiveRes = await modifyItemsHandler(inactiveTopReq, { params: Promise.resolve({ id: String(testOrderId) }) });
    expect(inactiveRes.status).toBe(400);
    const inactiveJson = await inactiveRes.json();
    expect(inactiveJson.error).toContain("không còn hoạt động");

    // 3. Duplicate toppingIds -> deduplicates without error
    const dupTopReq = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: ord.version,
        menuItemId: cfSuaItemId,
        quantity: 1,
        toppingIds: [thachCpToppingId, thachCpToppingId],
        notes: "Deduplicate test",
      }),
    });
    const dupRes = await modifyItemsHandler(dupTopReq, { params: Promise.resolve({ id: String(testOrderId) }) });
    expect(dupRes.status).toBe(200);
    const dupJson = await dupRes.json();
    const createdItem = dupJson.data.items.find((i: any) => i.notes === "Deduplicate test");
    expect(createdItem.toppings).toHaveLength(1);
  });

  it("Item 9: rejects quantity exceeding 999 with 400", async () => {
    const [ord] = await db.select().from(schema.orders).where(eq(schema.orders.id, testOrderId));
    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: ord.version,
        menuItemId: cfSuaItemId,
        quantity: 1000,
      }),
    });
    const res = await modifyItemsHandler(req, { params: Promise.resolve({ id: String(testOrderId) }) });
    expect(res.status).toBe(400);
  });

  it("enforces optimistic locking: returns 409 when expectedVersion does not match", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: 9999,
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

    const [wOrd] = await db.select().from(schema.orders).where(eq(schema.orders.id, waitingOrderId));

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${waitingOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: wOrd.version,
        menuItemId: cfSuaItemId,
        quantity: 1,
      }),
    });

    const res = await modifyItemsHandler(req, { params: Promise.resolve({ id: String(waitingOrderId) }) });
    expect(res.status).toBe(200);

    const [tblAfter] = await db.select().from(schema.tables).where(eq(schema.tables.id, waitingTableId));
    expect(tblAfter.status).toBe("DANG_DUNG");
  });
});
