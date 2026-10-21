import { describe, it, expect } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import {
  layoutReceiptItem,
  layoutReceiptItems,
  type ItemLayoutLine,
} from "@/server/printing/templates/receipt-item-layout";
import type { ReceiptItemPayload } from "@/server/printing/print-payload-types";

/**
 * Asserts that all lines in a layout have strictly increasing Y coordinates
 * and that the gap between consecutive lines is greater than or equal to the actual line height.
 */
function assertNonOverlappingLines(lines: ItemLayoutLine[]): void {
  expect(lines.length).toBeGreaterThan(0);
  for (let i = 0; i < lines.length - 1; i++) {
    const current = lines[i];
    const next = lines[i + 1];

    // Y position must strictly increase
    expect(next.y).toBeGreaterThan(current.y);

    // Distance between consecutive lines must be >= current line's actual height
    const distance = next.y - current.y;
    expect(distance).toBeGreaterThanOrEqual(current.lineHeight);
  }
}

describe("Receipt Item Row Layout Unit Tests", () => {
  const canvas = createCanvas(576, 1000);
  const ctx = canvas.getContext("2d");

  it("calculates strictly increasing Y coordinates for standard single-line item", () => {
    const item: ReceiptItemPayload = {
      name: "Cà phê muối",
      quantity: 2,
      unitPrice: 35000,
      totalPrice: 70000,
    };

    const layout = layoutReceiptItem(ctx, item, 100, 576);
    expect(layout.lines.length).toBe(2); // 1 name line + 1 price line
    assertNonOverlappingLines(layout.lines);

    const nameLine = layout.lines[0];
    const priceLine = layout.lines[1];
    expect(priceLine.y).toBeGreaterThanOrEqual(nameLine.y + nameLine.lineHeight);
  });

  it("handles very long item names by wrapping into multiple lines without overlapping price", () => {
    // Narrow 58mm width (384px) with long item name that will wrap
    const narrowCanvas = createCanvas(384, 1000);
    const narrowCtx = narrowCanvas.getContext("2d");

    const item: ReceiptItemPayload = {
      name: "Trà sữa Ô Long nướng trân châu hoàng kim đường đen đặc biệt thơm ngon hảo hạng size L",
      quantity: 3,
      unitPrice: 85000,
      totalPrice: 255000,
    };

    const layout = layoutReceiptItem(narrowCtx, item, 150, 384);
    // Name should wrap into at least 2 lines on 384px width
    const nameLines = layout.lines.filter((l) => l.type === "name");
    expect(nameLines.length).toBeGreaterThanOrEqual(2);

    // Verify all lines (including all wrapped name lines and price line) do not overlap
    assertNonOverlappingLines(layout.lines);

    const lastNameLine = nameLines[nameLines.length - 1];
    const priceLine = layout.lines.find((l) => l.type === "price_qty")!;
    expect(priceLine.y).toBeGreaterThanOrEqual(lastNameLine.y + lastNameLine.lineHeight);
  });

  it("correctly stacks toppings and notes below price line with strict non-overlap", () => {
    const item: ReceiptItemPayload = {
      name: "Mì xào bò trứng",
      quantity: 2,
      unitPrice: 55000,
      totalPrice: 110000,
      toppings: ["Trứng ốp la", "Bò thêm đặc biệt"],
      notes: "Ít dầu mỡ, không hành lá tươi, mang đi xa 5km",
    };

    const layout = layoutReceiptItem(ctx, item, 200, 576);
    assertNonOverlappingLines(layout.lines);

    const priceLine = layout.lines.find((l) => l.type === "price_qty")!;
    const toppingLines = layout.lines.filter((l) => l.type === "topping");
    const noteLines = layout.lines.filter((l) => l.type === "note");

    expect(toppingLines.length).toBeGreaterThanOrEqual(2);
    expect(noteLines.length).toBeGreaterThanOrEqual(1);

    // First topping must be below price line
    expect(toppingLines[0].y).toBeGreaterThanOrEqual(priceLine.y + priceLine.lineHeight);

    // First note must be below last topping line
    const lastTopping = toppingLines[toppingLines.length - 1];
    expect(noteLines[0].y).toBeGreaterThanOrEqual(lastTopping.y + lastTopping.lineHeight);
  });

  it("sequences multiple receipt items without overlap between items", () => {
    const items: ReceiptItemPayload[] = [
      { name: "Cà phê sữa đá", quantity: 1, unitPrice: 30000, totalPrice: 30000 },
      {
        name: "Combo Thuyền Sashimi Cá Hồi Nauy Tươi Sống Thượng Hạng Cùng Trứng Cá Tầm Đen",
        quantity: 2,
        unitPrice: 1234567,
        totalPrice: 2469134,
        notes: "Nhiều wasabi tươi",
      },
      { name: "Trà sen vàng", quantity: 1, unitPrice: 45000, totalPrice: 45000 },
    ];

    const { rows, endY } = layoutReceiptItems(ctx, items, 50, 384);
    expect(rows.length).toBe(3);

    for (let r = 0; r < rows.length; r++) {
      assertNonOverlappingLines(rows[r].lines);
      if (r < rows.length - 1) {
        expect(rows[r + 1].startY).toBeGreaterThanOrEqual(rows[r].endY);
      }
    }
    expect(endY).toBeGreaterThan(rows[rows.length - 1].startY);
  });

  it("fails verification if old naive coordinate calculation is simulated (regression test)", () => {
    const longName = "Trà sữa Ô Long nướng trân châu hoàng kim đường đen đặc biệt thơm ngon hảo hạng size L";
    const item: ReceiptItemPayload = {
      name: longName,
      quantity: 1,
      unitPrice: 50000,
      totalPrice: 50000,
    };

    const layout = layoutReceiptItem(ctx, item, 100, 384);
    const nameLines = layout.lines.filter((l) => l.type === "name");
    expect(nameLines.length).toBeGreaterThan(1); // Wraps into at least 2 lines

    // Old naive calculation did: y += 22 after the first line, ignoring wrapped height
    const oldSimulatedLines: ItemLayoutLine[] = [
      { ...nameLines[0], y: 100 },
      { ...nameLines[1], y: 124 },
      // In the old code, price line was drawn at startY + 22, before the 2nd line of name finished!
      {
        type: "price_qty",
        y: 100 + 22, // 122 < 124! This collided with the name!
        font: "17px sans-serif",
        fontSize: 17,
        lineHeight: 24,
      },
    ];

    // Expect the assertion helper to catch this overlap and fail
    expect(() => assertNonOverlappingLines(oldSimulatedLines)).toThrow();
  });
});
