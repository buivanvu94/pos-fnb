import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "@/db/schema";
import { POST as cancelOrderHandler } from "@/app/api/v1/orders/[id]/cancel/route";
import { DELETE as deleteOrderHandler } from "@/app/api/v1/orders/[id]/route";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
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

  const CORRECT_PIN = "7294";
  const WRONG_PIN = "0000";

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
        name: "Cơm chiên hải sản",
        price: 60000,
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
      await db.delete(schema.printJobs).where(inArray(schema.printJobs.jobType, ["KOT_KITCHEN", "KOT_BAR"]));
      await db.delete(schema.auditLogs).where(eq(schema.auditLogs.userId, waiterId));
      await db.delete(schema.auditLogs).where(eq(schema.auditLogs.userId, cashierId));
      await db.delete(schema.auditLogs).where(eq(schema.auditLogs.userId, managerId));
      await db.delete(schema.users).where(eq(schema.users.id, waiterId));
      await db.delete(schema.users).where(eq(schema.users.id, cashierId));
      await db.delete(schema.users).where(eq(schema.users.id, managerId));
    }
    await pool.end();
  });

  it("requires expectedVersion and rejects when expectedVersion is missing", async () => {
    const { order } = await createTestOrderWithPrintedItem();

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
      },
      body: JSON.stringify({
        lyDo: "Thiếu expectedVersion khi hủy đơn",
      }),
    });

    const res = await cancelOrderHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(400);
  });

  it("cancels order with printed item using THU_NGAN and valid Manager PIN, enqueues slip with approverName, and saves audit metadata", async () => {
    const { order, table, item } = await createTestOrderWithPrintedItem();

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

    const [updatedOrder] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
    expect(updatedOrder.status).toBe("DA_HUY");

    const [updatedTable] = await db.select().from(schema.tables).where(eq(schema.tables.id, table.id));
    expect(updatedTable.status).toBe("TRONG");

    const [updatedItem] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, item.id));
    expect(updatedItem.isCancelled).toBe(true);

    // Verify KOT_CANCEL print job enqueued with approverName
    const printJobs = await db
      .select()
      .from(schema.printJobs)
      .where(and(eq(schema.printJobs.orderId, order.id), eq(schema.printJobs.jobType, "KOT_KITCHEN")));
    expect(printJobs.length).toBeGreaterThanOrEqual(1);
    const cancelJob = printJobs[printJobs.length - 1];
    const payload = JSON.parse(cancelJob.payload);
    expect(payload.kind).toBe("KOT_CANCEL");
    expect(payload.reason).toBe("Khách có việc bận gấp xin hủy toàn bộ đơn");
    expect(payload.approverName).toBe("Quản Lý Test Hủy Đơn");
    expect(payload.cancelledByName).toBe("Thu Ngân Test Hủy Đơn");

    // Verify CANCEL_ORDER audit log has tableId, tableName, and items
    const [audit] = await db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.action, "CANCEL_ORDER"), eq(schema.auditLogs.entityId, String(order.id))));
    expect(audit).toBeDefined();
    expect(audit.reason).toBe("Khách có việc bận gấp xin hủy toàn bộ đơn");
    const meta = JSON.parse(audit.metadata!);
    expect(meta.tableId).toBe(table.id);
    expect(meta.tableName).toBe(table.name);
    expect(Array.isArray(meta.items)).toBe(true);
    expect(meta.items.length).toBe(1);
    expect(meta.items[0].name).toBe("Cơm chiên hải sản");
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

  it("blocks PHUC_VU role with 403 even when reason is under 5 chars", async () => {
    const { order } = await createTestOrderWithPrintedItem("DANG_PHUC_VU");

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
      },
      body: JSON.stringify({
        lyDo: "Hủy", // 3 chars
        pinCode: CORRECT_PIN,
        expectedVersion: 1,
      }),
    });

    const res = await cancelOrderHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(403);
  });

  it("retains empty order DELETE functionality and writes DELETE_EMPTY_ORDER audit log", async () => {
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

    // Verify DELETE_EMPTY_ORDER audit log
    const [audit] = await db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.action, "DELETE_EMPTY_ORDER"), eq(schema.auditLogs.entityId, String(emptyOrder.id))));
    expect(audit).toBeDefined();
    const meta = JSON.parse(audit.metadata!);
    expect(meta.orderCode).toBe(emptyOrder.orderCode);
    expect(meta.tableId).toBe(table.id);
  });

  it("Item 3b: rejects cancel order when THU_NGAN uses 4-character reason with 400 Bad Request", async () => {
    const { order } = await createTestOrderWithPrintedItem("DANG_PHUC_VU");

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        lyDo: "1234", // Exactly 4 chars
        pinCode: CORRECT_PIN,
        expectedVersion: 1,
      }),
    });

    const res = await cancelOrderHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
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

    const { order } = await createTestOrderWithPrintedItem("DANG_PHUC_VU");

    // 1. Wrong PIN
    const reqWrong = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
      body: JSON.stringify({
        lyDo: "Thử sai mã PIN",
        pinCode: WRONG_PIN,
        expectedVersion: 1,
      }),
    });
    const resWrong = await cancelOrderHandler(reqWrong, { params: Promise.resolve({ id: String(order.id) }) });
    const wrongText = await resWrong.text();
    expect(wrongText).not.toContain(WRONG_PIN);

    // 2. Correct PIN
    const reqCorrect = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
      body: JSON.stringify({
        lyDo: "Hủy đơn hợp lệ với mã PIN",
        pinCode: CORRECT_PIN,
        expectedVersion: 1,
      }),
    });
    const resCorrect = await cancelOrderHandler(reqCorrect, { params: Promise.resolve({ id: String(order.id) }) });
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



