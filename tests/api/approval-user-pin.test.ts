import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "@/db/schema";
import { PUT as updatePinHandler } from "@/app/api/v1/users/me/pin/route";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { verifyManagerPin } from "@/server/approvals/pin-service";
import { getTestDbUrl } from "../setup/test-config";

describe("Manager PIN Management API - PUT /api/v1/users/me/pin", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 10);
  const tag = rand();

  let managerId: number;
  let managerToken: string;
  let otherManagerId: number;
  let cashierId: number;
  let cashierToken: string;

  const CURRENT_PASSWORD = "Password123!";
  const INITIAL_PIN = "7410";
  const NEW_PIN = "6382";
  const OTHER_MANAGER_PIN = "9264";

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const passwordHash = await bcrypt.hash(CURRENT_PASSWORD, 10);
    const pinHash = await bcrypt.hash(INITIAL_PIN, 10);

    const [manager] = await db
      .insert(schema.users)
      .values({
        username: `mgr_pinm_${tag}`,
        fullName: "Quản Lý Đổi PIN",
        role: "QUAN_LY",
        passwordHash,
        pinHash,
        pinFailedCount: 3,
        loginFailedCount: 0,
      })
      .returning();
    managerId = manager.id;
    managerToken = await signAuthToken({
      userId: manager.id,
      username: manager.username,
      fullName: manager.fullName,
      role: "QUAN_LY",
    });

    const otherPinHash = await bcrypt.hash(OTHER_MANAGER_PIN, 10);
    const [otherMgr] = await db
      .insert(schema.users)
      .values({
        username: `mgr_other_${tag}`,
        fullName: "Quản Lý Khác",
        role: "QUAN_LY",
        passwordHash,
        pinHash: otherPinHash,
      })
      .returning();
    otherManagerId = otherMgr.id;

    const [cashier] = await db
      .insert(schema.users)
      .values({
        username: `csh_pinm_${tag}`,
        fullName: "Thu Ngân Test",
        role: "THU_NGAN",
        passwordHash,
      })
      .returning();
    cashierId = cashier.id;
    cashierToken = await signAuthToken({
      userId: cashier.id,
      username: cashier.username,
      fullName: cashier.fullName,
      role: "THU_NGAN",
    });
  });

  afterAll(async () => {
    if (db) {
      await db.delete(schema.auditLogs).where(eq(schema.auditLogs.entityType, "users"));
      await db.delete(schema.users).where(eq(schema.users.id, cashierId));
      await db.delete(schema.users).where(eq(schema.users.id, otherManagerId));
      await db.delete(schema.users).where(eq(schema.users.id, managerId));
    }
    await pool.end();
  });

  it("allows QUAN_LY to update their PIN with correct current password and resets failed count", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/users/me/pin", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
      },
      body: JSON.stringify({
        currentPassword: CURRENT_PASSWORD,
        newPin: NEW_PIN,
      }),
    });

    const res = await updatePinHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, managerId));
    expect(user.pinFailedCount).toBe(0);
    expect(user.pinLockedUntil).toBeNull();

    const verifyResult = await verifyManagerPin(managerId, NEW_PIN);
    expect(verifyResult.valid).toBe(true);

    // Verify PIN_CHANGED audit entry is logged and never contains plaintext PIN
    const [audit] = await db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.entityId, String(managerId)), eq(schema.auditLogs.action, "PIN_CHANGED")));
    expect(audit).toBeDefined();
    expect(audit.reason).toContain("cập nhật mã PIN");
    expect(JSON.stringify(audit)).not.toContain(NEW_PIN);
  });

  it("rejects trivial PINs: identical, sequential, repeating pairs, birth years", async () => {
    const trivialPins = [
      "0000", "1111", "9999", "111111",
      "1234", "4321", "123456", "654321",
      "1212", "112233", "121212",
      "1995", "2000", "2024",
    ];

    for (const badPin of trivialPins) {
      const req = new NextRequest("http://localhost:3000/api/v1/users/me/pin", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
        },
        body: JSON.stringify({
          currentPassword: CURRENT_PASSWORD,
          newPin: badPin,
        }),
      });

      const res = await updatePinHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
    }
  });

  it("rejects new PIN that collides with another manager's active PIN", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/users/me/pin", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
      },
      body: JSON.stringify({
        currentPassword: CURRENT_PASSWORD,
        newPin: OTHER_MANAGER_PIN,
      }),
    });

    const res = await updatePinHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toContain("Mã PIN này đã được sử dụng bởi một quản lý khác");
    // Ensure it doesn't reveal other manager's identity
    expect(data.error).not.toContain("mgr_other");
  });

  it("rejects PIN update when current password is wrong and locks after 5 failures", async () => {
    // Reset login failed count on manager
    await db.update(schema.users).set({ loginFailedCount: 0, loginLockedUntil: null }).where(eq(schema.users.id, managerId));

    for (let i = 1; i <= 4; i++) {
      const req = new NextRequest("http://localhost:3000/api/v1/users/me/pin", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
        },
        body: JSON.stringify({
          currentPassword: "WrongPassword!",
          newPin: "8391",
        }),
      });
      const res = await updatePinHandler(req);
      expect(res.status).toBe(400);
    }

    // 5th wrong attempt -> locks account with 429
    const lockReq = new NextRequest("http://localhost:3000/api/v1/users/me/pin", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
      },
      body: JSON.stringify({
        currentPassword: "WrongPassword!",
        newPin: "8391",
      }),
    });
    const lockRes = await updatePinHandler(lockReq);
    expect(lockRes.status).toBe(429);
    const lockData = await lockRes.json();
    expect(lockData.error).toContain("Tài khoản đã bị tạm khóa do nhập sai mật khẩu quá 5 lần");

    // Clean up lock for subsequent tests
    await db.update(schema.users).set({ loginFailedCount: 0, loginLockedUntil: null }).where(eq(schema.users.id, managerId));
  });

  it("blocks non-QUAN_LY roles from updating PIN with 403 Forbidden", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/users/me/pin", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        currentPassword: CURRENT_PASSWORD,
        newPin: "8391",
      }),
    });

    const res = await updatePinHandler(req);
    expect(res.status).toBe(403);
  });

  it("rejects new PIN that is not 4-6 digits with 400 Bad Request", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/users/me/pin", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
      },
      body: JSON.stringify({
        currentPassword: CURRENT_PASSWORD,
        newPin: "123", // only 3 digits
      }),
    });

    const res = await updatePinHandler(req);
    expect(res.status).toBe(400);
  });
});

