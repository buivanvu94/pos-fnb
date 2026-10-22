import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { getOrderDetails } from "@/server/orders/order-service";
import { enqueuePrintJob, dispatchPrintJob } from "@/server/printing/print-service";
import { getPrinterSettings } from "@/server/printing/settings-service";
import type { FinalReceiptPayload, ReceiptItemPayload } from "@/server/printing/print-payload-types";
import { ERROR_CATALOG } from "@/lib/error-catalog";
import type { TokenPayload } from "@/server/auth/jwt";

export interface ReprintResult {
  ok: boolean;
  status: number;
  error?: string;
  data?: {
    orderId: number;
    orderCode: string;
    jobId: number;
  };
  printWarning?: {
    message: string;
    jobId: number;
  };
}

/**
 * Reprints the final receipt for an already paid order (BR-08, BR-12, FR-13).
 * Does NOT kick the cash drawer.
 * Only QUAN_LY and THU_NGAN are allowed.
 */
export async function reprintFinalReceipt(
  orderId: number,
  user: TokenPayload,
): Promise<ReprintResult> {
  const order = await getOrderDetails(orderId);
  if (!order) {
    return { ok: false, status: 404, error: "Đơn hàng không tồn tại" };
  }

  if (order.status !== "DA_THANH_TOAN") {
    return {
      ok: false,
      status: 409,
      error: "Chỉ có thể in lại hóa đơn đã thanh toán hoàn tất",
    };
  }

  // Find latest payment
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .orderBy(payments.id)
    .limit(1);

  const activeItems = order.items.filter((item) => !item.isCancelled);
  const settings = await getPrinterSettings();

  const receiptItems: ReceiptItemPayload[] = activeItems.map((item) => ({
    name: item.menuItemName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalItemPrice,
    notes: item.notes,
    toppings: item.toppings?.map((t) => t.toppingName),
  }));

  const payload: FinalReceiptPayload = {
    kind: "FINAL_RECEIPT",
    orderId: order.id,
    orderCode: order.orderCode,
    tableName: order.tableName ?? (order.orderType === "MANG_VE" ? "Mang về" : "Tại bàn"),
    orderType: (order.orderType as "TAI_BAN" | "MANG_VE") || "TAI_BAN",
    cashierName: user.fullName || user.username,
    printedAt: new Date().toISOString(),
    storeName: settings.storeName,
    storeAddress: settings.storeAddress,
    storePhone: settings.storePhone,
    storeLogoPath: settings.storeLogo,
    items: receiptItems,
    subtotal: order.totalAmount,
    discount: order.discountAmount,
    total: order.finalAmount,
    paymentMethod: payment?.paymentMethod || order.paymentMethod || "TIEN_MAT",
    customerPaid: payment?.cashGiven ?? undefined,
    changeDue: payment?.cashReturned ?? undefined,
    wifiSsid: settings.wifiSsid,
    wifiPassword: settings.wifiPassword,
    wifiSecurity: settings.wifiSecurity,
    kickDrawer: false, // Reprint NEVER opens drawer
  };

  const job = await enqueuePrintJob({
    orderId: order.id,
    jobType: "RECEIPT_FINAL",
    targetPrinter: "RECEIPT",
    payload,
  });

  let printWarning: { message: string; jobId: number } | undefined;
  try {
    const dispatchResult = await dispatchPrintJob(job.id);
    if (!dispatchResult.ok || dispatchResult.status === "FAILED") {
      printWarning = {
        message: ERROR_CATALOG.ERR_10.message,
        jobId: job.id,
      };
    }
  } catch (printErr) {
    console.error("Reprint dispatch error:", printErr);
    printWarning = {
      message: ERROR_CATALOG.ERR_10.message,
      jobId: job.id,
    };
  }

  return {
    ok: true,
    status: 200,
    data: {
      orderId: order.id,
      orderCode: order.orderCode,
      jobId: job.id,
    },
    ...(printWarning ? { printWarning } : {}),
  };
}
