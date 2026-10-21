import fs from "fs";
import { createCanvas, loadImage, type Canvas } from "@napi-rs/canvas";
import type { FinalReceiptPayload } from "../print-payload-types";
import {
  formatVnd,
  formatDateTime,
  drawDashedLine,
  drawSolidLine,
  drawTwoColumn,
  drawQrCode,
  wrapText,
} from "./canvas-helpers";

export async function renderFinalReceiptCanvas(payload: FinalReceiptPayload, width: number): Promise<Canvas> {
  const baseHeight = 750 + payload.items.length * 60;
  const canvas = createCanvas(width, baseHeight);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, baseHeight);

  let y = 20;

  // Store Logo
  if (payload.storeLogoPath && fs.existsSync(payload.storeLogoPath)) {
    try {
      const logoImg = await loadImage(payload.storeLogoPath);
      const maxLogoW = Math.min(200, width - 40);
      const scale = maxLogoW / logoImg.width;
      const logoH = Math.round(logoImg.height * scale);
      const logoX = Math.round((width - maxLogoW) / 2);
      ctx.drawImage(logoImg, logoX, y, maxLogoW, logoH);
      y += logoH + 15;
    } catch {
      // Ignore logo loading errors safely
    }
  }

  // Store Name & Contact
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  if (payload.storeName) {
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(payload.storeName, width / 2, y);
    y += 30;
  }
  if (payload.storeAddress) {
    ctx.font = "16px sans-serif";
    const addrLines = wrapText(ctx, payload.storeAddress, width - 20);
    for (const line of addrLines) {
      ctx.fillText(line, width / 2, y);
      y += 22;
    }
  }
  if (payload.storePhone) {
    ctx.font = "16px sans-serif";
    ctx.fillText(`Hotline: ${payload.storePhone}`, width / 2, y);
    y += 24;
  }

  y += 10;
  ctx.font = "bold 26px sans-serif";
  ctx.fillText("HÓA ĐƠN THANH TOÁN", width / 2, y);
  y += 32;

  const orderLoc = payload.tableName || (payload.orderType === "MANG_VE" ? "Mang về" : "Tại bàn");
  ctx.font = "bold 22px sans-serif";
  ctx.fillText(orderLoc, width / 2, y);
  y += 32;

  drawDashedLine(ctx, y, width);
  y += 15;

  drawTwoColumn(ctx, "Số HD:", payload.orderCode, y, width, { fontSize: 17 });
  y += 24;
  drawTwoColumn(ctx, "Ngày giờ:", formatDateTime(payload.printedAt), y, width, { fontSize: 17 });
  y += 24;
  drawTwoColumn(ctx, "Thu ngân:", payload.cashierName, y, width, { fontSize: 17 });
  y += 26;

  drawSolidLine(ctx, y, width, 1);
  y += 12;

  ctx.font = "bold 17px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Món / Đơn giá", 10, y);
  ctx.textAlign = "right";
  ctx.fillText("T.Tiền", width - 10, y);
  y += 24;
  drawDashedLine(ctx, y, width);
  y += 14;

  for (const item of payload.items) {
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(item.name, 10, y);
    y += 22;

    const subDetail = `${item.quantity} x ${formatVnd(item.unitPrice)}`;
    drawTwoColumn(ctx, `  ${subDetail}`, formatVnd(item.totalPrice), y, width, { fontSize: 17 });
    y += 24;
  }

  drawSolidLine(ctx, y, width, 1);
  y += 16;

  drawTwoColumn(ctx, "Cộng tiền hàng:", formatVnd(payload.subtotal), y, width, { fontSize: 18 });
  y += 26;

  if (payload.discount && payload.discount > 0) {
    drawTwoColumn(ctx, "Chiết khấu / Giảm giá:", `-${formatVnd(payload.discount)}`, y, width, { fontSize: 18 });
    y += 26;
  }

  drawSolidLine(ctx, y, width, 2);
  y += 16;

  drawTwoColumn(ctx, "KHÁCH PHẢI TRẢ:", formatVnd(payload.total), y, width, {
    bold: true,
    fontSize: 22,
  });
  y += 34;

  const methodLabel = payload.paymentMethod === "VIETQR" ? "Chuyển khoản VietQR" : "Tiền mặt";
  drawTwoColumn(ctx, "Hình thức thanh toán:", methodLabel, y, width, { fontSize: 17 });
  y += 26;

  if (payload.customerPaid !== undefined && payload.customerPaid > 0) {
    drawTwoColumn(ctx, "Tiền khách đưa:", formatVnd(payload.customerPaid), y, width, { fontSize: 17 });
    y += 24;
    const change = payload.changeDue ?? Math.max(0, payload.customerPaid - payload.total);
    drawTwoColumn(ctx, "Tiền thối lại:", formatVnd(change), y, width, { fontSize: 17, bold: true });
    y += 26;
  }

  // Wi-Fi QR Code (DEC-13)
  if (payload.wifiSsid) {
    drawDashedLine(ctx, y, width);
    y += 18;

    ctx.textAlign = "center";
    ctx.font = "bold 17px sans-serif";
    ctx.fillText("QUÉT QR ĐĂNG NHẬP WI-FI MIỄN PHÍ", width / 2, y);
    y += 24;

    const security = payload.wifiSecurity || "WPA";
    const wifiString = `WIFI:S:${payload.wifiSsid};T:${security};P:${payload.wifiPassword || ""};;`;

    const qrSize = width >= 500 ? 140 : 110;
    y = await drawQrCode(ctx, wifiString, width / 2, y, qrSize);
    y += 14;

    ctx.font = "16px sans-serif";
    ctx.fillText(`Wi-Fi: ${payload.wifiSsid}`, width / 2, y);
    y += 22;
    if (payload.wifiPassword) {
      ctx.fillText(`Mật khẩu: ${payload.wifiPassword}`, width / 2, y);
      y += 22;
    }
  }

  drawDashedLine(ctx, y, width);
  y += 20;

  ctx.textAlign = "center";
  ctx.font = "italic 16px sans-serif";
  ctx.fillText("Cảm ơn Quý khách & Hẹn gặp lại!", width / 2, y);
  y += 30;

  const finalCanvas = createCanvas(width, y);
  finalCanvas.getContext("2d").drawImage(canvas, 0, 0);
  return finalCanvas;
}
