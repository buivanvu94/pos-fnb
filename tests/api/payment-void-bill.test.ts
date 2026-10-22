import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { POST as voidBillHandler } from "@/app/api/v1/orders/[id]/void/route";
import { getShiftCashBalance } from "@/server/shifts/cash-balance";
import { ERROR_CATALOG } from "@/lib/error-catalog";

describe("Void Paid Bill API - POST /api/v1/orders/:id/void (DEC-12, BR-08, BR-05)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 8);
  const tag = rand();

  let managerUserId: number;
  let managerToken: string;
  let cashierUserId: number;
  let cashierToken: string;
  let waiterUserId: number;
  let waiterToken: string;

  const validManagerPin = "8392"; // Unpredictable PIN passing pin-policy
  let testAreaId: number;
  let testShiftId: number;
  let closedShiftId: number;
  let testCategoryId: number;
  let testMenuItemId: number;

  const createdOrderIds: number[] = [];
  const createdTableIds: number[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const pinHash = await bcrypt.hash(validManagerPin, 10);

    // 1. Manager
    const [manager] = await db
      .insert(schema.users)
      .values({
        username: `mgr_void_${tag}`,
        fullName: "Quản Lý Void Test",
        role: "QUAN_LY",
        passwordHash: "dummy",
        pinHash,
      })
      .returning();
    managerUserId = manager.id;
    managerToken = await signAuthToken({
      userId: manager.id,
      username: manager.username,
      fullName: manager.fullName,
      role: "QUAN_LY",
    });

    // 2. Cashier
    const [cashier] = await db
      .insert(schema.users)
      .values({
        username: `c_void_${tag}`,
        fullName: "Thu Ngân Void Test",
        role: "THU_NGAN",
        passwordHash: "dummy",
      })
      .returning();
    cashierUserId = cashier.id;
    cashierToken = await signAuthToken({
      userId: cashier.id,
      username: cashier.username,
      fullName: cashier.fullName,
      role: "THU_NGAN",
    });

    // 3. Waiter
    const [waiter] = await db
      .insert(schema.users)
      .values({
        username: `w_void_${tag}`,
        fullName: "Phục Vụ Void Test",
        role: "PHUC_VU",
        passwordHash: "dummy",
      })
      .returning();
    waiterUserId = waiter.id;
    waiterToken = await signAuthToken({
      userId: waiter.id,
      username: waiter.username,
      fullName: waiter.fullName,
      role: "PHUC_VU",
    });

    // Area & Shifts
    const [area] = await db.insert(schema.areas).values({ code: `AR_VD_${tag}`, name: `Khu Void ${tag}` }).returning();
    testAreaId = area.id;

    const [openShift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_VD_OPEN_${tag}`,
        cashierId: cashierUserId,
        initialCash: 500_000,
        status: "DANG_MO",
      })
      .returning();
    testShiftId = openShift.id;

    const [closedShift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_VD_CLOSED_${tag}`,
        cashierId: cashierUserId,
        initialCash: 500_000,
        status: "DA_DONG",
      })
      .returning();
    closedShiftId = closedShift.id;

    const [cat] = await db.insert(schema.categories).values({ code: `CAT_VD_${tag}`, name: "Thực đơn Void" }).returning();
    testCategoryId = cat.id;

    const [item] = await db
      .insert(schema.menuItems)
      .values({
        code: `MI_VD_${tag}`,
        categoryId: cat.id,
        name: "Cơm Sườn Nướng",
        price: 80_000,
        targetPrinter: "KITCHEN",
        status: "DANG_BAN",
      })
      .returning();
    testMenuItemId = item.id;
  });

  afterAll(async () => {
    if (db) {
      if (createdOrderIds.length > 0) {
        await db.delete(schema.auditLogs).where(inArray(schema.auditLogs.entityId, createdOrderIds.map(String)));
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
      await db.delete(schema.shifts).where(inArray(schema.shifts.id, [testShiftId, closedShiftId]));
      await db.delete(schema.areas).where(eq(schema.areas.id, testAreaId));
      await db.delete(schema.users).where(inArray(schema.users.id, [managerUserId, cashierUserId, waiterUserId]));
    }
    await pool.end();
  });

  const createPaidOrder = async (shiftId: number = testShiftId, price: number = 80_000) => {
    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_VD_${rand()}`,
        orderType: "MANG_VE",
        shiftId,
        totalAmount: price,
        discountAmount: 0,
        finalAmount: price,
        status: "DA_THANH_TOAN",
        paidAt: new Date(),
        paymentMethod: "TIEN_MAT",
        version: 2,
        createdById: cashierUserId,
      })
      .returning();
    createdOrderIds.push(order.id);

    await db.insert(schema.orderItems).values({
      orderId: order.id,
      menuItemId: testMenuItemId,
      quantity: 1,
      unitPrice: price,
      isPrintedKitchen: true,
      isCancelled: false,
    });

    await db.insert(schema.payments).values({
      orderId: order.id,
      shiftId,
      paymentMethod: "TIEN_MAT",
      amount: price,
      cashGiven: price,
      cashReturned: 0,
      status: "SUCCESS",
    });

    return order;
  };

  it("allows QUAN_LY to void paid bill without PIN (DEC-12, BR-08)", async () => {
    const order = await createPaidOrder(testShiftId, 80_000);

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/void`, {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expectedVersion: 2,
        lyDo: "Khách gọi nhầm món mang về và xin hủy lấy lại tiền",
      }),
    });

    const res = await voidBillHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.status).toBe("DA_HUY");

    // Verify order in database
    const [updatedOrder] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
    expect(updatedOrder.status).toBe("DA_HUY");
    expect(updatedOrder.voidedAt).not.toBeNull();
    expect(updatedOrder.voidReason).toBe("Khách gọi nhầm món mang về và xin hủy lấy lại tiền");

    // Verify payment marked as VOIDED
    const [paymentRecord] = await db.select().from(schema.payments).where(eq(schema.payments.orderId, order.id));
    expect(paymentRecord.status).toBe("VOIDED");

    // Verify audit log
    const [audit] = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.entityId, String(order.id)));
    expect(audit).toBeDefined();
    expect(audit.action).toBe("VOID_BILL");
    expect(audit.reason).toContain("Khách gọi nhầm món");
  });

  it("allows THU_NGAN to void paid bill with correct Manager PIN", async () => {
    const order = await createPaidOrder(testShiftId, 80_000);

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/void`, {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expectedVersion: 2,
        lyDo: "Quản lý duyệt hủy hóa đơn bị nhầm lẫn",
        pinCode: validManagerPin,
      }),
    });

    const res = await voidBillHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.status).toBe("DA_HUY");
  });

  it("rejects THU_NGAN with wrong Manager PIN (ERR-02)", async () => {
    const order = await createPaidOrder(testShiftId, 80_000);

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/void`, {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expectedVersion: 2,
        lyDo: "Hủy hóa đơn sai món",
        pinCode: "0000", // Wrong PIN
      }),
    });

    const res = await voidBillHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe(ERROR_CATALOG.ERR_02.message);
  });

  it("rejects void attempt by PHUC_VU role (403)", async () => {
    const order = await createPaidOrder(testShiftId, 80_000);

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/void`, {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expectedVersion: 2,
        lyDo: "Hủy hóa đơn",
      }),
    });

    const res = await voidBillHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(403);
  });

  it("rejects void when order shift is already closed (409)", async () => {
    const order = await createPaidOrder(closedShiftId, 80_000);

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/void`, {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expectedVersion: 2,
        lyDo: "Hủy hóa đơn của ca đã đóng",
      }),
    });

    const res = await voidBillHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain("ca làm việc của hóa đơn này đã đóng");
  });

  it("BR-05: voiding bill automatically deducts cash from shift expected balance", async () => {
    const initialBal = await getShiftCashBalance(testShiftId, 500_000, db as any);
    const order = await createPaidOrder(testShiftId, 80_000);

    const afterPayBal = await getShiftCashBalance(testShiftId, 500_000, db as any);
    expect(afterPayBal.cashSales - initialBal.cashSales).toBe(80_000);

    // Void the bill
    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/void`, {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expectedVersion: 2,
        lyDo: "Hủy hóa đơn test hoàn tiền",
      }),
    });
    await voidBillHandler(req, { params: Promise.resolve({ id: String(order.id) }) });

    const afterVoidBal = await getShiftCashBalance(testShiftId, 500_000, db as any);
    expect(afterVoidBal.cashSales).toBe(initialBal.cashSales);
  });
});
