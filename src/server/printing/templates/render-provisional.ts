import { createCanvas, type Canvas } from "@napi-rs/canvas";
import type { ProvisionalPayload } from "../print-payload-types";
import {
  formatVnd,
  formatDateTime,
  drawDashedLine,
  drawSolidLine,
  drawTwoColumn,
} from "./canvas-helpers";

export function renderProvisionalCanvas(payload: ProvisionalPayload, width: number): Canvas {
  const baseHeight = 450 + payload.items.length * 60;
  const canvas = createCanvas(width, baseHeight);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, baseHeight);

  let y = 20;

  if (payload.storeName) {
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(payload.storeName, width / 2, y);
    y += 28;
  }

  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText("PHIẾU TẠM TÍNH", width / 2, y);
  y += 34;

  ctx.font = "bold 24px sans-serif";
  ctx.fillText(payload.tableName, width / 2, y);
  y += 34;

  drawDashedLine(ctx, y, width);
  y += 15;

  drawTwoColumn(ctx, "Mã đơn:", payload.orderCode, y, width, { fontSize: 17 });
  y += 24;
  drawTwoColumn(ctx, "Thời gian:", formatDateTime(payload.printedAt), y, width, { fontSize: 17 });
  y += 24;
  drawTwoColumn(ctx, "Thu ngân:", payload.cashierName, y, width, { fontSize: 17 });
  y += 28;

  drawSolidLine(ctx, y, width, 1);
  y += 12;

  ctx.font = "bold 17px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Tên món", 10, y);
  ctx.textAlign = "right";
  ctx.fillText("Thành tiền", width - 10, y);
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

  drawTwoColumn(ctx, "Tổng tiền hàng:", formatVnd(payload.subtotal), y, width, { fontSize: 18 });
  y += 26;

  if (payload.discount && payload.discount > 0) {
    drawTwoColumn(ctx, "Giảm giá:", `-${formatVnd(payload.discount)}`, y, width, { fontSize: 18 });
    y += 26;
  }

  drawSolidLine(ctx, y, width, 2);
  y += 16;

  drawTwoColumn(ctx, "TỔNG TẠM TÍNH:", formatVnd(payload.total), y, width, {
    bold: true,
    fontSize: 22,
  });
  y += 36;

  drawDashedLine(ctx, y, width);
  y += 18;

  ctx.textAlign = "center";
  ctx.font = "italic 16px sans-serif";
  ctx.fillText("(Phiếu tạm tính - Quý khách vui lòng kiểm tra lại)", width / 2, y);
  y += 30;

  const finalCanvas = createCanvas(width, y);
  finalCanvas.getContext("2d").drawImage(canvas, 0, 0);
  return finalCanvas;
}
