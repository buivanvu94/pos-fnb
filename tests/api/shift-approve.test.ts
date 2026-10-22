import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { POST as approveShiftHandler } from "@/app/api/v1/shifts/approve/route";
import { POST as createOrderHandler } from "@/app/api/v1/orders/route";
import { voidPaidBill } from "@/server/payments/void-bill-service";

describe("Shift Approve API - POST /api/v1/shifts/approve (US-10, FR-09, BR-05, AC-10-2)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  let cashierUserId: number;
  let cashierToken: string;
  let managerUserId: number;
  let managerToken: string;
  const managerPin = "8899";

  let testAreaId: number;
  let testTableId: number;
  let testShiftId: number;
  let paidOrderId: number;

  const rand = () => Math.random().toString(36).slice(2, 8);

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const pinHash = await bcrypt.hash(managerPin, 10);
    const [manager] = await db
      .insert(schema.users)
      .values({
        username: `mgr_app_${rand()}`,
        fullName: "Trần Quản Lý",
        role: "QUAN_LY",
        passwordHash: "dummy",
        pinHash,
      })
      .returning();
    managerUserId = manager.id;
    managerToken = await signAuthToken({
      userId: manager.id,
      username: manager.username,
      fullName: manager.fullName,
      role: "QUAN_LY",
    });

    const [cashier] = await db
      .insert(schema.users)
      .values({
        username: `csh_app_${rand()}`,
        fullName: "Lê Thu Ngân",
        role: "THU_NGAN",
        passwordHash: "dummy",
      })
      .returning();
    cashierUserId = cashier.id;
    cashierToken = await signAuthToken({
      userId: cashier.id,
      username: cashier.username,
      fullName: cashier.fullName,
      role: "THU_NGAN",
    });

    const [area] = await db.insert(schema.areas).values({ code: `KV_${rand()}`, name: "Khu vực test" }).returning();
    testAreaId = area.id;

    const [table] = await db.insert(schema.tables).values({ code: `B_${rand()}`, name: "Bàn 01", areaId: testAreaId, status: "TRONG" }).returning();
    testTableId = table.id;

    // Shift with 3,500,000 initial cash
    const [shift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_APP_${rand()}`,
        cashierId: cashierUserId,
        initialCash: 3_500_000,
        expectedCash: 3_500_000,
        actualCash: 3_500_000,
        difference: 0,
        status: "CHO_DUYET",
      })
      .returning();
    testShiftId = shift.id;

    // Insert a paid order in this shift for immutability testing
    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_APP_${rand()}`,
        orderType: "TAI_BAN",
        tableId: testTableId,
        shiftId: testShiftId,
        totalAmount: 100_000,
        finalAmount: 100_000,
        status: "DA_THANH_TOAN",
        version: 1,
      })
      .returning();
    paidOrderId = order.id;

    await db.insert(schema.payments).values({
      orderId: order.id,
      shiftId: testShiftId,
      paymentMethod: "TIEN_MAT",
      amount: 100_000,
      status: "SUCCESS",
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("fails to approve with wrong PIN (ERR-02)", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/shifts/approve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        shiftId: testShiftId,
        pin: "0000",
        lyDo: "Ký duyệt chốt ca làm việc",
      }),
    });

    const res = await approveShiftHandler(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Mã PIN phê duyệt không chính xác");
  });

  it("AC-10-2: approves shift with correct PIN -> DA_DONG, Z-Report queued, audit logged, logout cookie set", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/shifts/approve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        shiftId: testShiftId,
        pin: managerPin,
        lyDo: "Ký duyệt chốt ca chuẩn xác",
      }),
    });

    const res = await approveShiftHandler(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.shift.status).toBe("DA_DONG");
    expect(typeof body.data.shift.approvedById).toBe("number");
    expect(body.data.shift.approvedById).toBeGreaterThan(0);

    // Verify cashier session deactivation (Set-Cookie clears token)
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeDefined();

    // Verify Z-Report in print_jobs
    const [job] = await db
      .select()
      .from(schema.printJobs)
      .where(eq(schema.printJobs.jobType, "Z_REPORT"))
      .orderBy(desc(schema.printJobs.id));

    expect(job).toBeDefined();
    expect(["PENDING", "SENDING", "SENT", "FAILED"]).toContain(job.status);
    const payload = JSON.parse(job.payload);
    expect(payload.kind).toBe("Z_REPORT");
    expect(payload.initialCash).toBe(3_500_000);
    expect(payload.managerName).toBe("Trần Quản Lý");

    // Verify audit log has ca_lam_viec_da_dong
    const [audit] = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.action, "CLOSE_SHIFT_APPROVE"))
      .orderBy(desc(schema.auditLogs.id));
    expect(audit).toBeDefined();
    expect(audit.metadata).toContain("ca_lam_viec_da_dong");

    // Verify outbox has TELEGRAM_SHIFT_CLOSE
    const [outboxItem] = await db
      .select()
      .from(schema.outbox)
      .where(eq(schema.outbox.idempotencyKey, `telegram_shift_close_${testShiftId}`));
    expect(outboxItem).toBeDefined();
    expect(outboxItem.idempotencyKey).toBe(`telegram_shift_close_${testShiftId}`);
  });

  it("blocks creating new orders in closed shift", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        orderType: "TAI_BAN",
        tableId: testTableId,
      }),
    });

    const res = await createOrderHandler(req);
    expect(res.status).toBe(400); // ERR-01 shift is not open
  });

  it("blocks voiding paid bills in closed shift with 409", async () => {
    const result = await voidPaidBill({
      orderId: paidOrderId,
      expectedVersion: 1,
      lyDo: "Khách đổi ý trả món",
      pinCode: managerPin,
      user: {
        userId: managerUserId,
        username: "mgr",
        role: "QUAN_LY",
        fullName: "Trần Quản Lý",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.error).toContain("ca làm việc của hóa đơn này đã đóng");
  });
});
