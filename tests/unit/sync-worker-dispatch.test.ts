import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "http";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { processSyncOutbox, recordSyncInvoiceEvent, SYNC_OUTBOX_TYPES } from "@/server/sync";

describe("Sync Worker Dispatching (NFR-04, DEC-10)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  let mockServer: http.Server;
  let mockPort: number;
  let receivedHeaders: http.IncomingHttpHeaders[] = [];
  let receivedBodies: any[] = [];

  const rand = () => Math.random().toString(36).slice(2, 8);
  const tag = rand();

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    await new Promise<void>((resolve) => {
      mockServer = http.createServer((req, res) => {
        receivedHeaders.push(req.headers);
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => {
          if (data) receivedBodies.push(JSON.parse(data));
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
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

  it("safely handles unconfigured SYNC_TARGET_URL by keeping events PENDING", async () => {
    const item = await recordSyncInvoiceEvent(
      {
        orderId: 101,
        orderCode: `HD_${tag}_101`,
        orderType: "MANG_VE",
        status: "DA_THANH_TOAN",
        totalAmount: 10000,
        discountAmount: 0,
        finalAmount: 10000,
        paymentMethod: "TIEN_MAT",
        paidAt: new Date().toISOString(),
        voidedAt: null,
        voidReason: null,
        queueNumber: 1,
        shiftId: 1,
        version: 1,
      },
      db as any,
    );

    const result = await processSyncOutbox({ targetUrl: "" });
    expect(result.configured).toBe(false);
    expect(result.processed).toBe(0);
    expect(result.pending).toBeGreaterThan(0);

    const [row] = await db
      .select()
      .from(schema.outbox)
      .where(eq(schema.outbox.id, item!.id));
    expect(row.status).toBe("PENDING");

    await db.delete(schema.outbox).where(eq(schema.outbox.id, item!.id));
  });

  it("successfully dispatches sync item and marks it SENT with headers", async () => {
    receivedHeaders = [];
    receivedBodies = [];

    const item = await recordSyncInvoiceEvent(
      {
        orderId: 102,
        orderCode: `HD_${tag}_102`,
        orderType: "MANG_VE",
        status: "DA_THANH_TOAN",
        totalAmount: 20000,
        discountAmount: 0,
        finalAmount: 20000,
        paymentMethod: "TIEN_MAT",
        paidAt: new Date().toISOString(),
        voidedAt: null,
        voidReason: null,
        queueNumber: 2,
        shiftId: 1,
        version: 1,
      },
      db as any,
    );

    const targetUrl = `http://127.0.0.1:${mockPort}/sync-endpoint`;
    const result = await processSyncOutbox({
      targetUrl,
      apiKey: "secret-key-123",
      batchSize: 5,
    });

    expect(result.configured).toBe(true);
    expect(result.sent).toBeGreaterThanOrEqual(1);

    expect(receivedHeaders.length).toBeGreaterThan(0);
    const lastHeader = receivedHeaders[receivedHeaders.length - 1];
    expect(lastHeader["idempotency-key"]).toBe(`sync_invoice_102_v1`);
    expect(lastHeader["x-api-key"]).toBe("secret-key-123");

    const [row] = await db
      .select()
      .from(schema.outbox)
      .where(eq(schema.outbox.id, item!.id));
    expect(row.status).toBe("SENT");
    expect(row.sentAt).not.toBeNull();
    expect(row.lastError).toBeNull();

    await db.delete(schema.outbox).where(eq(schema.outbox.id, item!.id));
  });
});
