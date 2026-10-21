import { describe, it, expect } from "vitest";
import {
  renderPayloadToCanvas,
  compilePrintPayloadToEscpos,
  getDotWidth,
} from "@/server/printing/render-engine";
import type {
  KotPayload,
  KotCancelPayload,
  ProvisionalPayload,
  FinalReceiptPayload,
  CashReceiptPayload,
  ZReportPayload,
} from "@/server/printing/print-payload-types";

describe("Print Render Engine Unit Tests", () => {
  it("resolves correct dot width for 80mm (576) and 58mm (384)", () => {
    expect(getDotWidth(80)).toBe(576);
    expect(getDotWidth(58)).toBe(384);
  });

  it("renders KOT payload to correct canvas width and ESC/POS byte sequence", async () => {
    const kot: KotPayload = {
      kind: "KOT",
      orderId: 101,
      orderCode: "HD-20261022-0001",
      tableName: "Bàn 04 - Tầng 1",
      senderName: "Nguyễn Văn Phục Vụ",
      sentAt: new Date().toISOString(),
      targetStation: "KITCHEN",
      items: [
        { name: "Mì bò trứng", quantity: 2, notes: "Không hành", unitPrice: 45000 },
        { name: "Cơm chiên hải sản", quantity: 1, unitPrice: 65000 },
      ],
    };

    const canvas80 = await renderPayloadToCanvas(kot, 80);
    expect(canvas80.width).toBe(576);
    expect(canvas80.height).toBeGreaterThan(100);

    const canvas58 = await renderPayloadToCanvas(kot, 58);
    expect(canvas58.width).toBe(384);

    const escposBytes = await compilePrintPayloadToEscpos(kot, { paperWidth: 80 });
    // Check ESC @ init
    expect(escposBytes.subarray(0, 2)).toEqual(Buffer.from([0x1b, 0x40]));
    // Check GS v 0 raster header
    expect(escposBytes.subarray(2, 6)).toEqual(Buffer.from([0x1d, 0x76, 0x30, 0x00]));
    // Check GS V cut command
    expect(escposBytes.includes(Buffer.from([0x1d, 0x56, 0x42, 0x00]))).toBe(true);
  });

  it("renders KOT_CANCEL payload", async () => {
    const cancel: KotCancelPayload = {
      kind: "KOT_CANCEL",
      orderId: 101,
      orderCode: "HD-20261022-0001",
      tableName: "Bàn 04",
      cancelledByName: "Trần Quản Lý",
      cancelledAt: new Date().toISOString(),
      reason: "Khách đổi sang món khác",
      targetStation: "KITCHEN",
      items: [{ name: "Mì bò trứng", quantity: 1, notes: "Khách hủy" }],
    };

    const canvas = await renderPayloadToCanvas(cancel, 80);
    expect(canvas.width).toBe(576);
    expect(canvas.height).toBeGreaterThan(100);
  });

  it("renders PROVISIONAL payload", async () => {
    const prov: ProvisionalPayload = {
      kind: "PROVISIONAL",
      orderId: 101,
      orderCode: "HD-20261022-0001",
      tableName: "Bàn 02",
      cashierName: "Lê Thu Ngân",
      printedAt: new Date().toISOString(),
      storeName: "POS Cafe Demo",
      items: [
        { name: "Cà phê muối", quantity: 2, unitPrice: 35000, totalPrice: 70000 },
        { name: "Bạc xỉu", quantity: 1, unitPrice: 30000, totalPrice: 30000 },
      ],
      subtotal: 100000,
      discount: 10000,
      total: 90000,
    };

    const canvas = await renderPayloadToCanvas(prov, 80);
    expect(canvas.width).toBe(576);
    expect(canvas.height).toBeGreaterThan(200);
  });

  it("renders FINAL_RECEIPT with Wi-Fi QR code and optional drawer kick", async () => {
    const receipt: FinalReceiptPayload = {
      kind: "FINAL_RECEIPT",
      orderId: 101,
      orderCode: "HD-20261022-0001",
      tableName: "Bàn 02",
      cashierName: "Lê Thu Ngân",
      printedAt: new Date().toISOString(),
      storeName: "POS Cafe Demo",
      storeAddress: "123 Đường Nguyễn Huệ, Q1, TP.HCM",
      storePhone: "0901234567",
      items: [
        { name: "Cà phê muối", quantity: 2, unitPrice: 35000, totalPrice: 70000 },
      ],
      subtotal: 70000,
      total: 70000,
      paymentMethod: "TIEN_MAT",
      customerPaid: 100000,
      changeDue: 30000,
      wifiSsid: "POS_FREE_WIFI",
      wifiPassword: "pass_wifi_123",
      kickDrawer: true,
    };

    const canvas = await renderPayloadToCanvas(receipt, 80);
    expect(canvas.width).toBe(576);
    expect(canvas.height).toBeGreaterThan(300);

    const escpos = await compilePrintPayloadToEscpos(receipt, { paperWidth: 80 });
    // Check that drawer kick command ESC p 0 25 250 is present (DEC-11)
    expect(escpos.includes(Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]))).toBe(true);
  });

  it("renders CASH_RECEIPT (Phase 03 format) and triggers drawer kick automatically", async () => {
    // Phase 03 payload format from /api/v1/shifts/cash-transaction
    const phase03Payload: CashReceiptPayload = {
      entryId: 42,
      shiftId: 5,
      shiftCode: "CA-20261022-001",
      entryType: "THU",
      amount: 200000,
      reason: "Nạp thêm tiền lẻ đầu ca",
      performedBy: 2,
      performedByName: "Nguyễn Văn Thu Ngân",
      timestamp: new Date().toISOString(),
    };

    const canvas = await renderPayloadToCanvas(phase03Payload, 80);
    expect(canvas.width).toBe(576);

    const escpos = await compilePrintPayloadToEscpos(phase03Payload, { paperWidth: 80 });
    // Must include drawer kick ESC p (DEC-11)
    expect(escpos.includes(Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]))).toBe(true);
  });

  it("renders Z_REPORT payload with shift summaries and discrepancy", async () => {
    const zReport: ZReportPayload = {
      kind: "Z_REPORT",
      shiftId: 5,
      shiftCode: "CA-20261022-001",
      cashierName: "Lê Thu Ngân",
      managerName: "Trần Quản Lý",
      openedAt: new Date(Date.now() - 28800000).toISOString(),
      closedAt: new Date().toISOString(),
      initialCash: 1000000,
      cashRevenue: 5000000,
      bankRevenue: 3000000,
      totalRevenue: 8000000,
      totalCashIn: 200000,
      totalCashOut: 150000,
      expectedCash: 6050000,
      actualCash: 6050000,
      discrepancy: 0,
    };

    const canvas = await renderPayloadToCanvas(zReport, 58);
    expect(canvas.width).toBe(384);
    expect(canvas.height).toBeGreaterThan(400);
  });
});
