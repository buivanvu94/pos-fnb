import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "@/db/schema";
import { POST as discountHandler } from "@/app/api/v1/orders/[id]/discount/route";
import { POST as modifyOrderItemsHandler } from "@/app/api/v1/orders/[id]/items/route";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { ERROR_CATALOG } from "@/lib/error-catalog";
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

  const CORRECT_PIN = "4321";
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

  it("applies percentage discount (15%) with QUAN_LY without requiring PIN", async () => {
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
    expect(updatedOrder.finalAmount).toBe(170000);
  });

  it("blocks PHUC_VU from applying discount with 403 Forbidden even with correct Manager PIN (SRS 2.5)", async () => {
    const { order } = await createTestOrder(100000);

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/discount`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
      },
      body: JSON.stringify({
        amount: 10000,
        lyDo: "Phục vụ xin giảm giá cho khách",
        pinCode: CORRECT_PIN,
        expectedVersion: 1,
      }),
    });

    const res = await discountHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("rejects discount exceeding total order amount with 400 Bad Request and never negative final amount", async () => {
    const { order } = await createTestOrder(50000);

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/discount`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
      },
      body: JSON.stringify({
        amount: 60000, // exceeds total 50,000
        lyDo: "Giảm vượt quá tổng tiền hóa đơn",
        expectedVersion: 1,
      }),
    });

    const res = await discountHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("không được vượt quá tổng tiền");
  });

  it("recalculates percentage discount accurately when adding items subsequently", async () => {
    const { order } = await createTestOrder(100000);

    // 1. Add 1 item (50,000) to order so it has an actual order item
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
});
