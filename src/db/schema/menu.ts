import { pgTable, serial, varchar, integer, boolean, text, timestamp, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Categories (DanhMuc) for grouping menu items (e.g. Cà phê, Trà sữa, Ăn vặt).
 */
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Menu items (MonAn) representing items sold in the establishment.
 * Constraints: price >= 0 (ERR-12, BR-14), status valid, target printer valid
 */
export const menuItems = pgTable(
  "menu_items",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 20 }).notNull().unique(), // MaMon
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 100 }).notNull(), // TenMon
    price: integer("price").notNull(), // DonGia VND >= 0 (ERR-12, BR-14)
    unit: varchar("unit", { length: 20 }).notNull().default("Phần"), // DonViTinh
    status: varchar("status", { length: 20 }).notNull().default("DANG_BAN"), // DANG_BAN | HET_HANG
    imageUrl: text("image_url"),
    targetPrinter: varchar("target_printer", { length: 20 }).notNull().default("KITCHEN"), // KITCHEN | BAR
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("menu_items_category_id_idx").on(table.categoryId),
    check("menu_items_price_check", sql`${table.price} >= 0`),
    check("menu_items_status_check", sql`${table.status} IN ('DANG_BAN', 'HET_HANG')`),
    check("menu_items_target_printer_check", sql`${table.targetPrinter} IN ('KITCHEN', 'BAR')`),
  ],
);

/**
 * Toppings / side additions for menu items.
 */
export const toppings = pgTable(
  "toppings",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    price: integer("price").notNull().default(0), // VND
    isAvailable: boolean("is_available").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("toppings_price_check", sql`${table.price} >= 0`),
  ],
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type MenuItem = typeof menuItems.$inferSelect;
export type NewMenuItem = typeof menuItems.$inferInsert;
export type Topping = typeof toppings.$inferSelect;
export type NewTopping = typeof toppings.$inferInsert;
