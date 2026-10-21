import { createCanvas, type Canvas } from "@napi-rs/canvas";
import type { ProvisionalPayload } from "../print-payload-types";
import {
  formatVnd,
  formatDateTime,
  drawDashedLine,
  drawSolidLine,
  drawTwoColumn,
  wrapText,
} from "./canvas-helpers";
import { layoutReceiptItems, drawReceiptItemRow } from "./receipt-item-layout";

export function renderProvisionalCanvas(payload: ProvisionalPayload, width: number): Canvas {
  const estimatedHeight = Math.max(600, 480 + payload.items.length * 100);
  const canvas = createCanvas(width, estimatedHeight);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, estimatedHeight);
  ctx.textBaseline = "top";

  let y = 28;

  if (payload.storeName) {
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.font = "bold 22px sans-serif";
    const storeLines = wrapText(ctx, payload.storeName, width - 20);
    for (const line of storeLines) {
      ctx.fillText(line, width / 2, y);
      y += 26;
    }
    y += 2;
  }

  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText("PHIẾU TẠM TÍNH", width / 2, y);
  y += 32;

  ctx.font = "bold 24px sans-serif";
  const tableLines = wrapText(ctx, payload.tableName, width - 20);
  for (const line of tableLines) {
    ctx.fillText(line, width / 2, y);
    y += 28;
  }
  y += 4;

  drawDashedLine(ctx, y, width);
  y += 14;

  drawTwoColumn(ctx, "Mã đơn:", payload.orderCode, y, width, { fontSize: 17 });
  y += 24;
  drawTwoColumn(ctx, "Thời gian:", formatDateTime(payload.printedAt), y, width, { fontSize: 17 });
  y += 24;
  drawTwoColumn(ctx, "Thu ngân:", payload.cashierName, y, width, { fontSize: 17 });
  y += 26;

  // Header row
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

  drawTwoColumn(ctx, "Tổng tiền hàng:", formatVnd(payload.subtotal), y, width, { fontSize: 18 });
  y += 26;

  if (payload.discount && payload.discount > 0) {
    drawTwoColumn(ctx, "Giảm giá:", `-${formatVnd(payload.discount)}`, y, width, { fontSize: 18 });
    y += 26;
  }

  drawSolidLine(ctx, y, width, 2);
  y += 14;

  drawTwoColumn(ctx, "TỔNG TẠM TÍNH:", formatVnd(payload.total), y, width, {
    bold: true,
    fontSize: 22,
  });
  y += 34;

  drawDashedLine(ctx, y, width);
  y += 16;

  ctx.textAlign = "center";
  ctx.font = "italic 16px sans-serif";
  ctx.fillText("(Phiếu tạm tính - Quý khách vui lòng kiểm tra lại)", width / 2, y);
  y += 28;

  const finalCanvas = createCanvas(width, y + 10);
  finalCanvas.getContext("2d").drawImage(canvas, 0, 0);
  return finalCanvas;
}
