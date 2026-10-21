import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import {
  formatYmdVietnam,
  generateShiftCode,
  generateOrderCode,
} from "@/db/code-generator";

describe("Transaction-based Sequential Code Generator", () => {
  const testDbUrl =
    process.env.DATABASE_TEST_URL ||
    "postgres://pos:pos_dev_pw@127.0.0.1:15450/pos_test_p01";
  let pool: Pool;
  let testDb: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    testDb = drizzle(pool, { schema });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("formats Vietnam GMT+7 date to YYYYMMDD", () => {
    const fixedDate = new Date("2026-10-21T03:00:00Z"); // 10:00 AM GMT+7 on 2026-10-21
    const ymd = formatYmdVietnam(fixedDate);
    expect(ymd).toBe("20261021");
  });

  it("generates consecutive shift codes CA-YYYYMMDD-nn inside transactions", async () => {
    const date = new Date("2026-10-21T05:00:00Z");
    const ymd = formatYmdVietnam(date);

    await testDb.transaction(async (tx) => {
      const code1 = await generateShiftCode(tx, date);
      expect(code1).toMatch(new RegExp(`^CA-${ymd}-\\d{2}$`));

      await tx.insert(schema.shifts).values({
        shiftCode: code1,
        cashierId: 1,
        initialCash: 1000000,
        status: "DANG_MO",
      });

      const code2 = await generateShiftCode(tx, date);
      expect(code2).toMatch(new RegExp(`^CA-${ymd}-\\d{2}$`));

      const num1 = parseInt(code1.split("-")[2], 10);
      const num2 = parseInt(code2.split("-")[2], 10);
      expect(num2).toBe(num1 + 1);

      throw new Error("__ROLLBACK_TEST_TX__");
    }).catch((err) => {
      if (err.message !== "__ROLLBACK_TEST_TX__") throw err;
    });
  });

  it("correctly advances sequence past 99 to 100 without string sorting bugs", async () => {
    const date = new Date("2026-10-22T05:00:00Z");
    const ymd = formatYmdVietnam(date);

    await testDb.transaction(async (tx) => {
      // Seed a shift with sequence 99
      const [insertedShift] = await tx
        .insert(schema.shifts)
        .values({
          shiftCode: `CA-${ymd}-99`,
          cashierId: 1,
          initialCash: 500000,
          status: "DA_DONG",
        })
        .returning({ id: schema.shifts.id });

      // The next sequence must be 100 (not 10, not 01)
      const nextCode = await generateShiftCode(tx, date);
      expect(nextCode).toBe(`CA-${ymd}-100`);

      // Seed an order with sequence 99
      await tx.insert(schema.orders).values({
        orderCode: `HD-${ymd}-0099`,
        orderType: "MANG_VE",
        shiftId: insertedShift.id,
        totalAmount: 50000,
        finalAmount: 50000,
        status: "DA_THANH_TOAN",
      });

      const nextOrderCode = await generateOrderCode(tx, date);
      expect(nextOrderCode).toBe(`HD-${ymd}-0100`);

      throw new Error("__ROLLBACK_TEST_TX__");
    }).catch((err) => {
      if (err.message !== "__ROLLBACK_TEST_TX__") throw err;
    });
  });

  it("generates consecutive order codes HD-YYYYMMDD-nnnn inside transactions", async () => {
    const date = new Date("2026-10-21T05:00:00Z");
    const ymd = formatYmdVietnam(date);

    await testDb.transaction(async (tx) => {
      const code1 = await generateOrderCode(tx, date);
      expect(code1).toMatch(new RegExp(`^HD-${ymd}-\\d{4}$`));

      throw new Error("__ROLLBACK_TEST_TX__");
    }).catch((err) => {
      if (err.message !== "__ROLLBACK_TEST_TX__") throw err;
    });
  });
});
