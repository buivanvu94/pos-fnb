import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as loginHandler } from "@/app/api/v1/auth/login/route";
import { verifyAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";

describe("Auth Login API - POST /api/v1/auth/login", () => {
  it("authenticates successfully with valid credentials and sets httpOnly cookie", async () => {
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

    // Verify httpOnly cookie
    const cookie = res.cookies.get(AUTH_COOKIE_NAME);
    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.value).toBeTruthy();

    // Verify JWT payload contents
    const decoded = await verifyAuthToken(cookie!.value);
    expect(decoded).not.toBeNull();
    expect(decoded?.username).toBe("quanly");
    expect(decoded?.role).toBe("QUAN_LY");
  });

  it("authenticates cashier and waiter roles correctly", async () => {
    // Cashier
    const cashierReq = new NextRequest("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "thungan", password: "123456" }),
    });
    const cashierRes = await loginHandler(cashierReq);
    expect(cashierRes.status).toBe(200);
    const cashierData = await cashierRes.json();
    expect(cashierData.user.role).toBe("THU_NGAN");

    // Waiter
    const waiterReq = new NextRequest("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "phucvu", password: "123456" }),
    });
    const waiterRes = await loginHandler(waiterReq);
    expect(waiterRes.status).toBe(200);
    const waiterData = await waiterRes.json();
    expect(waiterData.user.role).toBe("PHUC_VU");
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

  it("fails authentication when username does not exist", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "nonexistent_user",
        password: "password123",
      }),
    });

    const res = await loginHandler(req);
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.ok).toBe(false);
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
