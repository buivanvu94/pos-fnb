import { eq, and, desc } from "drizzle-orm";
import { auditLogs } from "@/db/schema";

/**
 * Recalculates discount and final amounts when order items change.
 * If previous discount was percentage-based, recalculates from percentage.
 * If previous discount was fixed amount, caps discount at new total.
 */
export async function recalculateOrderDiscount(
  orderId: number,
  calculatedTotal: number,
  currentDiscountAmount: number,
  tx: any,
): Promise<{ discountAmount: number; finalAmount: number }> {
  if (currentDiscountAmount <= 0) {
    return {
      discountAmount: 0,
      finalAmount: calculatedTotal,
    };
  }

  let discountAmount = Math.min(currentDiscountAmount, calculatedTotal);

  const [latestDiscount] = await tx
    .select({ metadata: auditLogs.metadata })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.entityType, "orders"),
        eq(auditLogs.entityId, String(orderId)),
        eq(auditLogs.action, "DISCOUNT"),
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);

  if (latestDiscount?.metadata) {
    try {
      const parsed = JSON.parse(latestDiscount.metadata);
      if (typeof parsed.percent === "number" && parsed.percent >= 0 && parsed.percent <= 100) {
        discountAmount = Math.round(calculatedTotal * (parsed.percent / 100));
      }
    } catch {
      // Fallback to capped fixed amount
    }
  }

  discountAmount = Math.max(0, Math.min(discountAmount, calculatedTotal));
  const finalAmount = Math.max(0, calculatedTotal - discountAmount);

  return { discountAmount, finalAmount };
}
