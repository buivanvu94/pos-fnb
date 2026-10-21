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
import { layoutReceiptItems, drawReceiptItemRow } from "./receipt-item-layout";

export async function renderFinalReceiptCanvas(payload: FinalReceiptPayload, width: number): Promise<Canvas> {
  const estimatedHeight = Math.max(900, 750 + payload.items.length * 110);
  const canvas = createCanvas(width, estimatedHeight);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, estimatedHeight);
  ctx.textBaseline = "top";

  let y = 28;

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
    const nameLines = wrapText(ctx, payload.storeName, width - 20);
    for (const line of nameLines) {
      ctx.fillText(line, width / 2, y);
      y += 28;
    }
    y += 2;
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

  y += 8;
  ctx.font = "bold 26px sans-serif";
  ctx.fillText("HÓA ĐƠN THANH TOÁN", width / 2, y);
  y += 32;

  const orderLoc = payload.tableName || (payload.orderType === "MANG_VE" ? "Mang về" : "Tại bàn");
  ctx.font = "bold 22px sans-serif";
  const locLines = wrapText(ctx, orderLoc, width - 20);
  for (const line of locLines) {
    ctx.fillText(line, width / 2, y);
    y += 28;
  }
  y += 4;

  drawDashedLine(ctx, y, width);
  y += 14;

  drawTwoColumn(ctx, "Số HD:", payload.orderCode, y, width, { fontSize: 17 });
  y += 24;
  drawTwoColumn(ctx, "Ngày giờ:", formatDateTime(payload.printedAt), y, width, { fontSize: 17 });
  y += 24;
  drawTwoColumn(ctx, "Thu ngân:", payload.cashierName, y, width, { fontSize: 17 });
  y += 26;

  // Table Column Headers (spaced safely between lines)
  drawSolidLine(ctx, y, width, 1);
  y += 10;

  ctx.font = "bold 17px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Món / Đơn giá", 10, y);
  ctx.textAlign = "right";
  ctx.fillText("T.Tiền", width - 10, y);
  y += 26;

  drawDashedLine(ctx, y, width);
  y += 12;

  // Item rows with shared non-overlapping layout
  const { rows, endY } = layoutReceiptItems(ctx, payload.items, y, width);
  for (const row of rows) {
    drawReceiptItemRow(ctx, row, width);
  }
  y = endY;

  drawSolidLine(ctx, y, width, 1);
  y += 14;

  drawTwoColumn(ctx, "Cộng tiền hàng:", formatVnd(payload.subtotal), y, width, { fontSize: 18 });
  y += 26;

  if (payload.discount && payload.discount > 0) {
    drawTwoColumn(ctx, "Chiết khấu / Giảm giá:", `-${formatVnd(payload.discount)}`, y, width, { fontSize: 18 });
    y += 26;
  }

  drawSolidLine(ctx, y, width, 2);
  y += 14;

  drawTwoColumn(ctx, "KHÁCH PHẢI TRẢ:", formatVnd(payload.total), y, width, {
    bold: true,
    fontSize: 22,
  });
  y += 32;

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
    y += 16;

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
  y += 18;

  ctx.textAlign = "center";
  ctx.font = "italic 16px sans-serif";
  ctx.fillText("Cảm ơn Quý khách & Hẹn gặp lại!", width / 2, y);
  y += 28;

  const finalCanvas = createCanvas(width, y + 10);
  finalCanvas.getContext("2d").drawImage(canvas, 0, 0);
  return finalCanvas;
}
