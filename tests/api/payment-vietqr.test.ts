import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { POST as createVietQrHandler } from "@/app/api/v1/payments/vietqr/route";
import { GET as getPaymentStatusHandler } from "@/app/api/v1/payments/[id]/route";
import { POST as manualConfirmHandler } from "@/app/api/v1/payments/vietqr/manual-confirm/route";
import { crc16Ccitt } from "@/server/payments/vietqr-crc16";
import { setupVietQrTestContext, createVietQrTestOrder, type VietQrTestContext } from "./vietqr-test-helper";

describe("VietQR API - Create, Polling, Timeout & Manual Confirm (FR-12, BR-11, AC-08-1, AC-08-3)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let ctx: VietQrTestContext;

  const rand = () => Math.random().toString(36).slice(2, 8);

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });
    ctx = await setupVietQrTestContext(db);
  });

  afterAll(async () => {
    if (ctx?.managerUserId) {
      await db.update(schema.users).set({ pinHash: null }).where(eq(schema.users.id, ctx.managerUserId));
    }
    if (pool) await pool.end();
  });

  it("AC-08-1: creates dynamic VietQR containing bank BIN, account, 150000 VND and HD0012", async () => {
    const order = await createVietQrTestOrder(ctx, "HD-20261020-0012", 150000);
    const req = new NextRequest("http://localhost:3000/api/v1/payments/vietqr", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${AUTH_COOKIE_NAME}=${ctx.cashierToken}` },
      body: JSON.stringify({ orderId: order.id }),
    });

    const res = await createVietQrHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.transferContent).toBe("HD0012");
    expect(json.data.amount).toBe(150000);
    expect(json.data.remainingSeconds).toBe(180);
    expect(json.data.qrContent.startsWith("000201010212")).toBe(true);
    expect(json.data.qrContent).toContain("5406150000");

    const payloadWithoutCrc = json.data.qrContent.slice(0, -4);
    const crc = json.data.qrContent.slice(-4);
    expect(crc16Ccitt(payloadWithoutCrc)).toBe(crc);
  });

  it("AC-08-3: transitions payment to EXPIRED when 180 seconds elapse", async () => {
    const order = await createVietQrTestOrder(ctx, `HD_${rand()}`, 80000);
    const createReq = new NextRequest("http://localhost:3000/api/v1/payments/vietqr", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${AUTH_COOKIE_NAME}=${ctx.cashierToken}` },
      body: JSON.stringify({ orderId: order.id }),
    });
    const createRes = await createVietQrHandler(createReq);
    const { data } = await createRes.json();

    // Fast-forward simulated clock: set expires_at 10 seconds into the past
    await db.update(schema.payments)
      .set({ expiresAt: new Date(Date.now() - 10000) })
      .where(eq(schema.payments.id, data.paymentId));

    const pollReq = new NextRequest(`http://localhost:3000/api/v1/payments/${data.paymentId}`, {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${ctx.cashierToken}` },
    });
    const pollRes = await getPaymentStatusHandler(pollReq, { params: Promise.resolve({ id: String(data.paymentId) }) });
    const pollJson = await pollRes.json();

    expect(pollJson.ok).toBe(true);
    expect(pollJson.data.status).toBe("EXPIRED");
    expect(pollJson.data.isExpired).toBe(true);
  });

  it("AC-08-2: manual confirmation with manager PIN completes order and records audit log", async () => {
    const order = await createVietQrTestOrder(ctx, `HD_${rand()}`, 120000);
    await db.insert(schema.payments).values({
      orderId: order.id,
      shiftId: ctx.testShiftId,
      paymentMethod: "VIETQR",
      amount: 120000,
      vietqrRef: "HDTEST",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 180000),
    });

    const req = new NextRequest("http://localhost:3000/api/v1/payments/vietqr/manual-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${AUTH_COOKIE_NAME}=${ctx.cashierToken}` },
      body: JSON.stringify({
        orderId: order.id,
        pin: ctx.managerPin,
        reason: "Khách đã quét QR thành công trên máy khách, mạng quán chập chờn",
      }),
    });

    const res = await manualConfirmHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.status).toBe("DA_THANH_TOAN");

    const [audit] = await db
      .select()
      .from(schema.auditLogs)
      .where(sql`action = 'MANUAL_VIETQR_CONFIRM' AND entity_id = ${String(order.id)}`)
      .limit(1);
    expect(audit).toBeDefined();
    expect(audit.userId).toBe(ctx.managerUserId);
  });

  it("rejects manual confirm without valid manager PIN or with short reason", async () => {
    const order = await createVietQrTestOrder(ctx, `HD_${rand()}`, 50000);
    const shortReasonReq = new NextRequest("http://localhost:3000/api/v1/payments/vietqr/manual-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${AUTH_COOKIE_NAME}=${ctx.cashierToken}` },
      body: JSON.stringify({ orderId: order.id, pin: ctx.managerPin, reason: "ngan" }),
    });
    const shortRes = await manualConfirmHandler(shortReasonReq);
    expect(shortRes.status).toBe(400);

    const wrongPinReq = new NextRequest("http://localhost:3000/api/v1/payments/vietqr/manual-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${AUTH_COOKIE_NAME}=${ctx.cashierToken}` },
      body: JSON.stringify({ orderId: order.id, pin: "9999", reason: "Khach da tra tien" }),
    });
    const wrongRes = await manualConfirmHandler(wrongPinReq);
    expect(wrongRes.status).toBe(403);
  });

  it("rejects refresh VietQR when payment is already SUCCESS (409 Conflict)", async () => {
    const order = await createVietQrTestOrder(ctx, `HD_${rand()}`, 70000);
    await db.insert(schema.payments).values({
      orderId: order.id,
      shiftId: ctx.testShiftId,
      paymentMethod: "VIETQR",
      amount: 70000,
      vietqrRef: "HDSUCC",
      status: "SUCCESS",
    });

    const req = new NextRequest("http://localhost:3000/api/v1/payments/vietqr", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${AUTH_COOKIE_NAME}=${ctx.cashierToken}` },
      body: JSON.stringify({ orderId: order.id }),
    });
    const res = await createVietQrHandler(req);
    expect(res.status).toBe(409);
  });

  it("blocks VietQR creation when VIETQR_ENABLED=false", async () => {
    const order = await createVietQrTestOrder(ctx, `HD_${rand()}`, 50000);
    const prev = process.env.VIETQR_ENABLED;
    process.env.VIETQR_ENABLED = "false";
    try {
      const req = new NextRequest("http://localhost:3000/api/v1/payments/vietqr", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `${AUTH_COOKIE_NAME}=${ctx.cashierToken}` },
        body: JSON.stringify({ orderId: order.id }),
      });
      const res = await createVietQrHandler(req);
      expect(res.status).toBe(403);
    } finally {
      process.env.VIETQR_ENABLED = prev || "true";
    }
  });
});
