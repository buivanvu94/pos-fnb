import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "@/db/schema";
import { POST as cancelOrderHandler } from "@/app/api/v1/orders/[id]/cancel/route";
import { DELETE as deleteOrderHandler } from "@/app/api/v1/orders/[id]/route";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { ERROR_CATALOG } from "@/lib/error-catalog";
import { getTestDbUrl } from "../setup/test-config";

describe("Cancel Order API - POST /api/v1/orders/:id/cancel (FR-10, BR-03, BR-08)", () => {
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

  const CORRECT_PIN = "6789";
  const WRONG_PIN = "2222";

  async function createTestOrderWithPrintedItem(status: "DANG_PHUC_VU" | "DA_THANH_TOAN" = "DANG_PHUC_VU") {
    const [table] = await db
      .insert(schema.tables)
      .values({ code: `T_C_${rand()}`, name: `Bàn Hủy_${rand()}`, areaId, capacity: 4, status: "DANG_DUNG" })
      .returning();

    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_C_${rand()}`,
        tableId: table.id,
        shiftId,
        totalAmount: 60000,
        finalAmount: 60000,
        status,
        version: 1,
      })
      .returning();

    const [item] = await db
      .insert(schema.orderItems)
      .values({
        orderId: order.id,
        menuItemId,
        quantity: 1,
        unitPrice: 60000,
        isPrintedKitchen: true,
        sentAt: new Date(),
      })
      .returning();

    return { table, order, item };
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const pinHash = await bcrypt.hash(CORRECT_PIN, 10);

    const [manager] = await db
      .insert(schema.users)
      .values({
        username: `mgr_canc_${tag}`,
        fullName: "Quản Lý Test Hủy Đơn",
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
        username: `csh_canc_${tag}`,
        fullName: "Thu Ngân Test Hủy Đơn",
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
        username: `wtr_canc_${tag}`,
        fullName: "Phục Vụ Test Hủy Đơn",
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

    const [area] = await db.insert(schema.areas).values({ code: `A_C_${tag}`, name: `Area C ${tag}` }).returning();
    areaId = area.id;

    const [shift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_C_${tag}`,
        cashierId: cashier.id,
        initialCash: 1000000,
        expectedCash: 1000000,
        status: "DANG_MO",
      })
      .returning();
    shiftId = shift.id;

    const [cat] = await db
      .insert(schema.categories)
      .values({ code: `CAT_C_${tag}`, name: `Cat C ${tag}` })
      .returning();
    categoryId = cat.id;

    const [mItem] = await db
      .insert(schema.menuItems)
      .values({
        code: `MON_C_${tag}`,
        categoryId: cat.id,
        name: "Lẩu hải sản",
        price: 60000,
        targetPrinter: "KITCHEN",
      })
      .returning();
    menuItemId = mItem.id;
  });

  afterAll(async () => {
    if (db) {
      await db.delete(schema.printJobs).where(eq(schema.printJobs.status, "PENDING"));
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

  it("cancels active serving order with printed items using valid PIN, sets DA_HUY, resets table to TRONG, enqueues KOT_CANCEL, records audit", async () => {
    const { table, order, item } = await createTestOrderWithPrintedItem("DANG_PHUC_VU");

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        lyDo: "Khách có việc bận gấp xin hủy toàn bộ đơn",
        pinCode: CORRECT_PIN,
        expectedVersion: 1,
      }),
    });

    const res = await cancelOrderHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);

    // Verify order is DA_HUY
    const [updatedOrder] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
    expect(updatedOrder.status).toBe("DA_HUY");

    // Verify table returned to TRONG
    const [updatedTable] = await db.select().from(schema.tables).where(eq(schema.tables.id, table.id));
    expect(updatedTable.status).toBe("TRONG");

    // Verify item marked cancelled
    const [updatedItem] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, item.id));
    expect(updatedItem.isCancelled).toBe(true);

    // Verify KOT_CANCEL print job enqueued
    const printJobs = await db
      .select()
      .from(schema.printJobs)
      .where(and(eq(schema.printJobs.orderId, order.id), eq(schema.printJobs.jobType, "KOT_KITCHEN")));
    expect(printJobs.length).toBeGreaterThanOrEqual(1);
    const cancelJob = printJobs[printJobs.length - 1];
    const payload = JSON.parse(cancelJob.payload);
    expect(payload.kind).toBe("KOT_CANCEL");
    expect(payload.reason).toBe("Khách có việc bận gấp xin hủy toàn bộ đơn");

    // Verify CANCEL_ORDER audit log
    const auditEntries = await db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.action, "CANCEL_ORDER"), eq(schema.auditLogs.entityId, String(order.id))));
    expect(auditEntries.length).toBe(1);
    expect(auditEntries[0].reason).toBe("Khách có việc bận gấp xin hủy toàn bộ đơn");
  });

  it("rejects cancel order when order status is DA_THANH_TOAN with 409 Conflict", async () => {
    const { order } = await createTestOrderWithPrintedItem("DA_THANH_TOAN");

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
      },
      body: JSON.stringify({
        lyDo: "Cố hủy đơn đã thanh toán bằng route này",
        expectedVersion: 1,
      }),
    });

    const res = await cancelOrderHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("rejects cancel order when expectedVersion does not match with 409 Conflict", async () => {
    const { order } = await createTestOrderWithPrintedItem("DANG_PHUC_VU");

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
      },
      body: JSON.stringify({
        lyDo: "Hủy đơn với expectedVersion cũ",
        expectedVersion: 999, // Mismatched version
      }),
    });

    const res = await cancelOrderHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(409);
  });

  it("blocks PHUC_VU role from cancelling order with 403 Forbidden even with correct Manager PIN (SRS 2.5)", async () => {
    const { order } = await createTestOrderWithPrintedItem("DANG_PHUC_VU");

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
      },
      body: JSON.stringify({
        lyDo: "Phục vụ xin hủy đơn hàng này",
        pinCode: CORRECT_PIN,
        expectedVersion: 1,
      }),
    });

    const res = await cancelOrderHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(403);
  });

  it("retains empty order DELETE functionality without requiring PIN", async () => {
    const [table] = await db
      .insert(schema.tables)
      .values({ code: `T_EMP_${rand()}`, name: `Bàn Trống_${rand()}`, areaId, capacity: 4, status: "DANG_DUNG" })
      .returning();

    const [emptyOrder] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_EMP_${rand()}`,
        tableId: table.id,
        shiftId,
        totalAmount: 0,
        finalAmount: 0,
        status: "DANG_PHUC_VU",
        version: 1,
      })
      .returning();

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${emptyOrder.id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
      },
      body: JSON.stringify({ expectedVersion: 1 }),
    });

    const res = await deleteOrderHandler(req, { params: Promise.resolve({ id: String(emptyOrder.id) }) });
    expect(res.status).toBe(200);

    const [updatedOrder] = await db.select().from(schema.orders).where(eq(schema.orders.id, emptyOrder.id));
    expect(updatedOrder.status).toBe("DA_HUY");
  });
});
