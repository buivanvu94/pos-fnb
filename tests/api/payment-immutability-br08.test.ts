import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";

import { POST as modifyItemsHandler } from "@/app/api/v1/orders/[id]/items/route";
import { POST as discountHandler } from "@/app/api/v1/orders/[id]/discount/route";
import { POST as cancelOrderHandler } from "@/app/api/v1/orders/[id]/cancel/route";
import { POST as sendKitchenHandler } from "@/app/api/v1/orders/[id]/send-kitchen/route";
import { POST as provisionalPrintHandler } from "@/app/api/v1/orders/[id]/provisional-print/route";
import { POST as cashPaymentHandler } from "@/app/api/v1/payments/cash/route";

describe("Paid Order Immutability Enforcement (Rule BR-08)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 8);
  const tag = rand();

  let managerUserId: number;
  let managerToken: string;
  let testAreaId: number;
  let testShiftId: number;
  let testCategoryId: number;
  let testMenuItemId: number;
  let paidOrderId: number;
  let paidOrderItemId: number;

  const createdOrderIds: number[] = [];
  const createdTableIds: number[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const [manager] = await db
      .insert(schema.users)
      .values({
        username: `mgr_imm_${tag}`,
        fullName: "Quản Lý Immutability Test",
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

    const [area] = await db.insert(schema.areas).values({ code: `AR_IMM_${tag}`, name: `Khu Imm ${tag}` }).returning();
    testAreaId = area.id;

    const [table] = await db
      .insert(schema.tables)
      .values({
        code: `TB_IMM_${rand()}`,
        name: `Bàn Imm ${rand()}`,
        areaId: testAreaId,
        capacity: 4,
        status: "TRONG",
      })
      .returning();
    createdTableIds.push(table.id);

    const [shift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_IMM_${tag}`,
        cashierId: managerUserId,
        initialCash: 100_000,
        status: "DANG_MO",
      })
      .returning();
    testShiftId = shift.id;

    const [cat] = await db.insert(schema.categories).values({ code: `CAT_IMM_${tag}`, name: "Thực đơn Imm" }).returning();
    testCategoryId = cat.id;

    const [item] = await db
      .insert(schema.menuItems)
      .values({
        code: `MI_IMM_${tag}`,
        categoryId: cat.id,
        name: "Cà phê đen đá",
        price: 25_000,
        targetPrinter: "BAR",
        status: "DANG_BAN",
      })
      .returning();
    testMenuItemId = item.id;

    // Create a paid order
    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_IMM_${rand()}`,
        orderType: "TAI_BAN",
        tableId: table.id,
        shiftId: testShiftId,
        totalAmount: 25_000,
        discountAmount: 0,
        finalAmount: 25_000,
        status: "DA_THANH_TOAN",
        paidAt: new Date(),
        paymentMethod: "TIEN_MAT",
        version: 2,
        createdById: managerUserId,
      })
      .returning();
    paidOrderId = order.id;
    createdOrderIds.push(order.id);

    const [oi] = await db
      .insert(schema.orderItems)
      .values({
        orderId: order.id,
        menuItemId: testMenuItemId,
        quantity: 1,
        unitPrice: 25_000,
        isPrintedKitchen: true,
        isCancelled: false,
      })
      .returning();
    paidOrderItemId = oi.id;

    await db.insert(schema.payments).values({
      orderId: order.id,
      shiftId: testShiftId,
      paymentMethod: "TIEN_MAT",
      amount: 25_000,
      cashGiven: 25_000,
      cashReturned: 0,
      status: "SUCCESS",
    });
  });

  afterAll(async () => {
    if (db) {
      if (createdOrderIds.length > 0) {
        await db.delete(schema.payments).where(inArray(schema.payments.orderId, createdOrderIds));
        await db.delete(schema.printJobs).where(inArray(schema.printJobs.orderId, createdOrderIds));
        await db.delete(schema.orderItems).where(inArray(schema.orderItems.orderId, createdOrderIds));
        await db.delete(schema.orders).where(inArray(schema.orders.id, createdOrderIds));
      }
      if (createdTableIds.length > 0) {
        await db.delete(schema.tables).where(inArray(schema.tables.id, createdTableIds));
      }
      await db.delete(schema.menuItems).where(eq(schema.menuItems.id, testMenuItemId));
      await db.delete(schema.categories).where(eq(schema.categories.id, testCategoryId));
      await db.delete(schema.shifts).where(eq(schema.shifts.id, testShiftId));
      await db.delete(schema.areas).where(eq(schema.areas.id, testAreaId));
      await db.delete(schema.users).where(eq(schema.users.id, managerUserId));
    }
    await pool.end();
  });

  it("rejects adding an item to paid order with 409", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${paidOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", menuItemId: testMenuItemId, quantity: 1, expectedVersion: 2 }),
    });
    const res = await modifyItemsHandler(req, { params: Promise.resolve({ id: String(paidOrderId) }) });
    expect(res.status).toBe(409);
  });

  it("rejects modifying an item in paid order with 409", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${paidOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", orderItemId: paidOrderItemId, quantity: 2, expectedVersion: 2 }),
    });
    const res = await modifyItemsHandler(req, { params: Promise.resolve({ id: String(paidOrderId) }) });
    expect(res.status).toBe(409);
  });

  it("rejects deleting an item in paid order with 409", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${paidOrderId}/items`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        orderItemId: paidOrderItemId,
        lyDo: "Khách đổi ý muốn xóa món",
        expectedVersion: 2,
      }),
    });
    const res = await modifyItemsHandler(req, { params: Promise.resolve({ id: String(paidOrderId) }) });
    expect(res.status).toBe(409);
  });

  it("rejects applying discount to paid order with 409", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${paidOrderId}/discount`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 5000, lyDo: "Giảm giá khách quen", expectedVersion: 2 }),
    });
    const res = await discountHandler(req, { params: Promise.resolve({ id: String(paidOrderId) }) });
    expect(res.status).toBe(409);
  });

  it("rejects cancelling paid order via cancel-order API with 409", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${paidOrderId}/cancel`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ lyDo: "Hủy đơn hàng này", expectedVersion: 2 }),
    });
    const res = await cancelOrderHandler(req, { params: Promise.resolve({ id: String(paidOrderId) }) });
    expect(res.status).toBe(409);
  });

  it("rejects sending paid order to kitchen with 409", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${paidOrderId}/send-kitchen`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: 2 }),
    });
    const res = await sendKitchenHandler(req, { params: Promise.resolve({ id: String(paidOrderId) }) });
    expect(res.status).toBe(409);
  });

  it("rejects provisional print on paid order with 409", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${paidOrderId}/provisional-print`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: 2 }),
    });
    const res = await provisionalPrintHandler(req, { params: Promise.resolve({ id: String(paidOrderId) }) });
    expect(res.status).toBe(409);
  });

  it("rejects second payment attempt on paid order with 409", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/payments/cash", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: paidOrderId, tienKhachDua: 25_000, expectedVersion: 2 }),
    });
    const res = await cashPaymentHandler(req);
    expect(res.status).toBe(409);
  });
});
