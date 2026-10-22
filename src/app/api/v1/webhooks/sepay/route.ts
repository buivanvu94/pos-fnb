import { NextRequest, NextResponse } from "next/server";
import { verifySepayWebhookAuth, processSepayWebhook } from "@/server/payments/sepay-webhook-service";
import type { SepayWebhookPayload } from "@/server/payments/vietqr-types";

/**
 * POST /api/v1/webhooks/sepay
 * Webhook endpoint for receiving automated bank transfer balance changes from SePay (DEC-06, FR-12).
 * Always returns HTTP 200 { success: true } for processed branches per SePay specification.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const xApiKey = req.headers.get("x-api-key");

  // 1. Authenticate webhook request
  const isAuthorized = verifySepayWebhookAuth(authHeader, xApiKey);
  if (!isAuthorized) {
    return NextResponse.json(
      { success: false, error: "Xác thực SePay không hợp lệ (Unauthorized)" },
      { status: 401 },
    );
  }

  // 2. Parse payload
  const rawBody = (await req.json().catch(() => null)) as SepayWebhookPayload | null;
  if (!rawBody || (!rawBody.id && rawBody.id !== 0)) {
    return NextResponse.json(
      { success: false, error: "Dữ liệu webhook SePay không đúng định dạng (thiếu id)" },
      { status: 400 },
    );
  }

  try {
    const result = await processSepayWebhook(rawBody);

    return NextResponse.json(
      {
        success: true,
        ok: result.ok,
        ...(result.message ? { message: result.message } : {}),
        ...(result.error ? { error: result.error } : {}),
        ...(result.unmatched ? { unmatched: true } : {}),
        ...(result.idempotent ? { idempotent: true } : {}),
        ...(result.data ? { data: result.data } : {}),
        ...(result.printWarning ? { printWarning: result.printWarning } : {}),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("SePay webhook processing error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi máy chủ khi xử lý webhook SePay" },
      { status: 500 },
    );
  }
}
