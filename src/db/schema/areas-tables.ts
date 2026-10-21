import { pgTable, serial, varchar, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * Areas table representing physical zones in the venue (e.g. Tầng 1, Tầng 2, Sân vườn)
 */
export const areas = pgTable("areas", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 50 }).notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Tables (BanAn) representing physical tables within an area.
 * Status: TRONG (Empty/Green), DANG_DUNG (Occupied/Red), CHO_THANH_TOAN (Waiting payment/Yellow)
 */
export const tables = pgTable("tables", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(), // MaBan
  name: varchar("name", { length: 50 }).notNull(), // TenBan
  areaId: integer("area_id")
    .notNull()
    .references(() => areas.id, { onDelete: "cascade" }),
  capacity: integer("capacity").notNull().default(4), // SucChua
  status: varchar("status", { length: 20 }).notNull().default("TRONG"), // TRONG | DANG_DUNG | CHO_THANH_TOAN
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Area = typeof areas.$inferSelect;
export type NewArea = typeof areas.$inferInsert;
export type Table = typeof tables.$inferSelect;
export type NewTable = typeof tables.$inferInsert;
