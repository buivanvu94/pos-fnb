import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
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
  let cashierId: number;
  let cashierToken: string;

  const CURRENT_PASSWORD = "Password123!";
  const INITIAL_PIN = "1111";
  const NEW_PIN = "9999";

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
      })
      .returning();
    managerId = manager.id;
    managerToken = await signAuthToken({
      userId: manager.id,
      username: manager.username,
      fullName: manager.fullName,
      role: "QUAN_LY",
    });

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
      await db.delete(schema.users).where(eq(schema.users.id, cashierId));
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

    // Verify user in DB has reset counter and new PIN works
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, managerId));
    expect(user.pinFailedCount).toBe(0);
    expect(user.pinLockedUntil).toBeNull();

    // Verify the new PIN passes verification
    const verifyResult = await verifyManagerPin(managerId, NEW_PIN);
    expect(verifyResult.valid).toBe(true);

    // Verify the old PIN no longer works
    const oldVerify = await verifyManagerPin(managerId, INITIAL_PIN);
    expect(oldVerify.valid).toBe(false);
  });

  it("rejects PIN update when current password is wrong with 400 Bad Request", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/users/me/pin", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
      },
      body: JSON.stringify({
        currentPassword: "WrongPassword!",
        newPin: "8888",
      }),
    });

    const res = await updatePinHandler(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Mật khẩu hiện tại không chính xác");
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
        newPin: "8888",
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
