import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems, orderItemToppings, tables, areas, menuItems } from "@/db/schema";
import type { DbOrTx } from "@/server/tables/table-service";
import type { OrderItemDetail, OrderDetail } from "./order-types";

/**
 * Retrieves full order details with all items, toppings, and pricing.
 */
export async function getOrderDetails(orderId: number, tx: DbOrTx = db): Promise<OrderDetail | null> {
  const [order] = await tx
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      orderType: orders.orderType,
      tableId: orders.tableId,
      tableName: tables.name,
      areaId: tables.areaId,
      areaName: areas.name,
      shiftId: orders.shiftId,
      totalAmount: orders.totalAmount,
      discountAmount: orders.discountAmount,
      finalAmount: orders.finalAmount,
      paymentMethod: orders.paymentMethod,
      status: orders.status,
      version: orders.version,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .leftJoin(tables, eq(orders.tableId, tables.id))
    .leftJoin(areas, eq(tables.areaId, areas.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return null;

  const rawItems = await tx
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      menuItemId: orderItems.menuItemId,
      menuItemName: menuItems.name,
      menuItemCode: menuItems.code,
      unitPrice: orderItems.unitPrice,
      quantity: orderItems.quantity,
      notes: orderItems.notes,
      isPrintedKitchen: orderItems.isPrintedKitchen,
      sentAt: orderItems.sentAt,
      isCancelled: orderItems.isCancelled,
      targetPrinter: menuItems.targetPrinter,
      imageUrl: menuItems.imageUrl,
    })
    .from(orderItems)
    .leftJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
    .where(and(eq(orderItems.orderId, orderId), eq(orderItems.isCancelled, false)))
    .orderBy(orderItems.id);

  const itemIds = rawItems.map((i: any) => i.id);
  const toppingRows =
    itemIds.length > 0
      ? await tx
          .select({
            id: orderItemToppings.id,
            orderItemId: orderItemToppings.orderItemId,
            toppingId: orderItemToppings.toppingId,
            toppingName: orderItemToppings.toppingName,
            toppingPrice: orderItemToppings.toppingPrice,
          })
          .from(orderItemToppings)
          .where(inArray(orderItemToppings.orderItemId, itemIds))
      : [];

  const toppingsByItem = new Map<number, typeof toppingRows>();
  for (const t of toppingRows) {
    const list = toppingsByItem.get(t.orderItemId) ?? [];
    list.push(t);
    toppingsByItem.set(t.orderItemId, list);
  }

  const items: OrderItemDetail[] = rawItems.map((item: any) => {
    const itemTops = toppingsByItem.get(item.id) ?? [];
    const toppingTotal = itemTops.reduce((sum: number, t: any) => sum + t.toppingPrice, 0);
    return {
      id: item.id,
      orderId: item.orderId,
      menuItemId: item.menuItemId,
      menuItemName: item.menuItemName ?? "",
      menuItemCode: item.menuItemCode ?? "",
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      notes: item.notes,
      isPrintedKitchen: item.isPrintedKitchen,
      sentAt: item.sentAt,
      isCancelled: item.isCancelled,
      targetPrinter: item.targetPrinter,
      imageUrl: item.imageUrl,
      toppings: itemTops.map((t: any) => ({
        id: t.id,
        orderItemId: t.orderItemId,
        toppingId: t.toppingId,
        toppingName: t.toppingName,
        toppingPrice: t.toppingPrice,
      })),
      totalItemPrice: (item.unitPrice + toppingTotal) * item.quantity,
    };
  });

  return {
    ...order,
    items,
  };
}
