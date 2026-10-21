import { eq } from "drizzle-orm";
import { orders } from "@/db/schema";

/**
 * Recalculates discount and final amounts when order items change.
 * Reads discount_percent column directly on orders:
 * - If percentage-based (discountPercent is not null), recalculates discountAmount from percentage.
 * - Handles edge case: empty order discounted (amount = 0) retains its percentage when items are added later.
 * - If fixed amount (discountPercent is null), caps discountAmount at new total.
 */
export async function recalculateOrderDiscount(
  orderId: number,
  calculatedTotal: number,
  currentDiscountAmount: number,
  discountPercent?: number | null,
  tx?: any,
): Promise<{ discountAmount: number; finalAmount: number }> {
  let percent = discountPercent;

  // If discountPercent wasn't provided, read it directly from orders table
  if (percent === undefined && tx) {
    const [orderRow] = await tx
      .select({ discountPercent: orders.discountPercent })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    percent = orderRow?.discountPercent ?? null;
  }

  let discountAmount = 0;

  if (percent !== null && percent !== undefined && percent >= 0 && percent <= 100) {
    discountAmount = Math.round(calculatedTotal * (percent / 100));
  } else if (currentDiscountAmount > 0) {
    discountAmount = Math.min(currentDiscountAmount, calculatedTotal);
  }

  discountAmount = Math.max(0, Math.min(discountAmount, calculatedTotal));
  const finalAmount = Math.max(0, calculatedTotal - discountAmount);

  return { discountAmount, finalAmount };
}
