import { enqueuePrintJob, dispatchPrintJob } from "@/server/printing/print-service";
import type {
  FinalReceiptPayload,
  PickupTicketPayload,
  ReceiptItemPayload,
} from "@/server/printing/print-payload-types";
import type { TokenPayload } from "@/server/auth/jwt";
import type { Order, OrderItem } from "@/db/schema";
import type { db } from "@/db";
import { ERROR_CATALOG } from "@/lib/error-catalog";

export interface PreparePrintJobsParams {
  order: Order;
  activeItems: Array<{ id: number; name?: string | null; quantity: number; unitPrice: number }>;
  settings: {
    storeName?: string;
    storeAddress?: string;
    storePhone?: string;
    storeLogo?: string;
    wifiSsid?: string;
    wifiPassword?: string;
    wifiSecurity?: string;
  };
  user: TokenPayload;
  now: Date;
  tienKhachDua: number;
  cashReturned: number;
  queueNumber: number | null;
  queueDate: string | null;
  printPickupTicket?: boolean;
}

export interface EnqueuedJobsResult {
  receiptJobId?: number;
  pickupTicketJobId?: number;
  printJobsToDispatch: number[];
}

/**
 * Enqueues print jobs for RECEIPT_FINAL (with cash drawer kick) and PICKUP_TICKET (for takeaway)
 * within the active payment transaction (DEC-11, AC-05-1, AC-07-2).
 */
export async function enqueuePaymentPrintJobs(
  params: PreparePrintJobsParams,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<EnqueuedJobsResult> {
  const {
    order,
    activeItems,
    settings,
    user,
    now,
    tienKhachDua,
    cashReturned,
    queueNumber,
    queueDate,
    printPickupTicket,
  } = params;

  const receiptItems: ReceiptItemPayload[] = activeItems.map((item) => ({
    name: item.name ?? "Món ăn",
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.unitPrice * item.quantity,
  }));

  const finalReceiptPayload: FinalReceiptPayload = {
    kind: "FINAL_RECEIPT",
    orderId: order.id,
    orderCode: order.orderCode,
    tableName: order.tableId ? `Bàn ${order.tableId}` : "Mang về",
    orderType: (order.orderType as "TAI_BAN" | "MANG_VE") || "TAI_BAN",
    cashierName: user.fullName || user.username,
    printedAt: now.toISOString(),
    storeName: settings.storeName,
    storeAddress: settings.storeAddress,
    storePhone: settings.storePhone,
    storeLogoPath: settings.storeLogo,
    items: receiptItems,
    subtotal: order.totalAmount,
    discount: order.discountAmount,
    total: order.finalAmount,
    paymentMethod: "TIEN_MAT",
    customerPaid: tienKhachDua,
    changeDue: cashReturned,
    wifiSsid: settings.wifiSsid,
    wifiPassword: settings.wifiPassword,
    wifiSecurity: settings.wifiSecurity,
    kickDrawer: true, // Cash checkout kicks drawer (DEC-11)
  };

  const receiptJob = await enqueuePrintJob(
    {
      orderId: order.id,
      jobType: "RECEIPT_FINAL",
      targetPrinter: "RECEIPT",
      payload: finalReceiptPayload,
    },
    tx,
  );

  const printJobsToDispatch: number[] = [receiptJob.id];
  let pickupTicketJobId: number | undefined;

  if (order.orderType === "MANG_VE" && queueNumber !== null && printPickupTicket !== false) {
    const pickupPayload: PickupTicketPayload = {
      kind: "PICKUP_TICKET",
      orderId: order.id,
      orderCode: order.orderCode,
      queueNumber,
      queueDate: queueDate!,
      cashierName: user.fullName || user.username,
      printedAt: now.toISOString(),
      storeName: settings.storeName,
      items: receiptItems,
      total: order.finalAmount,
    };

    const pickupJob = await enqueuePrintJob(
      {
        orderId: order.id,
        jobType: "PICKUP_TICKET",
        targetPrinter: "RECEIPT",
        payload: pickupPayload,
      },
      tx,
    );

    pickupTicketJobId = pickupJob.id;
    printJobsToDispatch.push(pickupJob.id);
  }

  return {
    receiptJobId: receiptJob.id,
    pickupTicketJobId,
    printJobsToDispatch,
  };
}

/**
 * Dispatches thermal print jobs after transaction commits without failing business request (BR-12, ERR-10).
 * Dispatches in parallel using Promise.allSettled for optimal checkout response time.
 */
export async function dispatchPaymentPrintJobs(jobIds: number[]) {
  const validJobIds = jobIds.filter((id): id is number => Boolean(id) && id > 0);
  if (validJobIds.length === 0) return undefined;

  const results = await Promise.allSettled(
    validJobIds.map(async (jId) => {
      try {
        const res = await dispatchPrintJob(jId);
        if (!res.ok || res.status === "FAILED") {
          return { ok: false, jobId: jId };
        }
        return { ok: true, jobId: jId };
      } catch (printErr) {
        console.error("Dispatch print error for job", jId, printErr);
        return { ok: false, jobId: jId };
      }
    }),
  );

  const failedJobs: number[] = [];
  for (const outcome of results) {
    if (outcome.status === "fulfilled") {
      if (!outcome.value.ok) {
        failedJobs.push(outcome.value.jobId);
      }
    } else {
      failedJobs.push(-1);
    }
  }

  if (failedJobs.length > 0) {
    return {
      message: ERROR_CATALOG.ERR_10.message,
      failedJobs,
    };
  }

  return undefined;
}
