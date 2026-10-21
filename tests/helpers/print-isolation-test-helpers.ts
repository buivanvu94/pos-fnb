import type { Pool } from "pg";
import type { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";

export interface IsolationFixture {
  waiterUserId: number;
  waiterToken: string;
  testAreaId: number;
  testShiftId: number;
  kitchenItemId: number;
  barItemId: number;
}

export async function createOrderForTest(
  db: ReturnType<typeof drizzle<typeof schema>>,
  params: {
    tableId: number;
    shiftId: number;
    userId: number;
    items: Array<{ itemId: number; price: number }>;
    codePrefix: string;
  },
) {
  const [order] = await db
    .insert(schema.orders)
    .values({
      orderCode: `${params.codePrefix}_${Math.random().toString(36).slice(2, 7)}`,
      orderType: "TAI_BAN",
      tableId: params.tableId,
      shiftId: params.shiftId,
      totalAmount: params.items.reduce((s, i) => s + i.price, 0),
      finalAmount: params.items.reduce((s, i) => s + i.price, 0),
      status: "DANG_PHUC_VU",
      version: 1,
      createdById: params.userId,
    })
    .returning();

  await db.insert(schema.orderItems).values(
    params.items.map((i) => ({
      orderId: order.id,
      menuItemId: i.itemId,
      quantity: 1,
      unitPrice: i.price,
      isPrintedKitchen: false,
    })),
  );

  return order;
}
