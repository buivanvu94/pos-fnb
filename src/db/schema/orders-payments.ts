import { pgTable, serial, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { tables } from "./areas-tables";
import { shifts } from "./shifts-cash";
import { users } from "./users";
import { menuItems } from "./menu";

/**
 * Orders (HoaDon) representing table orders or counter takeaway orders.
 * Format for orderCode: HD-YYYYMMDD-nnnn (e.g. HD-20261020-0042)
 * Includes optimistic locking column `version` to prevent concurrent write collisions (DEC-08).
 */
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderCode: varchar("order_code", { length: 20 }).notNull().unique(), // MaHoaDon
  orderType: varchar("order_type", { length: 20 }).notNull().default("TAI_BAN"), // TAI_BAN | MANG_VE
  tableId: integer("table_id").references(() => tables.id, { onDelete: "set null" }),
  shiftId: integer("shift_id")
    .notNull()
    .references(() => shifts.id, { onDelete: "restrict" }),
  totalAmount: integer("total_amount").notNull().default(0), // TongTien VND
  discountAmount: integer("discount_amount").notNull().default(0), // GiamGia VND
  finalAmount: integer("final_amount").notNull().default(0), // KhachCanTra VND
  paymentMethod: varchar("payment_method", { length: 20 }), // TIEN_MAT | VIETQR
  status: varchar("status", { length: 20 }).notNull().default("DANG_PHUC_VU"), // DANG_PHUC_VU | DA_THANH_TOAN | DA_HUY
  version: integer("version").notNull().default(1), // Optimistic concurrency lock
  createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Order items (ChiTietHoaDon) for lines within an order.
 */
export const orderItems = pgTable("order_items", {
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
  isCancelled: boolean("is_cancelled").notNull().default(false), // DaHuy
  cancelReason: varchar("cancel_reason", { length: 255 }), // LyDoHuy (min 5 chars per BR-03)
  cancelledById: integer("cancelled_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Payments record payment transactions for orders.
 */
export const payments = pgTable("payments", {
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
  status: varchar("status", { length: 20 }).notNull().default("SUCCESS"), // PENDING | SUCCESS | FAILED
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
