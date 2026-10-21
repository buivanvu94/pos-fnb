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

      // Insert dummy shift to check sequence progression
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

      // Rollback dummy insert by throwing a silent error or test within sub-transaction
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

      // Rollback
      throw new Error("__ROLLBACK_TEST_TX__");
    }).catch((err) => {
      if (err.message !== "__ROLLBACK_TEST_TX__") throw err;
    });
  });
});
