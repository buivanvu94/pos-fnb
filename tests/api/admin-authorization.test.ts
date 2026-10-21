import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { GET as adminSummaryHandler } from "@/app/api/v1/admin/summary/route";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";

describe("Admin Route Authorization - Role Protection", () => {
  it("blocks Phục vụ (PHUC_VU) with 403 when calling admin API route", async () => {
    // Generate valid token for waiter role
    const waiterToken = await signAuthToken({
      userId: 3,
      username: "phucvu",
      fullName: "Lê Văn Phục Vụ",
      role: "PHUC_VU",
    });

    const req = new NextRequest("http://localhost:3000/api/v1/admin/summary", {
      method: "GET",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(403);

    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toContain("403 Forbidden");
  });

  it("blocks Thu ngân (THU_NGAN) with 403 when calling admin API route", async () => {
    const cashierToken = await signAuthToken({
      userId: 2,
      username: "thungan",
      fullName: "Trần Thị Thu Ngân",
      role: "THU_NGAN",
    });

    const req = new NextRequest("http://localhost:3000/api/v1/admin/summary", {
      method: "GET",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(403);
  });

  it("blocks Phục vụ with 403 when requesting admin web page", async () => {
    const waiterToken = await signAuthToken({
      userId: 3,
      username: "phucvu",
      fullName: "Lê Văn Phục Vụ",
      role: "PHUC_VU",
    });

    const req = new NextRequest("http://localhost:3000/admin/reports", {
      method: "GET",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(403);
  });

  it("permits Quản lý (QUAN_LY) to access admin route", async () => {
    const managerToken = await signAuthToken({
      userId: 1,
      username: "quanly",
      fullName: "Nguyễn Văn Quản Lý",
      role: "QUAN_LY",
    });

    const req = new NextRequest("http://localhost:3000/api/v1/admin/summary", {
      method: "GET",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
      },
    });

    const middlewareRes = await middleware(req);
    // When middleware allows the request, it returns next() with modified headers
    expect(middlewareRes.status).toBe(200);

    // Call route handler with the forwarded role header
    const handlerReq = new NextRequest("http://localhost:3000/api/v1/admin/summary", {
      method: "GET",
      headers: {
        "x-user-role": "QUAN_LY",
      },
    });
    const handlerRes = await adminSummaryHandler(handlerReq);
    expect(handlerRes.status).toBe(200);

    const data = await handlerRes.json();
    expect(data.ok).toBe(true);
    expect(data.message).toContain("Admin dashboard access granted");
  });

  it("returns 401 when unauthenticated request calls protected admin route", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/admin/summary", {
      method: "GET",
    });

    const res = await middleware(req);
    expect(res.status).toBe(401);
  });
});
