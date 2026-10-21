import { compilePrintPayloadToEscpos } from "../src/server/printing/render-engine";
import { sendToPrinter } from "../src/server/printing/tcp-printer";
import type { KotPayload, FinalReceiptPayload } from "../src/server/printing/print-payload-types";

async function main() {
  const args = process.argv.slice(2);
  const ip = args[0];
  const target = args[1]?.toLowerCase();

  if (!ip || !target || !["kitchen", "bar", "receipt"].includes(target)) {
    console.error("Cách sử dụng: npm run print:test -- <ip> <kitchen|bar|receipt>");
    console.error("Ví dụ: npm run print:test -- 192.168.1.200 kitchen");
    console.error("Ví dụ: npm run print:test -- 192.168.1.202 receipt");
    process.exit(1);
  }

  console.log(`=== BẮT ĐẦU IN THỬ NGHIỆM TỚI MÁY IN ${target.toUpperCase()} ===`);
  console.log(`IP máy in: ${ip}:9100`);

  let escposBytes: Buffer;

  if (target === "receipt") {
    const testReceipt: FinalReceiptPayload = {
      kind: "FINAL_RECEIPT",
      orderId: 0,
      orderCode: "TEST-RECEIPT-01",
      tableName: "Kiểm tra máy in Hóa đơn",
      cashierName: "Chủ quán kiểm tra",
      printedAt: new Date().toISOString(),
      storeName: "POS F&B Cafe & Restaurant",
      storeAddress: "123 Đường Nguyễn Huệ, Quận 1, TP.HCM",
      storePhone: "0901234567",
      items: [
        { name: "In nhiệt hóa đơn chuẩn tiếng Việt", quantity: 1, unitPrice: 0, totalPrice: 0 },
        { name: "Kiểm tra kích xung mở két tiền RJ12", quantity: 1, unitPrice: 0, totalPrice: 0 },
      ],
      subtotal: 0,
      total: 0,
      paymentMethod: "TIEN_MAT",
      wifiSsid: "POS_FREE_WIFI",
      wifiPassword: "pass_wifi_123",
      kickDrawer: true,
    };

    escposBytes = await compilePrintPayloadToEscpos(testReceipt, {
      paperWidth: 80,
      enableDrawerKick: true,
    });
  } else {
    const testKot: KotPayload = {
      kind: "KOT",
      orderId: 0,
      orderCode: `TEST-${target.toUpperCase()}-01`,
      tableName: "Bàn kiểm tra",
      senderName: "Chủ quán kiểm tra",
      sentAt: new Date().toISOString(),
      targetStation: target === "bar" ? "BAR" : "KITCHEN",
      items: [
        { name: `In thử phiếu ${target === "bar" ? "Quầy Bar" : "Bếp"}`, quantity: 2 },
        { name: "Kiểm tra dao cắt giấy và nét chữ", quantity: 1, notes: "In tốt, rõ nét" },
      ],
    };

    escposBytes = await compilePrintPayloadToEscpos(testKot, {
      paperWidth: 80,
      enableDrawerKick: false,
    });
  }

  console.log(`Đã biên dịch xong ${escposBytes.length} bytes ESC/POS.`);
  console.log("Đang gửi qua socket TCP:9100...");

  await sendToPrinter({
    ip,
    port: 9100,
    data: escposBytes,
    timeoutMs: 3000,
  });

  console.log("✓ Gửi trang in thử và lệnh mở két thành công!");
}

main().catch((err) => {
  console.error("✗ Lỗi in thử:", err?.message || err);
  process.exit(1);
});
