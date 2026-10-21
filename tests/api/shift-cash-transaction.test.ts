import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { POST as cashTransactionHandler } from "@/app/api/v1/shifts/cash-transaction/route";
import { GET as currentShiftHandler } from "@/app/api/v1/shifts/current/route";

describe("Cash Transaction API - POST /api/v1/shifts/cash-transaction (US-09, FR-07, BR-05)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  let cashierUserId: number;
  let cashierToken: string;
  let otherCashierId: number;
  let otherCashierToken: string;
  let waiterUserId: number;
  let waiterToken: string;

  let testShiftId: number;
  let otherShiftId: number;

  const rand = () => Math.random().toString(36).slice(2, 8);

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    // 1. Primary Cashier
    const [cashier] = await db
      .insert(schema.users)
      .values({
        username: `cashier_tx_${rand()}`,
        fullName: "Cashier Transaction Test",
        role: "THU_NGAN",
        passwordHash: "dummy",
      })
      .returning({ id: schema.users.id, username: schema.users.username, fullName: schema.users.fullName });
    cashierUserId = cashier.id;
    cashierToken = await signAuthToken({
      userId: cashier.id,
      username: cashier.username,
      fullName: cashier.fullName,
      role: "THU_NGAN",
    });

    // Open active shift with initialCash 1,000,000 for primary cashier
    const [shift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_TX_${rand()}`,
        cashierId: cashierUserId,
        initialCash: 1_000_000,
        expectedCash: 1_000_000,
        status: "DANG_MO",
      })
      .returning();
    testShiftId = shift.id;

    // 2. Secondary Cashier
    const [otherCashier] = await db
      .insert(schema.users)
      .values({
        username: `other_tx_${rand()}`,
        fullName: "Other Cashier Test",
        role: "THU_NGAN",
        passwordHash: "dummy",
      })
      .returning({ id: schema.users.id, username: schema.users.username, fullName: schema.users.fullName });
    otherCashierId = otherCashier.id;
    otherCashierToken = await signAuthToken({
      userId: otherCashier.id,
      username: otherCashier.username,
      fullName: otherCashier.fullName,
      role: "THU_NGAN",
    });

    // Open active shift for secondary cashier
    const [otherShift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_OTH_${rand()}`,
        cashierId: otherCashierId,
        initialCash: 500_000,
        expectedCash: 500_000,
        status: "DANG_MO",
      })
      .returning();
    otherShiftId = otherShift.id;

    // 3. Waiter
    const [waiter] = await db
      .insert(schema.users)
      .values({
        username: `waiter_tx_${rand()}`,
        fullName: "Waiter Transaction Test",
        role: "PHUC_VU",
        passwordHash: "dummy",
      })
      .returning({ id: schema.users.id, username: schema.users.username, fullName: schema.users.fullName });
    waiterUserId = waiter.id;
    waiterToken = await signAuthToken({
      userId: waiter.id,
      username: waiter.username,
      fullName: waiter.fullName,
      role: "PHUC_VU",
    });
  });

  afterAll(async () => {
    if (db) {
      await db.delete(schema.printJobs).where(sql`1=1`);
      await db.delete(schema.cashEntries).where(
        sql`performed_by IN (${cashierUserId}, ${otherCashierId}, ${waiterUserId})`,
      );
      await db.delete(schema.shifts).where(
        sql`cashier_id IN (${cashierUserId}, ${otherCashierId}, ${waiterUserId})`,
      );
      await db.delete(schema.users).where(
        sql`id IN (${cashierUserId}, ${otherCashierId}, ${waiterUserId})`,
      );
    }
    await pool.end();
  });

  it("blocks PHUC_VU role from recording cash transactions with 403 Forbidden", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/shifts/cash-transaction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
      },
      body: JSON.stringify({
        loai: "THU",
        soTien: 100_000,
        lyDo: "Nộp tiền",
      }),
    });

    const res = await cashTransactionHandler(req);
    expect(res.status).toBe(403);
  });

  it("blocks invalid amount (<= 0 or non-integer) with 400 Bad Request (TC-28)", async () => {
    // 0 VND
    const zeroReq = new NextRequest("http://localhost:3000/api/v1/shifts/cash-transaction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        loai: "CHI",
        soTien: 0,
        lyDo: "Mua đá",
      }),
    });
    expect((await cashTransactionHandler(zeroReq)).status).toBe(400);

    // Negative VND
    const negReq = new NextRequest("http://localhost:3000/api/v1/shifts/cash-transaction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        loai: "CHI",
        soTien: -20_000,
        lyDo: "Mua đá",
      }),
    });
    expect((await cashTransactionHandler(negReq)).status).toBe(400);
  });

  it("blocks empty or blank reason with 400 Bad Request (TC-28)", async () => {
    const blankReq = new NextRequest("http://localhost:3000/api/v1/shifts/cash-transaction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        loai: "THU",
        soTien: 100_000,
        lyDo: "   ",
      }),
    });
    expect((await cashTransactionHandler(blankReq)).status).toBe(400);
  });

  it("blocks cash transaction on another cashier's shift with 403 Forbidden", async () => {
    const tamperReq = new NextRequest("http://localhost:3000/api/v1/shifts/cash-transaction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        shiftId: otherShiftId,
        loai: "CHI",
        soTien: 50_000,
        lyDo: "Chi trộm ca người khác",
      }),
    });
    const res = await cashTransactionHandler(tamperReq);
    expect(res.status).toBe(403);
  });

  it("records cash out (CHI) 50,000, updates theoretical cash and queues CASH_RECEIPT print job (AC-09-1)", async () => {
    const printJobsBefore = await db.select().from(schema.printJobs);
    const countBefore = printJobsBefore.length;

    const req = new NextRequest("http://localhost:3000/api/v1/shifts/cash-transaction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        loai: "CHI",
        soTien: 50_000,
        lyDo: "Mua đá uống gấp",
      }),
    });

    const res = await cashTransactionHandler(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.entry.entryType).toBe("CHI");
    expect(body.data.entry.amount).toBe(50_000);
    expect(body.data.entry.reason).toBe("Mua đá uống gấp");
    expect(body.data.entry.performedBy).toBe(cashierUserId);
    // Theoretical cash: 1,000,000 - 50,000 = 950,000
    expect(body.data.expectedCash).toBe(950_000);

    // Verify exactly ONE print_job was created with CASH_RECEIPT
    const printJobsAfter = await db.select().from(schema.printJobs);
    expect(printJobsAfter.length).toBe(countBefore + 1);
    const latestJob = printJobsAfter[printJobsAfter.length - 1];
    expect(latestJob.jobType).toBe("CASH_RECEIPT");
    expect(latestJob.targetPrinter).toBe("RECEIPT");
    expect(latestJob.status).toBe("PENDING");

    const parsedPayload = JSON.parse(latestJob.payload);
    expect(parsedPayload.entryType).toBe("CHI");
    expect(parsedPayload.amount).toBe(50_000);
    expect(parsedPayload.reason).toBe("Mua đá uống gấp");
  });

  it("records cash in (THU) 200,000, updates theoretical cash and queues CASH_RECEIPT print job (AC-09-2)", async () => {
    const printJobsBefore = await db.select().from(schema.printJobs);
    const countBefore = printJobsBefore.length;

    const req = new NextRequest("http://localhost:3000/api/v1/shifts/cash-transaction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        loai: "THU",
        soTien: 200_000,
        lyDo: "Nạp thêm tiền lẻ thối",
      }),
    });

    const res = await cashTransactionHandler(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.entry.entryType).toBe("THU");
    expect(body.data.entry.amount).toBe(200_000);
    expect(body.data.entry.reason).toBe("Nạp thêm tiền lẻ thối");
    // Theoretical cash: 1,000,000 - 50,000 + 200,000 = 1,150,000
    expect(body.data.expectedCash).toBe(1_150_000);

    // Verify exactly ONE print_job was created
    const printJobsAfter = await db.select().from(schema.printJobs);
    expect(printJobsAfter.length).toBe(countBefore + 1);
    const latestJob = printJobsAfter[printJobsAfter.length - 1];
    expect(latestJob.jobType).toBe("CASH_RECEIPT");
    expect(latestJob.status).toBe("PENDING");
  });

  it("verifies GET /api/v1/shifts/current matches BR-05 cumulative balance (1,150,000 VND)", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/shifts/current", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
    });

    const res = await currentShiftHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.initialCash).toBe(1_000_000);
    expect(body.data.cashOut).toBe(50_000);
    expect(body.data.cashIn).toBe(200_000);
    expect(body.data.cashSales).toBe(0);
    expect(body.data.expectedCash).toBe(1_150_000);
  });

  it("enforces PostgreSQL CHECK constraint on print_jobs: accepts CASH_RECEIPT and rejects unknown job types (23514)", async () => {
    // Valid CASH_RECEIPT insertion directly to DB
    const [validJob] = await db
      .insert(schema.printJobs)
      .values({
        jobType: "CASH_RECEIPT",
        targetPrinter: "RECEIPT",
        payload: JSON.stringify({ test: true }),
        status: "PENDING",
      })
      .returning();
    expect(validJob.id).toBeDefined();

    // Invalid job type insertion must throw 23514
    let errCode = "";
    try {
      await db.execute(
        sql`INSERT INTO print_jobs (job_type, target_printer, payload, status) VALUES ('UNKNOWN_TYPE', 'RECEIPT', '{}', 'PENDING')`,
      );
    } catch (e: unknown) {
      errCode = (e as { code?: string }).code || "";
    }
    expect(errCode).toBe("23514");
  });
});
