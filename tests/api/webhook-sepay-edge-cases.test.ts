import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { POST as sepayWebhookHandler } from "@/app/api/v1/webhooks/sepay/route";
import { setupSepayTestContext, createOrderWithPendingPayment, type SepayTestContext } from "./sepay-test-helper";

describe("SePay Webhook Edge Cases & Reviewer Hardening", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let ctx: SepayTestContext;

  const rand = () => Math.random().toString(36).slice(2, 8);
  const TEST_SEPAY_API_KEY = "test_sepay_api_secret_edge_cases";
  const originalApiKey = process.env.SEPAY_API_KEY;

  beforeAll(async () => {
    process.env.SEPAY_API_KEY = TEST_SEPAY_API_KEY;
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
    if (pool) await pool.end();
  });

  it("handles duplicate compact code HDxxxx across different days by logging unmatched when multiple active candidates exist", async () => {
    const compactCode = `HD${Math.floor(Math.random() * 8999 + 1000)}`;
    // Order 1 (e.g. yesterday)
    await createOrderWithPendingPayment(ctx, `HD-20261021-${compactCode.slice(2)}`, 90000);
    // Order 2 (e.g. today)
    await createOrderWithPendingPayment(ctx, `HD-20261022-${compactCode.slice(2)}`, 90000);

    const txId = Math.floor(Math.random() * 900000) + 100000;
    const req = new NextRequest("http://localhost:3000/api/v1/webhooks/sepay", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Apikey ${TEST_SEPAY_API_KEY}` },
      body: JSON.stringify({ id: txId, transferType: "in", transferAmount: 90000, content: `CK ${compactCode}` }),
    });

    const res = await sepayWebhookHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.unmatched).toBe(true);
    expect(json.error).toContain("trùng mã");
  });

  it("handles race condition: when cash already paid order, webhook logs to unmatched and returns success: true", async () => {
    const { order, compactCode } = await createOrderWithPendingPayment(ctx, `HD_${rand()}`, 90000);

    // Order paid by cash before webhook arrives
    await db.update(schema.orders).set({ status: "DA_THANH_TOAN" }).where(eq(schema.orders.id, order.id));

    const txId = Math.floor(Math.random() * 900000) + 100000;
    const req = new NextRequest("http://localhost:3000/api/v1/webhooks/sepay", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Apikey ${TEST_SEPAY_API_KEY}` },
      body: JSON.stringify({ id: txId, transferType: "in", transferAmount: 90000, content: `CK ${compactCode}` }),
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
  });

  it("handles concurrent duplicate webhooks with Promise.all: only 1 completes and both return success: true", async () => {
    const { order, compactCode } = await createOrderWithPendingPayment(ctx, `HD_${rand()}`, 90000);
    const txId = Math.floor(Math.random() * 900000) + 100000;

    const makeReq = () =>
      new NextRequest("http://localhost:3000/api/v1/webhooks/sepay", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Apikey ${TEST_SEPAY_API_KEY}` },
        body: JSON.stringify({ id: txId, transferType: "in", transferAmount: 90000, content: `CK ${compactCode}` }),
      });

    const [res1, res2] = await Promise.all([sepayWebhookHandler(makeReq()), sepayWebhookHandler(makeReq())]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    const j1 = await res1.json();
    const j2 = await res2.json();
    expect(j1.success).toBe(true);
    expect(j2.success).toBe(true);

    const [dbOrder] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
    expect(dbOrder.status).toBe("DA_THANH_TOAN");
  });

  it("logs to unmatched when shift of order has already closed (status != DANG_MO)", async () => {
    // Create closed shift
    const [closedShift] = await db.insert(schema.shifts).values({
      shiftCode: `CA_CLOSED_${rand()}`,
      cashierId: ctx.testUserId,
      initialCash: 100_000,
      status: "DA_DONG",
    }).returning();

    const closedCtx = { ...ctx, testShiftId: closedShift.id };
    const { compactCode } = await createOrderWithPendingPayment(closedCtx, `HD_${rand()}`, 90000);

    const txId = Math.floor(Math.random() * 900000) + 100000;
    const req = new NextRequest("http://localhost:3000/api/v1/webhooks/sepay", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Apikey ${TEST_SEPAY_API_KEY}` },
      body: JSON.stringify({ id: txId, transferType: "in", transferAmount: 90000, content: `CK ${compactCode}` }),
    });

    const res = await sepayWebhookHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.unmatched).toBe(true);
    expect(json.error).toContain("đã đóng");
  });
});
