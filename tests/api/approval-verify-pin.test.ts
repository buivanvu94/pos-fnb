import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "@/db/schema";
import { POST as verifyPinHandler } from "@/app/api/v1/auth/verify-pin/route";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { ERROR_CATALOG } from "@/lib/error-catalog";
import { getTestDbUrl } from "../setup/test-config";

describe("Verify PIN API - POST /api/v1/auth/verify-pin (API-04, FR-10, BR-04)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 10);
  const tag = rand();

  let managerId: number;
  let waiterId: number;
  let waiterToken: string;
  const CORRECT_PIN = "5678";
  const WRONG_PIN = "0000";

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const pinHash = await bcrypt.hash(CORRECT_PIN, 10);
    const [manager] = await db
      .insert(schema.users)
      .values({
        username: `mgr_api04_${tag}`,
        fullName: "Quản Lý Nhà Hàng",
        role: "QUAN_LY",
        passwordHash: "dummy",
        pinHash,
      })
      .returning();
    managerId = manager.id;

    const [waiter] = await db
      .insert(schema.users)
      .values({
        username: `waiter_api04_${tag}`,
        fullName: "Phục Vụ Bàn",
        role: "PHUC_VU",
        passwordHash: "dummy",
      })
      .returning();
    waiterId = waiter.id;

    waiterToken = await signAuthToken({
      userId: waiter.id,
      username: waiter.username,
      fullName: waiter.fullName,
      role: "PHUC_VU",
    });
  });

  afterAll(async () => {
    if (db) {
      await db.delete(schema.auditLogs).where(eq(schema.auditLogs.userId, waiterId));
      await db.delete(schema.users).where(eq(schema.users.id, waiterId));
      await db.delete(schema.users).where(eq(schema.users.id, managerId));
    }
    await pool.end();
  });

  it("verifies valid PIN successfully and returns approver info with 200 OK", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/verify-pin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
      },
      body: JSON.stringify({
        pinCode: CORRECT_PIN,
        lyDo: "Khách đổi ý sang món khác",
      }),
    });

    const res = await verifyPinHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.approverId).toBe(managerId);
    expect(body.data.approverName).toBe("Quản Lý Nhà Hàng");
    expect(JSON.stringify(body)).not.toContain(CORRECT_PIN);
  });

  it("rejects reason shorter than 5 characters with 400 Bad Request", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/verify-pin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
      },
      body: JSON.stringify({
        pinCode: CORRECT_PIN,
        lyDo: "Huy", // only 3 characters
      }),
    });

    const res = await verifyPinHandler(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("tối thiểu 5 ký tự");
  });

  it("rejects malformed JSON or missing fields with 400 Bad Request", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/verify-pin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
      },
      body: JSON.stringify({
        pinCode: "12", // not 4-6 digits
        lyDo: "Hủy món này",
      }),
    });

    const res = await verifyPinHandler(req);
    expect(res.status).toBe(400);
  });

  it("rejects wrong PIN with 403 Forbidden and ERR-02 verbatim", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/verify-pin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
      },
      body: JSON.stringify({
        pinCode: WRONG_PIN,
        lyDo: "Khách hủy không ăn nữa",
      }),
    });

    const res = await verifyPinHandler(req);
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe(ERROR_CATALOG.ERR_02.message);
  });

  it("locks after 5 consecutive failures and returns 429 Too Many Requests with ERR-03 verbatim", async () => {
    // Current failed attempts: 1. Do 3 more to reach 4
    for (let i = 2; i <= 4; i++) {
      const req = new NextRequest("http://localhost:3000/api/v1/auth/verify-pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
        },
        body: JSON.stringify({
          pinCode: WRONG_PIN,
          lyDo: "Khách hủy không ăn nữa",
        }),
      });
      const res = await verifyPinHandler(req);
      expect(res.status).toBe(403);
    }

    // 5th attempt locks out
    const req5 = new NextRequest("http://localhost:3000/api/v1/auth/verify-pin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
      },
      body: JSON.stringify({
        pinCode: WRONG_PIN,
        lyDo: "Khách hủy không ăn nữa",
      }),
    });
    const res5 = await verifyPinHandler(req5);
    expect(res5.status).toBe(429);

    const body5 = await res5.json();
    expect(body5.ok).toBe(false);
    expect(body5.error).toBe(ERROR_CATALOG.ERR_03.message);

    // Further request with correct PIN is also rejected with 429 ERR-03
    const reqLocked = new NextRequest("http://localhost:3000/api/v1/auth/verify-pin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
      },
      body: JSON.stringify({
        pinCode: CORRECT_PIN,
        lyDo: "Khách hủy không ăn nữa",
      }),
    });
    const resLocked = await verifyPinHandler(reqLocked);
    expect(resLocked.status).toBe(429);
    const bodyLocked = await resLocked.json();
    expect(bodyLocked.error).toBe(ERROR_CATALOG.ERR_03.message);
  });
});
