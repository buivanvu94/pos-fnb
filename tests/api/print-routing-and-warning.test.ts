import { describe, it, expect, beforeAll, afterAll } from "vitest";
import net from "net";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { sendKitchenOrder } from "@/server/orders/send-kitchen-service";
import { POST as kitchenPrintHandler } from "@/app/api/v1/orders/kitchen-print/route";
import { POST as retryPrintJobHandler } from "@/app/api/v1/print-jobs/[id]/retry/route";
import { GET as listPrintJobsHandler } from "@/app/api/v1/print-jobs/route";
import { ERROR_CATALOG } from "@/lib/error-catalog";
import { savePrinterSettings, getPrinterSettings, type PrinterSettings } from "@/server/printing/settings-service";

describe("Print Routing, Warnings & Retry API (DEC-07, AC-03-2, ERR-06, API-02)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 8);
  const tag = rand();

  let waiterToken: string;
  let waiterUserId: number;
  let managerToken: string;
  let managerUserId: number;

  let testAreaId: number;
  let testShiftId: number;
  const createdTableIds: number[] = [];

  let kitchenItemId: number;
  let barItemId: number;
  let initialSettings: PrinterSettings;

  let mockServer: net.Server;
  let mockPort: number;
  const receivedBuffers: Buffer[] = [];

  const createTable = async () => {
    const [t] = await db
      .insert(schema.tables)
      .values({ code: `TB_${rand()}`, name: `Bàn ${rand()}`, areaId: testAreaId, capacity: 4, status: "DANG_DUNG" })
      .returning();
    createdTableIds.push(t.id);
    return t.id;
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    initialSettings = await getPrinterSettings();

    // Configure 127.0.0.1 in settings so unreachable tests fail instantly (ECONNREFUSED) without 2s delays
    await db
      .insert(schema.settings)
      .values([
        { key: "printer.kitchen.ip", value: "127.0.0.1" },
        { key: "printer.bar.ip", value: "127.0.0.1" },
        { key: "printer.receipt.ip", value: "127.0.0.1" },
      ])
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: { value: "127.0.0.1" },
      });

    // Start local mock TCP server on port 9103
    mockPort = 9103;
    await new Promise<void>((resolve) => {
      mockServer = net.createServer((socket) => {
        socket.on("data", (chunk) => {
          receivedBuffers.push(chunk);
        });
        socket.on("end", () => {
          socket.end();
        });
      });
      mockServer.listen(mockPort, "127.0.0.1", () => {
        resolve();
      });
    });

    const [wtr] = await db
      .insert(schema.users)
      .values({ username: `wtr_${tag}`, passwordHash: "dummy", fullName: "Nhân Viên Phục Vụ", role: "PHUC_VU" })
      .returning();
    waiterUserId = wtr.id;
    waiterToken = await signAuthToken({ userId: wtr.id, username: wtr.username, fullName: wtr.fullName, role: "PHUC_VU" });

    const [mgr] = await db
      .insert(schema.users)
      .values({ username: `mgr_${tag}`, passwordHash: "dummy", fullName: "Trần Quản Lý", role: "QUAN_LY" })
      .returning();
    managerUserId = mgr.id;
    managerToken = await signAuthToken({ userId: mgr.id, username: mgr.username, fullName: mgr.fullName, role: "QUAN_LY" });

    const [area] = await db
      .insert(schema.areas)
      .values({ code: `AR_${tag}`, name: `Khu vực ${tag}` })
      .returning();
    testAreaId = area.id;

    const [shift] = await db
      .insert(schema.shifts)
      .values({ shiftCode: `CA_${tag}`, cashierId: waiterUserId, initialCash: 100000, status: "DANG_MO" })
      .returning();
    testShiftId = shift.id;

    const [cat] = await db
      .insert(schema.categories)
      .values({ code: `CAT_${tag}`, name: "Thực đơn mẫu" })
      .returning();

    const [kItem] = await db
      .insert(schema.menuItems)
      .values({
        code: `K_${tag}`,
        categoryId: cat.id,
        name: "Cơm bò xào",
        price: 60000,
        targetPrinter: "KITCHEN",
        status: "DANG_BAN",
      })
      .returning();
    kitchenItemId = kItem.id;

    const [bItem] = await db
      .insert(schema.menuItems)
      .values({
        code: `B_${tag}`,
        categoryId: cat.id,
        name: "Trà sữa kem trứng",
        price: 45000,
        targetPrinter: "BAR",
        status: "DANG_BAN",
      })
      .returning();
    barItemId = bItem.id;
  });

  afterAll(async () => {
    if (mockServer) {
      await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    }
    if (db) {
      await db.delete(schema.orderItems).where(inArray(schema.orderItems.menuItemId, [kitchenItemId, barItemId]));
      await db.delete(schema.orders).where(eq(schema.orders.shiftId, testShiftId));
      await db.delete(schema.menuItems).where(inArray(schema.menuItems.id, [kitchenItemId, barItemId]));
      await db.delete(schema.shifts).where(eq(schema.shifts.id, testShiftId));
      if (createdTableIds.length > 0) {
        await db.delete(schema.tables).where(inArray(schema.tables.id, createdTableIds));
      }
      await db.delete(schema.areas).where(eq(schema.areas.id, testAreaId));
      await db.delete(schema.users).where(inArray(schema.users.id, [waiterUserId, managerUserId]));

      // Point 10: Clean up printJobs and restore settings
      await db.delete(schema.printJobs).where(inArray(schema.printJobs.targetPrinter, ["KITCHEN", "BAR", "RECEIPT"]));
      await savePrinterSettings({
        kitchenIp: initialSettings.kitchenIp,
        barIp: initialSettings.barIp,
        receiptIp: initialSettings.receiptIp,
      });
    }
    await pool.end();
  });

  it("DEC-07 Routing: mixed order splits into 2 jobs (KOT_KITCHEN and KOT_BAR)", async () => {
    const tableId = await createTable();
    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_${rand()}`,
        orderType: "TAI_BAN",
        tableId,
        shiftId: testShiftId,
        totalAmount: 105000,
        finalAmount: 105000,
        status: "DANG_PHUC_VU",
        version: 1,
        createdById: waiterUserId,
      })
      .returning();

    await db.insert(schema.orderItems).values([
      { orderId: order.id, menuItemId: kitchenItemId, quantity: 2, unitPrice: 60000, isPrintedKitchen: false },
      { orderId: order.id, menuItemId: barItemId, quantity: 1, unitPrice: 45000, isPrintedKitchen: false },
    ]);

    const result = await sendKitchenOrder(order.id, 1, "Nguyễn Văn Phục Vụ");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const jobs = await db
      .select()
      .from(schema.printJobs)
      .where(eq(schema.printJobs.orderId, order.id));

    expect(jobs).toHaveLength(2);

    const kitchenJob = jobs.find((j) => j.jobType === "KOT_KITCHEN");
    expect(kitchenJob).toBeDefined();
    expect(kitchenJob?.targetPrinter).toBe("KITCHEN");
    const kPayload = JSON.parse(kitchenJob!.payload);
    expect(kPayload.kind).toBe("KOT");
    expect(kPayload.targetStation).toBe("KITCHEN");
    expect(kPayload.items).toHaveLength(1);
    expect(kPayload.items[0].name).toBe("Cơm bò xào");

    const barJob = jobs.find((j) => j.jobType === "KOT_BAR");
    expect(barJob).toBeDefined();
    expect(barJob?.targetPrinter).toBe("BAR");
    const bPayload = JSON.parse(barJob!.payload);
    expect(bPayload.kind).toBe("KOT");
    expect(bPayload.targetStation).toBe("BAR");
    expect(bPayload.items).toHaveLength(1);
    expect(bPayload.items[0].name).toBe("Trà sữa kem trứng");
  });

  it("DEC-07 Routing: order with only beverage creates exactly 1 job for BAR", async () => {
    const tableId = await createTable();
    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_${rand()}`,
        orderType: "TAI_BAN",
        tableId,
        shiftId: testShiftId,
        totalAmount: 45000,
        finalAmount: 45000,
        status: "DANG_PHUC_VU",
        version: 1,
        createdById: waiterUserId,
      })
      .returning();

    await db.insert(schema.orderItems).values([
      { orderId: order.id, menuItemId: barItemId, quantity: 1, unitPrice: 45000, isPrintedKitchen: false },
    ]);

    const result = await sendKitchenOrder(order.id, 1);
    expect(result.ok).toBe(true);

    const jobs = await db
      .select()
      .from(schema.printJobs)
      .where(eq(schema.printJobs.orderId, order.id));

    expect(jobs).toHaveLength(1);
    expect(jobs[0].jobType).toBe("KOT_BAR");
    expect(jobs[0].targetPrinter).toBe("BAR");
  });

  it("AC-03-2 & ERR-06: unreachable printer marks job FAILED and returns 200 with printWarning", async () => {
    const tableId = await createTable();
    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_${rand()}`,
        orderType: "TAI_BAN",
        tableId,
        shiftId: testShiftId,
        totalAmount: 60000,
        finalAmount: 60000,
        status: "DANG_PHUC_VU",
        version: 1,
        createdById: waiterUserId,
      })
      .returning();

    await db.insert(schema.orderItems).values([
      { orderId: order.id, menuItemId: kitchenItemId, quantity: 1, unitPrice: 60000, isPrintedKitchen: false },
    ]);

    const result = await sendKitchenOrder(order.id, 1);
    // Business order is preserved (200 OK)
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Verbatim ERR-06 message check
    expect(result.printWarning).toBeDefined();
    expect(result.printWarning?.message).toBe(ERROR_CATALOG.ERR_06.message);
    expect(result.printWarning?.message).toBe(
      "Không thể kết nối tới máy in bếp. Vui lòng kiểm tra nguồn điện và dây mạng của máy in!",
    );

    const [failedJob] = await db
      .select()
      .from(schema.printJobs)
      .where(eq(schema.printJobs.orderId, order.id));

    expect(failedJob.status).toBe("FAILED");
    expect(failedJob.retryCount).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/v1/print-jobs?status=FAILED: lists failed jobs for authenticated users", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/print-jobs?status=FAILED", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });
    const res = await listPrintJobsHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it("POST /api/v1/orders/kitchen-print (API-02): delegates to sendKitchenOrder", async () => {
    const tableId = await createTable();
    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_${rand()}`,
        orderType: "TAI_BAN",
        tableId,
        shiftId: testShiftId,
        totalAmount: 60000,
        finalAmount: 60000,
        status: "DANG_PHUC_VU",
        version: 1,
        createdById: waiterUserId,
      })
      .returning();

    await db.insert(schema.orderItems).values([
      { orderId: order.id, menuItemId: kitchenItemId, quantity: 1, unitPrice: 60000, isPrintedKitchen: false },
    ]);

    const req = new NextRequest("http://localhost:3000/api/v1/orders/kitchen-print", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderId: order.id, expectedVersion: 1 }),
    });

    const res = await kitchenPrintHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.orderId).toBe(order.id);
  });
});
