import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems, orderItemToppings, tables, areas, menuItems, Shift } from "@/db/schema";
import { generateOrderCode } from "@/db/code-generator";
import { TokenPayload } from "@/server/auth/jwt";
import { OrderItemDetail, OrderDetail } from "./order-types";

export type { OrderItemDetail, OrderDetail };

/**
 * Creates a new active order for an empty table (TAI_BAN) (FR-01, FR-02, BR-02).
 */
export async function createTableOrder(
  tableId: number,
  user: TokenPayload,
  shift: Shift,
): Promise<{ ok: true; order: OrderDetail } | { ok: false; error: string; status: number }> {
  return await db.transaction(async (tx) => {
    const [targetTable] = await tx
      .select()
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1)
      .for("update");

    if (!targetTable) {
      return { ok: false, error: "Bàn không tồn tại trên hệ thống", status: 404 };
    }

    if (targetTable.status !== "TRONG") {
      return { ok: false, error: "Bàn đang có khách, không thể mở đơn mới", status: 409 };
    }

    const [existingOrder] = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.tableId, tableId), eq(orders.status, "DANG_PHUC_VU")))
      .limit(1);

    if (existingOrder) {
      return { ok: false, error: "Bàn đang có khách, không thể mở đơn mới", status: 409 };
    }

    const orderCode = await generateOrderCode(tx as any);

    try {
      const [newOrder] = await tx
        .insert(orders)
        .values({
          orderCode,
          orderType: "TAI_BAN",
          tableId,
          shiftId: shift.id,
          totalAmount: 0,
          discountAmount: 0,
          finalAmount: 0,
          status: "DANG_PHUC_VU",
          version: 1,
          createdById: user.userId,
        })
        .returning();

      await tx
        .update(tables)
        .set({ status: "DANG_DUNG", updatedAt: new Date() })
        .where(eq(tables.id, tableId));

      return {
        ok: true,
        order: {
          id: newOrder.id,
          orderCode: newOrder.orderCode,
          orderType: newOrder.orderType,
          tableId: newOrder.tableId,
          tableName: targetTable.name,
          areaId: targetTable.areaId,
          areaName: null,
          shiftId: newOrder.shiftId,
          totalAmount: 0,
          discountAmount: 0,
          finalAmount: 0,
          paymentMethod: null,
          status: newOrder.status,
          version: newOrder.version,
          createdAt: newOrder.createdAt,
          items: [],
        },
      };
    } catch (err: any) {
      if (err?.code === "23505") {
        return { ok: false, error: "Bàn đang có khách, không thể mở đơn mới", status: 409 };
      }
      throw err;
    }
  });
}

/**
 * Retrieves full order details with all items, toppings, and pricing.
 */
export async function getOrderDetails(orderId: number, tx: any = db): Promise<OrderDetail | null> {
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
      targetPrinter: item.targetPrinter ?? "KITCHEN",
      imageUrl: item.imageUrl,
      toppings: itemTops,
      totalItemPrice: (item.unitPrice + toppingTotal) * item.quantity,
    };
  });

  return { ...order, items };
}
