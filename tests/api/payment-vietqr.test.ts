import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { POST as createVietQrHandler } from "@/app/api/v1/payments/vietqr/route";
import { GET as getPaymentStatusHandler } from "@/app/api/v1/payments/[id]/route";
import { POST as manualConfirmHandler } from "@/app/api/v1/payments/vietqr/manual-confirm/route";
import { crc16Ccitt } from "@/server/payments/vietqr-crc16";

describe("VietQR API - Create, Polling, Timeout & Manual Confirm (FR-12, BR-11, AC-08-1, AC-08-3)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 8);
  const tag = rand();

  let cashierUserId: number;
  let cashierToken: string;
  let testAreaId: number;
  let testShiftId: number;
  let testTableId: number;
  let testMenuItemId: number;

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const [cashier] = await db.insert(schema.users).values({
      username: `c_vqr_${tag}`,
      fullName: "Thu Ngân Test VietQR",
      role: "THU_NGAN",
      passwordHash: "dummy",
    }).returning();
    cashierUserId = cashier.id;
    cashierToken = await signAuthToken({
      userId: cashier.id,
      username: cashier.username,
      fullName: cashier.fullName,
      role: "THU_NGAN",
    });

    const [area] = await db.insert(schema.areas).values({ code: `AR_VQR_${tag}`, name: `Khu VQR ${tag}` }).returning();
    testAreaId = area.id;

    const [table] = await db.insert(schema.tables).values({
      code: `TB_VQR_${tag}`,
      areaId: testAreaId,
      name: "Bàn 12",
      capacity: 4,
      status: "DANG_DUNG",
    }).returning();
    testTableId = table.id;

    const [shift] = await db.insert(schema.shifts).values({
      shiftCode: `CA_VQR_${tag}`,
      cashierId: cashierUserId,
      initialCash: 100_000,
      status: "DANG_MO",
    }).returning();
    testShiftId = shift.id;

    const [cat] = await db.insert(schema.categories).values({ code: `CAT_VQR_${tag}`, name: "Menu VQR" }).returning();
    const [item] = await db.insert(schema.menuItems).values({
      code: `MI_VQR_${tag}`,
      categoryId: cat.id,
      name: "Cà phê sữa đá",
      price: 150_000,
      targetPrinter: "BAR",
    }).returning();
    testMenuItemId = item.id;
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  async function createTestOrder(code: string, amount: number = 150000) {
    const [table] = await db.insert(schema.tables).values({
      code: `TB_${rand()}`,
      areaId: testAreaId,
      name: `Bàn ${rand()}`,
      capacity: 4,
      status: "DANG_DUNG",
    }).returning();

    const [order] = await db.insert(schema.orders).values({
      orderCode: code,
      orderType: "TAI_BAN",
      tableId: table.id,
      shiftId: testShiftId,
      totalAmount: amount,
      finalAmount: amount,
      status: "DANG_PHUC_VU",
      createdById: cashierUserId,
    }).returning();

    await db.insert(schema.orderItems).values({
      orderId: order.id,
      menuItemId: testMenuItemId,
      quantity: 1,
      unitPrice: amount,
    });
    return order;
  }

  it("AC-08-1: creates dynamic VietQR containing bank BIN, account, 150000 VND and HD0012", async () => {
    await db.delete(schema.payments).where(eq(schema.payments.vietqrRef, "HD0012"));
    await db.delete(schema.orders).where(eq(schema.orders.orderCode, "HD-20261020-0012"));
    const order = await createTestOrder("HD-20261020-0012", 150000);
    const req = new NextRequest("http://localhost:3000/api/v1/payments/vietqr", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
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
    expect(json.data.qrContent).toContain("HD0012");

    // Checksum integrity
    const payloadWithoutCrc = json.data.qrContent.slice(0, -4);
    const crc = json.data.qrContent.slice(-4);
    expect(crc16Ccitt(payloadWithoutCrc)).toBe(crc);
  });

  it("AC-08-3: transitions payment to EXPIRED when 180 seconds elapse", async () => {
    const order = await createTestOrder(`HD_${rand()}`, 80000);
    // Create pending payment
    const createReq = new NextRequest("http://localhost:3000/api/v1/payments/vietqr", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
      body: JSON.stringify({ orderId: order.id }),
    });
    const createRes = await createVietQrHandler(createReq);
    const { data } = await createRes.json();

    // Fast-forward simulated clock: set expires_at 10 seconds into the past
    await db.update(schema.payments)
      .set({ expiresAt: new Date(Date.now() - 10000) })
      .where(eq(schema.payments.id, data.paymentId));

    // Poll status
    const pollReq = new NextRequest(`http://localhost:3000/api/v1/payments/${data.paymentId}`, {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
    });
    const pollRes = await getPaymentStatusHandler(pollReq, { params: Promise.resolve({ id: String(data.paymentId) }) });
    const pollJson = await pollRes.json();

    expect(pollJson.ok).toBe(true);
    expect(pollJson.data.status).toBe("EXPIRED");
    expect(pollJson.data.isExpired).toBe(true);
    expect(pollJson.data.remainingSeconds).toBe(0);
  });

  it("AC-08-2: manual confirmation completes order and records audit log (DEC-06)", async () => {
    const order = await createTestOrder(`HD_${rand()}`, 120000);
    const req = new NextRequest("http://localhost:3000/api/v1/payments/vietqr/manual-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
      body: JSON.stringify({
        orderId: order.id,
        reason: "Khách đã quét QR thành công trên máy khách, mạng quán chập chờn",
      }),
    });

    const res = await manualConfirmHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.status).toBe("DA_THANH_TOAN");
    expect(json.data.paymentMethod).toBe("VIETQR");

    // Verify audit log recorded
    const [audit] = await db
      .select()
      .from(schema.auditLogs)
      .where(sql`action = 'MANUAL_VIETQR_CONFIRM' AND entity_id = ${String(order.id)}`)
      .limit(1);

    expect(audit).toBeDefined();
    expect(audit.userId).toBe(cashierUserId);
    expect(audit.reason).toContain("mạng quán chập chờn");
  });
});
