import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";

describe("Database Schema Integrity & Constraint Enforcement", () => {
  const testDbUrl =
    process.env.DATABASE_TEST_URL || "postgres://pos:pos_dev_pw@127.0.0.1:15450/pos_test_p01";
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let testUserId: number;
  let testAreaId: number;
  let testTableId: number;
  let testShiftId: number;

  const rand = () => Math.random().toString(36).slice(2, 8);
  const getErrCode = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      return "";
    } catch (e: unknown) {
      return (e as { code?: string }).code || "";
    }
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const [user] = await db
      .insert(schema.users)
      .values({
        username: `u_${rand()}`,
        passwordHash: "dummy",
        fullName: "Constraint Test User",
        role: "THU_NGAN",
      })
      .returning({ id: schema.users.id });
    testUserId = user.id;

    const [area] = await db
      .insert(schema.areas)
      .values({ code: `K_${rand()}`, name: `Area_${rand()}`, displayOrder: 1 })
      .returning({ id: schema.areas.id });
    testAreaId = area.id;

    const [table] = await db
      .insert(schema.tables)
      .values({ code: `B_${rand()}`, areaId: testAreaId, name: "Table_A1", capacity: 4, status: "TRONG" })
      .returning({ id: schema.tables.id });
    testTableId = table.id;

    const [shift] = await db
      .insert(schema.shifts)
      .values({ shiftCode: `C_${rand()}`, cashierId: testUserId, initialCash: 100000, status: "DA_DONG" })
      .returning({ id: schema.shifts.id });
    testShiftId = shift.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("enforces partial index: cashier cannot have multiple active (DANG_MO) shifts (23505)", async () => {
    const shiftCode1 = `CA_${rand()}`;
    const shiftCode2 = `CA_${rand()}`;

    await db.insert(schema.shifts).values({
      shiftCode: shiftCode1,
      cashierId: testUserId,
      initialCash: 100000,
      status: "DANG_MO",
    });

    const errCode = await getErrCode(() =>
      db.insert(schema.shifts).values({
        shiftCode: shiftCode2,
        cashierId: testUserId,
        initialCash: 200000,
        status: "DANG_MO",
      }),
    );
    expect(errCode).toBe("23505");

    await db.execute(sql`UPDATE shifts SET status = 'DA_DONG' WHERE shift_code = ${shiftCode1}`);
    await db.insert(schema.shifts).values({
      shiftCode: shiftCode2,
      cashierId: testUserId,
      initialCash: 200000,
      status: "DANG_MO",
    });
  });

  it("enforces partial index: table cannot have multiple active (DANG_PHUC_VU) orders (23505)", async () => {
    const orderCode1 = `HD_${rand()}`;
    const orderCode2 = `HD_${rand()}`;

    await db.insert(schema.orders).values({
      orderCode: orderCode1,
      tableId: testTableId,
      shiftId: testShiftId,
      orderType: "TAI_BAN",
      status: "DANG_PHUC_VU",
      totalAmount: 50000,
      finalAmount: 50000,
    });

    const errCode = await getErrCode(() =>
      db.insert(schema.orders).values({
        orderCode: orderCode2,
        tableId: testTableId,
        shiftId: testShiftId,
        orderType: "TAI_BAN",
        status: "DANG_PHUC_VU",
        totalAmount: 60000,
        finalAmount: 60000,
      }),
    );
    expect(errCode).toBe("23505");
  });

  it("enforces unique constraint: table name must be unique within an area (23505)", async () => {
    const errCode = await getErrCode(() =>
      db.insert(schema.tables).values({
        code: `B_${rand()}`,
        areaId: testAreaId,
        name: "Table_A1",
        capacity: 2,
        status: "TRONG",
      }),
    );
    expect(errCode).toBe("23505");
  });

  it("enforces CHECK constraints: rejects invalid status, negative capacity/price (23514)", async () => {
    const roleErr = await getErrCode(() =>
      db.execute(sql`INSERT INTO users (username, password_hash, full_name, role) VALUES ('bad_user', 'h', 'Bad', 'HACKER')`),
    );
    expect(roleErr).toBe("23514");

    const capErr = await getErrCode(() =>
      db.execute(sql`INSERT INTO tables (code, area_id, name, capacity, status) VALUES ('B_BAD', ${testAreaId}, 'Bad_Table', 0, 'TRONG')`),
    );
    expect(capErr).toBe("23514");

    const cashErr = await getErrCode(() =>
      db.execute(sql`INSERT INTO cash_entries (shift_id, entry_type, amount, reason, performed_by) VALUES (${testShiftId}, 'THU', -500, 'Invalid', ${testUserId})`),
    );
    expect(cashErr).toBe("23514");
  });

  it("enforces foreign key constraints on performed_by and cashier_id (23503)", async () => {
    const fkErr = await getErrCode(() =>
      db.execute(sql`INSERT INTO cash_entries (shift_id, entry_type, amount, reason, performed_by) VALUES (${testShiftId}, 'THU', 10000, 'Test', 99999999)`),
    );
    expect(fkErr).toBe("23503");
  });
});
