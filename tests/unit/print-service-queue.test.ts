import { describe, it, expect, beforeAll, afterAll } from "vitest";
import net from "net";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { enqueuePrintJob, dispatchPrintJob } from "@/server/printing/print-service";
import { savePrinterSettings, getPrinterSettings, type PrinterSettings } from "@/server/printing/settings-service";
import { POST as retryPrintJobHandler } from "@/app/api/v1/print-jobs/[id]/retry/route";
import { ERROR_CATALOG } from "@/lib/error-catalog";

describe("Print Queue, Atomic Claim & Retry Authorization Unit Tests (Point 2 & Point 5)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 8);
  const tag = rand();

  let mockServer: net.Server;
  const mockPort = 9106;
  let receivedCount = 0;

  let waiterToken: string;
  let waiterUserId: number;
  let managerToken: string;
  let managerUserId: number;
  let initialSettings: PrinterSettings;

  const createdJobIds: number[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });
    initialSettings = await getPrinterSettings();

    // Mock printer on port 9106
    await new Promise<void>((resolve) => {
      mockServer = net.createServer((socket) => {
        socket.on("data", () => {
          receivedCount++;
        });
        socket.on("end", () => socket.end());
      });
      mockServer.listen(mockPort, "127.0.0.1", () => resolve());
    });

    const [wtr] = await db
      .insert(schema.users)
      .values({ username: `wtr_${tag}`, passwordHash: "dummy", fullName: "Nhân Viên Phục Vụ", role: "PHUC_VU" })
      .returning();
    waiterUserId = wtr.id;
    waiterToken = await signAuthToken({ userId: wtr.id, username: wtr.username, fullName: wtr.fullName, role: "PHUC_VU" });

    const [mgr] = await db
      .insert(schema.users)
      .values({ username: `mgr_${tag}`, passwordHash: "dummy", fullName: "Trần Quản Lý", role: "QUAN_LY" })
      .returning();
    managerUserId = mgr.id;
    managerToken = await signAuthToken({ userId: mgr.id, username: mgr.username, fullName: mgr.fullName, role: "QUAN_LY" });

    await savePrinterSettings({
      kitchenIp: `127.0.0.1:${mockPort}`,
      barIp: `127.0.0.1:${mockPort}`,
      receiptIp: `127.0.0.1:${mockPort}`,
    });
  });

  afterAll(async () => {
    if (mockServer) {
      await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    }
    if (db) {
      // Point 10: Clean up created print jobs
      if (createdJobIds.length > 0) {
        await db.delete(schema.printJobs).where(inArray(schema.printJobs.id, createdJobIds));
      }
      await db.delete(schema.users).where(inArray(schema.users.id, [waiterUserId, managerUserId]));

      // Point 10: Restore printer settings
      await savePrinterSettings({
        kitchenIp: initialSettings.kitchenIp,
        barIp: initialSettings.barIp,
        receiptIp: initialSettings.receiptIp,
      });
    }
    await pool.end();
  });

  it("Point 2: two concurrent dispatches of the same job send to printer exactly ONCE", async () => {
    receivedCount = 0;
    const job = await enqueuePrintJob({
      orderId: null,
      jobType: "KOT_KITCHEN",
      targetPrinter: "KITCHEN",
      payload: {
        kind: "KOT",
        orderId: 101,
        orderCode: "HD-CONCUR-01",
        tableName: "Bàn Đồng Thời",
        senderName: "Thu Ngân",
        sentAt: new Date().toISOString(),
        targetStation: "KITCHEN",
        items: [{ name: "Món đồng thời", quantity: 1, unitPrice: 50000 }],
      },
    });
    createdJobIds.push(job.id);

    // Concurrently dispatch the exact same job twice
    const [res1, res2] = await Promise.all([
      dispatchPrintJob(job.id),
      dispatchPrintJob(job.id),
    ]);

    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);

    const statuses = [res1.status, res2.status];
    expect(statuses).toContain("SENT");
    expect(statuses).toContain("ALREADY_HANDLED");

    // Allow network event loop to flush
    await new Promise((r) => setTimeout(r, 40));
    expect(receivedCount).toBe(1);

    const [dbJob] = await db
      .select()
      .from(schema.printJobs)
      .where(eq(schema.printJobs.id, job.id));

    expect(dbJob.status).toBe("SENT");
    expect(dbJob.retryCount).toBe(1); // Increment in SQL
  });

  it("Point 2: retrying an already SENT job returns HTTP 409 Conflict", async () => {
    const job = await enqueuePrintJob({
      orderId: null,
      jobType: "RECEIPT_FINAL",
      targetPrinter: "RECEIPT",
      payload: { kind: "FINAL_RECEIPT", orderId: 102, orderCode: "HD-SENT", items: [] },
    });
    createdJobIds.push(job.id);

    // Set job to SENT
    await db
      .update(schema.printJobs)
      .set({ status: "SENT" })
      .where(eq(schema.printJobs.id, job.id));

    const req = new NextRequest(`http://localhost:3000/api/v1/print-jobs/${job.id}/retry`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}` },
    });

    const res = await retryPrintJobHandler(req, { params: Promise.resolve({ id: String(job.id) }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toMatch(/FAILED/);
  });

  it("Point 2: PHUC_VU is forbidden from retrying RECEIPT or CASH print jobs (403)", async () => {
    const receiptJob = await enqueuePrintJob({
      orderId: null,
      jobType: "RECEIPT_FINAL",
      targetPrinter: "RECEIPT",
      payload: { kind: "FINAL_RECEIPT", orderId: 103, orderCode: "HD-RBAC", items: [] },
    });
    createdJobIds.push(receiptJob.id);

    await db
      .update(schema.printJobs)
      .set({ status: "FAILED", retryCount: 1 })
      .where(eq(schema.printJobs.id, receiptJob.id));

    const req = new NextRequest(`http://localhost:3000/api/v1/print-jobs/${receiptJob.id}/retry`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });

    const res = await retryPrintJobHandler(req, { params: Promise.resolve({ id: String(receiptJob.id) }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toMatch(/bếp hoặc phiếu pha chế/i);
  });

  it("Point 2: retrying a FAILED KOT job succeeds and transitions status to SENT", async () => {
    const kotJob = await enqueuePrintJob({
      orderId: null,
      jobType: "KOT_KITCHEN",
      targetPrinter: "KITCHEN",
      payload: {
        kind: "KOT",
        orderId: 104,
        orderCode: "HD-KOT-RETRY",
        tableName: "Bàn 1",
        senderName: "Phục vụ",
        sentAt: new Date().toISOString(),
        targetStation: "KITCHEN",
        items: [{ name: "Trà đào", quantity: 1, unitPrice: 30000 }],
      },
    });
    createdJobIds.push(kotJob.id);

    await db
      .update(schema.printJobs)
      .set({ status: "FAILED", retryCount: 1, errorMessage: "Simulated prior failure" })
      .where(eq(schema.printJobs.id, kotJob.id));

    const req = new NextRequest(`http://localhost:3000/api/v1/print-jobs/${kotJob.id}/retry`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });

    const res = await retryPrintJobHandler(req, { params: Promise.resolve({ id: String(kotJob.id) }) });
    expect(res.status).toBe(200);

    const [updatedJob] = await db
      .select()
      .from(schema.printJobs)
      .where(eq(schema.printJobs.id, kotJob.id));

    expect(updatedJob.status).toBe("SENT");
    expect(updatedJob.errorMessage).toBeNull();
    expect(updatedJob.retryCount).toBe(2);
  });

  it("Point 5: dispatching to unconfigured printer returns FAILED with ERR-06 and no network call", async () => {
    const origBarEnv = process.env.PRINTER_BAR_IP;
    delete process.env.PRINTER_BAR_IP;
    try {
      // Unconfigure bar printer IP
      await savePrinterSettings({ barIp: "" });

      const job = await enqueuePrintJob({
        orderId: null,
        jobType: "KOT_BAR",
        targetPrinter: "BAR",
        payload: {
          kind: "KOT",
          orderId: 105,
          orderCode: "HD-NO-IP",
          tableName: "Bàn 5",
          senderName: "Phục vụ",
          sentAt: new Date().toISOString(),
          targetStation: "BAR",
          items: [{ name: "Sinh tố xoài", quantity: 1, unitPrice: 40000 }],
        },
      });
      createdJobIds.push(job.id);

      const res = await dispatchPrintJob(job.id);
      expect(res.ok).toBe(false);
      expect(res.status).toBe("FAILED");
      expect(res.error).toBe("Chưa cấu hình IP cho máy in Quầy Bar");
      expect(res.warningMessage).toBe(ERROR_CATALOG.ERR_06.message);

      const [dbJob] = await db
        .select()
        .from(schema.printJobs)
        .where(eq(schema.printJobs.id, job.id));

      expect(dbJob.status).toBe("FAILED");
      expect(dbJob.errorMessage).toBe("Chưa cấu hình IP cho máy in Quầy Bar");
    } finally {
      if (origBarEnv !== undefined) {
        process.env.PRINTER_BAR_IP = origBarEnv;
      }
    }
  });
});
