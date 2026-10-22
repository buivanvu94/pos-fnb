import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "http";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import {
  processSyncOutbox,
  recordSyncInvoiceEvent,
  requeueFailedSyncItems,
  calculateBackoffSeconds,
  SYNC_OUTBOX_TYPES,
} from "@/server/sync";

describe("Sync Worker Retry, Failure Classification & Requeue (NFR-04, DEC-10)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  let mockServer: http.Server;
  let mockPort: number;
  let mockStatusCode = 500;
  let delayMs = 0;

  const rand = () => Math.random().toString(36).slice(2, 8);
  const tag = rand();

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    await new Promise<void>((resolve) => {
      mockServer = http.createServer((req, res) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => {
          const sendResponse = () => {
            res.writeHead(mockStatusCode, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: mockStatusCode === 200 }));
          };
          if (delayMs > 0) setTimeout(sendResponse, delayMs);
          else sendResponse();
        });
      });
      mockServer.listen(0, "127.0.0.1", () => {
        const addr = mockServer.address() as any;
        mockPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    mockServer.close();
    await pool.end();
  });

  beforeEach(async () => {
    if (db) {
      await db.delete(schema.outbox).where(inArray(schema.outbox.type, [...SYNC_OUTBOX_TYPES]));
    }
  });

  it("prolonged server 500/network outage keeps items PENDING, capping backoff at 300s", async () => {
    mockStatusCode = 500;
    delayMs = 0;

    // Test backoff formula and cap directly
    expect(calculateBackoffSeconds(0, 5, 300)).toBe(5);
    expect(calculateBackoffSeconds(1, 5, 300)).toBe(10);
    expect(calculateBackoffSeconds(4, 5, 300)).toBe(80);
    expect(calculateBackoffSeconds(7, 5, 300)).toBe(300); // 5 * 128 = 640 -> capped at 300

    const item = await recordSyncInvoiceEvent(
      {
        orderId: 103,
        orderCode: `HD_${tag}_103`,
        orderType: "MANG_VE",
        status: "DA_THANH_TOAN",
        totalAmount: 30000,
        discountAmount: 0,
        finalAmount: 30000,
        paymentMethod: "TIEN_MAT",
        paidAt: new Date().toISOString(),
        voidedAt: null,
        voidReason: null,
        queueNumber: 3,
        shiftId: 1,
        version: 1,
      },
      db as any,
    );

    const targetUrl = `http://127.0.0.1:${mockPort}/sync-fail`;

    // Simulate 3 consecutive failures under outage
    for (let attempt = 1; attempt <= 3; attempt++) {
      // Force immediate retry
      await db
        .update(schema.outbox)
        .set({ nextAttemptAt: new Date(Date.now() - 1000) })
        .where(eq(schema.outbox.id, item!.id));

      const res = await processSyncOutbox({ targetUrl, batchSize: 1 });
      expect(res.failed).toBe(1);

      const [row] = await db.select().from(schema.outbox).where(eq(schema.outbox.id, item!.id));
      expect(row.status).toBe("PENDING");
      expect(row.attempts).toBe(attempt);
      expect(row.lastError).toContain("500");
    }

    await db.delete(schema.outbox).where(eq(schema.outbox.id, item!.id));
  });

  it("permanent 4xx marks item FAILED, and requeueFailedSyncItems restores to PENDING", async () => {
    mockStatusCode = 400; // Bad request
    delayMs = 0;

    const item = await recordSyncInvoiceEvent(
      {
        orderId: 104,
        orderCode: `HD_${tag}_104`,
        orderType: "MANG_VE",
        status: "DA_THANH_TOAN",
        totalAmount: 40000,
        discountAmount: 0,
        finalAmount: 40000,
        paymentMethod: "TIEN_MAT",
        paidAt: new Date().toISOString(),
        voidedAt: null,
        voidReason: null,
        queueNumber: 4,
        shiftId: 1,
        version: 1,
      },
      db as any,
    );

    const targetUrl = `http://127.0.0.1:${mockPort}/sync-4xx`;
    const res = await processSyncOutbox({ targetUrl, batchSize: 1 });
    expect(res.failed).toBe(1);

    let [row] = await db.select().from(schema.outbox).where(eq(schema.outbox.id, item!.id));
    expect(row.status).toBe("FAILED");
    expect(row.nextAttemptAt).toBeNull();
    expect(row.lastError).toContain("400");

    // Requeue failed items
    const requeued = await requeueFailedSyncItems();
    expect(requeued).toBe(1);

    [row] = await db.select().from(schema.outbox).where(eq(schema.outbox.id, item!.id));
    expect(row.status).toBe("PENDING");
    expect(row.attempts).toBe(0);
    expect(row.lastError).toBeNull();

    await db.delete(schema.outbox).where(eq(schema.outbox.id, item!.id));
  });

  it("handles timeout gracefully when server takes longer than timeoutMs", async () => {
    mockStatusCode = 200;
    delayMs = 400;

    const item = await recordSyncInvoiceEvent(
      {
        orderId: 105,
        orderCode: `HD_${tag}_105`,
        orderType: "MANG_VE",
        status: "DA_THANH_TOAN",
        totalAmount: 50000,
        discountAmount: 0,
        finalAmount: 50000,
        paymentMethod: "TIEN_MAT",
        paidAt: new Date().toISOString(),
        voidedAt: null,
        voidReason: null,
        queueNumber: 5,
        shiftId: 1,
        version: 1,
      },
      db as any,
    );

    const targetUrl = `http://127.0.0.1:${mockPort}/sync-timeout`;
    const res = await processSyncOutbox({ targetUrl, batchSize: 1, timeoutMs: 100 });
    expect(res.failed).toBe(1);

    const [row] = await db.select().from(schema.outbox).where(eq(schema.outbox.id, item!.id));
    expect(row.status).toBe("PENDING");
    expect(row.attempts).toBe(1);
    expect(row.lastError?.toLowerCase()).toContain("abort");

    delayMs = 0;
    await db.delete(schema.outbox).where(eq(schema.outbox.id, item!.id));
  });
});
