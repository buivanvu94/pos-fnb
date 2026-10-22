import { pgTable, serial, varchar, integer, boolean, timestamp, uniqueIndex, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tables } from "./areas-tables";
import { shifts } from "./shifts-cash";
import { users } from "./users";
import { menuItems, toppings } from "./menu";

/**
 * Orders (HoaDon) representing table orders or counter takeaway orders.
 * Constraints:
 * - Partial unique index on table_id when status is 'DANG_PHUC_VU' prevents multiple active orders per table (BR-02).
 * - Indexes on shift_id and table_id for foreign key optimization.
 */
export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderCode: varchar("order_code", { length: 20 }).notNull().unique(), // MaHoaDon
    orderType: varchar("order_type", { length: 20 }).notNull().default("TAI_BAN"), // TAI_BAN | MANG_VE
    tableId: integer("table_id").references(() => tables.id, { onDelete: "set null" }),
    shiftId: integer("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "restrict" }),
    totalAmount: integer("total_amount").notNull().default(0), // TongTien VND
    discountAmount: integer("discount_amount").notNull().default(0), // GiamGia VND
    discountPercent: integer("discount_percent"), // GiamGia % (0..100)
    finalAmount: integer("final_amount").notNull().default(0), // KhachCanTra VND
    paymentMethod: varchar("payment_method", { length: 20 }), // TIEN_MAT | VIETQR
    status: varchar("status", { length: 20 }).notNull().default("DANG_PHUC_VU"), // DANG_PHUC_VU | DA_THANH_TOAN | DA_HUY | DA_GOP
    version: integer("version").notNull().default(1), // Optimistic concurrency lock
    queueNumber: integer("queue_number"),
    queueDate: varchar("queue_date", { length: 10 }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedById: integer("voided_by_id").references(() => users.id, { onDelete: "set null" }),
    voidReason: varchar("void_reason", { length: 255 }),
    createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("orders_table_active_unique")
      .on(table.tableId)
      .where(sql`status = 'DANG_PHUC_VU' AND table_id IS NOT NULL`),
    uniqueIndex("orders_queue_date_number_unique")
      .on(table.queueDate, table.queueNumber)
      .where(sql`queue_number IS NOT NULL AND queue_date IS NOT NULL`),
    index("orders_shift_id_idx").on(table.shiftId),
    index("orders_table_id_idx").on(table.tableId),
    check("orders_order_type_check", sql`${table.orderType} IN ('TAI_BAN', 'MANG_VE')`),
    check("orders_status_check", sql`${table.status} IN ('DANG_PHUC_VU', 'DA_THANH_TOAN', 'DA_HUY', 'DA_GOP')`),
    check("orders_total_amount_check", sql`${table.totalAmount} >= 0`),
    check("orders_discount_amount_check", sql`${table.discountAmount} >= 0`),
    check("orders_discount_percent_check", sql`${table.discountPercent} IS NULL OR (${table.discountPercent} >= 0 AND ${table.discountPercent} <= 100)`),
    check("orders_final_amount_check", sql`${table.finalAmount} >= 0`),
  ],
);

/**
 * Order items (ChiTietHoaDon) for lines within an order.
 */
export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    menuItemId: integer("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1), // SoLuong > 0
    unitPrice: integer("unit_price").notNull(), // DonGia VND at order time
    notes: varchar("notes", { length: 100 }), // GhiChu
    isPrintedKitchen: boolean("is_printed_kitchen").notNull().default(false), // DaInBep
    sentAt: timestamp("sent_at", { withTimezone: true }), // Thời điểm gửi bếp
    isCancelled: boolean("is_cancelled").notNull().default(false), // DaHuy
    cancelReason: varchar("cancel_reason", { length: 255 }), // LyDoHuy (min 5 chars per BR-03)
    cancelledById: integer("cancelled_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("order_items_order_id_idx").on(table.orderId),
    index("order_items_menu_item_id_idx").on(table.menuItemId),
    check("order_items_quantity_check", sql`${table.quantity} > 0`),
    check("order_items_unit_price_check", sql`${table.unitPrice} >= 0`),
  ],
);

/**
 * Order item toppings: toppings selected for a specific order item.
 */
export const orderItemToppings = pgTable(
  "order_item_toppings",
  {
    id: serial("id").primaryKey(),
    orderItemId: integer("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    toppingId: integer("topping_id")
      .notNull()
      .references(() => toppings.id, { onDelete: "restrict" }),
    toppingName: varchar("topping_name", { length: 100 }).notNull(),
    toppingPrice: integer("topping_price").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("order_item_toppings_order_item_id_idx").on(table.orderItemId),
    check("order_item_toppings_price_check", sql`${table.toppingPrice} >= 0`),
  ],
);

/**
 * Payments record payment transactions for orders.
 */
export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    shiftId: integer("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "restrict" }),
    paymentMethod: varchar("payment_method", { length: 20 }).notNull(), // TIEN_MAT | VIETQR
    amount: integer("amount").notNull(), // SoTien VND
    cashGiven: integer("cash_given"), // For cash payments: Tiền khách đưa
    cashReturned: integer("cash_returned"), // For cash payments: Tiền thối lại
    vietqrRef: varchar("vietqr_ref", { length: 100 }), // Transaction reference
    status: varchar("status", { length: 20 }).notNull().default("SUCCESS"), // PENDING | SUCCESS | FAILED | VOIDED
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("payments_order_id_idx").on(table.orderId),
    index("payments_shift_id_idx").on(table.shiftId),
    check("payments_payment_method_check", sql`${table.paymentMethod} IN ('TIEN_MAT', 'VIETQR')`),
    check("payments_amount_check", sql`${table.amount} > 0`),
    check("payments_status_check", sql`${table.status} IN ('PENDING', 'SUCCESS', 'FAILED', 'VOIDED')`),
  ],
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type OrderItemTopping = typeof orderItemToppings.$inferSelect;
export type NewOrderItemTopping = typeof orderItemToppings.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
