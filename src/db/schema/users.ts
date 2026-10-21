import { pgTable, serial, varchar, text, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * Users table storing staff accounts, roles, hashed passwords and manager PINs.
 * Roles: QUAN_LY (Manager), THU_NGAN (Cashier), PHUC_VU (Waiter)
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  fullName: varchar("full_name", { length: 100 }).notNull(),
  role: varchar("role", { length: 20 }).notNull(), // 'QUAN_LY' | 'THU_NGAN' | 'PHUC_VU'
  passwordHash: text("password_hash").notNull(),
  pinHash: text("pin_hash"), // Hashed 4-6 digit PIN for Manager approvals (FR-10, BR-04)
  pinFailedCount: integer("pin_failed_count").notNull().default(0),
  pinLockedUntil: timestamp("pin_locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
