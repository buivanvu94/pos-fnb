import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "@/db/schema";
import { verifyManagerPin } from "@/server/approvals/pin-service";
import { getTestDbUrl } from "../setup/test-config";

describe("Approval Security & Audit Tests (Zero PIN Exposure, Atomic Isolation)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 10);
  const tag = rand();

  let managerId: number;
  let waiterId: number;
  const SECRET_PIN = "7412";
  const INCORRECT_PIN = "8520";

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const pinHash = await bcrypt.hash(SECRET_PIN, 10);
    const [manager] = await db
      .insert(schema.users)
      .values({
        username: `mgr_sec_${tag}`,
        fullName: "Quản Lý Bảo Mật",
        role: "QUAN_LY",
        passwordHash: "dummy",
        pinHash,
      })
      .returning();
    managerId = manager.id;

    const [waiter] = await db
      .insert(schema.users)
      .values({
        username: `wtr_sec_${tag}`,
        fullName: "Phục Vụ Bảo Mật",
        role: "PHUC_VU",
        passwordHash: "dummy",
      })
      .returning();
    waiterId = waiter.id;
  });

  afterAll(async () => {
    if (db) {
      await db.delete(schema.auditLogs).where(eq(schema.auditLogs.userId, waiterId));
      await db.delete(schema.users).where(eq(schema.users.id, waiterId));
      await db.delete(schema.users).where(eq(schema.users.id, managerId));
    }
    await pool.end();
  });

  it("proves plaintext PIN NEVER appears in audit_logs table (columns or metadata JSON)", async () => {
    // 1. Perform 1 failed PIN verification
    await verifyManagerPin(waiterId, INCORRECT_PIN);

    // 2. Perform 1 successful PIN verification
    await verifyManagerPin(waiterId, SECRET_PIN);

    // 3. Inspect all audit_logs records created for this user
    const userAuditLogs = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.userId, waiterId));

    expect(userAuditLogs.length).toBeGreaterThanOrEqual(1);

    for (const log of userAuditLogs) {
      const dump = JSON.stringify(log);
      // Ensure plaintext PINs never exist in any column or metadata
      expect(dump).not.toContain(SECRET_PIN);
      expect(dump).not.toContain(INCORRECT_PIN);
    }
  });

  it("proves failed PIN counter persists even if the calling business transaction rolls back", async () => {
    // Reset waiter counter
    await db
      .update(schema.users)
      .set({ pinFailedCount: 0, pinLockedUntil: null })
      .where(eq(schema.users.id, waiterId));

    // Simulate an outer business transaction that verifies PIN then rolls back intentionally
    try {
      await db.transaction(async () => {
        // Step A: verify wrong PIN (internally uses independent transaction)
        const verifyRes = await verifyManagerPin(waiterId, INCORRECT_PIN);
        expect(verifyRes.valid).toBe(false);

        // Step B: catastrophic rollback of the business transaction
        throw new Error("Business Transaction Rollback Simulation");
      });
    } catch (err: any) {
      expect(err.message).toBe("Business Transaction Rollback Simulation");
    }

    // Step C: Verify that pin_failed_count is STILL 1 despite the business transaction rollback!
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, waiterId));
    expect(user.pinFailedCount).toBe(1);

    // Step D: Verify the PIN_FAILED audit log also persisted
    const failedAudits = await db
      .select()
      .from(schema.auditLogs)
      .where(sql`user_id = ${waiterId} AND action = 'PIN_FAILED'`);
    expect(failedAudits.length).toBeGreaterThanOrEqual(1);
  });
});
