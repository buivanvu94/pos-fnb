import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { POST as sendKitchenHandler } from "@/app/api/v1/orders/[id]/send-kitchen/route";
import { DELETE as deleteOrderHandler } from "@/app/api/v1/orders/[id]/route";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { getTestDbUrl } from "../setup/test-config";

describe("Order Send Kitchen & Cancel API (FR-03, UC-02, DEC-07)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 10);
  const tag = rand();

  let waiterToken: string;
  let testAreaId: number;
  let testTableId: number;
  let emptyTableId: number;
  let testShiftId: number;
  let testUserId: number;
  let testOrderId: number;
  let emptyOrderId: number;

  let kitchenItemId: number;
  let barItemId: number;

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const [user] = await db
      .insert(schema.users)
      .values({ username: `u_${tag}`, passwordHash: "dummy", fullName: "User", role: "THU_NGAN" })
      .returning();
    testUserId = user.id;

    waiterToken = await signAuthToken({ userId: 993, username: `w_${tag}`, fullName: "Phục Vụ", role: "PHUC_VU" });

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
      .values({ code: `T2_${tag}`, name: `Bàn 02_${tag}`, areaId: testAreaId, capacity: 4, status: "DANG_DUNG" })
      .returning();
    emptyTableId = t2.id;

    const [shift] = await db
      .insert(schema.shifts)
      .values({ shiftCode: `CA_${tag}`, cashierId: testUserId, initialCash: 100000, status: "DANG_MO" })
      .returning();
    testShiftId = shift.id;

    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_${tag}`,
        orderType: "TAI_BAN",
        tableId: testTableId,
        shiftId: testShiftId,
        totalAmount: 100000,
        finalAmount: 100000,
        status: "DANG_PHUC_VU",
        version: 1,
      })
      .returning();
    testOrderId = order.id;

    const [eOrder] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HDE_${tag}`,
        orderType: "TAI_BAN",
        tableId: emptyTableId,
        shiftId: testShiftId,
        totalAmount: 0,
        finalAmount: 0,
        status: "DANG_PHUC_VU",
        version: 1,
      })
      .returning();
    emptyOrderId = eOrder.id;

    const [cat] = await db
      .insert(schema.categories)
      .values({ code: `C_${tag}`, name: "Thực đơn" })
      .returning();

    // Món Bếp (KITCHEN): Mì xào bò
    const [k] = await db
      .insert(schema.menuItems)
      .values({
        code: `MI_${tag}`,
        categoryId: cat.id,
        name: "Mì xào bò",
        price: 55000,
        targetPrinter: "KITCHEN",
        status: "DANG_BAN",
      })
      .returning();
    kitchenItemId = k.id;

    // Món Bar (BAR): Cà phê muối
    const [b] = await db
      .insert(schema.menuItems)
      .values({
        code: `CFM_${tag}`,
        categoryId: cat.id,
        name: "Cà phê muối",
        price: 35000,
        targetPrinter: "BAR",
        status: "DANG_BAN",
      })
      .returning();
    barItemId = b.id;

    await db.insert(schema.orderItems).values([
      { orderId: testOrderId, menuItemId: kitchenItemId, quantity: 1, unitPrice: 55000, isPrintedKitchen: false },
      { orderId: testOrderId, menuItemId: barItemId, quantity: 1, unitPrice: 35000, isPrintedKitchen: false },
    ]);
  });

  afterAll(async () => {
    if (db) {
      if (testOrderId && emptyOrderId) {
        await db.delete(schema.orderItems).where(inArray(schema.orderItems.orderId, [testOrderId, emptyOrderId]));
        await db.delete(schema.orders).where(inArray(schema.orders.id, [testOrderId, emptyOrderId]));
      }
      if (testShiftId) await db.delete(schema.shifts).where(eq(schema.shifts.id, testShiftId));
      if (testAreaId) {
        await db.delete(schema.tables).where(eq(schema.tables.areaId, testAreaId));
        await db.delete(schema.areas).where(eq(schema.areas.id, testAreaId));
      }
      if (kitchenItemId && barItemId) {
        await db.delete(schema.menuItems).where(inArray(schema.menuItems.id, [kitchenItemId, barItemId]));
      }
      if (testUserId) await db.delete(schema.users).where(eq(schema.users.id, testUserId));
    }
    await pool.end();
  });

  it("POST /send-kitchen: marks items as printed, records sentAt, and groups by KITCHEN & BAR", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/send-kitchen`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });

    const res = await sendKitchenHandler(req, { params: Promise.resolve({ id: String(testOrderId) }) });
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.data.orderId).toBe(testOrderId);
    expect(json.data.sentAt).toBeDefined();

    expect(json.data.items.kitchen).toHaveLength(1);
    expect(json.data.items.kitchen[0].name).toBe("Mì xào bò");

    expect(json.data.items.bar).toHaveLength(1);
    expect(json.data.items.bar[0].name).toBe("Cà phê muối");

    const itemsInDb = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, testOrderId));
    for (const it of itemsInDb) {
      expect(it.isPrintedKitchen).toBe(true);
      expect(it.sentAt).not.toBeNull();
    }
  });

  it("POST /send-kitchen: returns 409 when there are no new unprinted items", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}/send-kitchen`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });

    const res = await sendKitchenHandler(req, { params: Promise.resolve({ id: String(testOrderId) }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("Không có món mới để gửi bếp");
  });

  it("DELETE /orders/:id: rejects cancelling an order with printed items with 409", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${testOrderId}`, {
      method: "DELETE",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });

    const res = await deleteOrderHandler(req, { params: Promise.resolve({ id: String(testOrderId) }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain("Không thể hủy đơn đã có món gửi bếp");
  });

  it("DELETE /orders/:id: cancels empty order and returns table to TRONG", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${emptyOrderId}`, {
      method: "DELETE",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });

    const res = await deleteOrderHandler(req, { params: Promise.resolve({ id: String(emptyOrderId) }) });
    expect(res.status).toBe(200);

    const [tbl] = await db.select().from(schema.tables).where(eq(schema.tables.id, emptyTableId));
    expect(tbl.status).toBe("TRONG");

    const [ord] = await db.select().from(schema.orders).where(eq(schema.orders.id, emptyOrderId));
    expect(ord.status).toBe("DA_HUY");
  });
});
