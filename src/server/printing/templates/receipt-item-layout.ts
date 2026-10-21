import type { SKRSContext2D } from "@napi-rs/canvas";
import type { ReceiptItemPayload } from "../print-payload-types";
import { formatVnd, wrapText } from "./canvas-helpers";

export interface ItemLayoutLine {
  type: "name" | "price_qty" | "topping" | "note";
  text?: string;
  leftText?: string;
  rightText?: string;
  font: string;
  fontSize: number;
  lineHeight: number;
  y: number;
}

export interface ItemRowLayout {
  item: ReceiptItemPayload;
  lines: ItemLayoutLine[];
  startY: number;
  endY: number;
  totalHeight: number;
}

export interface ReceiptLayoutOptions {
  fontSizeName?: number;
  fontSizePrice?: number;
  fontSizeSub?: number;
  itemSpacing?: number;
}

/**
 * Calculates deterministic, non-overlapping vertical layout for a single receipt item row.
 * Guarantees that every line strictly increases in Y position with spacing >= line height.
 */
export function layoutReceiptItem(
  ctx: SKRSContext2D,
  item: ReceiptItemPayload,
  startY: number,
  width: number,
  options?: ReceiptLayoutOptions,
): ItemRowLayout {
  const isNarrow = width <= 400;
  const fontSizeName = options?.fontSizeName ?? (isNarrow ? 16 : 18);
  const fontSizePrice = options?.fontSizePrice ?? (isNarrow ? 15 : 17);
  const fontSizeSub = options?.fontSizeSub ?? (isNarrow ? 14 : 16);
  const itemSpacing = options?.itemSpacing ?? (isNarrow ? 8 : 10);

  const fontName = `bold ${fontSizeName}px sans-serif`;
  const fontPrice = `${fontSizePrice}px sans-serif`;
  const fontTopping = `${fontSizeSub}px sans-serif`;
  const fontNote = `italic ${fontSizeSub}px sans-serif`;

  const lineHeightName = Math.round(fontSizeName * 1.35);
  const lineHeightPrice = Math.round(fontSizePrice * 1.4);
  const lineHeightSub = Math.round(fontSizeSub * 1.35);

  const lines: ItemLayoutLine[] = [];
  let currentY = startY;

  // 1. Item Name (wrapped to printable width, 10px padding on each side)
  ctx.save();
  ctx.font = fontName;
  const printableWidth = width - 20;
  const nameLines = wrapText(ctx, item.name, printableWidth);
  ctx.restore();

  for (const lineText of nameLines) {
    lines.push({
      type: "name",
      text: lineText,
      font: fontName,
      fontSize: fontSizeName,
      lineHeight: lineHeightName,
      y: currentY,
    });
    currentY += lineHeightName;
  }

  // 2. Quantity x Unit Price (left) and Total Price (right) on the SAME line below the name
  const subDetail = `${item.quantity} x ${formatVnd(item.unitPrice)}`;
  lines.push({
    type: "price_qty",
    leftText: `  ${subDetail}`,
    rightText: formatVnd(item.totalPrice),
    font: fontPrice,
    fontSize: fontSizePrice,
    lineHeight: lineHeightPrice,
    y: currentY,
  });
  currentY += lineHeightPrice;

  // 3. Toppings (if any) sequentially below
  if (item.toppings && item.toppings.length > 0) {
    ctx.save();
    ctx.font = fontTopping;
    for (const top of item.toppings) {
      const topLines = wrapText(ctx, `   + ${top}`, width - 25);
      for (const tl of topLines) {
        lines.push({
          type: "topping",
          text: tl,
          font: fontTopping,
          fontSize: fontSizeSub,
          lineHeight: lineHeightSub,
          y: currentY,
        });
        currentY += lineHeightSub;
      }
    }
    ctx.restore();
  }

  // 4. Notes (if any) sequentially below
  if (item.notes) {
    ctx.save();
    ctx.font = fontNote;
    const noteLines = wrapText(ctx, `   * Ghi chú: ${item.notes}`, width - 25);
    for (const nl of noteLines) {
      lines.push({
        type: "note",
        text: nl,
        font: fontNote,
        fontSize: fontSizeSub,
        lineHeight: lineHeightSub,
        y: currentY,
      });
      currentY += lineHeightSub;
    }
    ctx.restore();
  }

  const endY = currentY + itemSpacing;
  return {
    item,
    lines,
    startY,
    endY,
    totalHeight: endY - startY,
  };
}

/**
 * Calculates layouts for multiple receipt items in sequence.
 */
export function layoutReceiptItems(
  ctx: SKRSContext2D,
  items: ReceiptItemPayload[],
  startY: number,
  width: number,
  options?: ReceiptLayoutOptions,
): { rows: ItemRowLayout[]; endY: number } {
  const rows: ItemRowLayout[] = [];
  let currentY = startY;

  for (const item of items) {
    const row = layoutReceiptItem(ctx, item, currentY, width, options);
    rows.push(row);
    currentY = row.endY;
  }

  return { rows, endY: currentY };
}

/**
 * Renders an ItemRowLayout onto SKRSContext2D using textBaseline = "top".
 */
export function drawReceiptItemRow(
  ctx: SKRSContext2D,
  layout: ItemRowLayout,
  width: number,
): void {
  ctx.save();
  ctx.textBaseline = "top";

  for (const line of layout.lines) {
    ctx.font = line.font;
    ctx.fillStyle = "#000000";

    if (line.type === "price_qty") {
      ctx.textAlign = "left";
      ctx.fillText(line.leftText || "", 10, line.y);
      ctx.textAlign = "right";
      ctx.fillText(line.rightText || "", width - 10, line.y);
    } else {
      ctx.textAlign = "left";
      ctx.fillText(line.text || "", 10, line.y);
    }
  }

  ctx.restore();
}
