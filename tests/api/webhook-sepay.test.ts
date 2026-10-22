import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { POST as sepayWebhookHandler } from "@/app/api/v1/webhooks/sepay/route";
import { setupSepayTestContext, createOrderWithPendingPayment, type SepayTestContext } from "./sepay-test-helper";

describe("SePay Webhook API - POST /api/v1/webhooks/sepay (DEC-06, FR-12)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let ctx: SepayTestContext;

  const rand = () => Math.random().toString(36).slice(2, 8);
  const originalApiKey = process.env.SEPAY_API_KEY;
  const originalSecret = process.env.SEPAY_WEBHOOK_SECRET;
  const TEST_SEPAY_API_KEY = "test_sepay_api_secret_key_12345";

  beforeAll(async () => {
    process.env.SEPAY_API_KEY = TEST_SEPAY_API_KEY;
    delete process.env.SEPAY_WEBHOOK_SECRET;
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });
    ctx = await setupSepayTestContext(db);
  });

  afterAll(async () => {
    if (originalApiKey !== undefined) {
      process.env.SEPAY_API_KEY = originalApiKey;
    } else {
      delete process.env.SEPAY_API_KEY;
    }
    if (originalSecret !== undefined) {
      process.env.SEPAY_WEBHOOK_SECRET = originalSecret;
    } else {
      delete process.env.SEPAY_WEBHOOK_SECRET;
    }
    if (pool) await pool.end();
  });

  it("fail-closed: rejects unauthorized webhook with 401 when API key is wrong or unconfigured", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/webhooks/sepay", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Apikey WRONG_KEY" },
      body: JSON.stringify({ id: 9999, content: "HD0001", transferAmount: 90000 }),
    });
    const res = await sepayWebhookHandler(req);
    expect(res.status).toBe(401);
    expect((await res.json()).success).toBe(false);

    delete process.env.SEPAY_API_KEY;
    const reqUnconf = new NextRequest("http://localhost:3000/api/v1/webhooks/sepay", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Apikey ${TEST_SEPAY_API_KEY}` },
      body: JSON.stringify({ id: 9999, content: "HD0001", transferAmount: 90000 }),
    });
    const resUnconf = await sepayWebhookHandler(reqUnconf);
    expect(resUnconf.status).toBe(401);
    process.env.SEPAY_API_KEY = TEST_SEPAY_API_KEY;
  });

  it("completes order when API key matches and amount is exact (DA_THANH_TOAN, frees table, success: true)", async () => {
    const { order, table, compactCode } = await createOrderWithPendingPayment(ctx, `HD_${rand()}`, 90000);
    const txId = Math.floor(Math.random() * 900000) + 100000;

    const req = new NextRequest("http://localhost:3000/api/v1/webhooks/sepay", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Apikey ${TEST_SEPAY_API_KEY}` },
      body: JSON.stringify({
        id: txId,
        gateway: "Vietcombank",
        transferType: "in",
        transferAmount: 90000,
        content: `Khach hang chuyen khoan ${compactCode} noi dung`,
      }),
    });

    const res = await sepayWebhookHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.ok).toBe(true);

    const [updatedOrder] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
    expect(updatedOrder.status).toBe("DA_THANH_TOAN");
    expect(updatedOrder.paymentMethod).toBe("VIETQR");

    const [updatedTable] = await db.select().from(schema.tables).where(eq(schema.tables.id, table.id));
    expect(updatedTable.status).toBe("TRONG");

    const [updatedPayment] = await db.select().from(schema.payments).where(eq(schema.payments.orderId, order.id));
    expect(updatedPayment.status).toBe("SUCCESS");
    expect(updatedPayment.sepayTransactionId).toBe(String(txId));
  });

  it("is idempotent: sending same transaction ID twice completes once and returns success: true", async () => {
    const { order, compactCode } = await createOrderWithPendingPayment(ctx, `HD_${rand()}`, 90000);
    const txId = Math.floor(Math.random() * 900000) + 100000;

    const makeReq = () =>
      new NextRequest("http://localhost:3000/api/v1/webhooks/sepay", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TEST_SEPAY_API_KEY}` },
        body: JSON.stringify({ id: txId, transferType: "in", transferAmount: 90000, content: compactCode }),
      });

    const res1 = await sepayWebhookHandler(makeReq());
    expect(res1.status).toBe(200);
    expect((await res1.json()).success).toBe(true);

    const res2 = await sepayWebhookHandler(makeReq());
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.success).toBe(true);
    expect(json2.idempotent).toBe(true);
  });

  it("logs to unmatched_transactions and returns success: true when amount is deficient or overpaid", async () => {
    const { order, compactCode } = await createOrderWithPendingPayment(ctx, `HD_${rand()}`, 90000);
    const txId = Math.floor(Math.random() * 900000) + 100000;

    // 1. Deficient amount
    const req = new NextRequest("http://localhost:3000/api/v1/webhooks/sepay", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Apikey ${TEST_SEPAY_API_KEY}` },
      body: JSON.stringify({ id: txId, transferType: "in", transferAmount: 50000, content: `Chuyen khoan ${compactCode}` }),
    });
    const res = await sepayWebhookHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.unmatched).toBe(true);

    const [unmatched] = await db
      .select()
      .from(schema.unmatchedTransactions)
      .where(eq(schema.unmatchedTransactions.gatewayTransactionId, String(txId)));
    expect(unmatched).toBeDefined();
    expect(unmatched.amount).toBe(50000);

    // 2. Overpaid amount
    const txIdOver = txId + 1;
    const reqOver = new NextRequest("http://localhost:3000/api/v1/webhooks/sepay", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Apikey ${TEST_SEPAY_API_KEY}` },
      body: JSON.stringify({ id: txIdOver, transferType: "in", transferAmount: 150000, content: `Chuyen khoan ${compactCode}` }),
    });
    const resOver = await sepayWebhookHandler(reqOver);
    expect(resOver.status).toBe(200);
    const jsonOver = await resOver.json();
    expect(jsonOver.success).toBe(true);
    expect(jsonOver.unmatched).toBe(true);

    const [unmatchedOver] = await db
      .select()
      .from(schema.unmatchedTransactions)
      .where(eq(schema.unmatchedTransactions.gatewayTransactionId, String(txIdOver)));
    expect(unmatchedOver).toBeDefined();
    expect(unmatchedOver.amount).toBe(150000);
    expect(unmatchedOver.reason).toContain("thừa");
  });

  it("reconciles late payment: completes order even if payment had EXPIRED (funds preserved)", async () => {
    const { order, compactCode } = await createOrderWithPendingPayment(ctx, `HD_${rand()}`, 90000, true);
    const txId = Math.floor(Math.random() * 900000) + 100000;

    const req = new NextRequest("http://localhost:3000/api/v1/webhooks/sepay", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Apikey ${TEST_SEPAY_API_KEY}` },
      body: JSON.stringify({ id: txId, transferType: "in", transferAmount: 90000, content: `Thanh toan tre ${compactCode}` }),
    });

    const res = await sepayWebhookHandler(req);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);

    const [dbOrder] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
    expect(dbOrder.status).toBe("DA_THANH_TOAN");
  });
});
