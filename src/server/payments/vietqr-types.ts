export interface CreateVietQrPaymentParams {
  orderId: number;
  expectedVersion?: number;
  shiftId: number;
  userId?: number;
}

export interface CreateVietQrPaymentResult {
  ok: boolean;
  status: number;
  error?: string;
  data?: {
    paymentId: number;
    orderId: number;
    orderCode: string;
    transferContent: string;
    amount: number;
    qrContent: string;
    expiresAt: string;
    remainingSeconds: number;
  };
}

export interface VietQrStatusResult {
  ok: boolean;
  status: number;
  error?: string;
  data?: {
    paymentId: number;
    orderId: number;
    orderCode: string;
    orderType: string;
    status: string; // PENDING | SUCCESS | EXPIRED | FAILED | VOIDED
    amount: number;
    expiresAt: string | null;
    remainingSeconds: number;
    isExpired: boolean;
    paidAt?: string | null;
    queueNumber?: number | null;
  };
}

export interface SepayWebhookPayload {
  id: number | string;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  subAccount?: string | null;
  code?: string | null;
  content: string;
  transferType?: string;
  description?: string;
  transferAmount?: number;
  amount?: number;
  referenceCode?: string;
  accumulated?: number;
}

export interface ManualConfirmVietQrParams {
  orderId: number;
  expectedVersion?: number;
  shift: { id: number };
  user: { id: number; username: string; role: string; fullName: string };
  reason?: string;
  printPickupTicket?: boolean;
}
