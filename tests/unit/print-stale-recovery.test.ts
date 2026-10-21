import { describe, it, expect, beforeAll, afterAll } from "vitest";
import net from "net";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { dispatchPrintJob, sweepStaleSendingJobs } from "@/server/printing/print-service";
import { savePrinterSettings, getPrinterSettings, type PrinterSettings } from "@/server/printing/settings-service";
import { POST as retryJobHandler } from "@/app/api/v1/print-jobs/[id]/retry/route";

describe("Print Job Stale SENDING Recovery & Conditional Writes (Point 1, 2, 4)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let managerToken: string;
  let managerUserId: number;
  let initialSettings: PrinterSettings;
  let mockServer: net.Server;
  const mockPort = 9106;
  const createdJobIds: number[] = [];

  const createJob = async (status: "SENDING", stale = false) => {
    const [job] = await db
      .insert(schema.printJobs)
      .values({
        jobType: "KOT_KITCHEN",
        targetPrinter: "KITCHEN",
        payload: JSON.stringify({ kind: "KOT", items: [] }),
        status,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: stale ? new Date(Date.now() - 120000) : new Date(),
      })
      .returning();
    if (stale) {
      await db.update(schema.printJobs)
        .set({ updatedAt: sql`NOW() - INTERVAL '120 seconds'` })
        .where(eq(schema.printJobs.id, job.id));
    }
    createdJobIds.push(job.id);
    return job;
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });
    initialSettings = await getPrinterSettings();

    await new Promise<void>((resolve) => {
      mockServer = net.createServer((sock) => sock.on("data", () => {}));
      mockServer.listen(mockPort, "127.0.0.1", () => resolve());
    });

    await savePrinterSettings({ kitchenIp: `127.0.0.1:${mockPort}` });
    const [mgr] = await db.insert(schema.users)
      .values({ username: `mgr_stale_${Math.random().toString(36).slice(2, 7)}`, passwordHash: "dummy", fullName: "Quản Lý Test", role: "QUAN_LY" })
      .returning();
    managerUserId = mgr.id;
    managerToken = await signAuthToken({ userId: mgr.id, username: mgr.username, fullName: mgr.fullName, role: "QUAN_LY" });
  });

  afterAll(async () => {
    if (mockServer) await new Promise<void>((r) => mockServer.close(() => r()));
    if (db) {
      if (createdJobIds.length > 0) {
        await db.delete(schema.printJobs).where(inArray(schema.printJobs.id, createdJobIds));
      }
      await db.delete(schema.users).where(eq(schema.users.id, managerUserId));
      await savePrinterSettings({
        kitchenIp: initialSettings.kitchenIp,
        barIp: initialSettings.barIp,
        receiptIp: initialSettings.receiptIp,
      });
    }
    await pool.end();
  });

  it("fresh SENDING job returns ALREADY_HANDLED and does not dispatch", async () => {
    const job = await createJob("SENDING", false);
    const res = await dispatchPrintJob(job.id);
    expect(res.ok).toBe(true);
    expect(res.status).toBe("ALREADY_HANDLED");

    const [freshCheck] = await db.select().from(schema.printJobs).where(eq(schema.printJobs.id, job.id));
    expect(freshCheck.status).toBe("SENDING");
    expect(freshCheck.retryCount).toBe(0);
  });

  it("stale SENDING job (> 60s) is claimed and transitions to SENT", async () => {
    const job = await createJob("SENDING", true);
    const res = await dispatchPrintJob(job.id);
    expect(res.ok).toBe(true);
    expect(res.status).toBe("SENT");

    const [claimedCheck] = await db.select().from(schema.printJobs).where(eq(schema.printJobs.id, job.id));
    expect(claimedCheck.status).toBe("SENT");
    expect(claimedCheck.retryCount).toBe(1);
  });

  it("retry route rejects fresh SENDING with 409 and succeeds for stale SENDING (> 60s)", async () => {
    const freshJob = await createJob("SENDING", false);
    const reqFresh = new NextRequest(`http://localhost:3000/api/v1/print-jobs/${freshJob.id}/retry`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}` },
    });
    const resFresh = await retryJobHandler(reqFresh, { params: Promise.resolve({ id: String(freshJob.id) }) });
    expect(resFresh.status).toBe(409);
    expect((await resFresh.json()).error).toContain("đang được xử lý");

    const staleJob = await createJob("SENDING", true);
    const reqStale = new NextRequest(`http://localhost:3000/api/v1/print-jobs/${staleJob.id}/retry`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}` },
    });
    const resStale = await retryJobHandler(reqStale, { params: Promise.resolve({ id: String(staleJob.id) }) });
    expect(resStale.status).toBe(200);
    expect((await resStale.json()).ok).toBe(true);
  });

  it("sweepStaleSendingJobs converts stale SENDING into FAILED with clear message", async () => {
    const staleJob = await createJob("SENDING", true);
    const sweptCount = await sweepStaleSendingJobs();
    expect(sweptCount).toBeGreaterThanOrEqual(1);

    const [sweptJob] = await db.select().from(schema.printJobs).where(eq(schema.printJobs.id, staleJob.id));
    expect(sweptJob.status).toBe("FAILED");
    expect(sweptJob.errorMessage).toContain("quá 60 giây");
  });

  it("conditional SENT write does not overwrite job if status was modified midway", async () => {
    const job = await createJob("SENDING", false);
    await db.update(schema.printJobs)
      .set({ status: "FAILED", errorMessage: "Reclaimed by another worker" })
      .where(eq(schema.printJobs.id, job.id));

    await db.update(schema.printJobs)
      .set({ status: "SENT", updatedAt: new Date(), errorMessage: null })
      .where(sql`${schema.printJobs.id} = ${job.id} AND ${schema.printJobs.status} = 'SENDING'`);

    const [finalJob] = await db.select().from(schema.printJobs).where(eq(schema.printJobs.id, job.id));
    expect(finalJob.status).toBe("FAILED");
    expect(finalJob.errorMessage).toBe("Reclaimed by another worker");
  });
});
