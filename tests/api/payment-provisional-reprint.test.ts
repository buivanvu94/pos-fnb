import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { POST as provisionalPrintHandler } from "@/app/api/v1/orders/[id]/provisional-print/route";
import { POST as reprintHandler } from "@/app/api/v1/orders/[id]/reprint/route";
import { getPrinterSettings, savePrinterSettings, type PrinterSettings } from "@/server/printing/settings-service";

describe("Provisional Print & Reprint API (US-07, FR-13, BR-08, BR-12, AC-07-1)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 8);
  const tag = rand();

  let cashierUserId: number;
  let cashierToken: string;
  let waiterUserId: number;
  let waiterToken: string;
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
    await savePrinterSettings({ receiptIp: "" });

    const [cashier] = await db
      .insert(schema.users)
      .values({
        username: `c_prov_${tag}`,
        fullName: "Thu Ngân Test Provisional",
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
        username: `w_prov_${tag}`,
        fullName: "Phục Vụ Test Provisional",
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

    const [area] = await db.insert(schema.areas).values({ code: `AR_PRV_${tag}`, name: `Khu Prov ${tag}` }).returning();
    testAreaId = area.id;

    const [shift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_PRV_${tag}`,
        cashierId: cashierUserId,
        initialCash: 100_000,
        status: "DANG_MO",
      })
      .returning();
    testShiftId = shift.id;

    const [cat] = await db.insert(schema.categories).values({ code: `CAT_PRV_${tag}`, name: "Thực đơn Prov" }).returning();
    testCategoryId = cat.id;

    const [item] = await db
      .insert(schema.menuItems)
      .values({
        code: `MI_PRV_${tag}`,
        categoryId: cat.id,
        name: "Bún Bò Huế Đặc Biệt",
        price: 65_000,
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

  const createTableOrderWithItem = async () => {
    const [table] = await db
      .insert(schema.tables)
      .values({
        code: `TB_${rand()}`,
        name: `Bàn 03 - ${rand()}`,
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
        totalAmount: 65_000,
        discountAmount: 0,
        finalAmount: 65_000,
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
      unitPrice: 65_000,
      isPrintedKitchen: true,
      isCancelled: false,
    });

    return { order, table };
  };

  it("AC-07-1: provisional print sets table to CHO_THANH_TOAN (yellow) and enqueues RECEIPT_TEMP job", async () => {
    const { order, table } = await createTableOrderWithItem();

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/provisional-print`, {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, // Waiter can print provisional bill (SRS 2.5)
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expectedVersion: 1 }),
    });

    const res = await provisionalPrintHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.tableStatus).toBe("CHO_THANH_TOAN");

    // Verify table updated to CHO_THANH_TOAN
    const [updatedTable] = await db.select().from(schema.tables).where(eq(schema.tables.id, table.id));
    expect(updatedTable.status).toBe("CHO_THANH_TOAN");

    // Verify RECEIPT_TEMP job enqueued
    const jobs = await db.select().from(schema.printJobs).where(eq(schema.printJobs.orderId, order.id));
    const tempJob = jobs.find((j) => j.jobType === "RECEIPT_TEMP");
    expect(tempJob).toBeDefined();
    const payload = JSON.parse(tempJob!.payload);
    expect(payload.kind).toBe("PROVISIONAL");
    expect(payload.tableName).toBe(table.name);
    expect(payload.total).toBe(65_000);
  });

  it("reprints final receipt for paid order (RECEIPT_FINAL without kickDrawer)", async () => {
    const { order } = await createTableOrderWithItem();

    // Mark order as DA_THANH_TOAN
    await db
      .update(schema.orders)
      .set({ status: "DA_THANH_TOAN", paidAt: new Date(), paymentMethod: "TIEN_MAT" })
      .where(eq(schema.orders.id, order.id));

    await db.insert(schema.payments).values({
      orderId: order.id,
      shiftId: testShiftId,
      paymentMethod: "TIEN_MAT",
      amount: 65_000,
      cashGiven: 100_000,
      cashReturned: 35_000,
      status: "SUCCESS",
    });

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/reprint`, {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
    });

    const res = await reprintHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    // Verify print job: kickDrawer must be false
    const jobs = await db.select().from(schema.printJobs).where(eq(schema.printJobs.orderId, order.id));
    const finalReceiptJob = jobs.find((j) => j.jobType === "RECEIPT_FINAL");
    expect(finalReceiptJob).toBeDefined();
    const payload = JSON.parse(finalReceiptJob!.payload);
    expect(payload.kickDrawer).toBe(false);
  });

  it("rejects reprint when order is not yet paid (409)", async () => {
    const { order } = await createTableOrderWithItem();

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/reprint`, {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
    });

    const res = await reprintHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(409);
  });

  it("rejects reprint by PHUC_VU role (403)", async () => {
    const { order } = await createTableOrderWithItem();

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/reprint`, {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
      },
    });

    const res = await reprintHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(403);
  });
});
