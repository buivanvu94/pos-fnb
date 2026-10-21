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
    cancelledByName: "Nguyễn Thu Ngân",
    approverName: "Trần Quản Lý",
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

  // Requirement 5: Edge cases with very long item names, 12 items, large amounts (e.g. 1.234.567 d), long notes
  const sampleEdgeCaseReceipt: FinalReceiptPayload = {
    kind: "FINAL_RECEIPT",
    orderId: 202,
    orderCode: "HD-20261022-0099",
    tableName: "Phòng VIP Hoàng Gia - Lầu 3",
    cashierName: "Nguyễn Thị Thu Ngân Trưởng",
    printedAt: "2026-10-22T21:45:00.000Z",
    storeName: "Hệ Thống Nhà Hàng & Cà Phê Cao Cấp Sài Gòn Phố",
    storeAddress: "Số 999 Đại Lộ Nguyễn Huệ, Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh",
    storePhone: "028.3822.9999 - 0909.888.777",
    items: [
      {
        name: "Trà sữa Ô Long nướng trân châu hoàng kim đường đen đặc biệt thơm ngon hảo hạng size L",
        quantity: 3,
        unitPrice: 85000,
        totalPrice: 255000,
        toppings: ["Trân châu hoàng kim", "Pudding trứng", "Kem cheese béo ngậy"],
        notes: "Ít đá 30%, 0% đường ngọt, đóng nắp màng bọc riêng mang về nhà",
      },
      {
        name: "Combo Thuyền Sashimi Cá Hồi Nauy Tươi Sống Thượng Hạng Cùng Trứng Cá Tầm Đen",
        quantity: 1,
        unitPrice: 1234567,
        totalPrice: 1234567,
        notes: "Thêm nhiều wasabi tươi Nhật Bản và gừng hồng ngâm chua ngọt",
      },
      { name: "Cà phê đen truyền thống Robusta rang mộc thơm lừng", quantity: 2, unitPrice: 35000, totalPrice: 70000 },
      { name: "Bạc xỉu ba tầng sữa tươi sương sáo thanh mát", quantity: 1, unitPrice: 42000, totalPrice: 42000 },
      { name: "Trà đào cam sả hạt chia mật ong rừng tự nhiên", quantity: 2, unitPrice: 48000, totalPrice: 96000 },
      { name: "Nước ép táo cần tây củ dền thanh lọc cơ thể", quantity: 1, unitPrice: 55000, totalPrice: 55000 },
      { name: "Mì Ý bò bằm sốt cà chua truyền thống Ý phô mai", quantity: 2, unitPrice: 89000, totalPrice: 178000 },
      { name: "Pizza hải sản sốt tiêu đen phô mai Mozzarella đút lò", quantity: 1, unitPrice: 185000, totalPrice: 185000 },
      { name: "Cơm bò Fuji nướng sốt Teriyaki Nhật Bản trứng lòng đào", quantity: 2, unitPrice: 135000, totalPrice: 270000 },
      { name: "Salad ức gà xông khói sốt mè rang dầu giấm Ý", quantity: 1, unitPrice: 79000, totalPrice: 79000 },
      { name: "Khoai tây chiên giòn lắc phô mai rong biển", quantity: 2, unitPrice: 45000, totalPrice: 90000 },
      {
        name: "Rượu Vang Đỏ Cao Cấp Nhập Khẩu Bordeaux Grand Cru Classe Niên Vụ 2018",
        quantity: 1,
        unitPrice: 3500000,
        totalPrice: 3500000,
        notes: "Ướp lạnh sẵn 16 độ C trước khi phục vụ tại bàn",
      },
    ],
    subtotal: 6054567,
    discount: 500000,
    total: 5554567,
    paymentMethod: "VIETQR",
    customerPaid: 5554567,
    changeDue: 0,
    wifiSsid: "SAIGON_PHO_VIP_5G",
    wifiPassword: "saigonpho@welcome2026",
    wifiSecurity: "WPA2",
    kickDrawer: false,
  };

  const sampleEdgeCaseKot: KotPayload = {
    kind: "KOT",
    orderId: 202,
    orderCode: "HD-20261022-0099",
    tableName: "Phòng VIP Hoàng Gia - Lầu 3",
    senderName: "Trần Văn Trưởng Ca Phục Vụ",
    sentAt: "2026-10-22T21:40:00.000Z",
    targetStation: "KITCHEN",
    items: [
      {
        name: "Combo Thuyền Sashimi Cá Hồi Nauy Tươi Sống Thượng Hạng Cùng Trứng Cá Tầm Đen",
        quantity: 2,
        notes: "Trang trí đẹp mắt kiểu cung đình, thêm nhiều wasabi tươi và gừng hồng",
        toppings: ["Wasabi tươi x2", "Gừng hồng thêm"],
        unitPrice: 1234567,
      },
      {
        name: "Bò Wagyu A5 áp chảo sốt nấm Truffle đen ăn kèm măng tây tươi",
        quantity: 3,
        notes: "Khách yêu cầu Medium Rare chín 5 phần, không ướp nhiều muối",
        toppings: ["Nấm Truffle x2", "Măng tây thêm"],
        unitPrice: 1850000,
      },
      {
        name: "Lẩu tôm hùm Alaska chua cay đặc biệt niêu đất khổng lồ",
        quantity: 1,
        notes: "Rau nấm rửa kỹ, ớt để riêng cho khách tự nêm",
        unitPrice: 2200000,
      },
    ],
  };

  const templates: { name: string; payload: any }[] = [
    { name: "kot", payload: sampleKot },
    { name: "kot-cancel", payload: sampleKotCancel },
    { name: "provisional", payload: sampleProvisional },
    { name: "final-receipt", payload: sampleFinalReceipt },
    { name: "cash-receipt", payload: sampleCashReceipt },
    { name: "z-report", payload: sampleZReport },
    // Edge cases for coordinator visual review
    { name: "edge-case-receipt", payload: sampleEdgeCaseReceipt },
    { name: "edge-case-kot", payload: sampleEdgeCaseKot },
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

