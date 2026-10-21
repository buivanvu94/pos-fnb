import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { GET as getSettingsHandler, PUT as putSettingsHandler } from "@/app/api/v1/settings/printers/route";
import { savePrinterSettings, getPrinterSettings, type PrinterSettings } from "@/server/printing/settings-service";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { getTestDbUrl } from "../setup/test-config";

describe("Printer & Store Settings API (Anti-SSRF & RBAC)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  let managerToken: string;
  let cashierToken: string;
  let waiterToken: string;
  let managerUserId: number;
  let cashierUserId: number;
  let waiterUserId: number;
  let initialSettings: PrinterSettings;

  const rand = () => Math.random().toString(36).slice(2, 8);
  const tag = rand();

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });
    initialSettings = await getPrinterSettings();

    const [mgr] = await db
      .insert(schema.users)
      .values({ username: `mgr_${tag}`, passwordHash: "dummy", fullName: "Manager", role: "QUAN_LY" })
      .returning();
    managerUserId = mgr.id;
    managerToken = await signAuthToken({ userId: mgr.id, username: mgr.username, fullName: mgr.fullName, role: "QUAN_LY" });

    const [csh] = await db
      .insert(schema.users)
      .values({ username: `csh_${tag}`, passwordHash: "dummy", fullName: "Cashier", role: "THU_NGAN" })
      .returning();
    cashierUserId = csh.id;
    cashierToken = await signAuthToken({ userId: csh.id, username: csh.username, fullName: csh.fullName, role: "THU_NGAN" });

    const [wtr] = await db
      .insert(schema.users)
      .values({ username: `wtr_${tag}`, passwordHash: "dummy", fullName: "Waiter", role: "PHUC_VU" })
      .returning();
    waiterUserId = wtr.id;
    waiterToken = await signAuthToken({ userId: wtr.id, username: wtr.username, fullName: wtr.fullName, role: "PHUC_VU" });
  });

  afterAll(async () => {
    if (db) {
      await db.delete(schema.users).where(inArray(schema.users.id, [managerUserId, cashierUserId, waiterUserId]));
      // Point 10: Restore settings
      await savePrinterSettings({
        kitchenIp: initialSettings.kitchenIp,
        barIp: initialSettings.barIp,
        receiptIp: initialSettings.receiptIp,
      });
    }
    await pool.end();
  });

  it("GET /api/v1/settings/printers: QUAN_LY receives full printer and network configuration", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/settings/printers", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}` },
    });
    const res = await getSettingsHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.kitchenIp).toBeDefined();
    expect(json.data.paperWidth).toBeDefined();
    expect(json.data.storeName).toBeDefined();
  });

  it("GET /api/v1/settings/printers: non-manager (PHUC_VU) receives only public UI metadata (Point 6)", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/settings/printers", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });
    const res = await getSettingsHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.paperWidth).toBeDefined();
    expect(json.data.drawerEnabled).toBeDefined();
    expect(json.data.storeName).toBeDefined();
    // Sensitive fields must be omitted
    expect(json.data.kitchenIp).toBeUndefined();
    expect(json.data.barIp).toBeUndefined();
    expect(json.data.receiptIp).toBeUndefined();
    expect(json.data.wifiPassword).toBeUndefined();
    expect(json.data.storeLogo).toBeUndefined();
  });

  it("PUT /api/v1/settings/printers: blocks THU_NGAN with 403 Forbidden", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/settings/printers", {
      method: "PUT",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ kitchenIp: "192.168.1.100" }),
    });
    const res = await putSettingsHandler(req);
    expect(res.status).toBe(403);
  });

  it("PUT /api/v1/settings/printers: blocks PHUC_VU with 403 Forbidden", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/settings/printers", {
      method: "PUT",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ kitchenIp: "192.168.1.100" }),
    });
    const res = await putSettingsHandler(req);
    expect(res.status).toBe(403);
  });

  it("PUT /api/v1/settings/printers: rejects public IP to prevent SSRF (status 400)", async () => {
    // 8.8.8.8 is a public IP
    const req = new NextRequest("http://localhost:3000/api/v1/settings/printers", {
      method: "PUT",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ kitchenIp: "8.8.8.8" }),
    });
    const res = await putSettingsHandler(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("SSRF");
  });

  it("PUT /api/v1/settings/printers: rejects AWS metadata IP 169.254.169.254 (status 400)", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/settings/printers", {
      method: "PUT",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ receiptIp: "169.254.169.254" }),
    });
    const res = await putSettingsHandler(req);
    expect(res.status).toBe(400);
  });

  it("PUT /api/v1/settings/printers: rejects invalid paperWidth (e.g. 70 or 100)", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/settings/printers", {
      method: "PUT",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ paperWidth: 70 }),
    });
    const res = await putSettingsHandler(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Khổ giấy");
  });

  it("PUT /api/v1/settings/printers: QUAN_LY successfully updates RFC1918 IPs and paperWidth 58", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/settings/printers", {
      method: "PUT",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        kitchenIp: "192.168.1.150",
        barIp: "10.0.1.50",
        receiptIp: "172.16.0.20",
        paperWidth: 58,
        storeName: "Quán Ăn Phố Xưa",
        drawerEnabled: true,
      }),
    });
    const res = await putSettingsHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.kitchenIp).toBe("192.168.1.150");
    expect(json.data.barIp).toBe("10.0.1.50");
    expect(json.data.receiptIp).toBe("172.16.0.20");
    expect(json.data.paperWidth).toBe(58);
    expect(json.data.storeName).toBe("Quán Ăn Phố Xưa");
    expect(json.data.drawerEnabled).toBe(true);
  });
});
