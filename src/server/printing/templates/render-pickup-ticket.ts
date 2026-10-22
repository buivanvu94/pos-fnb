import { createCanvas, type Canvas } from "@napi-rs/canvas";
import type { PickupTicketPayload } from "../print-payload-types";
import {
  formatVnd,
  formatDateTime,
  drawDashedLine,
  drawSolidLine,
  drawTwoColumn,
  wrapText,
} from "./canvas-helpers";
import { layoutReceiptItems, drawReceiptItemRow } from "./receipt-item-layout";

export function renderPickupTicketCanvas(payload: PickupTicketPayload, width: number): Canvas {
  const estimatedHeight = Math.max(600, 480 + payload.items.length * 100);
  const canvas = createCanvas(width, estimatedHeight);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, estimatedHeight);
  ctx.textBaseline = "top";

  let y = 24;

  if (payload.storeName) {
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.font = "bold 20px sans-serif";
    const storeLines = wrapText(ctx, payload.storeName, width - 20);
    for (const line of storeLines) {
      ctx.fillText(line, width / 2, y);
      y += 24;
    }
    y += 2;
  }

  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText("PHIẾU NHẬN ĐỒ (MANG VỀ)", width / 2, y);
  y += 32;

  // Prominent Queue Number
  ctx.font = "bold 56px sans-serif";
  const queueText = `#${payload.queueNumber}`;
  ctx.fillText(queueText, width / 2, y);
  y += 64;

  drawDashedLine(ctx, y, width);
  y += 14;

  drawTwoColumn(ctx, "Mã đơn:", payload.orderCode, y, width, { fontSize: 17 });
  y += 24;
  drawTwoColumn(ctx, "Thời gian:", formatDateTime(payload.printedAt), y, width, { fontSize: 17 });
  y += 24;
  drawTwoColumn(ctx, "Thu ngân:", payload.cashierName, y, width, { fontSize: 17 });
  y += 26;

  drawSolidLine(ctx, y, width, 1);
  y += 10;

  ctx.font = "bold 17px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Tên món", 10, y);
  ctx.textAlign = "right";
  ctx.fillText("Thành tiền", width - 10, y);
  y += 26;

  drawDashedLine(ctx, y, width);
  y += 12;

  // Items
  const { rows, endY } = layoutReceiptItems(ctx, payload.items, y, width);
  for (const row of rows) {
    drawReceiptItemRow(ctx, row, width);
  }
  y = endY;

  drawSolidLine(ctx, y, width, 1);
  y += 14;

  drawTwoColumn(ctx, "TỔNG TIỀN:", formatVnd(payload.total), y, width, {
    bold: true,
    fontSize: 20,
  });
  y += 32;

  drawDashedLine(ctx, y, width);
  y += 16;

  ctx.textAlign = "center";
  ctx.font = "italic 16px sans-serif";
  ctx.fillText("Quý khách vui lòng chờ gọi số để nhận đồ!", width / 2, y);
  y += 28;

  const finalCanvas = createCanvas(width, y + 10);
  finalCanvas.getContext("2d").drawImage(canvas, 0, 0);
  return finalCanvas;
}
