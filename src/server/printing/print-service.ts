import { eq, and, or, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { printJobs, type PrintJob } from "@/db/schema";
import { ERROR_CATALOG } from "@/lib/error-catalog";
import { getPrinterSettings } from "./settings-service";
import { compilePrintPayloadToEscpos } from "./render-engine";
import { sendToPrinter } from "./tcp-printer";
import { parsePrinterAddress } from "./printer-address-validator";

export type PrintJobType =
  | "KOT_KITCHEN"
  | "KOT_BAR"
  | "RECEIPT_TEMP"
  | "RECEIPT_FINAL"
  | "Z_REPORT"
  | "CASH_RECEIPT";

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

/**
 * Enqueues a new print job with status PENDING inside (or outside) an active transaction.
 */
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

/**
 * Safely updates a print job to FAILED without throwing errors if the DB update fails.
 */
async function safeMarkJobFailed(jobId: number, errorMessage: string): Promise<void> {
  try {
    await db
      .update(printJobs)
      .set({
        status: "FAILED",
        errorMessage: errorMessage.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(printJobs.id, jobId));
  } catch (dbErr) {
    console.error(`Failed to mark print job ${jobId} as FAILED in DB:`, dbErr);
  }
}

/**
 * Dispatches an enqueued print job to the physical LAN printer.
 * Atomic claim (Point 2): transitions to SENDING and increments retry_count in SQL.
 * Complete failure isolation (Point 1): never throws an unhandled rejection.
 */
export async function dispatchPrintJob(jobId: number): Promise<DispatchResult> {
  let claimedJob: PrintJob | undefined;

  try {
    const now = new Date();
    // Crashed SENDING jobs older than 60s can be reclaimed (Point 2)
    const staleThreshold = new Date(Date.now() - 60000);

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

  // If another worker/process already claimed or already SENT this job
  if (!claimedJob) {
    return { ok: true, jobId, status: "ALREADY_HANDLED" };
  }

  const isReceipt = claimedJob.targetPrinter === "RECEIPT";
  const defaultWarning = isReceipt
    ? ERROR_CATALOG.ERR_10.message
    : ERROR_CATALOG.ERR_06.message;

  try {
    const settings = await getPrinterSettings();

    // Resolve target station and IP
    let targetIp = settings.kitchenIp;
    let stationName = "Bếp";
    if (claimedJob.targetPrinter === "BAR") {
      targetIp = settings.barIp;
      stationName = "Quầy Bar";
    } else if (claimedJob.targetPrinter === "RECEIPT") {
      targetIp = settings.receiptIp;
      stationName = "Hóa đơn";
    }

    // Point 5: If printer IP is unconfigured, fail explicitly with Vietnamese message and ERR-06
    if (!targetIp || targetIp.trim() === "") {
      const errMsg = `Chưa cấu hình IP cho máy in ${stationName}`;
      await safeMarkJobFailed(jobId, errMsg);
      return {
        ok: false,
        jobId,
        status: "FAILED",
        error: errMsg,
        warningMessage: defaultWarning,
      };
    }

    // Point 3: Validate and parse printer address strictly at dispatch time
    const parsedAddr = parsePrinterAddress(targetIp);
    if (!parsedAddr.ok) {
      const errMsg = `Địa chỉ máy in ${stationName} không hợp lệ: ${parsedAddr.error}`;
      await safeMarkJobFailed(jobId, errMsg);
      return {
        ok: false,
        jobId,
        status: "FAILED",
        error: errMsg,
        warningMessage: defaultWarning,
      };
    }

    let payloadObj: Record<string, any> = {};
    try {
      payloadObj = JSON.parse(claimedJob.payload);
    } catch {
      payloadObj = {};
    }

    // Inject store defaults if missing
    if (!payloadObj.storeName) payloadObj.storeName = settings.storeName;
    if (!payloadObj.storeAddress) payloadObj.storeAddress = settings.storeAddress;
    if (!payloadObj.storePhone) payloadObj.storePhone = settings.storePhone;
    if (!payloadObj.storeLogoPath && settings.storeLogo) payloadObj.storeLogoPath = settings.storeLogo;
    if (!payloadObj.wifiSsid) {
      payloadObj.wifiSsid = settings.wifiSsid;
      payloadObj.wifiPassword = settings.wifiPassword;
      payloadObj.wifiSecurity = settings.wifiSecurity;
    }

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

    // Successfully sent to printer
    await db
      .update(printJobs)
      .set({ status: "SENT", updatedAt: new Date(), errorMessage: null })
      .where(eq(printJobs.id, jobId));

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
      warningMessage: defaultWarning,
    };
  }
}

/**
 * Retries a previously failed print job (AC-03-2, BR-12).
 */
export async function retryPrintJob(jobId: number): Promise<DispatchResult> {
  return await dispatchPrintJob(jobId);
}
