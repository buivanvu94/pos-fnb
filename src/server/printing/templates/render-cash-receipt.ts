import { createCanvas, type Canvas } from "@napi-rs/canvas";
import type { CashReceiptPayload } from "../print-payload-types";
import {
  formatVnd,
  formatDateTime,
  drawDashedLine,
  drawSolidLine,
  drawTwoColumn,
  wrapText,
} from "./canvas-helpers";

export function renderCashReceiptCanvas(payload: CashReceiptPayload, width: number): Canvas {
  const estimatedHeight = 520;
  const canvas = createCanvas(width, estimatedHeight);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, estimatedHeight);
  ctx.textBaseline = "top";

  // Requirement 3 & 4: Top margin at least equal to font height (26px) so characters are never clipped
  let y = 30;

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

  const isThu = payload.entryType === "THU";
  const title = isThu ? "PHIẾU THU TIỀN MẶT" : "PHIẾU CHI TIỀN MẶT";
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText(title, width / 2, y);
  y += 34;

  drawDashedLine(ctx, y, width);
  y += 14;

  drawTwoColumn(ctx, "Mã phiếu:", `#${payload.entryId}`, y, width, { fontSize: 17 });
  y += 24;
  drawTwoColumn(ctx, "Ca làm việc:", payload.shiftCode, y, width, { fontSize: 17 });
  y += 24;
  drawTwoColumn(ctx, "Thời gian:", formatDateTime(payload.timestamp), y, width, { fontSize: 17 });
  y += 24;
  drawTwoColumn(ctx, "Người thực hiện:", payload.performedByName, y, width, { fontSize: 17 });
  y += 28;

  drawSolidLine(ctx, y, width, 1);
  y += 16;

  drawTwoColumn(ctx, "SỐ TIỀN:", formatVnd(payload.amount), y, width, {
    bold: true,
    fontSize: width <= 400 ? 20 : 24,
  });
  y += 36;

  ctx.textAlign = "left";
  ctx.font = "18px sans-serif";
  const reasonLines = wrapText(ctx, `Lý do: ${payload.reason}`, width - 20);
  for (const line of reasonLines) {
    ctx.fillText(line, 10, y);
    y += 24;
  }
  y += 14;

  drawSolidLine(ctx, y, width, 1);
  y += 18;

  const half = width / 2;
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Người lập phiếu", half / 2, y);
  ctx.fillText(isThu ? "Người nộp tiền" : "Người nhận tiền", half + half / 2, y);
  y += 22;

  ctx.font = "italic 14px sans-serif";
  ctx.fillText("(Ký, ghi rõ họ tên)", half / 2, y);
  ctx.fillText("(Ký, ghi rõ họ tên)", half + half / 2, y);
  y += 65;

  const finalCanvas = createCanvas(width, y + 10);
  finalCanvas.getContext("2d").drawImage(canvas, 0, 0);
  return finalCanvas;
}
