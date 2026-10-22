import type { TokenPayload } from "@/server/auth/jwt";
import type { Shift } from "@/db/schema";

export const MAX_CASH_AMOUNT = 2_000_000_000; // 2 tỷ VNĐ

export interface CashPaymentParams {
  orderId: number;
  tienKhachDua: number;
  expectedVersion: number;
  user: TokenPayload;
  shift: Shift;
}

export interface CashPaymentResult {
  ok: boolean;
  status: number;
  error?: string;
  data?: {
    orderId: number;
    orderCode: string;
    orderType: string;
    queueNumber?: number | null;
    queueDate?: string | null;
    totalAmount: number;
    discountAmount: number;
    finalAmount: number;
    cashGiven: number;
    cashReturned: number;
    status: string;
    paidAt: Date;
    receiptJobId?: number;
    pickupTicketJobId?: number;
  };
  printWarning?: {
    message: string;
    failedJobs?: number[];
  };
}
