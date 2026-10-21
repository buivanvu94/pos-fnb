import { loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import * as QRCode from "qrcode";

export const WIDTH_80MM = 576;
export const WIDTH_58MM = 384;

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount)) + " đ";
}

export function formatDateTime(isoString?: string): string {
  try {
    const d = isoString ? new Date(isoString) : new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const hours = pad(d.getHours());
    const mins = pad(d.getMinutes());
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    return `${hours}:${mins} - ${day}/${month}/${year}`;
  } catch {
    return isoString || "";
  }
}

export function drawDashedLine(ctx: SKRSContext2D, y: number, width: number): void {
  ctx.save();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(10, y);
  ctx.lineTo(width - 10, y);
  ctx.stroke();
  ctx.restore();
}

export function drawSolidLine(ctx: SKRSContext2D, y: number, width: number, thickness = 2): void {
  ctx.save();
  ctx.fillStyle = "#000000";
  ctx.fillRect(10, y, width - 20, thickness);
  ctx.restore();
}

export function wrapText(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [];
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export function drawTwoColumn(
  ctx: SKRSContext2D,
  left: string,
  right: string,
  y: number,
  width: number,
  options?: { bold?: boolean; fontSize?: number; fontColor?: string },
): void {
  ctx.save();
  const baseSize = options?.fontSize ?? (width <= 400 ? 16 : 18);
  const boldStr = options?.bold ? "bold " : "";
  ctx.font = `${boldStr}${baseSize}px sans-serif`;
  ctx.fillStyle = options?.fontColor ?? "#000000";
  ctx.textBaseline = "top";

  const leftW = ctx.measureText(left).width;
  const rightW = ctx.measureText(right).width;
  const availableW = width - 20;

  if (leftW + rightW + 8 > availableW) {
    const scaledSize = Math.max(12, Math.floor(baseSize * (availableW / (leftW + rightW + 12))));
    ctx.font = `${boldStr}${scaledSize}px sans-serif`;
  }

  ctx.textAlign = "left";
  ctx.fillText(left, 10, y);

  ctx.textAlign = "right";
  ctx.fillText(right, width - 10, y);
  ctx.restore();
}

export async function drawQrCode(
  ctx: SKRSContext2D,
  qrText: string,
  centerX: number,
  y: number,
  size: number,
): Promise<number> {
  const qrBuffer = await QRCode.toBuffer(qrText, {
    type: "png",
    width: size,
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });
  const qrImage = await loadImage(qrBuffer);
  const x = Math.round(centerX - size / 2);
  ctx.drawImage(qrImage, x, y, size, size);
  return y + size;
}
