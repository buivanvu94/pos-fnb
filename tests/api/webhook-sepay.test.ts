import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { POST as sepayWebhookHandler } from "@/app/api/v1/webhooks/sepay/route";
import { createOrderWithPendingPayment, type SepayTestContext } from "./sepay-test-helper";

describe("SePay Webhook API - POST /api/v1/webhooks/sepay (DEC-06, FR-12)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let ctx: SepayTestContext;

  const rand = () => Math.random().toString(36).slice(2, 8);
  const tag = rand();

  const originalApiKey = process.env.SEPAY_API_KEY;
  const TEST_SEPAY_API_KEY = "test_sepay_api_secret_key_12345";

  beforeAll(async () => {
    process.env.SEPAY_API_KEY = TEST_SEPAY_API_KEY;
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const [user] = await db.insert(schema.users).values({
      username: `u_sp_${tag}`,
      fullName: "User Test SePay",
      role: "THU_NGAN",
      passwordHash: "dummy",
    }).returning();

    const [area] = await db.insert(schema.areas).values({ code: `AR_SP_${tag}`, name: `Khu SP ${tag}` }).returning();

    const [shift] = await db.insert(schema.shifts).values({
      shiftCode: `CA_SP_${tag}`,
      cashierId: user.id,
      initialCash: 100_000,
      status: "DANG_MO",
    }).returning();

    const [cat] = await db.insert(schema.categories).values({ code: `CAT_SP_${tag}`, name: "Menu SP" }).returning();
    const [item] = await db.insert(schema.menuItems).values({
      code: `MI_SP_${tag}`,
      categoryId: cat.id,
      name: "Bạc xỉu",
      price: 90_000,
      targetPrinter: "BAR",
    }).returning();

    ctx = { db, testUserId: user.id, testAreaId: area.id, testShiftId: shift.id, testMenuItemId: item.id };
  });

  afterAll(async () => {
    if (originalApiKey !== undefined) {
      process.env.SEPAY_API_KEY = originalApiKey;
    } else {
      delete process.env.SEPAY_API_KEY;
    }
    if (pool) await pool.end();
  });

  it("rejects unauthorized webhook with 401 when API key is wrong", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/webhooks/sepay", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Apikey WRONG_KEY" },
      body: JSON.stringify({ id: 9999, content: "HD0001", transferAmount: 90000 }),
    });

    const res = await sepayWebhookHandler(req);
    expect(res.status).toBe(401);
  });

  it("completes order when API key matches and amount is exact (DA_THANH_TOAN, frees table)", async () => {
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

  it("is idempotent: sending same transaction ID twice completes once and returns idempotent true", async () => {
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
    const json1 = await res1.json();
    expect(json1.ok).toBe(true);
    expect(json1.idempotent).toBeUndefined();

    const res2 = await sepayWebhookHandler(makeReq());
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.ok).toBe(true);
    expect(json2.idempotent).toBe(true);
  });

  it("does not complete order and logs to unmatched_transactions when amount is deficient", async () => {
    const { order, compactCode } = await createOrderWithPendingPayment(ctx, `HD_${rand()}`, 90000);
    const txId = Math.floor(Math.random() * 900000) + 100000;

    const req = new NextRequest("http://localhost:3000/api/v1/webhooks/sepay", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Apikey ${TEST_SEPAY_API_KEY}` },
      body: JSON.stringify({
        id: txId,
        transferType: "in",
        transferAmount: 50000,
        content: `Chuyen khoan ${compactCode}`,
      }),
    });

    const res = await sepayWebhookHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.unmatched).toBe(true);

    const [dbOrder] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
    expect(dbOrder.status).toBe("DANG_PHUC_VU");

    const [unmatched] = await db
      .select()
      .from(schema.unmatchedTransactions)
      .where(eq(schema.unmatchedTransactions.gatewayTransactionId, String(txId)));
    expect(unmatched).toBeDefined();
    expect(unmatched.amount).toBe(50000);
    expect(unmatched.status).toBe("UNRESOLVED");
    expect(unmatched.reason).toContain("không đủ");
  });

  it("reconciles late payment: completes order even if payment had EXPIRED (funds preserved)", async () => {
    const { order, compactCode } = await createOrderWithPendingPayment(ctx, `HD_${rand()}`, 90000, true);
    const txId = Math.floor(Math.random() * 900000) + 100000;

    const req = new NextRequest("http://localhost:3000/api/v1/webhooks/sepay", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Apikey ${TEST_SEPAY_API_KEY}` },
      body: JSON.stringify({
        id: txId,
        transferType: "in",
        transferAmount: 90000,
        content: `Thanh toan tre ${compactCode}`,
      }),
    });

    const res = await sepayWebhookHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    const [dbOrder] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
    expect(dbOrder.status).toBe("DA_THANH_TOAN");
  });
});
