/**
 * Utility functions for handling Vietnamese Dong (VND) currency calculations and formatting.
 * Constraint: In F&B POS systems, VND amounts are strictly non-negative integers without decimal places.
 */

/**
 * Formats an integer VND amount into a localized Vietnamese currency string.
 * Example: 100000 -> "100.000 ₫"
 *
 * @param amount - The integer monetary amount in VND
 * @returns Formatted currency string
 */
export function formatVnd(amount: number): string {
  if (typeof amount !== "number" || isNaN(amount)) {
    return "0 ₫";
  }
  const integerAmount = Math.round(amount);
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(integerAmount);
}

/**
 * Formats an integer VND amount with dot separators without the currency symbol.
 * Example: 100000 -> "100.000"
 *
 * @param amount - The integer monetary amount in VND
 * @returns Formatted number string with dot thousand separators
 */
export function formatVndNumber(amount: number): string {
  if (typeof amount !== "number" || isNaN(amount)) {
    return "0";
  }
  const integerAmount = Math.round(amount);
  return new Intl.NumberFormat("vi-VN").format(integerAmount);
}

/**
 * Parses a formatted VND currency string back into an integer amount.
 * Strips out currency symbols, whitespace, and dots.
 * Example: "100.000 đ" -> 100000
 *
 * @param formattedStr - The formatted currency string
 * @returns The integer value in VND, or 0 if invalid
 */
export function parseVnd(formattedStr: string): number {
  if (!formattedStr) {
    return 0;
  }
  const cleanStr = formattedStr.replace(/[^\d-]/g, "");
  const parsed = parseInt(cleanStr, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Validates that an amount is a valid non-negative integer VND value.
 *
 * @param amount - Number to validate
 * @returns True if the value is an integer and >= 0
 */
export function isValidVndAmount(amount: unknown): amount is number {
  return typeof amount === "number" && Number.isInteger(amount) && amount >= 0;
}

/**
 * Calculates theoretical cash balance at end of shift based on Rule BR-05:
 * Tiền mặt lý thuyết = Tiền đầu ca + Tiền mặt thu bán hàng + Thu vặt - Chi vặt
 *
 * @param initialCash - Opening cash balance
 * @param cashSales - Cash collected from sales
 * @param cashIn - Cash in entries
 * @param cashOut - Cash out entries
 * @returns Expected cash balance in VND
 */
export function calculateExpectedCash(
  initialCash: number,
  cashSales: number,
  cashIn: number,
  cashOut: number,
): number {
  return Math.max(0, Math.round(initialCash + cashSales + cashIn - cashOut));
}

/**
 * Calculates discrepancy between actual counted cash and expected cash:
 * Độ lệch = Tiền cuối ca thực tế - Tiền lý thuyết
 *
 * @param actualCash - Counted cash at shift close
 * @param expectedCash - Calculated theoretical cash
 * @returns Cash difference (negative means shortage, positive means surplus)
 */
export function calculateCashDiscrepancy(
  actualCash: number,
  expectedCash: number,
): number {
  return Math.round(actualCash) - Math.round(expectedCash);
}
