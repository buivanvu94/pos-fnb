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
  const isNarrow = width <= 400;
  const estimatedHeight = Math.max(800, 500 + payload.items.length * 220);
  const canvas = createCanvas(width, estimatedHeight);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, estimatedHeight);
  ctx.textBaseline = "top";

  // Requirement 3: Top margin at least equal to font height (28px) so characters are never clipped
  let y = 32;

  // Header Title
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.font = isNarrow ? "bold 24px sans-serif" : "bold 28px sans-serif";
  const stationLabel = payload.targetStation === "BAR" ? "PHIẾU PHA CHẾ (BAR)" : "PHIẾU BẾP (KITCHEN)";
  ctx.fillText(stationLabel, width / 2, y);
  y += 38;

  // Table Name (Prominent & Large)
  ctx.font = isNarrow ? "bold 26px sans-serif" : "bold 32px sans-serif";
  const tableLines = wrapText(ctx, payload.tableName, width - 20);
  for (const line of tableLines) {
    ctx.fillText(line, width / 2, y);
    y += 36;
  }
  y += 2;

  drawDashedLine(ctx, y, width);
  y += 14;

  // Order Info
  drawTwoColumn(ctx, "Mã đơn:", payload.orderCode, y, width, { fontSize: 18 });
  y += 24;
  drawTwoColumn(ctx, "Thời gian:", formatDateTime(payload.sentAt), y, width, { fontSize: 18 });
  y += 24;
  drawTwoColumn(ctx, "Người gửi:", payload.senderName, y, width, { fontSize: 18 });
  y += 28;

  drawSolidLine(ctx, y, width, 2);
  y += 16;

  // Items List
  for (const item of payload.items) {
    ctx.textAlign = "left";

    // Quantity + Item Name
    ctx.font = "bold 24px sans-serif";
    const qtyText = `[ ${item.quantity} ]  ${item.name}`;
    const nameLines = wrapText(ctx, qtyText, width - 20);

    for (const line of nameLines) {
      ctx.fillText(line, 10, y);
      y += 30;
    }

    // Toppings
    if (item.toppings && item.toppings.length > 0) {
      ctx.font = "18px sans-serif";
      for (const top of item.toppings) {
        const topLines = wrapText(ctx, `   + ${top}`, width - 25);
        for (const tl of topLines) {
          ctx.fillText(tl, 15, y);
          y += 24;
        }
      }
    }

    // Notes
    if (item.notes) {
      ctx.font = "italic bold 18px sans-serif";
      const noteLines = wrapText(ctx, `   * Ghi chú: ${item.notes}`, width - 25);
      for (const nl of noteLines) {
        ctx.fillText(nl, 15, y);
        y += 24;
      }
    }

    y += 12;
  }

  drawSolidLine(ctx, y, width, 2);
  y += 22;

  const finalCanvas = createCanvas(width, y + 10);
  finalCanvas.getContext("2d").drawImage(canvas, 0, 0);
  return finalCanvas;
}

export function renderKotCancelCanvas(payload: KotCancelPayload, width: number): Canvas {
  const isNarrow = width <= 400;
  const estimatedHeight = Math.max(700, 450 + payload.items.length * 180);
  const canvas = createCanvas(width, estimatedHeight);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, estimatedHeight);
  ctx.textBaseline = "top";

  // Requirement 3: Top margin at least equal to font height (26px) so characters are never clipped
  let y = 30;

  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.font = isNarrow ? "bold 22px sans-serif" : "bold 26px sans-serif";
  ctx.fillText("*** BÁO HỦY MÓN ***", width / 2, y);
  y += 36;

  ctx.font = isNarrow ? "bold 24px sans-serif" : "bold 30px sans-serif";
  const tblLines = wrapText(ctx, payload.tableName, width - 20);
  for (const line of tblLines) {
    ctx.fillText(line, width / 2, y);
    y += 36;
  }
  y += 2;

  drawDashedLine(ctx, y, width);
  y += 14;

  drawTwoColumn(ctx, "Mã đơn:", payload.orderCode, y, width, { fontSize: 18 });
  y += 24;
  drawTwoColumn(ctx, "Giờ hủy:", formatDateTime(payload.cancelledAt), y, width, { fontSize: 18 });
  y += 24;
  drawTwoColumn(ctx, "Người hủy:", payload.cancelledByName, y, width, { fontSize: 18 });
  y += 26;

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
  y += 16;

  // Cancelled items
  for (const item of payload.items) {
    ctx.font = "bold 22px sans-serif";
    const itemLines = wrapText(ctx, `HỦY: [ ${item.quantity} ]  ${item.name}`, width - 20);
    for (const line of itemLines) {
      ctx.fillText(line, 10, y);
      y += 28;
    }

    if (item.notes) {
      ctx.font = "italic 18px sans-serif";
      const noteLines = wrapText(ctx, `   (${item.notes})`, width - 25);
      for (const nl of noteLines) {
        ctx.fillText(nl, 15, y);
        y += 22;
      }
    }
    y += 10;
  }

  drawSolidLine(ctx, y, width, 2);
  y += 22;

  const finalCanvas = createCanvas(width, y + 10);
  finalCanvas.getContext("2d").drawImage(canvas, 0, 0);
  return finalCanvas;
}
