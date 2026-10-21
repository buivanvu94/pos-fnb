import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import {
  computeTheoreticalCash,
  getShiftCashBalance,
} from "@/server/shifts/cash-balance";

describe("BR-05 Theoretical Cash Balance Unit Tests", () => {
  it("pure function: calculates BR-05 formula correctly (AC-09-1, AC-09-2)", () => {
    // Standard acceptance test case: initial 1,000,000; cash-out 50,000; cash-in 200,000
    // Expected: 1,000,000 + 0 + 200,000 - 50,000 = 1,150,000
    const result = computeTheoreticalCash(1_000_000, 0, 200_000, 50_000);
    expect(result).toBe(1_150_000);

    // Initial 0 with cash sales 500,000, cash in 100,000, cash out 20,000 -> 580,000
    expect(computeTheoreticalCash(0, 500_000, 100_000, 20_000)).toBe(580_000);

    // Initial 2,000,000, no transactions -> 2,000,000
    expect(computeTheoreticalCash(2_000_000, 0, 0, 0)).toBe(2_000_000);
  });

  describe("database calculation: getShiftCashBalance", () => {
    const testDbUrl = getTestDbUrl();
    let pool: Pool;
    let db: ReturnType<typeof drizzle<typeof schema>>;
    let testUserId: number;
    let testShiftId: number;
    let testOrderId: number;
    let cancelledOrderId: number;

    const rand = () => Math.random().toString(36).slice(2, 8);

    beforeAll(async () => {
      pool = new Pool({ connectionString: testDbUrl });
      db = drizzle(pool, { schema });

      // Create test cashier
      const [user] = await db
        .insert(schema.users)
        .values({
          username: `cashier_${rand()}`,
          passwordHash: "dummy",
          fullName: "Cash Balance Test Cashier",
          role: "THU_NGAN",
        })
        .returning({ id: schema.users.id });
      testUserId = user.id;

      // Create test shift with initial cash 1,000,000
      const [shift] = await db
        .insert(schema.shifts)
        .values({
          shiftCode: `CA_BAL_${rand()}`,
          cashierId: testUserId,
          initialCash: 1_000_000,
          status: "DANG_MO",
        })
        .returning({ id: schema.shifts.id });
      testShiftId = shift.id;

      // Create a valid order associated with the shift
      const [order] = await db
        .insert(schema.orders)
        .values({
          orderCode: `ORD_BAL_${rand()}`,
          orderType: "MANG_VE",
          shiftId: testShiftId,
          totalAmount: 350_000,
          finalAmount: 350_000,
          status: "DA_THANH_TOAN",
        })
        .returning({ id: schema.orders.id });
      testOrderId = order.id;

      // Create a CANCELLED order (DA_HUY)
      const [cancelledOrder] = await db
        .insert(schema.orders)
        .values({
          orderCode: `ORD_CNL_${rand()}`,
          orderType: "TAI_BAN",
          shiftId: testShiftId,
          totalAmount: 180_000,
          finalAmount: 180_000,
          status: "DA_HUY",
        })
        .returning({ id: schema.orders.id });
      cancelledOrderId = cancelledOrder.id;
    });

    afterAll(async () => {
      if (db) {
        await db.delete(schema.payments).where(sql`shift_id = ${testShiftId}`);
        await db.delete(schema.cashEntries).where(sql`shift_id = ${testShiftId}`);
        await db.delete(schema.orders).where(sql`id IN (${testOrderId}, ${cancelledOrderId})`);
        await db.delete(schema.shifts).where(sql`id = ${testShiftId}`);
        await db.delete(schema.users).where(sql`id = ${testUserId}`);
      }
      await pool.end();
    });

    it("calculates balance with no transactions initially", async () => {
      const summary = await getShiftCashBalance(testShiftId, 1_000_000, db);
      expect(summary.initialCash).toBe(1_000_000);
      expect(summary.cashSales).toBe(0);
      expect(summary.cashIn).toBe(0);
      expect(summary.cashOut).toBe(0);
      expect(summary.expectedCash).toBe(1_000_000);
    });

    it("calculates balance after inserting cash entries and cash sales (AC-09-1, AC-09-2)", async () => {
      // 1. Insert CHI (cash-out) 50,000
      await db.insert(schema.cashEntries).values({
        shiftId: testShiftId,
        entryType: "CHI",
        amount: 50_000,
        reason: "Mua đá uống gấp",
        performedBy: testUserId,
      });

      // 2. Insert THU (cash-in) 200,000
      await db.insert(schema.cashEntries).values({
        shiftId: testShiftId,
        entryType: "THU",
        amount: 200_000,
        reason: "Nạp thêm tiền lẻ thối",
        performedBy: testUserId,
      });

      // 3. Insert real cash payment of 350,000 (TIEN_MAT, SUCCESS)
      await db.insert(schema.payments).values({
        orderId: testOrderId,
        shiftId: testShiftId,
        paymentMethod: "TIEN_MAT",
        amount: 350_000,
        status: "SUCCESS",
      });

      const summary = await getShiftCashBalance(testShiftId, 1_000_000, db);
      expect(summary.initialCash).toBe(1_000_000);
      expect(summary.cashIn).toBe(200_000);
      expect(summary.cashOut).toBe(50_000);
      expect(summary.cashSales).toBe(350_000);
      // Expected: 1,000,000 + 350,000 + 200,000 - 50,000 = 1,500,000
      expect(summary.expectedCash).toBe(1_500_000);
    });

    it("Item 2: payment PENDING, FAILED, VIETQR, and payment SUCCESS of cancelled order (DA_HUY) are NOT added to cashSales", async () => {
      // 1. Payment with status = 'PENDING'
      await db.insert(schema.payments).values({
        orderId: testOrderId,
        shiftId: testShiftId,
        paymentMethod: "TIEN_MAT",
        amount: 40_000,
        status: "PENDING",
      });

      // 2. Payment with status = 'FAILED'
      await db.insert(schema.payments).values({
        orderId: testOrderId,
        shiftId: testShiftId,
        paymentMethod: "TIEN_MAT",
        amount: 60_000,
        status: "FAILED",
      });

      // 3. Payment with paymentMethod = 'VIETQR' (even if SUCCESS)
      await db.insert(schema.payments).values({
        orderId: testOrderId,
        shiftId: testShiftId,
        paymentMethod: "VIETQR",
        amount: 100_000,
        status: "SUCCESS",
      });

      // 4. Payment with status = 'SUCCESS' and TIEN_MAT, but belonging to CANCELLED order (DA_HUY)
      await db.insert(schema.payments).values({
        orderId: cancelledOrderId,
        shiftId: testShiftId,
        paymentMethod: "TIEN_MAT",
        amount: 180_000,
        status: "SUCCESS",
      });

      const summary = await getShiftCashBalance(testShiftId, 1_000_000, db);
      // None of the 4 invalid payments above should be added to cashSales
      // cashSales should remain strictly 350,000
      expect(summary.cashSales).toBe(350_000);
      expect(summary.expectedCash).toBe(1_500_000);
    });
  });
});
