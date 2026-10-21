import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth/require-role";
import {
  getPrinterSettings,
  isPrivateOrLoopbackIp,
} from "@/server/printing/settings-service";
import { compilePrintPayloadToEscpos } from "@/server/printing/render-engine";
import { sendToPrinter } from "@/server/printing/tcp-printer";
import type { KotPayload, FinalReceiptPayload } from "@/server/printing/print-payload-types";

const testPrintSchema = z.object({
  target: z.enum(["kitchen", "bar", "receipt"]),
  ip: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "QUAN_LY");
  if (!auth.authorized) {
    return auth.response;
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = testPrintSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Tham số kiểm tra máy in không hợp lệ (target: kitchen|bar|receipt)" },
      { status: 400 },
    );
  }

  const { target, ip: customIp } = parsed.data;
  const settings = await getPrinterSettings();

  let targetIp = customIp;
  if (!targetIp) {
    if (target === "kitchen") targetIp = settings.kitchenIp;
    else if (target === "bar") targetIp = settings.barIp;
    else targetIp = settings.receiptIp;
  }

  if (!isPrivateOrLoopbackIp(targetIp)) {
    return NextResponse.json(
      { ok: false, error: "Địa chỉ IP máy in không thuộc dải mạng LAN riêng hợp lệ" },
      { status: 400 },
    );
  }

  try {
    let escposBytes: Buffer;

    if (target === "receipt") {
      const testReceipt: FinalReceiptPayload = {
        kind: "FINAL_RECEIPT",
        orderId: 0,
        orderCode: "TEST-RECEIPT-01",
        tableName: "Trang in thử nghiệm",
        cashierName: auth.user.fullName,
        printedAt: new Date().toISOString(),
        storeName: settings.storeName,
        storeAddress: settings.storeAddress,
        storePhone: settings.storePhone,
        items: [
          { name: "Kiểm tra in nhiệt hóa đơn", quantity: 1, unitPrice: 0, totalPrice: 0 },
          { name: "Kiểm tra xung mở két RJ12", quantity: 1, unitPrice: 0, totalPrice: 0 },
        ],
        subtotal: 0,
        total: 0,
        paymentMethod: "TIEN_MAT",
        wifiSsid: settings.wifiSsid,
        wifiPassword: settings.wifiPassword,
        kickDrawer: true,
      };

      escposBytes = await compilePrintPayloadToEscpos(testReceipt, {
        paperWidth: settings.paperWidth,
        enableDrawerKick: settings.drawerEnabled,
      });
    } else {
      const testKot: KotPayload = {
        kind: "KOT",
        orderId: 0,
        orderCode: `TEST-${target.toUpperCase()}-01`,
        tableName: "Bàn kiểm tra",
        senderName: auth.user.fullName,
        sentAt: new Date().toISOString(),
        targetStation: target === "bar" ? "BAR" : "KITCHEN",
        items: [
          { name: `In thử máy in ${target === "bar" ? "Quầy Bar" : "Bếp"}`, quantity: 1 },
          { name: "Font tiếng Việt có dấu chuẩn", quantity: 2, notes: "Kiểm tra dao cắt giấy" },
        ],
      };

      escposBytes = await compilePrintPayloadToEscpos(testKot, {
        paperWidth: settings.paperWidth,
        enableDrawerKick: false,
      });
    }

    await sendToPrinter({
      ip: targetIp,
      port: 9100,
      data: escposBytes,
      timeoutMs: 2000,
    });

    return NextResponse.json({
      ok: true,
      message: `Đã gửi thành công trang in thử tới máy in ${target} (${targetIp})`,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: `Không thể in thử tới máy in ${target} (${targetIp}): ${error?.message || "Lỗi kết nối"}`,
      },
      { status: 503 },
    );
  }
}
