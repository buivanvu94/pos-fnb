import { describe, it, expect, beforeAll, afterAll } from "vitest";
import net from "net";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { sendKitchenOrder } from "@/server/orders/send-kitchen-service";
import { retryPrintJob, enqueuePrintJob } from "@/server/printing/print-service";
import { savePrinterSettings } from "@/server/printing/settings-service";

describe("Mock TCP Printer & NFR-02 Performance Verification", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 8);
  const tag = rand();

  let mockServer: net.Server;
  let mockPort: number;
  let receivedData = Buffer.alloc(0);

  let testUserId: number;
  let testAreaId: number;
  let testTableId: number;
  let testShiftId: number;
  let testMenuItemId: number;

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    // 1. Start mock TCP socket server
    await new Promise<void>((resolve) => {
      mockServer = net.createServer((socket) => {
        socket.on("data", (chunk) => {
          receivedData = Buffer.concat([receivedData, chunk]);
        });
        socket.on("end", () => {
          socket.end();
        });
      });
      mockServer.listen(0, "127.0.0.1", () => {
        const addr = mockServer.address() as net.AddressInfo;
        mockPort = addr.port;
        resolve();
      });
    });

    // Point kitchen and receipt printers to the mock server port
    await savePrinterSettings({
      kitchenIp: `127.0.0.1:${mockPort}`,
      barIp: `127.0.0.1:${mockPort}`,
      receiptIp: `127.0.0.1:${mockPort}`,
      paperWidth: 80,
    });

    // 2. Seed test entities
    const [user] = await db
      .insert(schema.users)
      .values({ username: `u_${tag}`, passwordHash: "dummy", fullName: "User NFR", role: "PHUC_VU" })
      .returning();
    testUserId = user.id;

    const [area] = await db
      .insert(schema.areas)
      .values({ code: `AR_${tag}`, name: `Khu NFR ${tag}` })
      .returning();
    testAreaId = area.id;

    const [tbl] = await db
      .insert(schema.tables)
      .values({ code: `TB_${tag}`, name: `Bàn NFR ${tag}`, areaId: testAreaId, capacity: 4, status: "DANG_DUNG" })
      .returning();
    testTableId = tbl.id;

    const [shift] = await db
      .insert(schema.shifts)
      .values({ shiftCode: `CA_${tag}`, cashierId: testUserId, initialCash: 100000, status: "DANG_MO" })
      .returning();
    testShiftId = shift.id;

    const [cat] = await db
      .insert(schema.categories)
      .values({ code: `CAT_${tag}`, name: "Thực đơn NFR" })
      .returning();

    const [item] = await db
      .insert(schema.menuItems)
      .values({
        code: `M_${tag}`,
        categoryId: cat.id,
        name: "Phở bò đặc biệt",
        price: 75000,
        targetPrinter: "KITCHEN",
        status: "DANG_BAN",
      })
      .returning();
    testMenuItemId = item.id;
  });

  afterAll(async () => {
    if (mockServer) {
      await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    }
    if (db) {
      await db.delete(schema.orderItems).where(eq(schema.orderItems.menuItemId, testMenuItemId));
      await db.delete(schema.orders).where(eq(schema.orders.shiftId, testShiftId));
      await db.delete(schema.menuItems).where(eq(schema.menuItems.id, testMenuItemId));
      await db.delete(schema.shifts).where(eq(schema.shifts.id, testShiftId));
      await db.delete(schema.tables).where(eq(schema.tables.id, testTableId));
      await db.delete(schema.areas).where(eq(schema.areas.id, testAreaId));
      await db.delete(schema.users).where(eq(schema.users.id, testUserId));
    }
    await pool.end();
  });

  it("NFR-02: Send Kitchen to mock TCP printer delivers full ESC/POS bytes under 2500ms", async () => {
    receivedData = Buffer.alloc(0);

    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_${rand()}`,
        orderType: "TAI_BAN",
        tableId: testTableId,
        shiftId: testShiftId,
        totalAmount: 150000,
        finalAmount: 150000,
        status: "DANG_PHUC_VU",
        version: 1,
        createdById: testUserId,
      })
      .returning();

    await db.insert(schema.orderItems).values([
      { orderId: order.id, menuItemId: testMenuItemId, quantity: 2, unitPrice: 75000, isPrintedKitchen: false },
    ]);

    const startTime = performance.now();
    const result = await sendKitchenOrder(order.id, 1, "Nhân Viên NFR");
    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(result.ok).toBe(true);
    expect(duration).toBeLessThan(2500); // NFR-02 requirement: < 2.5 seconds
    console.log(`NFR-02 Measured latency: ${duration.toFixed(2)} ms (Threshold: < 2500 ms)`);

    // Verify mock server received data
    expect(receivedData.length).toBeGreaterThan(100);

    // Verify ESC/POS byte integrity
    // ESC @ init
    expect(receivedData.subarray(0, 2)).toEqual(Buffer.from([0x1b, 0x40]));
    // GS v 0 raster header
    expect(receivedData.includes(Buffer.from([0x1d, 0x76, 0x30, 0x00]))).toBe(true);
    // GS V cut command
    expect(receivedData.includes(Buffer.from([0x1d, 0x56, 0x42, 0x00]))).toBe(true);

    const [job] = await db
      .select()
      .from(schema.printJobs)
      .where(eq(schema.printJobs.orderId, order.id));

    expect(job.status).toBe("SENT");
    expect(job.errorMessage).toBeNull();
  });

  it("retry failed job: transitioning status from FAILED to SENT upon successful mock print", async () => {
    // 1. Enqueue a job and simulate FAILED state
    const failedJob = await enqueuePrintJob({
      orderId: null,
      jobType: "KOT_KITCHEN",
      targetPrinter: "KITCHEN",
      payload: {
        kind: "KOT",
        orderId: 999,
        orderCode: "HD-RETRY-01",
        tableName: "Bàn Retry",
        senderName: "Thu Ngân",
        sentAt: new Date().toISOString(),
        targetStation: "KITCHEN",
        items: [{ name: "Món in lại", quantity: 1, unitPrice: 50000 }],
      },
    });

    await db
      .update(schema.printJobs)
      .set({ status: "FAILED", retryCount: 1, errorMessage: "Socket error" })
      .where(eq(schema.printJobs.id, failedJob.id));

    // 2. Execute retry
    const retryRes = await retryPrintJob(failedJob.id);
    expect(retryRes.ok).toBe(true);
    expect(retryRes.status).toBe("SENT");

    // 3. Verify in database
    const [updatedJob] = await db
      .select()
      .from(schema.printJobs)
      .where(eq(schema.printJobs.id, failedJob.id));

    expect(updatedJob.status).toBe("SENT");
    expect(updatedJob.errorMessage).toBeNull();
  });
});
