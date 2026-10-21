import { createCanvas, type Canvas } from "@napi-rs/canvas";
import type { KotPayload, KotCancelPayload } from "../print-payload-types";
import {
  formatDateTime,
  drawDashedLine,
  drawSolidLine,
  drawTwoColumn,
  wrapText,
} from "./canvas-helpers";

export function renderKotCanvas(payload: KotPayload, width: number): Canvas {
  // Pre-calculate estimated height
  const baseHeight = 350 + payload.items.length * 70;
  const canvas = createCanvas(width, baseHeight);
  const ctx = canvas.getContext("2d");

  // Fill background white
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, baseHeight);

  let y = 20;

  // Header Title
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.font = "bold 28px sans-serif";
  const stationLabel = payload.targetStation === "BAR" ? "PHIẾU PHA CHẾ (BAR)" : "PHIẾU BẾP (KITCHEN)";
  ctx.fillText(stationLabel, width / 2, y);
  y += 36;

  // Table Name (Prominent & Large)
  ctx.font = "bold 32px sans-serif";
  ctx.fillText(payload.tableName, width / 2, y);
  y += 40;

  drawDashedLine(ctx, y, width);
  y += 15;

  // Order Info
  drawTwoColumn(ctx, "Mã đơn:", payload.orderCode, y, width, { fontSize: 18 });
  y += 24;
  drawTwoColumn(ctx, "Thời gian:", formatDateTime(payload.sentAt), y, width, { fontSize: 18 });
  y += 24;
  drawTwoColumn(ctx, "Người gửi:", payload.senderName, y, width, { fontSize: 18 });
  y += 30;

  drawSolidLine(ctx, y, width, 2);
  y += 18;

  // Items List
  for (const item of payload.items) {
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    // Quantity (Large box or bold) + Item Name
    ctx.font = "bold 24px sans-serif";
    const qtyText = `[ ${item.quantity} ]  ${item.name}`;
    const nameLines = wrapText(ctx, qtyText, width - 20);

    for (const line of nameLines) {
      ctx.fillText(line, 10, y);
      y += 28;
    }

    // Toppings
    if (item.toppings && item.toppings.length > 0) {
      ctx.font = "18px sans-serif";
      for (const top of item.toppings) {
        ctx.fillText(`   + ${top}`, 15, y);
        y += 22;
      }
    }

    // Notes
    if (item.notes) {
      ctx.font = "italic bold 18px sans-serif";
      const noteLines = wrapText(ctx, `   * Ghi chú: ${item.notes}`, width - 30);
      for (const line of noteLines) {
        ctx.fillText(line, 15, y);
        y += 22;
      }
    }

    y += 10;
  }

  drawSolidLine(ctx, y, width, 2);
  y += 25;

  // Crop canvas to actual content height
  const finalHeight = y + 20;
  const finalCanvas = createCanvas(width, finalHeight);
  const finalCtx = finalCanvas.getContext("2d");
  finalCtx.drawImage(canvas, 0, 0);
  return finalCanvas;
}

export function renderKotCancelCanvas(payload: KotCancelPayload, width: number): Canvas {
  const baseHeight = 350 + payload.items.length * 60;
  const canvas = createCanvas(width, baseHeight);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, baseHeight);

  let y = 20;

  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText("*** BÁO HỦY MÓN ***", width / 2, y);
  y += 34;

  ctx.font = "bold 30px sans-serif";
  ctx.fillText(payload.tableName, width / 2, y);
  y += 38;

  drawDashedLine(ctx, y, width);
  y += 15;

  drawTwoColumn(ctx, "Mã đơn:", payload.orderCode, y, width, { fontSize: 18 });
  y += 24;
  drawTwoColumn(ctx, "Giờ hủy:", formatDateTime(payload.cancelledAt), y, width, { fontSize: 18 });
  y += 24;
  drawTwoColumn(ctx, "Người hủy:", payload.cancelledByName, y, width, { fontSize: 18 });
  y += 24;

  // Reason
  ctx.textAlign = "left";
  ctx.font = "bold 18px sans-serif";
  const reasonLines = wrapText(ctx, `Lý do: ${payload.reason}`, width - 20);
  for (const line of reasonLines) {
    ctx.fillText(line, 10, y);
    y += 24;
  }
  y += 10;

  drawSolidLine(ctx, y, width, 2);
  y += 15;

  // Cancelled items
  for (const item of payload.items) {
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(`HỦY: [ ${item.quantity} ]  ${item.name}`, 10, y);
    y += 28;

    if (item.notes) {
      ctx.font = "italic 18px sans-serif";
      ctx.fillText(`   (${item.notes})`, 15, y);
      y += 22;
    }
    y += 8;
  }

  drawSolidLine(ctx, y, width, 2);
  y += 25;

  const finalHeight = y + 20;
  const finalCanvas = createCanvas(width, finalHeight);
  const finalCtx = finalCanvas.getContext("2d");
  finalCtx.drawImage(canvas, 0, 0);
  return finalCanvas;
}
