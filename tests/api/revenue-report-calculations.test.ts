import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { GET as revenueReportHandler } from "@/app/api/v1/reports/revenue/route";

describe("Revenue Report Calculations & Data Matching (FR-14, BR-13)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 8);
  const tag = rand();
  let managerToken: string;
  let cashierId: number;
  let shiftId: number;
  let item1Id: number;
  let item2Id: number;
  const orderIds: number[] = [];

  async function createOrder(
    total: number, disc: number, final: number, status: string,
    method: "TIEN_MAT" | "VIETQR" | null, items: { itemId: number; qty: number; price: number }[],
    voided = false,
  ) {
    const [o] = await db.insert(schema.orders).values({
      orderCode: `HD_${rand()}`,
      orderType: "TAI_BAN",
      shiftId,
      totalAmount: total,
      discountAmount: disc,
      finalAmount: final,
      status,
      paymentMethod: method,
      paidAt: status === "DANG_PHUC_VU" ? null : new Date("2026-08-21T03:00:00.000Z"),
      voidedAt: voided ? new Date("2026-08-21T06:00:00.000Z") : null,
      createdById: cashierId,
    }).returning();
    orderIds.push(o.id);

    if (items.length > 0) {
      await db.insert(schema.orderItems).values(
        items.map((it) => ({
          orderId: o.id,
          menuItemId: it.itemId,
          quantity: it.qty,
          unitPrice: it.price,
        })),
      );
    }
    return o;
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const [mgr] = await db.insert(schema.users).values({
      username: `mgr_calc_${tag}`,
      fullName: "Quản Lý Tính Toán",
      role: "QUAN_LY",
      passwordHash: "dummy",
    }).returning();
    managerToken = await signAuthToken({
      userId: mgr.id,
      username: mgr.username,
      fullName: mgr.fullName,
      role: "QUAN_LY",
    });

    const [c] = await db.insert(schema.users).values({
      username: `c_calc_${tag}`,
      fullName: "Thu Ngân",
      role: "THU_NGAN",
      passwordHash: "dummy",
    }).returning();
    cashierId = c.id;

    const [cat] = await db.insert(schema.categories).values({
      name: `Cat_${tag}`,
      code: `CAT_${tag}`,
    }).returning();

    const [m1] = await db.insert(schema.menuItems).values({
      name: `Cà phê_${tag}`,
      code: `CFS_${tag}`,
      categoryId: cat.id,
      price: 30_000,
    }).returning();
    item1Id = m1.id;

    const [m2] = await db.insert(schema.menuItems).values({
      name: `Trà đào_${tag}`,
      code: `TD_${tag}`,
      categoryId: cat.id,
      price: 40_000,
    }).returning();
    item2Id = m2.id;

    const [s] = await db.insert(schema.shifts).values({
      shiftCode: `CA_CALC_${tag}`,
      cashierId,
      initialCash: 100_000,
      actualCash: 350_000,
      expectedCash: 400_000,
      difference: -50_000,
      status: "DA_DONG",
      openedAt: new Date("2026-08-21T01:00:00.000Z"),
      closedAt: new Date("2026-08-21T10:00:00.000Z"),
    }).returning();
    shiftId = s.id;

    // 1. Paid Cash 1: 50k (item1 x1, item2 x1, disc 20k)
    await createOrder(70_000, 20_000, 50_000, "DA_THANH_TOAN", "TIEN_MAT", [
      { itemId: item1Id, qty: 1, price: 30_000 },
      { itemId: item2Id, qty: 1, price: 40_000 },
    ]);
    // 2. Paid Cash 2: 100k (item1 x1, item2 x2, disc 10k)
    await createOrder(110_000, 10_000, 100_000, "DA_THANH_TOAN", "TIEN_MAT", [
      { itemId: item1Id, qty: 1, price: 30_000 },
      { itemId: item2Id, qty: 2, price: 40_000 },
    ]);
    // 3. Paid VietQR: 150k (item1 x5)
    await createOrder(150_000, 0, 150_000, "DA_THANH_TOAN", "VIETQR", [
      { itemId: item1Id, qty: 5, price: 30_000 },
    ]);
    // 4. Cancelled order (DA_HUY) - Excluded
    await createOrder(80_000, 0, 80_000, "DA_HUY", "TIEN_MAT", [
      { itemId: item2Id, qty: 2, price: 40_000 },
    ]);
    // 5. Voided order (DA_HUY) - Excluded
    await createOrder(120_000, 0, 120_000, "DA_HUY", "TIEN_MAT", [], true);
    // 6. Active order (DANG_PHUC_VU) - Excluded
    await createOrder(90_000, 0, 90_000, "DANG_PHUC_VU", null, []);
  });

  afterAll(async () => {
    if (orderIds.length > 0) {
      await db.delete(schema.orderItems).where(inArray(schema.orderItems.orderId, orderIds));
      await db.delete(schema.orders).where(inArray(schema.orders.id, orderIds));
    }
    await db.delete(schema.shifts).where(inArray(schema.shifts.id, [shiftId]));
    await pool.end();
  });

  it("calculates exact net revenue, orders, AOV, payment methods, and shift difference", async () => {
    const headers = new Headers();
    headers.set("cookie", `${AUTH_COOKIE_NAME}=${managerToken}`);
    const req = new NextRequest(
      new URL(`/api/v1/reports/revenue?fromDate=2026-08-21&toDate=2026-08-21&cashierId=${cashierId}`, "http://localhost:3000"),
      { headers },
    );
    const res = await revenueReportHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    const { summary, paymentMethods, byShift, topItems } = json.data;
    // Net revenue = 50k + 100k + 150k = 300k
    expect(summary.totalRevenue).toBe(300_000);
    expect(summary.orderCount).toBe(3);
    expect(summary.averageOrderValue).toBe(100_000);
    expect(summary.totalDiscount).toBe(30_000);

    // Payment methods: 150k cash (50%), 150k VietQR (50%)
    const cash = paymentMethods.find((p: any) => p.method === "TIEN_MAT");
    const vietqr = paymentMethods.find((p: any) => p.method === "VIETQR");
    expect(cash.amount).toBe(150_000);
    expect(cash.count).toBe(2);
    expect(cash.percentage).toBe(50);
    expect(vietqr.amount).toBe(150_000);
    expect(vietqr.count).toBe(1);
    expect(vietqr.percentage).toBe(50);

    // Shift difference is present (-50_000)
    const shiftStat = byShift.find((s: any) => s.shiftId === shiftId);
    expect(shiftStat).toBeDefined();
    expect(shiftStat.difference).toBe(-50_000);
    expect(shiftStat.revenue).toBe(300_000);

    // Top items: item1 sold 1 + 1 + 5 = 7; item2 sold 1 + 2 = 3
    expect(topItems[0].menuItemId).toBe(item1Id);
    expect(topItems[0].quantity).toBe(7);
  });
});
