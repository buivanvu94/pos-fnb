import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "@/db/schema";
import { verifyManagerPin } from "@/server/approvals/pin-service";
import { ERROR_CATALOG } from "@/lib/error-catalog";
import { getTestDbUrl } from "../setup/test-config";

describe("Approval PIN Service - Unit Tests (FR-10, BR-04, ERR-02, ERR-03)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 10);
  const tag = rand();

  let managerId: number;
  let waiterId: number;
  const CORRECT_PIN = "6183";
  const WRONG_PIN = "9999";

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const pinHash = await bcrypt.hash(CORRECT_PIN, 10);
    const [manager] = await db
      .insert(schema.users)
      .values({
        username: `mgr_pin_${tag}`,
        fullName: "Test Manager PIN",
        role: "QUAN_LY",
        passwordHash: "dummy",
        pinHash,
      })
      .returning();
    managerId = manager.id;

    const [waiter] = await db
      .insert(schema.users)
      .values({
        username: `waiter_pin_${tag}`,
        fullName: "Test Waiter PIN",
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

  it("verifies correct PIN successfully and returns approver info", async () => {
    const result = await verifyManagerPin(waiterId, CORRECT_PIN);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.approver.id).toBe(managerId);
      expect(result.approver.fullName).toBe("Test Manager PIN");
    }

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, waiterId));
    expect(user.pinFailedCount).toBe(0);
    expect(user.pinLockedUntil).toBeNull();
  });

  it("AC-06-2: rejects wrong PIN with ERR-02 (403) and increments failed counter", async () => {
    const result = await verifyManagerPin(waiterId, WRONG_PIN);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(ERROR_CATALOG.ERR_02.message);
      expect(result.locked).toBe(false);
    }

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, waiterId));
    expect(user.pinFailedCount).toBe(1);
    expect(user.pinLockedUntil).toBeNull();
  });

  it("AC-06-3: locks after 5 consecutive failures with ERR-03 (429)", async () => {
    // Current failed count is 1 from previous test. Enter wrong PIN 3 more times (total 4)
    for (let i = 2; i <= 4; i++) {
      const res = await verifyManagerPin(waiterId, WRONG_PIN);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.status).toBe(403);
        expect(res.error).toBe(ERROR_CATALOG.ERR_02.message);
      }
    }

    // 5th failed attempt triggers lockout
    const res5 = await verifyManagerPin(waiterId, WRONG_PIN);
    expect(res5.valid).toBe(false);
    if (!res5.valid) {
      expect(res5.status).toBe(429);
      expect(res5.error).toBe(ERROR_CATALOG.ERR_03.message);
      expect(res5.locked).toBe(true);
    }

    const [lockedUser] = await db.select().from(schema.users).where(eq(schema.users.id, waiterId));
    expect(lockedUser.pinFailedCount).toBe(5);
    expect(lockedUser.pinLockedUntil).not.toBeNull();
    expect(lockedUser.pinLockedUntil!.getTime()).toBeGreaterThan(Date.now());

    // While locked out, even the correct PIN is rejected with ERR-03 (429) without comparison
    const correctPinWhileLocked = await verifyManagerPin(waiterId, CORRECT_PIN);
    expect(correctPinWhileLocked.valid).toBe(false);
    if (!correctPinWhileLocked.valid) {
      expect(correctPinWhileLocked.status).toBe(429);
      expect(correctPinWhileLocked.error).toBe(ERROR_CATALOG.ERR_03.message);
      expect(correctPinWhileLocked.locked).toBe(true);
    }
  });

  it("unlocks automatically and resets counter to 0 after lockout expiration", async () => {
    // Set pinLockedUntil to 1 minute in the past to simulate time passing
    const pastTime = new Date(Date.now() - 60 * 1000);
    await db
      .update(schema.users)
      .set({ pinLockedUntil: pastTime, pinFailedCount: 5 })
      .where(eq(schema.users.id, waiterId));

    // Next verification with correct PIN should succeed and reset counter
    const result = await verifyManagerPin(waiterId, CORRECT_PIN);
    expect(result.valid).toBe(true);

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, waiterId));
    expect(user.pinFailedCount).toBe(0);
    expect(user.pinLockedUntil).toBeNull();
  });

  it("serializes 10 concurrent wrong PIN attempts and locks at exactly threshold 5", async () => {
    // Reset user state
    await db
      .update(schema.users)
      .set({ pinFailedCount: 0, pinLockedUntil: null })
      .where(eq(schema.users.id, waiterId));

    // Send 10 concurrent wrong PIN verifications
    const promises = Array.from({ length: 10 }, () =>
      verifyManagerPin(waiterId, WRONG_PIN),
    );
    const results = await Promise.all(promises);

    const status403Count = results.filter((r) => !r.valid && r.status === 403).length;
    const status429Count = results.filter((r) => !r.valid && r.status === 429).length;

    // Exactly 4 requests should return 403 (attempts 1 to 4)
    expect(status403Count).toBe(4);
    // Attempts 5 to 10 should all return 429
    expect(status429Count).toBe(6);

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, waiterId));
    expect(user.pinLockedUntil).not.toBeNull();
  });

  it("selects manager with smallest ID (ORDER BY id ASC) when multiple managers match PIN", async () => {
    const pinHashShared = await bcrypt.hash("5391", 10);
    const [mgr1] = await db
      .insert(schema.users)
      .values({
        username: `mgr_shared_1_${tag}`,
        fullName: "Quản Lý 1",
        role: "QUAN_LY",
        passwordHash: "dummy",
        pinHash: pinHashShared,
      })
      .returning();

    const [mgr2] = await db
      .insert(schema.users)
      .values({
        username: `mgr_shared_2_${tag}`,
        fullName: "Quản Lý 2",
        role: "QUAN_LY",
        passwordHash: "dummy",
        pinHash: pinHashShared,
      })
      .returning();

    expect(mgr1.id).toBeLessThan(mgr2.id);

    await db.update(schema.users).set({ pinFailedCount: 0, pinLockedUntil: null }).where(eq(schema.users.id, waiterId));

    const result = await verifyManagerPin(waiterId, "5391");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.approver.id).toBe(mgr1.id);
      expect(result.approver.fullName).toBe("Quản Lý 1");
    }

    await db.delete(schema.users).where(eq(schema.users.id, mgr1.id));
    await db.delete(schema.users).where(eq(schema.users.id, mgr2.id));
  });
});


