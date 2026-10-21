import fs from "fs";
import path from "path";
import { renderPayloadToPng } from "../src/server/printing/render-engine";
import type {
  KotPayload,
  KotCancelPayload,
  ProvisionalPayload,
  FinalReceiptPayload,
  CashReceiptPayload,
  ZReportPayload,
} from "../src/server/printing/print-payload-types";

async function main() {
  const outDir = path.resolve(process.cwd(), "tmp", "print-preview");
  fs.mkdirSync(outDir, { recursive: true });

  const sampleKot: KotPayload = {
    kind: "KOT",
    orderId: 101,
    orderCode: "HD-20261022-0042",
    tableName: "Bàn 04 - Tầng 1",
    senderName: "Nguyễn Văn Phục Vụ",
    sentAt: "2026-10-22T08:30:00.000Z",
    targetStation: "KITCHEN",
    items: [
      {
        name: "Mì xào bò trứng",
        quantity: 2,
        notes: "Ít dầu mỡ, không hành lá",
        toppings: ["Trứng ốp la", "Bò thêm"],
        unitPrice: 55000,
      },
      {
        name: "Cơm chiên hải sản",
        quantity: 1,
        notes: "Cay vừa",
        unitPrice: 65000,
      },
    ],
  };

  const sampleKotCancel: KotCancelPayload = {
    kind: "KOT_CANCEL",
    orderId: 101,
    orderCode: "HD-20261022-0042",
    tableName: "Bàn 04 - Tầng 1",
    cancelledByName: "Trần Quản Lý",
    cancelledAt: "2026-10-22T08:45:00.000Z",
    reason: "Khách đổi sang cơm rang dưa bò",
    targetStation: "KITCHEN",
    items: [
      {
        name: "Cơm chiên hải sản",
        quantity: 1,
        notes: "Chưa lên lửa",
      },
    ],
  };

  const sampleProvisional: ProvisionalPayload = {
    kind: "PROVISIONAL",
    orderId: 101,
    orderCode: "HD-20261022-0042",
    tableName: "Bàn 04 - Tầng 1",
    cashierName: "Lê Thu Ngân",
    printedAt: "2026-10-22T09:15:00.000Z",
    storeName: "POS Cafe & Restaurant",
    items: [
      { name: "Mì xào bò trứng", quantity: 2, unitPrice: 55000, totalPrice: 110000 },
      { name: "Cà phê muối", quantity: 2, unitPrice: 35000, totalPrice: 70000 },
      { name: "Trà đào cam sả", quantity: 1, unitPrice: 40000, totalPrice: 40000 },
    ],
    subtotal: 220000,
    discount: 20000,
    total: 200000,
  };

  const sampleFinalReceipt: FinalReceiptPayload = {
    kind: "FINAL_RECEIPT",
    orderId: 101,
    orderCode: "HD-20261022-0042",
    tableName: "Bàn 04 - Tầng 1",
    cashierName: "Lê Thu Ngân",
    printedAt: "2026-10-22T09:30:00.000Z",
    storeName: "POS Cafe & Restaurant",
    storeAddress: "123 Đường Nguyễn Huệ, Quận 1, TP.HCM",
    storePhone: "0901234567",
    items: [
      { name: "Mì xào bò trứng", quantity: 2, unitPrice: 55000, totalPrice: 110000 },
      { name: "Cà phê muối", quantity: 2, unitPrice: 35000, totalPrice: 70000 },
      { name: "Trà đào cam sả", quantity: 1, unitPrice: 40000, totalPrice: 40000 },
    ],
    subtotal: 220000,
    discount: 20000,
    total: 200000,
    paymentMethod: "TIEN_MAT",
    customerPaid: 500000,
    changeDue: 300000,
    wifiSsid: "POS_FREE_WIFI",
    wifiPassword: "pass_wifi_123",
    wifiSecurity: "WPA",
    kickDrawer: true,
  };

  const sampleCashReceipt: CashReceiptPayload = {
    kind: "CASH_RECEIPT",
    entryId: 12,
    shiftId: 3,
    shiftCode: "CA-20261022-001",
    entryType: "THU",
    amount: 500000,
    reason: "Nạp thêm tiền lẻ đầu ca",
    performedBy: 1,
    performedByName: "Lê Thu Ngân",
    timestamp: "2026-10-22T07:05:00.000Z",
    storeName: "POS Cafe & Restaurant",
    kickDrawer: true,
  };

  const sampleZReport: ZReportPayload = {
    kind: "Z_REPORT",
    shiftId: 3,
    shiftCode: "CA-20261022-001",
    cashierName: "Lê Thu Ngân",
    managerName: "Trần Quản Lý",
    openedAt: "2026-10-22T07:00:00.000Z",
    closedAt: "2026-10-22T15:00:00.000Z",
    initialCash: 1000000,
    cashRevenue: 6500000,
    bankRevenue: 4200000,
    totalRevenue: 10700000,
    totalCashIn: 500000,
    totalCashOut: 300000,
    expectedCash: 7700000,
    actualCash: 7700000,
    discrepancy: 0,
    storeName: "POS Cafe & Restaurant",
  };

  const templates: { name: string; payload: any }[] = [
    { name: "kot", payload: sampleKot },
    { name: "kot-cancel", payload: sampleKotCancel },
    { name: "provisional", payload: sampleProvisional },
    { name: "final-receipt", payload: sampleFinalReceipt },
    { name: "cash-receipt", payload: sampleCashReceipt },
    { name: "z-report", payload: sampleZReport },
  ];

  console.log("=== RENDER PRINT PREVIEW (80mm & 58mm) ===");
  console.log(`Target directory: ${outDir}\n`);

  for (const t of templates) {
    for (const width of [80, 58] as const) {
      const filename = `${t.name}-${width}mm.png`;
      const targetPath = path.join(outDir, filename);
      const pngBuffer = await renderPayloadToPng(t.payload, width);
      fs.writeFileSync(targetPath, pngBuffer);
      console.log(`✓ Rendered: ${filename} (${pngBuffer.length} bytes)`);
    }
  }

  console.log("\nAll print preview PNGs generated successfully!");
}

main().catch((err) => {
  console.error("Preview generation failed:", err);
  process.exit(1);
});
