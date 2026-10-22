import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { payOrderCash } from "@/server/payments/cash-payment-service";
import { processSyncOutbox, SYNC_OUTBOX_TYPES } from "@/server/sync";
import { generateSafeTestPin, clearManagerPinHash } from "../helpers/test-pin-helper";

describe("Network Outage Resilience & Recovery (NFR-04, DEC-10)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  let mockServer: http.Server | null = null;
  let mockPort: number;

  const rand = () => Math.random().toString(36).slice(2, 8);
  const tag = rand();

  let cashierId: number;
  let managerId: number;
  let shiftId: number;
  let categoryId: number;
  let menuItemId: number;
  const managerPin = generateSafeTestPin();

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    // Pick an unused port for server
    const srv = http.createServer();
    await new Promise<void>((resolve) => {
      srv.listen(0, "127.0.0.1", () => {
        const addr = srv.address() as any;
        mockPort = addr.port;
        srv.close(() => resolve());
      });
    });

    const [mgr] = await db
      .insert(schema.users)
      .values({
        username: `mgr_res_${tag}`,
        fullName: "Quản Lý Resilience",
        role: "QUAN_LY",
        passwordHash: "dummy",
        pinHash: await bcrypt.hash(managerPin, 10),
      })
      .returning();
    managerId = mgr.id;

    const [csh] = await db
      .insert(schema.users)
      .values({ username: `csh_res_${tag}`, fullName: "Thu Ngân Res", role: "THU_NGAN", passwordHash: "dummy" })
      .returning();
    cashierId = csh.id;

    const [shift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_RES_${tag}`,
        cashierId,
        initialCash: 1000000,
        expectedCash: 1000000,
        status: "DANG_MO",
      })
      .returning();
    shiftId = shift.id;

    const [cat] = await db
      .insert(schema.categories)
      .values({ code: `CAT_RES_${tag}`, name: "Cat Res" })
      .returning();
    categoryId = cat.id;

    const [mItem] = await db
      .insert(schema.menuItems)
      .values({ code: `MI_RES_${tag}`, categoryId: cat.id, name: `Item Res ${tag}`, price: 50000 })
      .returning();
    menuItemId = mItem.id;
  });

  afterAll(async () => {
    if (mockServer) mockServer.close();
    if (db) {
      await clearManagerPinHash(db, managerId);
      await db.delete(schema.outbox).where(inArray(schema.outbox.type, [...SYNC_OUTBOX_TYPES]));
    }
    await pool.end();
  });

  it("handles payment & shift operations normally during connection refusal, recovers to 0 PENDING", async () => {
    // Clear outbox before test run
    await db.delete(schema.outbox).where(inArray(schema.outbox.type, [...SYNC_OUTBOX_TYPES]));

    // 1. Target server is offline (refuses connection)
    const deadTargetUrl = `http://127.0.0.1:${mockPort}/events`;

    // 2. Perform Cash Payment while internet / target is down
    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_RES_${tag}`,
        orderType: "MANG_VE",
        shiftId,
        totalAmount: 50000,
        finalAmount: 50000,
        status: "DANG_PHUC_VU",
        version: 1,
      })
      .returning();

    await db.insert(schema.orderItems).values({
      orderId: order.id,
      menuItemId,
      quantity: 1,
      unitPrice: 50000,
      isCancelled: false,
    });

    const [currentShift] = await db.select().from(schema.shifts).where(eq(schema.shifts.id, shiftId));

    const payResult = await payOrderCash({
      orderId: order.id,
      tienKhachDua: 50000,
      expectedVersion: 1,
      user: { userId: cashierId, username: "csh", fullName: "Csh", role: "THU_NGAN" },
      shift: currentShift,
      printPickupTicket: false,
    });

    expect(payResult.ok).toBe(true);
    expect(payResult.status).toBe(200);

    // Verify outbox queued SYNC_INVOICE event
    const [pendingItem] = await db
      .select()
      .from(schema.outbox)
      .where(
        and(
          eq(schema.outbox.status, "PENDING"),
          eq(schema.outbox.idempotencyKey, `sync_invoice_${order.id}_v2`),
        ),
      );
    expect(pendingItem).toBeDefined();

    // 3. Worker tries to run against offline target -> fails gracefully, item remains PENDING
    const offlineRun = await processSyncOutbox({ targetUrl: deadTargetUrl, batchSize: 20 });
    expect(offlineRun.failed).toBeGreaterThanOrEqual(1);

    // 4. Network restored: start mock server
    await new Promise<void>((resolve) => {
      mockServer = http.createServer((req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      });
      mockServer.listen(mockPort, "127.0.0.1", () => resolve());
    });

    // Reset nextAttemptAt to now to bypass exponential backoff delay for test
    await db
      .update(schema.outbox)
      .set({ nextAttemptAt: new Date(Date.now() - 1000) })
      .where(eq(schema.outbox.id, pendingItem.id));

    // 5. Worker runs with network back up -> sync succeeds, outbox reaches 0 PENDING
    const onlineRun = await processSyncOutbox({ targetUrl: deadTargetUrl, batchSize: 20 });
    expect(onlineRun.sent).toBeGreaterThanOrEqual(1);

    const remainingPending = await db
      .select()
      .from(schema.outbox)
      .where(
        and(
          eq(schema.outbox.status, "PENDING"),
          eq(schema.outbox.id, pendingItem.id),
        ),
      );
    expect(remainingPending.length).toBe(0);
  });
});
