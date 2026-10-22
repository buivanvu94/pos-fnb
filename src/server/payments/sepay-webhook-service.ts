import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { payments, unmatchedTransactions } from "@/db/schema";
import { executeVietQrPaymentCompletion } from "./vietqr-complete-helper";
import { extractOrderCodeFromContent } from "./vietqr-generator";
import { verifySepayWebhookAuth } from "./sepay-auth-helper";
import { logUnmatchedTransaction } from "./sepay-unmatched-helper";
import { matchOrderAndPayment } from "./sepay-matcher-helper";
import type { SepayWebhookPayload } from "./vietqr-types";

export { verifySepayWebhookAuth, extractOrderCodeFromContent };

export interface ProcessSepayWebhookResult {
  ok: boolean;
  status?: number;
  success?: boolean;
  message?: string;
  error?: string;
  unmatched?: boolean;
  idempotent?: boolean;
  data?: any;
  printWarning?: { message: string; failedJobs?: number[] };
}

/**
 * Processes incoming SePay bank transfer webhook (DEC-06, FR-12).
 * Fully idempotent, resilient to cross-day order collisions, and always returns HTTP 200 { success: true }.
 */
export async function processSepayWebhook(payload: SepayWebhookPayload): Promise<ProcessSepayWebhookResult> {
  const gatewayTxId = String(payload.id);
  const transferAmount = payload.transferAmount ?? payload.amount ?? 0;
  const content = payload.content || payload.description || "";
  const transferType = (payload.transferType || "in").toUpperCase();

  // 1. Idempotency Check: check BOTH payments.sepay_transaction_id and unmatched_transactions
  const [existingPayment] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.sepayTransactionId, gatewayTxId), eq(payments.status, "SUCCESS")))
    .limit(1);

  if (existingPayment) {
    return { ok: true, status: 200, success: true, message: "Giao dịch đã được xử lý trước đó", idempotent: true };
  }

  const [existingUnmatched] = await db
    .select({ id: unmatchedTransactions.id })
    .from(unmatchedTransactions)
    .where(eq(unmatchedTransactions.gatewayTransactionId, gatewayTxId))
    .limit(1);

  if (existingUnmatched) {
    return { ok: true, status: 200, success: true, message: "Giao dịch đã được ghi nhận trước đó", idempotent: true };
  }

  if (transferType !== "IN") {
    return { ok: true, status: 200, success: true, message: "Bỏ qua giao dịch không phải tiền vào" };
  }

  // 2. Candidate matching & validation
  const extractedCode = extractOrderCodeFromContent(content);
  const matchResult = await matchOrderAndPayment(extractedCode, transferAmount);

  if (matchResult.error) {
    await logUnmatchedTransaction({
      payload,
      gatewayTxId,
      amount: transferAmount,
      content,
      orderCode: matchResult.matchedOrder?.orderCode || extractedCode || null,
      orderId: matchResult.matchedOrder?.id || null,
      reason: matchResult.error,
    });

    return {
      ok: true,
      status: 200,
      success: true,
      unmatched: true,
      error: matchResult.error,
    };
  }

  // 3. Complete payment atomically with race condition handling
  const { matchedOrder, matchedPayment, creatorUser } = matchResult;
  const systemUser = {
    userId: creatorUser!.id,
    username: creatorUser!.username,
    role: creatorUser!.role as "QUAN_LY" | "THU_NGAN" | "PHUC_VU",
    fullName: creatorUser!.fullName,
  };

  const result = await executeVietQrPaymentCompletion({
    orderId: matchedOrder!.id,
    shiftId: matchedPayment?.shiftId || matchedOrder!.shiftId,
    user: systemUser,
    sepayTransactionId: gatewayTxId,
    paymentId: matchedPayment?.id,
  });

  if (!result.ok) {
    // If order was already paid by cash, voided, or cancelled, log to unmatched
    const raceReason = `Thanh toán thất bại do xung đột (${result.error || "Đơn hàng đã thanh toán hoặc đã hủy"})`;
    await logUnmatchedTransaction({
      payload,
      gatewayTxId,
      amount: transferAmount,
      content,
      orderCode: matchedOrder!.orderCode,
      orderId: matchedOrder!.id,
      reason: raceReason,
    });

    return {
      ok: true,
      status: 200,
      success: true,
      unmatched: true,
      error: raceReason,
    };
  }

  return {
    ok: true,
    status: 200,
    success: true,
    data: result.data,
    printWarning: result.printWarning,
  };
}
