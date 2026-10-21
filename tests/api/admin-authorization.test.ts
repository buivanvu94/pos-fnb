import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { GET as adminSummaryHandler } from "@/app/api/v1/admin/summary/route";
import { GET as revenueReportHandler } from "@/app/api/v1/reports/revenue/route";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";

describe("Admin Route & Middleware Security Authorization", () => {
  it("does not bypass auth for paths containing a dot if not a static file", async () => {
    // Attempting to bypass auth with dot in path
    const req1 = new NextRequest("http://localhost:3000/admin.test", { method: "GET" });
    const res1 = await middleware(req1);
    expect(res1.status).toBe(307); // Redirect to /login
    expect(res1.headers.get("location")).toContain("/login");

    const req2 = new NextRequest("http://localhost:3000/api/v1/admin.custom", { method: "GET" });
    const res2 = await middleware(req2);
    expect(res2.status).toBe(401);
  });

  it("strips spoofed client x-user-* headers before downstream processing", async () => {
    // Malicious request sending fake admin header without token
    const req = new NextRequest("http://localhost:3000/api/v1/tables", {
      method: "GET",
      headers: {
        "x-user-role": "QUAN_LY",
        "x-user-id": "1",
        "x-user-name": "Hacker",
      },
    });

    const res = await middleware(req);
    // Because there is no valid cookie token, spoofed headers must NOT grant access!
    expect(res.status).toBe(401);
  });

  it("blocks Phục vụ (PHUC_VU) with 403 when calling admin API route", async () => {
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

  it("permits Quản lý (QUAN_LY) to access admin route via requireRole", async () => {
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
    expect(middlewareRes.status).toBe(200);

    const handlerRes = await adminSummaryHandler(req);
    expect(handlerRes.status).toBe(200);

    const data = await handlerRes.json();
    expect(data.ok).toBe(true);
    expect(data.message).toContain("Admin dashboard access granted");
  });

  it("revenue report endpoint enforces can() permissions per role", async () => {
    const waiterToken = await signAuthToken({
      userId: 3,
      username: "phucvu",
      fullName: "Lê Văn Phục Vụ",
      role: "PHUC_VU",
    });
    const cashierToken = await signAuthToken({
      userId: 2,
      username: "thungan",
      fullName: "Trần Thị Thu Ngân",
      role: "THU_NGAN",
    });
    const managerToken = await signAuthToken({
      userId: 1,
      username: "quanly",
      fullName: "Nguyễn Văn Quản Lý",
      role: "QUAN_LY",
    });

    // 1. Phục vụ -> 403
    const waiterReq = new NextRequest("http://localhost:3000/api/v1/reports/revenue", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });
    const waiterRes = await revenueReportHandler(waiterReq);
    expect(waiterRes.status).toBe(403);

    // 2. Thu ngân asking for general report -> 403
    const cashierGeneralReq = new NextRequest("http://localhost:3000/api/v1/reports/revenue", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
    });
    const cashierGeneralRes = await revenueReportHandler(cashierGeneralReq);
    expect(cashierGeneralRes.status).toBe(403);

    // 3. Thu ngân asking for own shift -> 200
    const cashierOwnReq = new NextRequest("http://localhost:3000/api/v1/reports/revenue?cashierId=2", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
    });
    const cashierOwnRes = await revenueReportHandler(cashierOwnReq);
    expect(cashierOwnRes.status).toBe(200);
    const ownData = await cashierOwnRes.json();
    expect(ownData.scope).toBe("OWN_SHIFT_REVENUE");

    // 4. Quản lý -> 200 general report
    const managerReq = new NextRequest("http://localhost:3000/api/v1/reports/revenue", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}` },
    });
    const managerRes = await revenueReportHandler(managerReq);
    expect(managerRes.status).toBe(200);
    const mgrData = await managerRes.json();
    expect(mgrData.scope).toBe("ALL_REVENUE");
  });
});
