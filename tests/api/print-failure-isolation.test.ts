import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import net from "net";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { sendKitchenOrder } from "@/server/orders/send-kitchen-service";
import { POST as sendKitchenHandler } from "@/app/api/v1/orders/[id]/send-kitchen/route";
import { savePrinterSettings } from "@/server/printing/settings-service";
import * as printService from "@/server/printing/print-service";
import { ERROR_CATALOG } from "@/lib/error-catalog";

describe("Send Kitchen Failure Isolation Tests (Point 1)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 8);
  const tag = rand();

  let waiterToken: string;
  let waiterUserId: number;

  let testAreaId: number;
  let testTableId: number;
  let testShiftId: number;
  let kitchenItemId: number;
  let barItemId: number;

  const createdOrderIds: number[] = [];
  const createdTableIds: number[] = [];

  const createTable = async () => {
    const [tbl] = await db
      .insert(schema.tables)
      .values({ code: `TB_ISO_${rand()}`, name: `Bàn Isolation ${rand()}`, areaId: testAreaId, capacity: 4, status: "DANG_DUNG" })
      .returning();
    createdTableIds.push(tbl.id);
    return tbl.id;
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const [user] = await db
      .insert(schema.users)
      .values({ username: `u_iso_${tag}`, passwordHash: "dummy", fullName: "Nhân Viên Isolation", role: "PHUC_VU" })
      .returning();
    waiterUserId = user.id;
    waiterToken = await signAuthToken({ userId: user.id, username: user.username, fullName: user.fullName, role: "PHUC_VU" });

    const [area] = await db
      .insert(schema.areas)
      .values({ code: `AR_ISO_${tag}`, name: `Khu Isolation ${tag}` })
      .returning();
    testAreaId = area.id;

    const [table] = await db
      .insert(schema.tables)
      .values({ code: `TB_ISO_${tag}`, name: `Bàn Isolation ${tag}`, areaId: testAreaId, capacity: 4, status: "DANG_DUNG" })
      .returning();
    testTableId = table.id;

    const [shift] = await db
      .insert(schema.shifts)
      .values({ shiftCode: `CA_ISO_${tag}`, cashierId: waiterUserId, initialCash: 100000, status: "DANG_MO" })
      .returning();
    testShiftId = shift.id;

    const [cat] = await db
      .insert(schema.categories)
      .values({ code: `CAT_ISO_${tag}`, name: "Thực đơn Isolation" })
      .returning();

    const [kItem] = await db
      .insert(schema.menuItems)
      .values({ code: `K_${tag}`, categoryId: cat.id, name: "Cơm rang dưa bò", price: 60000, targetPrinter: "KITCHEN", status: "DANG_BAN" })
      .returning();
    kitchenItemId = kItem.id;

    const [bItem] = await db
      .insert(schema.menuItems)
      .values({ code: `B_${tag}`, categoryId: cat.id, name: "Trà tắc xí muội", price: 30000, targetPrinter: "BAR", status: "DANG_BAN" })
      .returning();
    barItemId = bItem.id;
  });

  afterAll(async () => {
    if (db) {
      if (createdOrderIds.length > 0) {
        await db.delete(schema.printJobs).where(inArray(schema.printJobs.orderId, createdOrderIds));
        await db.delete(schema.orderItems).where(inArray(schema.orderItems.orderId, createdOrderIds));
        await db.delete(schema.orders).where(inArray(schema.orders.id, createdOrderIds));
      }
      await db.delete(schema.menuItems).where(inArray(schema.menuItems.id, [kitchenItemId, barItemId]));
      await db.delete(schema.shifts).where(eq(schema.shifts.id, testShiftId));
      if (createdTableIds.length > 0) {
        await db.delete(schema.tables).where(inArray(schema.tables.id, createdTableIds));
      }
      await db.delete(schema.areas).where(eq(schema.areas.id, testAreaId));
      await db.delete(schema.users).where(eq(schema.users.id, waiterUserId));

      await savePrinterSettings({
        kitchenIp: "",
        barIp: "",
        receiptIp: "",
      });
    }
    await pool.end();
  });

  it("returns HTTP 200 with printWarning when both Kitchen and Bar printers fail", async () => {
    // Set invalid / unreachable dynamic loopback ports
    await savePrinterSettings({
      kitchenIp: "127.0.0.1:9108", // No server listening
      barIp: "127.0.0.1:9109",     // No server listening
    });

    const tId1 = await createTable();
    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_BOTH_FAIL_${rand()}`,
        orderType: "TAI_BAN",
        tableId: tId1,
        shiftId: testShiftId,
        totalAmount: 90000,
        finalAmount: 90000,
        status: "DANG_PHUC_VU",
        version: 1,
        createdById: waiterUserId,
      })
      .returning();
    createdOrderIds.push(order.id);

    await db.insert(schema.orderItems).values([
      { orderId: order.id, menuItemId: kitchenItemId, quantity: 1, unitPrice: 60000, isPrintedKitchen: false },
      { orderId: order.id, menuItemId: barItemId, quantity: 1, unitPrice: 30000, isPrintedKitchen: false },
    ]);

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/send-kitchen`, {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expectedVersion: 1 }),
    });

    const res = await sendKitchenHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.printWarning).toBeDefined();
    expect(json.printWarning.message).toBe(ERROR_CATALOG.ERR_06.message);
    expect(json.printWarning.failedJobs.length).toBe(2);

    // Business items were committed and marked sent
    const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
    expect(items.every((i) => i.isPrintedKitchen)).toBe(true);
  });

  it("returns HTTP 200 with printWarning even when dispatchPrintJob throws a simulated unexpected error", async () => {
    const tId2 = await createTable();
    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_UNEXPECTED_${rand()}`,
        orderType: "TAI_BAN",
        tableId: tId2,
        shiftId: testShiftId,
        totalAmount: 60000,
        finalAmount: 60000,
        status: "DANG_PHUC_VU",
        version: 1,
        createdById: waiterUserId,
      })
      .returning();
    createdOrderIds.push(order.id);

    await db.insert(schema.orderItems).values([
      { orderId: order.id, menuItemId: kitchenItemId, quantity: 1, unitPrice: 60000, isPrintedKitchen: false },
    ]);

    // Force dispatchPrintJob to reject
    const spy = vi
      .spyOn(printService, "dispatchPrintJob")
      .mockRejectedValue(new Error("Simulated catastrophic dispatch failure"));

    try {
      const result = await sendKitchenOrder(order.id, 1, "Nhân Viên");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.printWarning).toBeDefined();
        expect(result.printWarning?.message).toBe(ERROR_CATALOG.ERR_06.message);
      }
    } finally {
      spy.mockRestore();
    }
  });

  it("handles printer disconnect midway without failing the send kitchen request (HTTP 200)", async () => {
    // Start a server that abruptly destroys connection on data
    let abruptServer: net.Server;
    await new Promise<void>((resolve) => {
      abruptServer = net.createServer((socket) => {
        socket.on("data", () => {
          socket.destroy(); // Abrupt drop
        });
      });
      abruptServer.listen(9105, "127.0.0.1", () => resolve());
    });

    await savePrinterSettings({ kitchenIp: "127.0.0.1:9105" });

    const tId3 = await createTable();
    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_DROP_${rand()}`,
        orderType: "TAI_BAN",
        tableId: tId3,
        shiftId: testShiftId,
        totalAmount: 60000,
        finalAmount: 60000,
        status: "DANG_PHUC_VU",
        version: 1,
        createdById: waiterUserId,
      })
      .returning();
    createdOrderIds.push(order.id);

    await db.insert(schema.orderItems).values([
      { orderId: order.id, menuItemId: kitchenItemId, quantity: 1, unitPrice: 60000, isPrintedKitchen: false },
    ]);

    try {
      const result = await sendKitchenOrder(order.id, 1, "Nhân Viên");
      expect(result.ok).toBe(true);
    } finally {
      await new Promise<void>((resolve) => abruptServer.close(() => resolve()));
    }
  });
});
