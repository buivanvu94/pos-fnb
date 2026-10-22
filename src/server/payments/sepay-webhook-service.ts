import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, payments, unmatchedTransactions } from "@/db/schema";
import { executeVietQrPaymentCompletion } from "./vietqr-complete-helper";
import { formatVietqrTransferContent } from "./vietqr-generator";
import type { SepayWebhookPayload } from "./vietqr-types";

/**
 * Validates SePay webhook API key or secret token against environment configuration.
 */
export function verifySepayWebhookAuth(authHeader: string | null, xApiKey: string | null): boolean {
  const configuredApiKey = process.env.SEPAY_API_KEY;
  const configuredSecret = process.env.SEPAY_WEBHOOK_SECRET;

  // In test environment or unconfigured placeholder, permit when explicit match
  const validTokens = [configuredApiKey, configuredSecret].filter(Boolean);
  if (validTokens.length === 0) {
    return true; // No secret configured in dev mode
  }

  const checkValue = (token: string | null | undefined): boolean => {
    if (!token) return false;
    const cleanToken = token.replace(/^(Apikey|Bearer)\s+/i, "").trim();
    return validTokens.includes(cleanToken) || validTokens.includes(token.trim());
  };

  return checkValue(authHeader) || checkValue(xApiKey);
}

/**
 * Extracts compact or full order code from bank transfer message content.
 */
export function extractOrderCodeFromContent(content: string): string | null {
  if (!content) return null;
  const match = content.match(/(HD-?\d{8}-[A-Za-z0-9]+|HD-?[A-Za-z0-9]{2,20})/i);
  return match ? match[1].toUpperCase() : null;
}

export interface ProcessSepayWebhookResult {
  ok: boolean;
  status?: number;
  message?: string;
  error?: string;
  unmatched?: boolean;
  idempotent?: boolean;
  data?: any;
  printWarning?: { message: string; failedJobs?: number[] };
}

/**
 * Processes incoming SePay bank transfer webhook (DEC-06, FR-12).
 * Fully idempotent by gateway transaction ID.
 * Unmatched or deficient transactions are durably logged to unmatched_transactions.
 */
export async function processSepayWebhook(payload: SepayWebhookPayload): Promise<ProcessSepayWebhookResult> {
  const gatewayTxId = String(payload.id);
  const transferAmount = payload.transferAmount ?? payload.amount ?? 0;
  const content = payload.content || payload.description || "";
  const transferType = (payload.transferType || "in").toUpperCase();

  // 1. Idempotency Check: if already processed successfully, return OK immediately
  const [existingSuccess] = await db
    .select({ id: payments.id, status: payments.status })
    .from(payments)
    .where(and(eq(payments.sepayTransactionId, gatewayTxId), eq(payments.status, "SUCCESS")))
    .limit(1);

  if (existingSuccess) {
    return { ok: true, status: 200, message: "Giao dịch đã được xử lý trước đó", idempotent: true };
  }

  // Only handle incoming transfers
  if (transferType !== "IN") {
    return { ok: true, status: 200, message: "Bỏ qua giao dịch không phải tiền vào" };
  }

  // 2. Extract order code
  const extractedCode = extractOrderCodeFromContent(content);
  let matchedOrder: typeof orders.$inferSelect | undefined;
  let matchedPayment: typeof payments.$inferSelect | undefined;

  if (extractedCode) {
    const compactCode = formatVietqrTransferContent(extractedCode);

    // Try finding pending or expired payment with this ref
    const [p] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.vietqrRef, compactCode), eq(payments.paymentMethod, "VIETQR")))
      .orderBy(payments.id)
      .limit(1);

    if (p) {
      matchedPayment = p;
      const [o] = await db.select().from(orders).where(eq(orders.id, p.orderId)).limit(1);
      matchedOrder = o;
    } else {
      // Find order by code directly
      const [o] = await db
        .select()
        .from(orders)
        .where(
          sql`UPPER(${orders.orderCode}) = ${extractedCode} OR UPPER(${orders.orderCode}) LIKE ${'%' + extractedCode.replace(/^HD-?/, '')}`,
        )
        .limit(1);
      matchedOrder = o;
    }
  }

  // 3. Handle unmatched or deficient scenarios
  let unmatchedReason: string | null = null;

  if (!matchedOrder) {
    unmatchedReason = "Không tìm thấy hóa đơn phù hợp với nội dung chuyển khoản";
  } else if (matchedOrder.status !== "DANG_PHUC_VU") {
    unmatchedReason = `Hóa đơn ${matchedOrder.orderCode} ở trạng thái ${matchedOrder.status}, không thể tự động thanh toán`;
  } else if (transferAmount < matchedOrder.finalAmount) {
    unmatchedReason = `Số tiền không đủ (chuyển ${transferAmount.toLocaleString("vi-VN")} đ, cần ${matchedOrder.finalAmount.toLocaleString("vi-VN")} đ)`;
  }

  if (unmatchedReason) {
    await db.insert(unmatchedTransactions).values({
      gateway: (payload.gateway || "SEPAY").slice(0, 50),
      gatewayTransactionId: gatewayTxId,
      amount: transferAmount,
      content: content.slice(0, 255),
      transferType: "IN",
      orderCode: matchedOrder?.orderCode || extractedCode || null,
      orderId: matchedOrder?.id || null,
      reason: unmatchedReason,
      rawPayload: JSON.stringify(payload),
      status: "UNRESOLVED",
    });

    return {
      ok: false,
      status: 200, // Return 200 to acknowledge webhook receipt while flagging unmatched
      unmatched: true,
      error: unmatchedReason,
    };
  }

  // 4. Complete payment and order atomically
  const systemUser = {
    userId: matchedOrder!.createdById || 1,
    username: "sepay_webhook",
    role: "THU_NGAN" as const,
    fullName: "Cổng SePay Tự Động",
  };

  const result = await executeVietQrPaymentCompletion({
    orderId: matchedOrder!.id,
    shiftId: matchedPayment?.shiftId || matchedOrder!.shiftId,
    user: systemUser,
    sepayTransactionId: gatewayTxId,
    paymentId: matchedPayment?.id,
  });

  return result;
}
