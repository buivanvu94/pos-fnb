import { pgTable, serial, varchar, integer, boolean, text, timestamp } from "drizzle-orm/pg-core";

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
 * Price is integer VND.
 * Status: DANG_BAN (Available) | HET_HANG (Sold out)
 * Target Printer: KITCHEN | BAR
 */
export const menuItems = pgTable("menu_items", {
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
});

/**
 * Toppings / side additions for menu items.
 */
export const toppings = pgTable("toppings", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  price: integer("price").notNull().default(0), // VND
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type MenuItem = typeof menuItems.$inferSelect;
export type NewMenuItem = typeof menuItems.$inferInsert;
export type Topping = typeof toppings.$inferSelect;
export type NewTopping = typeof toppings.$inferInsert;
