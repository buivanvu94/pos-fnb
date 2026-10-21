import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "@/db/schema";
import { POST as discountHandler } from "@/app/api/v1/orders/[id]/discount/route";
import { POST as modifyOrderItemsHandler } from "@/app/api/v1/orders/[id]/items/route";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { getTestDbUrl } from "../setup/test-config";

describe("Order Discount API - POST /api/v1/orders/:id/discount (FR-10, BR-03, SRS 2.5)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 10);
  const tag = rand();

  let managerId: number;
  let managerToken: string;
  let cashierId: number;
  let cashierToken: string;
  let waiterId: number;
  let waiterToken: string;

  let areaId: number;
  let shiftId: number;
  let categoryId: number;
  let menuItemId: number;

  const CORRECT_PIN = "8472";
  const WRONG_PIN = "0000";

  async function createTestOrder(totalAmount = 100000) {
    const [table] = await db
      .insert(schema.tables)
      .values({ code: `T_${rand()}`, name: `Bàn_${rand()}`, areaId, capacity: 4, status: "DANG_DUNG" })
      .returning();

    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_${rand()}`,
        tableId: table.id,
        shiftId,
        totalAmount,
        finalAmount: totalAmount,
        discountAmount: 0,
        status: "DANG_PHUC_VU",
        version: 1,
      })
      .returning();

    return { table, order };
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const pinHash = await bcrypt.hash(CORRECT_PIN, 10);

    const [manager] = await db
      .insert(schema.users)
      .values({
        username: `mgr_disc_${tag}`,
        fullName: "Quản Lý Test Giảm Giá",
        role: "QUAN_LY",
        passwordHash: "dummy",
        pinHash,
      })
      .returning();
    managerId = manager.id;
    managerToken = await signAuthToken({
      userId: manager.id,
      username: manager.username,
      fullName: manager.fullName,
      role: "QUAN_LY",
    });

    const [cashier] = await db
      .insert(schema.users)
      .values({
        username: `csh_disc_${tag}`,
        fullName: "Thu Ngân Test Giảm Giá",
        role: "THU_NGAN",
        passwordHash: "dummy",
      })
      .returning();
    cashierId = cashier.id;
    cashierToken = await signAuthToken({
      userId: cashier.id,
      username: cashier.username,
      fullName: cashier.fullName,
      role: "THU_NGAN",
    });

    const [waiter] = await db
      .insert(schema.users)
      .values({
        username: `wtr_disc_${tag}`,
        fullName: "Phục Vụ Test Giảm Giá",
        role: "PHUC_VU",
        passwordHash: "dummy",
      })
      .returning();
    waiterId = waiter.id;
    waiterToken = await signAuthToken({
      userId: waiter.id,
      username: waiter.username,
      fullName: waiter.fullName,
      role: "PHUC_VU",
    });

    const [area] = await db.insert(schema.areas).values({ code: `A_D_${tag}`, name: `Area D ${tag}` }).returning();
    areaId = area.id;

    const [shift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_D_${tag}`,
        cashierId: cashier.id,
        initialCash: 1000000,
        expectedCash: 1000000,
        status: "DANG_MO",
      })
      .returning();
    shiftId = shift.id;

    const [cat] = await db
      .insert(schema.categories)
      .values({ code: `CAT_D_${tag}`, name: `Cat D ${tag}` })
      .returning();
    categoryId = cat.id;

    const [mItem] = await db
      .insert(schema.menuItems)
      .values({
        code: `MON_D_${tag}`,
        categoryId: cat.id,
        name: "Lẩu thái chua cay",
        price: 50000,
        targetPrinter: "KITCHEN",
      })
      .returning();
    menuItemId = mItem.id;
  });

  afterAll(async () => {
    if (db) {
      await db.delete(schema.orderItems).where(eq(schema.orderItems.menuItemId, menuItemId));
      await db.delete(schema.orders).where(eq(schema.orders.shiftId, shiftId));
      await db.delete(schema.menuItems).where(eq(schema.menuItems.categoryId, categoryId));
      await db.delete(schema.categories).where(eq(schema.categories.id, categoryId));
      await db.delete(schema.tables).where(eq(schema.tables.areaId, areaId));
      await db.delete(schema.areas).where(eq(schema.areas.id, areaId));
      await db.delete(schema.shifts).where(eq(schema.shifts.id, shiftId));
      await db.delete(schema.auditLogs).where(eq(schema.auditLogs.userId, waiterId));
      await db.delete(schema.auditLogs).where(eq(schema.auditLogs.userId, cashierId));
      await db.delete(schema.auditLogs).where(eq(schema.auditLogs.userId, managerId));
      await db.delete(schema.users).where(eq(schema.users.id, waiterId));
      await db.delete(schema.users).where(eq(schema.users.id, cashierId));
      await db.delete(schema.users).where(eq(schema.users.id, managerId));
    }
    await pool.end();
  });

  it("applies fixed amount discount (20,000 VND) with THU_NGAN and valid Manager PIN", async () => {
    const { order } = await createTestOrder(100000);

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/discount`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        amount: 20000,
        lyDo: "Khách quen giảm giá sinh nhật",
        pinCode: CORRECT_PIN,
        expectedVersion: 1,
      }),
    });

    const res = await discountHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.totalAmount).toBe(100000);
    expect(body.data.discountAmount).toBe(20000);
    expect(body.data.finalAmount).toBe(80000);

    // Verify discount_percent is null on fixed amount discounts
    const [dbOrder] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
    expect(dbOrder.discountPercent).toBeNull();

    const audit = await db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.action, "DISCOUNT"), eq(schema.auditLogs.entityId, String(order.id))));
    expect(audit.length).toBe(1);
    expect(audit[0].reason).toBe("Khách quen giảm giá sinh nhật");
    const meta = JSON.parse(audit[0].metadata!);
    expect(meta.approverId).toBe(managerId);
    expect(meta.discountAmount).toBe(20000);
  });

  it("requires expectedVersion and returns 409 on version mismatch", async () => {
    const { order } = await createTestOrder(100000);

    // Missing expectedVersion -> 400
    const missingReq = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/discount`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
      },
      body: JSON.stringify({
        percent: 10,
        lyDo: "Giảm giá thiếu expectedVersion",
      }),
    });
    const missingRes = await discountHandler(missingReq, { params: Promise.resolve({ id: String(order.id) }) });
    expect(missingRes.status).toBe(400);

    // Mismatched expectedVersion -> 409
    const mismatchReq = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/discount`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
      },
      body: JSON.stringify({
        percent: 10,
        lyDo: "Giảm giá sai expectedVersion",
        expectedVersion: 999,
      }),
    });
    const mismatchRes = await discountHandler(mismatchReq, { params: Promise.resolve({ id: String(order.id) }) });
    expect(mismatchRes.status).toBe(409);
  });

  it("returns 400 when both amount and percent are provided simultaneously", async () => {
    const { order } = await createTestOrder(100000);

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/discount`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
      },
      body: JSON.stringify({
        amount: 10000,
        percent: 10,
        lyDo: "Giảm giá đồng thời cả hai loại",
        expectedVersion: 1,
      }),
    });

    const res = await discountHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Không thể áp dụng đồng thời cả số tiền và phần trăm");
  });

  it("applies percentage discount (15%) with QUAN_LY and persists discount_percent column", async () => {
    const { order } = await createTestOrder(200000);

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/discount`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
      },
      body: JSON.stringify({
        percent: 15,
        lyDo: "Quản lý duyệt chiết khấu 15%",
        expectedVersion: 1,
      }),
    });

    const res = await discountHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.discountAmount).toBe(30000);
    expect(body.data.finalAmount).toBe(170000);

    const [updatedOrder] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
    expect(updatedOrder.discountAmount).toBe(30000);
    expect(updatedOrder.discountPercent).toBe(15);
    expect(updatedOrder.finalAmount).toBe(170000);
  });

  it("blocks PHUC_VU with 403 even when reason is under 5 chars (can check takes precedence)", async () => {
    const { order } = await createTestOrder(100000);

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/discount`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
      },
      body: JSON.stringify({
        amount: 10000,
        lyDo: "Ngắn", // Only 4 chars
        pinCode: CORRECT_PIN,
        expectedVersion: 1,
      }),
    });

    const res = await discountHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    // Must return 403 Forbidden, NOT 400 Bad Request
    expect(res.status).toBe(403);
  });

  it("recalculates percentage discount accurately when adding items subsequently", async () => {
    const { order } = await createTestOrder(100000);

    // 1. Add 2 items (100,000)
    await db.insert(schema.orderItems).values({
      orderId: order.id,
      menuItemId,
      quantity: 2,
      unitPrice: 50000,
      isPrintedKitchen: false,
    });

    // 2. Apply 20% discount on order (100,000 * 20% = 20,000; final = 80,000)
    const discountReq = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/discount`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
      },
      body: JSON.stringify({
        percent: 20,
        lyDo: "Giảm giá 20% tổng bill",
        expectedVersion: 1,
      }),
    });
    const discountRes = await discountHandler(discountReq, { params: Promise.resolve({ id: String(order.id) }) });
    expect(discountRes.status).toBe(200);

    // 3. Add 1 more item (50,000) -> new total should be 150,000, new 20% discount should be 30,000!
    const addReq = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        menuItemId,
        quantity: 1,
        expectedVersion: 2,
      }),
    });

    const addRes = await modifyOrderItemsHandler(addReq, { params: Promise.resolve({ id: String(order.id) }) });
    expect(addRes.status).toBe(200);

    const addBody = await addRes.json();
    expect(addBody.data.totalAmount).toBe(150000);
    expect(addBody.data.discountAmount).toBe(30000); // 20% of 150,000
    expect(addBody.data.finalAmount).toBe(120000);
  });

  it("handles edge case: empty order discounted 10% (0 VND) maintains 10% discount when items added later", async () => {
    const { order } = await createTestOrder(0);

    // Apply 10% discount on empty order (total = 0, discount = 0)
    const discountReq = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/discount`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
      },
      body: JSON.stringify({
        percent: 10,
        lyDo: "Giảm giá 10% cho đơn mới mở",
        expectedVersion: 1,
      }),
    });
    const discountRes = await discountHandler(discountReq, { params: Promise.resolve({ id: String(order.id) }) });
    expect(discountRes.status).toBe(200);

    // Now add 2 items (100,000 total) -> discount should become 10,000!
    const addReq = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        menuItemId,
        quantity: 2,
        expectedVersion: 2,
      }),
    });

    const addRes = await modifyOrderItemsHandler(addReq, { params: Promise.resolve({ id: String(order.id) }) });
    expect(addRes.status).toBe(200);

    const addBody = await addRes.json();
    expect(addBody.data.totalAmount).toBe(100000);
    expect(addBody.data.discountAmount).toBe(10000); // 10% of 100,000
    expect(addBody.data.finalAmount).toBe(90000);
  });

  it("Item 3b: rejects discount when THU_NGAN uses 4-character reason with 400 Bad Request", async () => {
    const { order } = await createTestOrder(100000);

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/discount`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        amount: 10000,
        lyDo: "1234", // Exactly 4 chars
        pinCode: CORRECT_PIN,
        expectedVersion: 1,
      }),
    });

    const res = await discountHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("tối thiểu 5 ký tự");
  });

  it("Item 3c: never leaks PIN in response body, stdout, stderr, or console logs for valid or invalid PIN", async () => {
    const logSpy = vi.spyOn(console, "log");
    const errorSpy = vi.spyOn(console, "error");
    const warnSpy = vi.spyOn(console, "warn");
    const infoSpy = vi.spyOn(console, "info");

    const { order } = await createTestOrder(100000);

    // 1. Wrong PIN
    const reqWrong = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/discount`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
      body: JSON.stringify({
        amount: 10000,
        pinCode: WRONG_PIN,
        lyDo: "Thử sai mã PIN",
        expectedVersion: 1,
      }),
    });
    const resWrong = await discountHandler(reqWrong, { params: Promise.resolve({ id: String(order.id) }) });
    const wrongText = await resWrong.text();
    expect(wrongText).not.toContain(WRONG_PIN);

    // 2. Correct PIN
    const reqCorrect = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/discount`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
      body: JSON.stringify({
        amount: 10000,
        pinCode: CORRECT_PIN,
        lyDo: "Giảm giá với mã PIN đúng",
        expectedVersion: 1,
      }),
    });
    const resCorrect = await discountHandler(reqCorrect, { params: Promise.resolve({ id: String(order.id) }) });
    const correctText = await resCorrect.text();
    expect(correctText).not.toContain(CORRECT_PIN);

    for (const spy of [logSpy, errorSpy, warnSpy, infoSpy]) {
      for (const call of spy.mock.calls) {
        const str = JSON.stringify(call);
        expect(str).not.toContain(CORRECT_PIN);
        expect(str).not.toContain(WRONG_PIN);
      }
      spy.mockRestore();
    }
  });
});

