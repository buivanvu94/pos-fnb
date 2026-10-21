import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "@/db/schema";
import { GET as getSettingHandler, PUT as updateSettingHandler } from "@/app/api/v1/settings/approval/route";
import { POST as discountHandler } from "@/app/api/v1/orders/[id]/discount/route";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { setPinRequired, isPinRequired, APPROVAL_PIN_REQUIRED_KEY } from "@/server/approvals/approval-settings-service";
import { getTestDbUrl } from "../setup/test-config";

describe("Approval Settings API - GET & PUT /api/v1/settings/approval (SRS Section 10)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 10);
  const tag = rand();

  let managerId: number;
  let managerToken: string;
  let cashierId: number;
  let cashierToken: string;

  let areaId: number;
  let tableId: number;
  let shiftId: number;
  let initialPinRequired: boolean;

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    initialPinRequired = await isPinRequired();

    const [manager] = await db
      .insert(schema.users)
      .values({
        username: `mgr_sett_${tag}`,
        fullName: "Quản Lý Test Cấu Hình",
        role: "QUAN_LY",
        passwordHash: "dummy",
        pinHash: await bcrypt.hash("8391", 10),
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
        username: `csh_sett_${tag}`,
        fullName: "Thu Ngân Test Cấu Hình",
        role: "THU_NGAN",
        passwordHash: "dummy",
      })
      .returning();
    cashierId = cashier.id;
    cashierToken = await signAuthToken({
      userId: cashier.id,
      username: cashier.username,
      fullName: cashier.fullName,
      role: "THU_NGAN",
    });

    const [area] = await db.insert(schema.areas).values({ code: `A_S_${tag}`, name: `Area S ${tag}` }).returning();
    areaId = area.id;

    const [table] = await db
      .insert(schema.tables)
      .values({ code: `T_S_${tag}`, name: `Bàn S ${tag}`, areaId, capacity: 4, status: "DANG_DUNG" })
      .returning();
    tableId = table.id;

    const [shift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_S_${tag}`,
        cashierId: cashier.id,
        initialCash: 1000000,
        expectedCash: 1000000,
        status: "DANG_MO",
      })
      .returning();
    shiftId = shift.id;
  });

  afterAll(async () => {
    // Restore settings to prior value per prompt requirements
    await setPinRequired(initialPinRequired);

    if (db) {
      await db.delete(schema.auditLogs).where(eq(schema.auditLogs.entityType, "settings"));
      await db.delete(schema.orders).where(eq(schema.orders.shiftId, shiftId));
      await db.delete(schema.tables).where(eq(schema.tables.id, tableId));
      await db.delete(schema.areas).where(eq(schema.areas.id, areaId));
      await db.delete(schema.shifts).where(eq(schema.shifts.id, shiftId));
      await db.delete(schema.users).where(eq(schema.users.id, cashierId));
      await db.delete(schema.users).where(eq(schema.users.id, managerId));
    }
    await pool.end();
  });

  it("retrieves current pinRequired setting with 200 OK", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/settings/approval", {
      method: "GET",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
    });

    const res = await getSettingHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.data.pinRequired).toBe("boolean");
  });

  it("blocks non-QUAN_LY from updating approval settings with 403 Forbidden", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/settings/approval", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({ pinRequired: false }),
    });

    const res = await updateSettingHandler(req);
    expect(res.status).toBe(403);
  });

  it("forbids disabling pinRequired in production environment (HTTP 403)", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as any).NODE_ENV = "production";

      const req = new NextRequest("http://localhost:3000/api/v1/settings/approval", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
        },
        body: JSON.stringify({ pinRequired: false }),
      });

      const res = await updateSettingHandler(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Không thể tắt yêu cầu mã PIN trong môi trường production");
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
    }
  });

  it("allows QUAN_LY to toggle pinRequired and writes SETTINGS_CHANGED audit log", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/settings/approval", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
      },
      body: JSON.stringify({ pinRequired: false }),
    });

    const res = await updateSettingHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.pinRequired).toBe(false);

    expect(await isPinRequired()).toBe(false);

    // Verify SETTINGS_CHANGED audit log
    const [audit] = await db
      .select()
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.action, "SETTINGS_CHANGED"),
          eq(schema.auditLogs.entityId, APPROVAL_PIN_REQUIRED_KEY),
        ),
      );
    expect(audit).toBeDefined();
    const meta = JSON.parse(audit.metadata!);
    expect(meta.key).toBe(APPROVAL_PIN_REQUIRED_KEY);
    expect(meta.newValue).toBe(false);
  });

  it("when pinRequired is false, cashier applies discount without PIN (reason & audit still mandatory)", async () => {
    await setPinRequired(false);

    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_NO_PIN_${rand()}`,
        tableId,
        shiftId,
        totalAmount: 100000,
        finalAmount: 100000,
        status: "DANG_PHUC_VU",
        version: 1,
      })
      .returning();

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/discount`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        amount: 10000,
        lyDo: "Giảm giá môi trường thử nghiệm không cần PIN",
        expectedVersion: 1,
      }),
    });

    const res = await discountHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.discountAmount).toBe(10000);

    const audit = await db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.action, "DISCOUNT"), eq(schema.auditLogs.entityId, String(order.id))));
    expect(audit.length).toBe(1);
    expect(audit[0].reason).toBe("Giảm giá môi trường thử nghiệm không cần PIN");
  });
});
