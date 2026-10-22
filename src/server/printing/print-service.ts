import { eq, and, or, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { printJobs, type PrintJob } from "@/db/schema";
import { ERROR_CATALOG } from "@/lib/error-catalog";
import { getPrinterSettings } from "./settings-service";
import { compilePrintPayloadToEscpos } from "./render-engine";
import { sendToPrinter } from "./tcp-printer";
import { parsePrinterAddress } from "./printer-address-validator";
import { sweepStaleSendingJobs, STALE_SENDING_THRESHOLD_MS } from "./print-stale-sweeper";
import { resolveStationAddress, populatePayloadDefaults } from "./print-station-resolver";

export { sweepStaleSendingJobs } from "./print-stale-sweeper";

export type PrintJobType =
  | "KOT_KITCHEN"
  | "KOT_BAR"
  | "RECEIPT_TEMP"
  | "RECEIPT_FINAL"
  | "Z_REPORT"
  | "CASH_RECEIPT"
  | "PICKUP_TICKET";

export type TargetPrinterStation = "KITCHEN" | "BAR" | "RECEIPT";

export interface EnqueueJobParams {
  orderId?: number | null;
  jobType: PrintJobType;
  targetPrinter: TargetPrinterStation;
  payload: Record<string, any>;
}

export interface DispatchResult {
  ok: boolean;
  jobId: number;
  status: "SENT" | "FAILED" | "SENDING" | "ALREADY_HANDLED";
  error?: string;
  warningMessage?: string;
}

let hasSweptOnStartup = false;

export function resetStartupSweepFlag(): void {
  hasSweptOnStartup = false;
}

export async function enqueuePrintJob(
  params: EnqueueJobParams,
  txInstance: any = db,
): Promise<PrintJob> {
  const [job] = await txInstance
    .insert(printJobs)
    .values({
      orderId: params.orderId ?? null,
      jobType: params.jobType,
      targetPrinter: params.targetPrinter,
      payload: JSON.stringify(params.payload),
      status: "PENDING",
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return job;
}

async function safeMarkJobFailed(jobId: number, errorMessage: string): Promise<void> {
  try {
    await db
      .update(printJobs)
      .set({
        status: "FAILED",
        errorMessage: errorMessage.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(and(eq(printJobs.id, jobId), eq(printJobs.status, "SENDING")));
  } catch (dbErr) {
    console.error(`Failed to mark print job ${jobId} as FAILED in DB:`, dbErr);
  }
}

export async function dispatchPrintJob(jobId: number): Promise<DispatchResult> {
  if (!hasSweptOnStartup) {
    hasSweptOnStartup = true;
    await sweepStaleSendingJobs();
  }

  let claimedJob: PrintJob | undefined;

  try {
    const now = new Date();
    const staleThreshold = new Date(Date.now() - STALE_SENDING_THRESHOLD_MS);

    const [job] = await db
      .update(printJobs)
      .set({
        status: "SENDING",
        retryCount: sql`${printJobs.retryCount} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(printJobs.id, jobId),
          or(
            inArray(printJobs.status, ["PENDING", "FAILED"]),
            and(
              eq(printJobs.status, "SENDING"),
              sql`${printJobs.updatedAt} < ${staleThreshold}`,
            ),
          ),
        ),
      )
      .returning();

    claimedJob = job;
  } catch (claimErr: any) {
    console.error(`Error claiming print job ${jobId}:`, claimErr);
    return {
      ok: false,
      jobId,
      status: "FAILED",
      error: "Lỗi kết nối cơ sở dữ liệu khi nhận lệnh in",
      warningMessage: ERROR_CATALOG.ERR_06.message,
    };
  }

  if (!claimedJob) {
    return { ok: true, jobId, status: "ALREADY_HANDLED" };
  }

  const settings = await getPrinterSettings();
  const station = resolveStationAddress(claimedJob, settings);

  try {
    if (!station.targetIp || station.targetIp.trim() === "") {
      const errMsg = `Chưa cấu hình IP cho máy in ${station.stationName}`;
      await safeMarkJobFailed(jobId, errMsg);
      return { ok: false, jobId, status: "FAILED", error: errMsg, warningMessage: station.defaultWarning };
    }

    const parsedAddr = parsePrinterAddress(station.targetIp);
    if (!parsedAddr.ok) {
      const errMsg = `Địa chỉ máy in ${station.stationName} không hợp lệ: ${parsedAddr.error}`;
      await safeMarkJobFailed(jobId, errMsg);
      return { ok: false, jobId, status: "FAILED", error: errMsg, warningMessage: station.defaultWarning };
    }

    const payloadObj = populatePayloadDefaults(claimedJob.payload, settings);
    const escposBytes = await compilePrintPayloadToEscpos(payloadObj, {
      paperWidth: settings.paperWidth,
      enableDrawerKick: settings.drawerEnabled,
    });

    await sendToPrinter({
      ip: parsedAddr.host,
      port: parsedAddr.port,
      data: escposBytes,
      timeoutMs: 2000,
    });

    try {
      await db
        .update(printJobs)
        .set({ status: "SENT", updatedAt: new Date(), errorMessage: null })
        .where(and(eq(printJobs.id, jobId), eq(printJobs.status, "SENDING")));
    } catch (sentDbErr) {
      console.error(`Failed to record SENT status for job ${jobId} in DB:`, sentDbErr);
    }

    return { ok: true, jobId, status: "SENT" };
  } catch (err: any) {
    const rawMsg = err?.message || "Không thể kết nối máy in";
    const errMsg = rawMsg.slice(0, 500);
    await safeMarkJobFailed(jobId, errMsg);

    return {
      ok: false,
      jobId,
      status: "FAILED",
      error: errMsg,
      warningMessage: station.defaultWarning,
    };
  }
}

export async function retryPrintJob(jobId: number): Promise<DispatchResult> {
  return await dispatchPrintJob(jobId);
}
