import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { users, auditLogs } from "@/db/schema";
import { POST as loginHandler } from "@/app/api/v1/auth/login/route";
import { verifyAuthToken, AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE } from "@/server/auth/jwt";

describe("Auth Login API - POST /api/v1/auth/login", () => {
  const rand = () => Math.random().toString(36).slice(2, 8);
  const tag = rand();

  const lockTestUsername = `lockuser_${tag}`;
  const lockTestPassword = "CorrectPassword123!";
  let lockTestUserId: number;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash("123456", 10);
    const testUsers = [
      { username: "quanly", passwordHash, fullName: "Nguyễn Văn Quản Lý", role: "QUAN_LY" as const },
      { username: "thungan", passwordHash, fullName: "Trần Thị Thu Ngân", role: "THU_NGAN" as const },
      { username: "phucvu", passwordHash, fullName: "Lê Văn Phục Vụ", role: "PHUC_VU" as const },
    ];
    for (const u of testUsers) {
      const existing = await db.select().from(users).where(eq(users.username, u.username)).limit(1);
      if (existing.length === 0) {
        await db.insert(users).values(u);
      }
    }

    const lockHash = await bcrypt.hash(lockTestPassword, 10);
    const [created] = await db
      .insert(users)
      .values({
        username: lockTestUsername,
        passwordHash: lockHash,
        fullName: "User Test Lockout",
        role: "THU_NGAN",
      })
      .returning();
    lockTestUserId = created.id;
  });

  afterAll(async () => {
    await db.delete(auditLogs).where(eq(auditLogs.entityType, "users"));
    await db.delete(users).where(eq(users.id, lockTestUserId));
  });

  it("authenticates successfully with valid credentials and sets 12-hour httpOnly cookie", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "quanly",
        password: "123456",
      }),
    });

    const res = await loginHandler(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.user).toBeDefined();
    expect(data.user.username).toBe("quanly");
    expect(data.user.role).toBe("QUAN_LY");

    // Verify httpOnly cookie and 12-hour maxAge
    const cookie = res.cookies.get(AUTH_COOKIE_NAME);
    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.maxAge).toBe(AUTH_COOKIE_MAX_AGE);
    expect(cookie?.maxAge).toBe(43200); // 12 hours * 3600 seconds

    // Verify JWT payload contents
    const decoded = await verifyAuthToken(cookie!.value);
    expect(decoded).not.toBeNull();
    expect(decoded?.username).toBe("quanly");
    expect(decoded?.role).toBe("QUAN_LY");
  });

  it("fails authentication when password is incorrect", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "quanly",
        password: "wrong_password_999",
      }),
    });

    const res = await loginHandler(req);
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toContain("Tên đăng nhập hoặc mật khẩu không chính xác");
    expect(res.cookies.get(AUTH_COOKIE_NAME)).toBeUndefined();
  });

  it("locks account for 5 minutes after 5 consecutive failures, and rejects valid password during lockout", async () => {
    // Reset user counters
    await db.update(users).set({ loginFailedCount: 0, loginLockedUntil: null }).where(eq(users.id, lockTestUserId));

    // 4 wrong attempts -> each returns 401
    for (let i = 1; i <= 4; i++) {
      const req = new NextRequest("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: lockTestUsername, password: `wrong_${i}` }),
      });
      const res = await loginHandler(req);
      expect(res.status).toBe(401);
    }

    // 5th wrong attempt -> triggers lockout (429)
    const req5 = new NextRequest("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: lockTestUsername, password: "wrong_5" }),
    });
    const res5 = await loginHandler(req5);
    expect(res5.status).toBe(429);
    const data5 = await res5.json();
    expect(data5.error).toContain("Tài khoản đã bị tạm khóa do nhập sai mật khẩu quá 5 lần");

    // Correct password during lockout must STILL be rejected with 429
    const reqCorrect = new NextRequest("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: lockTestUsername, password: lockTestPassword }),
    });
    const resCorrect = await loginHandler(reqCorrect);
    expect(resCorrect.status).toBe(429);

    // Verify LOGIN_LOCKED audit log exists
    const [lockedAudit] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, String(lockTestUserId)), eq(auditLogs.action, "LOGIN_LOCKED")));
    expect(lockedAudit).toBeDefined();

    // Fast-forward lockout expiration into the past
    await db
      .update(users)
      .set({ loginLockedUntil: new Date(Date.now() - 1000) })
      .where(eq(users.id, lockTestUserId));

    // Now valid login succeeds and resets counter
    const reqUnlock = new NextRequest("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: lockTestUsername, password: lockTestPassword }),
    });
    const resUnlock = await loginHandler(reqUnlock);
    expect(resUnlock.status).toBe(200);

    const [unlockedUser] = await db.select().from(users).where(eq(users.id, lockTestUserId));
    expect(unlockedUser.loginFailedCount).toBe(0);
    expect(unlockedUser.loginLockedUntil).toBeNull();
  });

  it("serializes 10 concurrent wrong password attempts and locks at exactly threshold 5", async () => {
    // Reset counter
    await db.update(users).set({ loginFailedCount: 0, loginLockedUntil: null }).where(eq(users.id, lockTestUserId));

    const attempts = Array.from({ length: 10 }).map((_, idx) =>
      loginHandler(
        new NextRequest("http://localhost:3000/api/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: lockTestUsername, password: `concurrent_wrong_${idx}` }),
        }),
      ),
    );

    const results = await Promise.all(attempts);
    const statuses = results.map((r) => r.status);
    const count401 = statuses.filter((s) => s === 401).length;
    const count429 = statuses.filter((s) => s === 429).length;

    expect(count401).toBe(4);
    expect(count429).toBe(6);

    const [user] = await db.select().from(users).where(eq(users.id, lockTestUserId));
    expect(user.loginFailedCount).toBeGreaterThanOrEqual(5);
    expect(user.loginLockedUntil).not.toBeNull();

    // Reset lock
    await db.update(users).set({ loginFailedCount: 0, loginLockedUntil: null }).where(eq(users.id, lockTestUserId));
  });

  it("returns identical generic response for non-existent and wrong-password user to prevent enumeration", async () => {
    const wrongPassReq = new NextRequest("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: lockTestUsername, password: "incorrect_pass_xyz" }),
    });
    const wrongPassRes = await loginHandler(wrongPassReq);
    const wrongPassData = await wrongPassRes.json();

    const nonExistReq = new NextRequest("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: `nonexistent_${rand()}`, password: "incorrect_pass_xyz" }),
    });
    const nonExistRes = await loginHandler(nonExistReq);
    const nonExistData = await nonExistRes.json();

    expect(wrongPassRes.status).toBe(401);
    expect(nonExistRes.status).toBe(401);
    expect(wrongPassData).toEqual(nonExistData);
    expect(nonExistData.error).toBe("Tên đăng nhập hoặc mật khẩu không chính xác");
  });

  it("returns 400 when missing username or password", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "quanly",
      }),
    });

    const res = await loginHandler(req);
    expect(res.status).toBe(400);
  });
});
