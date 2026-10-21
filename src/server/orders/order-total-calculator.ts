import { eq, and, inArray } from "drizzle-orm";
import { orderItems, orderItemToppings } from "@/db/schema";
import type { DbOrTx } from "@/server/tables/table-service";

/**
 * Calculates the total amount for all active items and toppings in an order.
 */
export async function calculateOrderTotal(orderId: number, tx: DbOrTx): Promise<number> {
  const activeItems = await tx
    .select({
      id: orderItems.id,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
    })
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), eq(orderItems.isCancelled, false)));

  if (activeItems.length === 0) {
    return 0;
  }

  const activeItemIds = activeItems.map((i: any) => i.id);
  const allToppings = await tx
    .select({
      orderItemId: orderItemToppings.orderItemId,
      toppingPrice: orderItemToppings.toppingPrice,
    })
    .from(orderItemToppings)
    .where(inArray(orderItemToppings.orderItemId, activeItemIds));

  const toppingSumMap = new Map<number, number>();
  for (const top of allToppings) {
    toppingSumMap.set(top.orderItemId, (toppingSumMap.get(top.orderItemId) ?? 0) + top.toppingPrice);
  }

  let calculatedTotal = 0;
  for (const it of activeItems) {
    const topPrice = toppingSumMap.get(it.id) ?? 0;
    calculatedTotal += (it.unitPrice + topPrice) * it.quantity;
  }

  return calculatedTotal;
}
