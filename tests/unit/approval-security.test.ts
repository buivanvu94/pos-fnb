import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "@/db/schema";
import { verifyManagerPin } from "@/server/approvals/pin-service";
import { getClientIp, getUserAgent } from "@/server/approvals/ip-helper";
import { logAudit } from "@/server/approvals/audit-log-service";
import { getTestDbUrl } from "../setup/test-config";

describe("Approval Security & Audit Tests (Zero PIN Exposure, Atomic Isolation, Proxy Defense)", () => {
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
      expect(dump).not.toContain(SECRET_PIN);
      expect(dump).not.toContain(INCORRECT_PIN);
    }
  });

  it("proves failed PIN counter persists even if the calling business transaction rolls back", async () => {
    await db
      .update(schema.users)
      .set({ pinFailedCount: 0, pinLockedUntil: null })
      .where(eq(schema.users.id, waiterId));

    try {
      await db.transaction(async () => {
        const verifyRes = await verifyManagerPin(waiterId, INCORRECT_PIN);
        expect(verifyRes.valid).toBe(false);
        throw new Error("Business Transaction Rollback Simulation");
      });
    } catch (err: any) {
      expect(err.message).toBe("Business Transaction Rollback Simulation");
    }

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, waiterId));
    expect(user.pinFailedCount).toBe(1);

    const failedAudits = await db
      .select()
      .from(schema.auditLogs)
      .where(sql`user_id = ${waiterId} AND action = 'PIN_FAILED'`);
    expect(failedAudits.length).toBeGreaterThanOrEqual(1);
  });

  it("enforces TRUST_PROXY: ignores x-forwarded-for when TRUST_PROXY is false, trusts only when true", () => {
    const originalEnv = process.env.TRUST_PROXY;
    try {
      // 1. TRUST_PROXY=false (default): ignore proxy headers and return null
      process.env.TRUST_PROXY = "false";
      const fakeReq = new NextRequest("http://localhost:3000/api/v1/auth/verify-pin", {
        headers: {
          "x-forwarded-for": "203.0.113.195, 198.51.100.17",
          "x-real-ip": "198.51.100.17",
        },
      });
      expect(getClientIp(fakeReq)).toBeNull();

      // 2. TRUST_PROXY=true: trust first forwarded IP
      process.env.TRUST_PROXY = "true";
      expect(getClientIp(fakeReq)).toBe("203.0.113.195");
    } finally {
      process.env.TRUST_PROXY = originalEnv;
    }
  });

  it("enriches audit logs with username and truncates userAgent to 200 characters", async () => {
    const longUa = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " + "A".repeat(300);
    const req = new NextRequest("http://localhost:3000/api/test", {
      headers: { "user-agent": longUa },
    });

    const parsedUa = getUserAgent(req);
    expect(parsedUa?.length).toBe(200);

    await logAudit(
      {
        userId: waiterId,
        username: "waiter_sec_test",
        userAgent: parsedUa,
        action: "TEST_AUDIT_ACTION",
        entityType: "test",
        entityId: "123",
        reason: "Test audit enrichment",
        metadata: { someKey: "value" },
      },
      db,
    );

    const [log] = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.action, "TEST_AUDIT_ACTION"));
    expect(log).toBeDefined();
    const meta = JSON.parse(log.metadata!);
    expect(meta.username).toBe("waiter_sec_test");
    expect(meta.userAgent?.length).toBe(200);
  });
});
