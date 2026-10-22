import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { GET as revenueReportHandler } from "@/app/api/v1/reports/revenue/route";
import { ERROR_CATALOG } from "@/lib/error-catalog";

describe("Revenue Report API Permissions & Validation (API-09, FR-14, AC-11-2)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 8);
  const tag = rand();

  let managerToken: string;
  let cashier1UserId: number;
  let cashier1Token: string;
  let cashier2UserId: number;
  let cashier2Token: string;
  let waiterToken: string;

  let shift1Id: number;
  let shift2Id: number;
  const createdOrderIds: number[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const [mgr] = await db.insert(schema.users).values({
      username: `mgr_rr_${tag}`,
      fullName: "Quản Lý Báo Cáo",
      role: "QUAN_LY",
      passwordHash: "dummy",
    }).returning();
    managerToken = await signAuthToken({
      userId: mgr.id,
      username: mgr.username,
      fullName: mgr.fullName,
      role: "QUAN_LY",
    });

    const [c1] = await db.insert(schema.users).values({
      username: `c1_rr_${tag}`,
      fullName: "Thu Ngân 1",
      role: "THU_NGAN",
      passwordHash: "dummy",
    }).returning();
    cashier1UserId = c1.id;
    cashier1Token = await signAuthToken({
      userId: c1.id,
      username: c1.username,
      fullName: c1.fullName,
      role: "THU_NGAN",
    });

    const [c2] = await db.insert(schema.users).values({
      username: `c2_rr_${tag}`,
      fullName: "Thu Ngân 2",
      role: "THU_NGAN",
      passwordHash: "dummy",
    }).returning();
    cashier2UserId = c2.id;
    cashier2Token = await signAuthToken({
      userId: c2.id,
      username: c2.username,
      fullName: c2.fullName,
      role: "THU_NGAN",
    });

    const [w] = await db.insert(schema.users).values({
      username: `w_rr_${tag}`,
      fullName: "Phục Vụ",
      role: "PHUC_VU",
      passwordHash: "dummy",
    }).returning();
    waiterToken = await signAuthToken({
      userId: w.id,
      username: w.username,
      fullName: w.fullName,
      role: "PHUC_VU",
    });

    const [s1] = await db.insert(schema.shifts).values({
      shiftCode: `CA_RR1_${tag}`,
      cashierId: cashier1UserId,
      initialCash: 100_000,
      status: "DANG_MO",
    }).returning();
    shift1Id = s1.id;

    const [s2] = await db.insert(schema.shifts).values({
      shiftCode: `CA_RR2_${tag}`,
      cashierId: cashier2UserId,
      initialCash: 200_000,
      status: "DANG_MO",
    }).returning();
    shift2Id = s2.id;

    const [o1] = await db.insert(schema.orders).values({
      orderCode: `HD_RR1_${rand()}`,
      orderType: "MANG_VE",
      shiftId: shift1Id,
      totalAmount: 100_000,
      discountAmount: 0,
      finalAmount: 100_000,
      status: "DA_THANH_TOAN",
      paymentMethod: "TIEN_MAT",
      paidAt: new Date("2026-08-20T03:00:00.000Z"), // 10:00 GMT+7
      createdById: cashier1UserId,
    }).returning();
    createdOrderIds.push(o1.id);

    const [o2] = await db.insert(schema.orders).values({
      orderCode: `HD_RR2_${rand()}`,
      orderType: "MANG_VE",
      shiftId: shift2Id,
      totalAmount: 200_000,
      discountAmount: 0,
      finalAmount: 200_000,
      status: "DA_THANH_TOAN",
      paymentMethod: "VIETQR",
      paidAt: new Date("2026-08-20T04:00:00.000Z"), // 11:00 GMT+7
      createdById: cashier2UserId,
    }).returning();
    createdOrderIds.push(o2.id);
  });

  afterAll(async () => {
    if (createdOrderIds.length > 0) {
      await db.delete(schema.orders).where(inArray(schema.orders.id, createdOrderIds));
    }
    await db.delete(schema.shifts).where(inArray(schema.shifts.id, [shift1Id, shift2Id]));
    await pool.end();
  });

  function createReq(url: string, token?: string) {
    const headers = new Headers();
    if (token) headers.set("cookie", `${AUTH_COOKIE_NAME}=${token}`);
    return new NextRequest(new URL(url, "http://localhost:3000"), { headers });
  }

  it("PHUC_VU receives 403 Forbidden", async () => {
    const req = createReq("/api/v1/reports/revenue?fromDate=2026-08-20&toDate=2026-08-20", waiterToken);
    const res = await revenueReportHandler(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });

  it("AC-11-2: returns 400 with verbatim ERR-11 when fromDate > toDate", async () => {
    const req = createReq("/api/v1/reports/revenue?fromDate=2026-10-25&toDate=2026-10-20", managerToken);
    const res = await revenueReportHandler(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("ERR-11");
    expect(json.error).toBe(ERROR_CATALOG.ERR_11.message);
    expect(json.error).toBe("Ngày bắt đầu không được lớn hơn ngày kết thúc!");
  });

  it("THU_NGAN only sees revenue for their own shift", async () => {
    const req = createReq("/api/v1/reports/revenue?fromDate=2026-08-20&toDate=2026-08-20", cashier1Token);
    const res = await revenueReportHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.summary.totalRevenue).toBe(100_000);
    expect(json.data.summary.orderCount).toBe(1);
    expect(json.data.byShift).toHaveLength(1);
    expect(json.data.byShift[0].shiftId).toBe(shift1Id);
  });

  it("QUAN_LY sees all shifts and aggregate revenue", async () => {
    const req = createReq("/api/v1/reports/revenue?fromDate=2026-08-20&toDate=2026-08-20", managerToken);
    const res = await revenueReportHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.summary.totalRevenue).toBe(300_000);
    expect(json.data.summary.orderCount).toBe(2);
    expect(json.data.byShift.length).toBeGreaterThanOrEqual(2);
  });
});
