import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { POST as cashPaymentHandler } from "@/app/api/v1/payments/cash/route";
import { getShiftCashBalance } from "@/server/shifts/cash-balance";
import { savePrinterSettings, getPrinterSettings, type PrinterSettings } from "@/server/printing/settings-service";
import { ERROR_CATALOG } from "@/lib/error-catalog";

describe("Cash Payment API - POST /api/v1/payments/cash (US-07, FR-11, FR-13, BR-08, BR-12, AC-07-2, AC-07-3)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 8);
  const tag = rand();

  let cashierUserId: number;
  let cashierToken: string;
  let waiterUserId: number;
  let waiterToken: string;
  let cashierWithoutShiftToken: string;

  let testAreaId: number;
  let testShiftId: number;
  let testCategoryId: number;
  let testMenuItemId: number;
  let initialPrinterSettings: PrinterSettings;

  const createdOrderIds: number[] = [];
  const createdTableIds: number[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });
    initialPrinterSettings = await getPrinterSettings();

    // 1. Cashier with open shift
    const [cashier] = await db
      .insert(schema.users)
      .values({
        username: `c_pay_${tag}`,
        fullName: "Thu Ngân Test Cash",
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

    // 2. Waiter (PHUC_VU)
    const [waiter] = await db
      .insert(schema.users)
      .values({
        username: `w_pay_${tag}`,
        fullName: "Phục Vụ Test Cash",
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

    // 3. Cashier without shift
    const [noShiftCashier] = await db
      .insert(schema.users)
      .values({
        username: `ns_pay_${tag}`,
        fullName: "Thu Ngân Không Ca",
        role: "THU_NGAN",
        passwordHash: "dummy",
      })
      .returning();
    cashierWithoutShiftToken = await signAuthToken({
      userId: noShiftCashier.id,
      username: noShiftCashier.username,
      fullName: noShiftCashier.fullName,
      role: "THU_NGAN",
    });

    // 4. Area, Shift, Category, MenuItem
    const [area] = await db.insert(schema.areas).values({ code: `AR_PAY_${tag}`, name: `Khu Pay ${tag}` }).returning();
    testAreaId = area.id;

    const [shift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_PAY_${tag}`,
        cashierId: cashierUserId,
        initialCash: 500_000,
        status: "DANG_MO",
      })
      .returning();
    testShiftId = shift.id;

    const [cat] = await db.insert(schema.categories).values({ code: `CAT_PAY_${tag}`, name: "Thực đơn Pay" }).returning();
    testCategoryId = cat.id;

    const [item] = await db
      .insert(schema.menuItems)
      .values({
        code: `MI_PAY_${tag}`,
        categoryId: cat.id,
        name: "Lẩu Thái Hải Sản",
        price: 175_000,
        targetPrinter: "KITCHEN",
        status: "DANG_BAN",
      })
      .returning();
    testMenuItemId = item.id;
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
      await db.delete(schema.users).where(inArray(schema.users.id, [cashierUserId, waiterUserId]));
      await savePrinterSettings(initialPrinterSettings);
    }
    await pool.end();
  });

  const createTableOrderWithItem = async (price: number = 175_000) => {
    const [table] = await db
      .insert(schema.tables)
      .values({
        code: `TB_${rand()}`,
        name: `Bàn Pay ${rand()}`,
        areaId: testAreaId,
        capacity: 4,
        status: "DANG_DUNG",
      })
      .returning();
    createdTableIds.push(table.id);

    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_${rand()}`,
        orderType: "TAI_BAN",
        tableId: table.id,
        shiftId: testShiftId,
        totalAmount: price,
        discountAmount: 0,
        finalAmount: price,
        status: "DANG_PHUC_VU",
        version: 1,
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

    return { order, table };
  };

  it("AC-07-2: pays cash 200,000 for 175,000 order -> returns change 25,000, DA_THANH_TOAN, frees table, enqueues RECEIPT_FINAL", async () => {
    const { order, table } = await createTableOrderWithItem(175_000);

    const req = new NextRequest("http://localhost:3000/api/v1/payments/cash", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId: order.id,
        tienKhachDua: 200_000,
        expectedVersion: 1,
      }),
    });

    const res = await cashPaymentHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.cashReturned).toBe(25_000);
    expect(json.data.status).toBe("DA_THANH_TOAN");

    // Verify order in database
    const [updatedOrder] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
    expect(updatedOrder.status).toBe("DA_THANH_TOAN");
    expect(updatedOrder.paymentMethod).toBe("TIEN_MAT");
    expect(updatedOrder.paidAt).not.toBeNull();

    // Verify table freed to TRONG
    const [updatedTable] = await db.select().from(schema.tables).where(eq(schema.tables.id, table.id));
    expect(updatedTable.status).toBe("TRONG");

    // Verify payment record
    const [paymentRecord] = await db.select().from(schema.payments).where(eq(schema.payments.orderId, order.id));
    expect(paymentRecord).toBeDefined();
    expect(paymentRecord.amount).toBe(175_000);
    expect(paymentRecord.cashGiven).toBe(200_000);
    expect(paymentRecord.cashReturned).toBe(25_000);
    expect(paymentRecord.status).toBe("SUCCESS");
    expect(paymentRecord.shiftId).toBe(testShiftId);

    // Verify print job enqueued with kickDrawer
    const jobs = await db.select().from(schema.printJobs).where(eq(schema.printJobs.orderId, order.id));
    const receiptJob = jobs.find((j) => j.jobType === "RECEIPT_FINAL");
    expect(receiptJob).toBeDefined();
    const payload = JSON.parse(receiptJob!.payload);
    expect(payload.kickDrawer).toBe(true);
  });

  it("AC-07-3: handles printer failure gracefully, keeping order DA_THANH_TOAN with ERR-10 warning", async () => {
    // Configure invalid receipt printer IP to simulate paper out / offline printer
    await savePrinterSettings({ receiptIp: "127.0.0.1:9199" });

    const { order } = await createTableOrderWithItem(175_000);

    const req = new NextRequest("http://localhost:3000/api/v1/payments/cash", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId: order.id,
        tienKhachDua: 200_000,
        expectedVersion: 1,
      }),
    });

    const res = await cashPaymentHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.status).toBe("DA_THANH_TOAN");
    expect(json.printWarning?.message).toBe(ERROR_CATALOG.ERR_10.message);

    // Restore printer settings
    await savePrinterSettings(initialPrinterSettings);
  });

  it("rejects payment when customer tender is less than required amount (400)", async () => {
    const { order } = await createTableOrderWithItem(175_000);

    const req = new NextRequest("http://localhost:3000/api/v1/payments/cash", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId: order.id,
        tienKhachDua: 150_000, // Short by 25,000
        expectedVersion: 1,
      }),
    });

    const res = await cashPaymentHandler(req);
    expect(res.status).toBe(400);

    // Verify order remains DANG_PHUC_VU
    const [orderCheck] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
    expect(orderCheck.status).toBe("DANG_PHUC_VU");
  });

  it("serializes concurrent double-submit requests: exactly ONE succeeds, the other gets 409", async () => {
    const { order } = await createTableOrderWithItem(175_000);

    const makeRequest = () =>
      cashPaymentHandler(
        new NextRequest("http://localhost:3000/api/v1/payments/cash", {
          method: "POST",
          headers: {
            Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orderId: order.id,
            tienKhachDua: 200_000,
            expectedVersion: 1,
          }),
        }),
      );

    const [res1, res2] = await Promise.all([makeRequest(), makeRequest()]);
    const statuses = [res1.status, res2.status].sort();

    expect(statuses).toEqual([200, 409]);

    // Verify exactly ONE payment record exists in the database
    const paymentsForOrder = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.orderId, order.id));
    expect(paymentsForOrder.length).toBe(1);
  });

  it("rejects payment attempt by PHUC_VU role with 403 Forbidden", async () => {
    const { order } = await createTableOrderWithItem(175_000);

    const req = new NextRequest("http://localhost:3000/api/v1/payments/cash", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId: order.id,
        tienKhachDua: 200_000,
        expectedVersion: 1,
      }),
    });

    const res = await cashPaymentHandler(req);
    expect(res.status).toBe(403);
  });

  it("rejects payment attempt when user does not have an open shift with ERR-01", async () => {
    const { order } = await createTableOrderWithItem(175_000);

    const req = new NextRequest("http://localhost:3000/api/v1/payments/cash", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${cashierWithoutShiftToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId: order.id,
        tienKhachDua: 200_000,
        expectedVersion: 1,
      }),
    });

    const res = await cashPaymentHandler(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe(ERROR_CATALOG.ERR_01.message);
  });

  it("BR-05: shift cash balance increases accurately with cash payments", async () => {
    const initialBalance = await getShiftCashBalance(testShiftId, 500_000, db as any);
    const { order } = await createTableOrderWithItem(175_000);

    const req = new NextRequest("http://localhost:3000/api/v1/payments/cash", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId: order.id,
        tienKhachDua: 200_000,
        expectedVersion: 1,
      }),
    });

    await cashPaymentHandler(req);

    const updatedBalance = await getShiftCashBalance(testShiftId, 500_000, db as any);
    expect(updatedBalance.cashSales - initialBalance.cashSales).toBe(175_000);
    expect(updatedBalance.expectedCash - initialBalance.expectedCash).toBe(175_000);
  });
});
