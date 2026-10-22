import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { GET as getSyncStatusHandler } from "@/app/api/v1/sync/status/route";
import { POST as runSyncHandler } from "@/app/api/v1/sync/run/route";
import { recordSyncInvoiceEvent, SYNC_OUTBOX_TYPES } from "@/server/sync";

describe("Sync Status & Run API Routes (NFR-04, DEC-10)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 8);
  const tag = rand();

  let managerToken: string;
  let cashierToken: string;
  let waiterToken: string;
  let managerId: number;
  let cashierId: number;
  let waiterId: number;

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const [mgr] = await db
      .insert(schema.users)
      .values({
        username: `mgr_sync_${tag}`,
        fullName: "Quản Lý Sync",
        role: "QUAN_LY",
        passwordHash: "dummy",
      })
      .returning();
    managerId = mgr.id;
    managerToken = await signAuthToken({
      userId: mgr.id,
      username: mgr.username,
      fullName: mgr.fullName,
      role: "QUAN_LY",
    });

    const [csh] = await db
      .insert(schema.users)
      .values({
        username: `csh_sync_${tag}`,
        fullName: "Thu Ngân Sync",
        role: "THU_NGAN",
        passwordHash: "dummy",
      })
      .returning();
    cashierId = csh.id;
    cashierToken = await signAuthToken({
      userId: csh.id,
      username: csh.username,
      fullName: csh.fullName,
      role: "THU_NGAN",
    });

    const [wtr] = await db
      .insert(schema.users)
      .values({
        username: `wtr_sync_${tag}`,
        fullName: "Phục Vụ Sync",
        role: "PHUC_VU",
        passwordHash: "dummy",
      })
      .returning();
    waiterId = wtr.id;
    waiterToken = await signAuthToken({
      userId: wtr.id,
      username: wtr.username,
      fullName: wtr.fullName,
      role: "PHUC_VU",
    });
  });

  afterAll(async () => {
    if (db) {
      await db.delete(schema.outbox).where(inArray(schema.outbox.type, [...SYNC_OUTBOX_TYPES]));
      await db.delete(schema.users).where(inArray(schema.users.id, [managerId, cashierId, waiterId]));
    }
    await pool.end();
  });

  it("GET /api/v1/sync/status enforces authentication and allows all roles", async () => {
    // 1. Unauthenticated -> 401
    const anonReq = new NextRequest("http://localhost:3000/api/v1/sync/status");
    const anonRes = await getSyncStatusHandler(anonReq);
    expect(anonRes.status).toBe(401);

    // 2. Waiter -> 200
    const waiterReq = new NextRequest("http://localhost:3000/api/v1/sync/status", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });
    const waiterRes = await getSyncStatusHandler(waiterReq);
    expect(waiterRes.status).toBe(200);

    // 3. Cashier -> 200
    const cashierReq = new NextRequest("http://localhost:3000/api/v1/sync/status", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
    });
    const cashierRes = await getSyncStatusHandler(cashierReq);
    expect(cashierRes.status).toBe(200);

    // 4. Manager -> 200 with accurate structure
    const mgrReq = new NextRequest("http://localhost:3000/api/v1/sync/status", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}` },
    });
    const mgrRes = await getSyncStatusHandler(mgrReq);
    expect(mgrRes.status).toBe(200);
    const body = await mgrRes.json();
    expect(body.ok).toBe(true);
    expect(typeof body.data.pending).toBe("number");
    expect(typeof body.data.failed).toBe("number");
    expect(typeof body.data.configured).toBe("boolean");
  });

  it("POST /api/v1/sync/run restricts execution to QUAN_LY only", async () => {
    // 1. Unauthenticated -> 401
    const anonReq = new NextRequest("http://localhost:3000/api/v1/sync/run", { method: "POST" });
    const anonRes = await runSyncHandler(anonReq);
    expect(anonRes.status).toBe(401);

    // 2. Waiter -> 403
    const waiterReq = new NextRequest("http://localhost:3000/api/v1/sync/run", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });
    const waiterRes = await runSyncHandler(waiterReq);
    expect(waiterRes.status).toBe(403);

    // 3. Cashier -> 403
    const cashierReq = new NextRequest("http://localhost:3000/api/v1/sync/run", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
    });
    const cashierRes = await runSyncHandler(cashierReq);
    expect(cashierRes.status).toBe(403);

    // 4. Manager -> 200 OK
    const mgrReq = new NextRequest("http://localhost:3000/api/v1/sync/run", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}` },
    });
    const mgrRes = await runSyncHandler(mgrReq);
    expect(mgrRes.status).toBe(200);
    const body = await mgrRes.json();
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(typeof body.data.requeuedCount).toBe("number");
  });
});
