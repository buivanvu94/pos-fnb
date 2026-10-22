import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { POST as createOrderHandler } from "@/app/api/v1/orders/route";
import { POST as cashPaymentHandler } from "@/app/api/v1/payments/cash/route";
import { ERROR_CATALOG } from "@/lib/error-catalog";

describe("Takeaway & Counter Payment API (US-05, FR-05, BR-10, ERR-08, AC-05-1, AC-05-2)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 8);
  const tag = rand();

  let cashierUserId: number;
  let cashierToken: string;
  let waiterUserId: number;
  let waiterToken: string;
  let testShiftId: number;
  let testCategoryId: number;
  let milkTeaItemId: number;
  let initialPrinterSettings: any;

  const createdOrderIds: number[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });
    const { getPrinterSettings, savePrinterSettings } = await import("@/server/printing/settings-service");
    initialPrinterSettings = await getPrinterSettings();
    await savePrinterSettings({ receiptIp: "" });

    const [cashier] = await db
      .insert(schema.users)
      .values({
        username: `c_tkw_${tag}`,
        fullName: "Thu Ngân Takeaway",
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

    const [waiter] = await db
      .insert(schema.users)
      .values({
        username: `w_tkw_${tag}`,
        fullName: "Phục Vụ Takeaway",
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

    const [shift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_TKW_${tag}`,
        cashierId: cashierUserId,
        initialCash: 200_000,
        status: "DANG_MO",
      })
      .returning();
    testShiftId = shift.id;

    const [cat] = await db.insert(schema.categories).values({ code: `CAT_TKW_${tag}`, name: "Trà sữa" }).returning();
    testCategoryId = cat.id;

    const [item] = await db
      .insert(schema.menuItems)
      .values({
        code: `TS_${tag}`,
        categoryId: cat.id,
        name: "Trà sữa trân châu",
        price: 35_000,
        targetPrinter: "BAR",
        status: "DANG_BAN",
      })
      .returning();
    milkTeaItemId = item.id;
  });

  afterAll(async () => {
    if (db) {
      if (createdOrderIds.length > 0) {
        await db.delete(schema.payments).where(inArray(schema.payments.orderId, createdOrderIds));
        await db.delete(schema.printJobs).where(inArray(schema.printJobs.orderId, createdOrderIds));
        await db.delete(schema.orderItems).where(inArray(schema.orderItems.orderId, createdOrderIds));
        await db.delete(schema.orders).where(inArray(schema.orders.id, createdOrderIds));
      }
      await db.delete(schema.menuItems).where(eq(schema.menuItems.id, milkTeaItemId));
      await db.delete(schema.categories).where(eq(schema.categories.id, testCategoryId));
      await db.delete(schema.shifts).where(eq(schema.shifts.id, testShiftId));
      await db.delete(schema.users).where(inArray(schema.users.id, [cashierUserId, waiterUserId]));
      const { savePrinterSettings } = await import("@/server/printing/settings-service");
      await savePrinterSettings(initialPrinterSettings);
    }
    await pool.end();
  });

  it("AC-05-1: takeaway order paid cash 35,000 -> DA_THANH_TOAN, has RECEIPT_FINAL & PICKUP_TICKET with queue_number", async () => {
    // 1. Create takeaway order via API
    const orderReq = new NextRequest("http://localhost:3000/api/v1/orders", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderType: "MANG_VE" }),
    });
    const orderRes = await createOrderHandler(orderReq);
    expect(orderRes.status).toBe(201);
    const orderJson = await orderRes.json();
    expect(orderJson.ok).toBe(true);
    const orderId = orderJson.data.id;
    createdOrderIds.push(orderId);

    // 2. Add 1 Trà sữa trân châu 35,000
    await db.insert(schema.orderItems).values({
      orderId,
      menuItemId: milkTeaItemId,
      quantity: 1,
      unitPrice: 35_000,
      isPrintedKitchen: false,
      isCancelled: false,
    });
    await db.update(schema.orders).set({ totalAmount: 35_000, finalAmount: 35_000 }).where(eq(schema.orders.id, orderId));

    // 3. Pay cash 35,000
    const payReq = new NextRequest("http://localhost:3000/api/v1/payments/cash", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId,
        tienKhachDua: 35_000,
        expectedVersion: 1,
      }),
    });

    const payRes = await cashPaymentHandler(payReq);
    expect(payRes.status).toBe(200);
    const payJson = await payRes.json();
    expect(payJson.ok).toBe(true);
    expect(payJson.data.status).toBe("DA_THANH_TOAN");
    expect(payJson.data.queueNumber).toBeGreaterThan(0);

    // 4. Verify print jobs: both RECEIPT_FINAL and PICKUP_TICKET exist
    const jobs = await db.select().from(schema.printJobs).where(eq(schema.printJobs.orderId, orderId));
    const finalJob = jobs.find((j) => j.jobType === "RECEIPT_FINAL");
    const pickupJob = jobs.find((j) => j.jobType === "PICKUP_TICKET");

    expect(finalJob).toBeDefined();
    expect(pickupJob).toBeDefined();
    const pickupPayload = JSON.parse(pickupJob!.payload);
    expect(pickupPayload.queueNumber).toBe(payJson.data.queueNumber);
    expect(pickupPayload.items.length).toBe(1);
    expect(pickupPayload.items[0].name).toBe("Trà sữa trân châu");
  });

  it("AC-05-2 & BR-10: rejects checkout when takeaway cart has 0 items or total is 0 (ERR-08 verbatim)", async () => {
    // Create empty takeaway order
    const orderReq = new NextRequest("http://localhost:3000/api/v1/orders", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderType: "MANG_VE" }),
    });
    const orderRes = await createOrderHandler(orderReq);
    const orderJson = await orderRes.json();
    const orderId = orderJson.data.id;
    createdOrderIds.push(orderId);

    // Attempt to pay empty order
    const payReq = new NextRequest("http://localhost:3000/api/v1/payments/cash", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId,
        tienKhachDua: 50_000,
        expectedVersion: 1,
      }),
    });

    const payRes = await cashPaymentHandler(payReq);
    expect(payRes.status).toBe(400);
    const json = await payRes.json();
    expect(json.error).toBe(ERROR_CATALOG.ERR_08.message);
  });

  it("assigns strictly unique queue numbers under 10 concurrent takeaway payments", async () => {
    const ordersToPay: number[] = [];

    // Create 10 takeaway orders with 1 item each
    for (let i = 0; i < 10; i++) {
      const [o] = await db
        .insert(schema.orders)
        .values({
          orderCode: `HD_TKW_${rand()}`,
          orderType: "MANG_VE",
          shiftId: testShiftId,
          totalAmount: 35_000,
          discountAmount: 0,
          finalAmount: 35_000,
          status: "DANG_PHUC_VU",
          version: 1,
          createdById: cashierUserId,
        })
        .returning();
      ordersToPay.push(o.id);
      createdOrderIds.push(o.id);

      await db.insert(schema.orderItems).values({
        orderId: o.id,
        menuItemId: milkTeaItemId,
        quantity: 1,
        unitPrice: 35_000,
        isPrintedKitchen: false,
        isCancelled: false,
      });
    }

    // Pay all 10 simultaneously
    const paymentPromises = ordersToPay.map((orderId) =>
      cashPaymentHandler(
        new NextRequest("http://localhost:3000/api/v1/payments/cash", {
          method: "POST",
          headers: {
            Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orderId,
            tienKhachDua: 50_000,
            expectedVersion: 1,
          }),
        }),
      ),
    );

    const responses = await Promise.all(paymentPromises);
    expect(responses.every((r) => r.status === 200)).toBe(true);

    const results = await Promise.all(responses.map((r) => r.json()));
    const queueNumbers = results.map((r) => r.data.queueNumber);

    // Verify all 10 queue numbers are unique
    const uniqueNumbers = new Set(queueNumbers);
    expect(uniqueNumbers.size).toBe(10);
  });

  it("allows skipping PICKUP_TICKET when printPickupTicket is explicitly set to false", async () => {
    // 1. Create takeaway order
    const orderReq = new NextRequest("http://localhost:3000/api/v1/orders", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderType: "MANG_VE" }),
    });
    const orderRes = await createOrderHandler(orderReq);
    const orderJson = await orderRes.json();
    const orderId = orderJson.data.id;
    createdOrderIds.push(orderId);

    // 2. Add item
    await db.insert(schema.orderItems).values({
      orderId,
      menuItemId: milkTeaItemId,
      quantity: 1,
      unitPrice: 35_000,
      isPrintedKitchen: false,
      isCancelled: false,
    });
    await db.update(schema.orders).set({ totalAmount: 35_000, finalAmount: 35_000 }).where(eq(schema.orders.id, orderId));

    // 3. Pay with printPickupTicket: false
    const payReq = new NextRequest("http://localhost:3000/api/v1/payments/cash", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId,
        tienKhachDua: 35_000,
        expectedVersion: 1,
        printPickupTicket: false,
      }),
    });

    const payRes = await cashPaymentHandler(payReq);
    expect(payRes.status).toBe(200);

    // 4. Verify print jobs: RECEIPT_FINAL exists, but PICKUP_TICKET does NOT exist
    const jobs = await db.select().from(schema.printJobs).where(eq(schema.printJobs.orderId, orderId));
    const finalJob = jobs.find((j) => j.jobType === "RECEIPT_FINAL");
    const pickupJob = jobs.find((j) => j.jobType === "PICKUP_TICKET");

    expect(finalJob).toBeDefined();
    expect(pickupJob).toBeUndefined();
  });
});
