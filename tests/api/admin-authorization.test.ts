import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { GET as adminSummaryHandler } from "@/app/api/v1/admin/summary/route";
import { GET as revenueReportHandler } from "@/app/api/v1/reports/revenue/route";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";

describe("Admin Route & Middleware Security Authorization", () => {
  it("never bypasses auth for /api/* or /admin/* even with static file extensions", async () => {
    // 1. /api/v1/orders/1.png -> must require auth (returns 401)
    const req1 = new NextRequest("http://localhost:3000/api/v1/orders/1.png");
    const res1 = await middleware(req1);
    expect(res1.status).toBe(401);

    // 2. /admin/foo.js -> must require auth (redirects to /login)
    const req2 = new NextRequest("http://localhost:3000/admin/foo.js");
    const res2 = await middleware(req2);
    expect(res2.status).toBe(307);
    expect(res2.headers.get("location")).toContain("/login");

    // 3. /admin.test -> must require auth
    const req3 = new NextRequest("http://localhost:3000/admin.test");
    const res3 = await middleware(req3);
    expect(res3.status).toBe(307);

    // 4. /api/v1/auth/login-fake -> exact match ensures this is not treated as public login
    const req4 = new NextRequest("http://localhost:3000/api/v1/auth/login-fake");
    const res4 = await middleware(req4);
    expect(res4.status).toBe(401);
  });

  it("strips spoofed x-user-* headers and blocks non-QUAN_LY from /admin", async () => {
    // A: Spoofed headers without token -> 401
    const unauthReq = new NextRequest("http://localhost:3000/api/v1/tables", {
      headers: { "x-user-role": "QUAN_LY", "x-user-id": "1", "x-user-name": "Hacker" },
    });
    const unauthRes = await middleware(unauthReq);
    expect(unauthRes.status).toBe(401);

    // B: THU_NGAN token + spoofed header x-user-role: QUAN_LY visiting /admin -> 403
    const cashierToken = await signAuthToken({
      userId: 2,
      username: "thungan",
      fullName: "Trần Thị Thu Ngân",
      role: "THU_NGAN",
    });
    const spoofReq = new NextRequest("http://localhost:3000/admin", {
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
        "x-user-role": "QUAN_LY",
        "x-user-id": "1",
      },
    });
    const spoofRes = await middleware(spoofReq);
    expect(spoofRes.status).toBe(403);
  });

  it("blocks PHUC_VU with 403 on admin API routes", async () => {
    const waiterToken = await signAuthToken({
      userId: 3,
      username: "phucvu",
      fullName: "Lê Văn Phục Vụ",
      role: "PHUC_VU",
    });
    const req = new NextRequest("http://localhost:3000/api/v1/admin/summary", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });
    const res = await middleware(req);
    expect(res.status).toBe(403);
  });

  it("permits QUAN_LY to access admin API route", async () => {
    const managerToken = await signAuthToken({
      userId: 1,
      username: "quanly",
      fullName: "Nguyễn Văn Quản Lý",
      role: "QUAN_LY",
    });
    const req = new NextRequest("http://localhost:3000/api/v1/admin/summary", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}` },
    });
    expect((await middleware(req)).status).toBe(200);

    const handlerRes = await adminSummaryHandler(req);
    expect(handlerRes.status).toBe(200);
    const data = await handlerRes.json();
    expect(data.ok).toBe(true);
  });

  it("revenue report endpoint returns 501 Not Implemented or 403 per permissions", async () => {
    const waiterToken = await signAuthToken({
      userId: 3,
      username: "phucvu",
      fullName: "Phục Vụ",
      role: "PHUC_VU",
    });
    const cashierToken = await signAuthToken({
      userId: 2,
      username: "thungan",
      fullName: "Thu Ngân",
      role: "THU_NGAN",
    });
    const managerToken = await signAuthToken({
      userId: 1,
      username: "quanly",
      fullName: "Quản Lý",
      role: "QUAN_LY",
    });

    // 1. Phục vụ -> 403
    const waiterRes = await revenueReportHandler(
      new NextRequest("http://localhost:3000/api/v1/reports/revenue", {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
      }),
    );
    expect(waiterRes.status).toBe(403);

    // 2. Thu ngân querying another cashier's report -> 403
    const otherRes = await revenueReportHandler(
      new NextRequest("http://localhost:3000/api/v1/reports/revenue?cashierId=99", {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
      }),
    );
    expect(otherRes.status).toBe(403);

    // 3. Thu ngân querying without cashierId defaults to own shift -> 501
    const ownRes = await revenueReportHandler(
      new NextRequest("http://localhost:3000/api/v1/reports/revenue", {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
      }),
    );
    expect(ownRes.status).toBe(501);
    const ownData = await ownRes.json();
    expect(ownData.scope).toBe("OWN_SHIFT_REVENUE");
    expect(ownData.code).toBe("NOT_IMPLEMENTED");

    // 4. Quản lý -> 501 general report
    const mgrRes = await revenueReportHandler(
      new NextRequest("http://localhost:3000/api/v1/reports/revenue", {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}` },
      }),
    );
    expect(mgrRes.status).toBe(501);
    const mgrData = await mgrRes.json();
    expect(mgrData.scope).toBe("ALL_REVENUE");
    expect(mgrData.code).toBe("NOT_IMPLEMENTED");
  });
});
