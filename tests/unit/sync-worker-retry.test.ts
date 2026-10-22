import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "http";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { processSyncOutbox, recordSyncInvoiceEvent, SYNC_OUTBOX_TYPES } from "@/server/sync";

describe("Sync Worker Retry & Timeout (NFR-04, DEC-10)", () => {
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
          if (delayMs > 0) {
            setTimeout(sendResponse, delayMs);
          } else {
            sendResponse();
          }
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

  it("retries with backoff on HTTP failure and marks FAILED when exhausted", async () => {
    mockStatusCode = 500;
    delayMs = 0;

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
    // Attempt 1 of 2
    const res1 = await processSyncOutbox({
      targetUrl,
      batchSize: 1,
      maxAttempts: 2,
      initialBackoffSeconds: 1,
    });
    expect(res1.failed).toBeGreaterThanOrEqual(1);

    let [row] = await db
      .select()
      .from(schema.outbox)
      .where(eq(schema.outbox.id, item!.id));
    expect(row.attempts).toBe(1);
    expect(row.status).toBe("PENDING");
    expect(row.nextAttemptAt).not.toBeNull();

    // Fast-forward nextAttemptAt to allow immediate second attempt
    await db
      .update(schema.outbox)
      .set({ nextAttemptAt: new Date(Date.now() - 1000) })
      .where(eq(schema.outbox.id, item!.id));

    // Attempt 2 of 2 -> should exhaust and mark FAILED
    const res2 = await processSyncOutbox({
      targetUrl,
      batchSize: 1,
      maxAttempts: 2,
    });
    expect(res2.failed).toBeGreaterThanOrEqual(1);

    [row] = await db
      .select()
      .from(schema.outbox)
      .where(eq(schema.outbox.id, item!.id));
    expect(row.attempts).toBe(2);
    expect(row.status).toBe("FAILED");
    expect(row.lastError).toContain("500");

    await db.delete(schema.outbox).where(eq(schema.outbox.id, item!.id));
  });

  it("handles timeout gracefully when server takes longer than timeoutMs", async () => {
    mockStatusCode = 200;
    delayMs = 500; // longer than 100ms timeout

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

    const targetUrl = `http://127.0.0.1:${mockPort}/sync-timeout`;
    const res = await processSyncOutbox({
      targetUrl,
      batchSize: 1,
      timeoutMs: 100,
    });

    expect(res.failed).toBeGreaterThanOrEqual(1);

    const [row] = await db
      .select()
      .from(schema.outbox)
      .where(eq(schema.outbox.id, item!.id));
    expect(row.attempts).toBe(1);
    expect(row.lastError?.toLowerCase()).toContain("abort");

    delayMs = 0;
    await db.delete(schema.outbox).where(eq(schema.outbox.id, item!.id));
  });
});
