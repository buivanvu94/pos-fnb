import { createCanvas, type Canvas } from "@napi-rs/canvas";
import type { ZReportPayload } from "../print-payload-types";
import {
  formatVnd,
  formatDateTime,
  drawDashedLine,
  drawSolidLine,
  drawTwoColumn,
  wrapText,
} from "./canvas-helpers";

export function renderZReportCanvas(payload: ZReportPayload, width: number): Canvas {
  const isNarrow = width <= 400;
  const estimatedHeight = 900;
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
    ctx.font = isNarrow ? "bold 20px sans-serif" : "bold 22px sans-serif";
    const storeLines = wrapText(ctx, payload.storeName, width - 20);
    for (const line of storeLines) {
      ctx.fillText(line, width / 2, y);
      y += 26;
    }
    y += 2;
  }

  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.font = isNarrow ? "bold 21px sans-serif" : "bold 26px sans-serif";
  ctx.fillText("BÁO CÁO KẾT CA (Z-REPORT)", width / 2, y);
  y += 34;

  ctx.font = "bold 20px sans-serif";
  ctx.fillText(`Mã ca: ${payload.shiftCode}`, width / 2, y);
  y += 28;

  drawDashedLine(ctx, y, width);
  y += 14;

  const fontDetail = isNarrow ? 15 : 17;
  const fontSection = isNarrow ? 16 : 18;

  drawTwoColumn(ctx, "Thu ngân:", payload.cashierName, y, width, { fontSize: fontDetail });
  y += 24;
  if (payload.managerName) {
    drawTwoColumn(ctx, "Quản lý duyệt:", payload.managerName, y, width, { fontSize: fontDetail });
    y += 24;
  }
  drawTwoColumn(ctx, "Giờ mở:", formatDateTime(payload.openedAt), y, width, { fontSize: fontDetail - 1 });
  y += 22;
  drawTwoColumn(ctx, "Giờ đóng:", formatDateTime(payload.closedAt), y, width, { fontSize: fontDetail - 1 });
  y += 26;

  drawSolidLine(ctx, y, width, 1);
  y += 14;

  // Financial figures
  drawTwoColumn(ctx, "1. Tiền mặt đầu ca:", formatVnd(payload.initialCash), y, width, { fontSize: fontDetail });
  y += 24;
  drawTwoColumn(ctx, "2. Doanh thu tiền mặt:", formatVnd(payload.cashRevenue), y, width, { fontSize: fontDetail });
  y += 24;
  drawTwoColumn(ctx, "3. Doanh thu VietQR:", formatVnd(payload.bankRevenue), y, width, { fontSize: fontDetail });
  y += 24;
  drawTwoColumn(ctx, "-> TỔNG DOANH THU:", formatVnd(payload.totalRevenue), y, width, { fontSize: fontSection, bold: true });
  y += 26;

  drawDashedLine(ctx, y, width);
  y += 14;

  drawTwoColumn(ctx, "4. Thu vặt trong ca:", `+${formatVnd(payload.totalCashIn)}`, y, width, { fontSize: fontDetail });
  y += 24;
  drawTwoColumn(ctx, "5. Chi vặt trong ca:", `-${formatVnd(payload.totalCashOut)}`, y, width, { fontSize: fontDetail });
  y += 26;

  drawSolidLine(ctx, y, width, 1);
  y += 14;

  drawTwoColumn(ctx, "Tiền mặt lý thuyết:", formatVnd(payload.expectedCash), y, width, { fontSize: fontSection, bold: true });
  y += 26;
  drawTwoColumn(ctx, "Tiền thực tế kiểm đếm:", formatVnd(payload.actualCash), y, width, { fontSize: fontSection, bold: true });
  y += 26;

  const diffLabel = payload.discrepancy === 0 ? "Khớp (0 đ)" : formatVnd(payload.discrepancy);
  drawTwoColumn(ctx, "Chênh lệch:", diffLabel, y, width, {
    fontSize: fontSection,
    bold: true,
  });
  y += 28;

  if (payload.explanation) {
    ctx.textAlign = "left";
    ctx.font = "italic 16px sans-serif";
    const expLines = wrapText(ctx, `Giải trình lệch: ${payload.explanation}`, width - 20);
    for (const line of expLines) {
      ctx.fillText(line, 10, y);
      y += 22;
    }
    y += 10;
  }

  drawSolidLine(ctx, y, width, 2);
  y += 20;

  const half = width / 2;
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Thu ngân kết ca", half / 2, y);
  ctx.fillText("Quản lý duyệt chốt ca", half + half / 2, y);
  y += 22;

  ctx.font = "italic 14px sans-serif";
  ctx.fillText("(Ký tên)", half / 2, y);
  ctx.fillText("(Ký tên)", half + half / 2, y);
  y += 65;

  const finalCanvas = createCanvas(width, y + 10);
  finalCanvas.getContext("2d").drawImage(canvas, 0, 0);
  return finalCanvas;
}
