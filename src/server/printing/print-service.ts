import { eq } from "drizzle-orm";
import { db } from "@/db";
import { printJobs, type PrintJob } from "@/db/schema";
import { ERROR_CATALOG } from "@/lib/error-catalog";
import { getPrinterSettings } from "./settings-service";
import { compilePrintPayloadToEscpos } from "./render-engine";
import { sendToPrinter } from "./tcp-printer";

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
  status: "SENT" | "FAILED";
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
 * Dispatches an enqueued print job to the physical LAN printer (run after DB commit).
 * Non-blocking: printer communication errors are caught, updating job status to FAILED.
 */
export async function dispatchPrintJob(jobId: number): Promise<DispatchResult> {
  const [job] = await db
    .select()
    .from(printJobs)
    .where(eq(printJobs.id, jobId))
    .limit(1);

  if (!job) {
    return { ok: false, jobId, status: "FAILED", error: "Không tìm thấy lệnh in" };
  }

  const settings = await getPrinterSettings();

  // Resolve target IP address
  let targetIp = settings.kitchenIp;
  if (job.targetPrinter === "BAR") {
    targetIp = settings.barIp;
  } else if (job.targetPrinter === "RECEIPT") {
    targetIp = settings.receiptIp;
  }

  let host = targetIp;
  let port = 9100;
  if (targetIp.includes(":")) {
    const [h, p] = targetIp.split(":");
    host = h;
    port = Number(p) || 9100;
  }

  let payloadObj: Record<string, any> = {};
  try {
    payloadObj = JSON.parse(job.payload);
  } catch {
    payloadObj = {};
  }

  // Inject defaults from system settings if missing
  if (!payloadObj.storeName) payloadObj.storeName = settings.storeName;
  if (!payloadObj.storeAddress) payloadObj.storeAddress = settings.storeAddress;
  if (!payloadObj.storePhone) payloadObj.storePhone = settings.storePhone;
  if (!payloadObj.storeLogoPath && settings.storeLogo) payloadObj.storeLogoPath = settings.storeLogo;
  if (!payloadObj.wifiSsid) {
    payloadObj.wifiSsid = settings.wifiSsid;
    payloadObj.wifiPassword = settings.wifiPassword;
    payloadObj.wifiSecurity = settings.wifiSecurity;
  }

  try {
    const escposBytes = await compilePrintPayloadToEscpos(payloadObj, {
      paperWidth: settings.paperWidth,
      enableDrawerKick: settings.drawerEnabled,
    });

    await sendToPrinter({
      ip: host,
      port,
      data: escposBytes,
      timeoutMs: 2000,
    });

    await db
      .update(printJobs)
      .set({ status: "SENT", updatedAt: new Date(), errorMessage: null })
      .where(eq(printJobs.id, jobId));

    return { ok: true, jobId, status: "SENT" };
  } catch (err: any) {
    const errMsg = err?.message || "Không thể kết nối máy in";
    const isReceipt = job.targetPrinter === "RECEIPT";
    const warningMessage = isReceipt
      ? ERROR_CATALOG.ERR_10.message
      : ERROR_CATALOG.ERR_06.message;

    await db
      .update(printJobs)
      .set({
        status: "FAILED",
        retryCount: job.retryCount + 1,
        errorMessage: errMsg,
        updatedAt: new Date(),
      })
      .where(eq(printJobs.id, jobId));

    return {
      ok: false,
      jobId,
      status: "FAILED",
      error: errMsg,
      warningMessage,
    };
  }
}

/**
 * Retries a previously failed print job (AC-03-2, BR-12).
 */
export async function retryPrintJob(jobId: number): Promise<DispatchResult> {
  return await dispatchPrintJob(jobId);
}
