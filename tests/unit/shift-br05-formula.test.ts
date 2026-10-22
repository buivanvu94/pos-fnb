import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { computeTheoreticalCash, getShiftCashBalance } from "@/server/shifts/cash-balance";
import { getShiftFinancialReport } from "@/server/shifts/shift-financial-report";

describe("BR-05 Cash Balance Formula & Financial Report (US-10, BR-05, FR-08)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  let cashierUserId: number;
  let shiftId: number;
  let areaId: number;
  let tableId: number;

  const rand = () => Math.random().toString(36).slice(2, 8);

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const [user] = await db
      .insert(schema.users)
      .values({
        username: `csh_br05_${rand()}`,
        fullName: "Cashier BR05 Test",
        role: "THU_NGAN",
        passwordHash: "dummy",
      })
      .returning();
    cashierUserId = user.id;

    const [area] = await db.insert(schema.areas).values({ code: `KV_${rand()}`, name: "Khu vực" }).returning();
    areaId = area.id;

    const [table] = await db.insert(schema.tables).values({ code: `TB_${rand()}`, name: "Bàn 1", areaId, status: "TRONG" }).returning();
    tableId = table.id;

    // Shift with 1,000,000 initial cash
    const [shift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_BR05_${rand()}`,
        cashierId: cashierUserId,
        initialCash: 1_000_000,
        expectedCash: 1_000_000,
        status: "DANG_MO",
      })
      .returning();
    shiftId = shift.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("pure function computeTheoreticalCash computes initial + cashSales + in - out", () => {
    const result = computeTheoreticalCash(1_000_000, 2_500_000, 200_000, 100_000);
    expect(result).toBe(3_600_000);
  });

  it("calculates BR-05 with multiple cash entries, cash orders, excluding VietQR and voided/cancelled", async () => {
    // 1. Order 1: Cash payment 500,000 (SUCCESS)
    const [order1] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD1_${rand()}`,
        orderType: "TAI_BAN",
        tableId,
        shiftId,
        totalAmount: 500_000,
        finalAmount: 500_000,
        status: "DA_THANH_TOAN",
      })
      .returning();

    await db.insert(schema.payments).values({
      orderId: order1.id,
      shiftId,
      paymentMethod: "TIEN_MAT",
      amount: 500_000,
      status: "SUCCESS",
    });

    // 2. Order 2: VietQR payment 800,000 (SUCCESS) -> MUST NOT be included in cashSales
    const [order2] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD2_${rand()}`,
        orderType: "TAI_BAN",
        tableId,
        shiftId,
        totalAmount: 800_000,
        finalAmount: 800_000,
        status: "DA_THANH_TOAN",
      })
      .returning();

    await db.insert(schema.payments).values({
      orderId: order2.id,
      shiftId,
      paymentMethod: "VIETQR",
      amount: 800_000,
      status: "SUCCESS",
    });

    // 3. Order 3: Cancelled cash order 300,000 (status DA_HUY) -> MUST NOT be included
    const [order3] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD3_${rand()}`,
        orderType: "TAI_BAN",
        tableId,
        shiftId,
        totalAmount: 300_000,
        finalAmount: 300_000,
        status: "DA_HUY",
      })
      .returning();

    await db.insert(schema.payments).values({
      orderId: order3.id,
      shiftId,
      paymentMethod: "TIEN_MAT",
      amount: 300_000,
      status: "SUCCESS",
    });

    // 4. Order 4: Voided payment 200,000 (payment status VOIDED) -> MUST NOT be included
    const [order4] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD4_${rand()}`,
        orderType: "TAI_BAN",
        tableId,
        shiftId,
        totalAmount: 200_000,
        finalAmount: 200_000,
        status: "DA_THANH_TOAN",
      })
      .returning();

    await db.insert(schema.payments).values({
      orderId: order4.id,
      shiftId,
      paymentMethod: "TIEN_MAT",
      amount: 200_000,
      status: "VOIDED",
    });

    // 5. Cash In 1: THU 150,000
    await db.insert(schema.cashEntries).values({
      shiftId,
      entryType: "THU",
      amount: 150_000,
      reason: "Thu tiền bán phế liệu",
      performedBy: cashierUserId,
    });

    // 6. Cash In 2: THU 50,000
    await db.insert(schema.cashEntries).values({
      shiftId,
      entryType: "THU",
      amount: 50_000,
      reason: "Thu tiền cọc vỏ lon",
      performedBy: cashierUserId,
    });

    // 7. Cash Out 1: CHI 70,000
    await db.insert(schema.cashEntries).values({
      shiftId,
      entryType: "CHI",
      amount: 70_000,
      reason: "Mua đá lạnh khẩn cấp",
      performedBy: cashierUserId,
    });

    // 8. Cash Out 2: CHI 30,000
    await db.insert(schema.cashEntries).values({
      shiftId,
      entryType: "CHI",
      amount: 30_000,
      reason: "Mua chanh sả",
      performedBy: cashierUserId,
    });

    // Theoretical cash:
    // Initial: 1,000,000
    // Cash Sales: 500,000 (only order 1)
    // Cash In: 150,000 + 50,000 = 200,000
    // Cash Out: 70,000 + 30,000 = 100,000
    // Expected: 1,000,000 + 500,000 + 200,000 - 100,000 = 1,600,000
    const balance = await getShiftCashBalance(shiftId, 1_000_000, db);
    expect(balance.cashSales).toBe(500_000);
    expect(balance.cashIn).toBe(200_000);
    expect(balance.cashOut).toBe(100_000);
    expect(balance.expectedCash).toBe(1_600_000);

    // Full financial report
    const report = await getShiftFinancialReport(shiftId, 1_000_000, db);
    expect(report.cashSales).toBe(500_000);
    expect(report.vietqrSales).toBe(800_000);
    expect(report.totalSales).toBe(1_300_000);
    expect(report.expectedCash).toBe(1_600_000);
    expect(report.cancelledCount).toBe(1);
    expect(report.cancelledAmount).toBe(300_000);
  });
});
