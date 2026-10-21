import { describe, it, expect } from "vitest";
import {
  formatVnd,
  formatVndNumber,
  parseVnd,
  isValidVndAmount,
  calculateExpectedCash,
  calculateCashDiscrepancy,
} from "@/lib/money";

describe("Money Utility - VND Currency and Cash Rules", () => {
  it("formats integer VND currency with proper Vietnamese locale symbols", () => {
    const formatted = formatVnd(100000);
    expect(formatted).toContain("100.000");

    expect(formatVnd(0)).toContain("0");
    expect(formatVnd(-10000)).toContain("10.000");
  });

  it("formats integer VND numbers with dot separators without symbol", () => {
    expect(formatVndNumber(1000000)).toBe("1.000.000");
    expect(formatVndNumber(45000)).toBe("45.000");
    expect(formatVndNumber(0)).toBe("0");
  });

  it("parses formatted VND strings back into integers", () => {
    expect(parseVnd("100.000 đ")).toBe(100000);
    expect(parseVnd("1.500.000 ₫")).toBe(1500000);
    expect(parseVnd("45,000")).toBe(45000);
    expect(parseVnd("0 ₫")).toBe(0);
    expect(parseVnd("")).toBe(0);
  });

  it("validates non-negative integer VND amounts", () => {
    expect(isValidVndAmount(0)).toBe(true);
    expect(isValidVndAmount(50000)).toBe(true);
    expect(isValidVndAmount(-100)).toBe(false);
    expect(isValidVndAmount(100.5)).toBe(false);
    expect(isValidVndAmount("1000")).toBe(false);
  });

  it("calculates theoretical cash according to Rule BR-05", () => {
    // Tiền mặt lý thuyết = Tiền đầu ca (1,000,000) + Tiền mặt thu bán hàng (4,500,000) + Thu vặt (200,000) - Chi vặt (100,000) = 5,600,000
    const expected = calculateExpectedCash(1000000, 4500000, 200000, 100000);
    expect(expected).toBe(5600000);
  });

  it("calculates discrepancy between actual counted cash and expected cash (BR-06)", () => {
    // Discrepancy = 5,450,000 - 5,500,000 = -50,000 (shortage)
    const discrepancyNegative = calculateCashDiscrepancy(5450000, 5500000);
    expect(discrepancyNegative).toBe(-50000);

    // Surplus = 5,550,000 - 5,500,000 = +50,000
    const discrepancyPositive = calculateCashDiscrepancy(5550000, 5500000);
    expect(discrepancyPositive).toBe(50000);

    // Exact match = 0
    expect(calculateCashDiscrepancy(5500000, 5500000)).toBe(0);
  });
});
