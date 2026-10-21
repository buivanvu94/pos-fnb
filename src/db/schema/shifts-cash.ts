import { pgTable, serial, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Shifts (CaLamViec) managing cashier work sessions, cash handling, and closeout approvals.
 * Format for shiftCode: CA-YYYYMMDD-nn (e.g. CA-20261020-01)
 * Status: DANG_MO | CHO_DUYET | DA_DONG
 */
export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  shiftCode: varchar("shift_code", { length: 20 }).notNull().unique(), // MaCa: CA-YYYYMMDD-nn
  cashierId: integer("cashier_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  initialCash: integer("initial_cash").notNull().default(0), // TienDauCa >= 0
  actualCash: integer("actual_cash"), // TienCuoiCaThucTe
  expectedCash: integer("expected_cash"), // TienLyThuyet (BR-05)
  difference: integer("difference"), // DoLech = actualCash - expectedCash
  explanation: varchar("explanation", { length: 255 }), // GiaiTrinh
  approvedById: integer("approved_by_id").references(() => users.id, { onDelete: "set null" }),
  status: varchar("status", { length: 20 }).notNull().default("DANG_MO"), // DANG_MO | CHO_DUYET | DA_DONG
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Cash transactions (PhieuThuChi) within a shift for Cash In/Cash Out.
 * Types: THU (Cash In) | CHI (Cash Out)
 */
export const cashEntries = pgTable("cash_entries", {
  id: serial("id").primaryKey(),
  shiftId: integer("shift_id")
    .notNull()
    .references(() => shifts.id, { onDelete: "cascade" }),
  entryType: varchar("entry_type", { length: 20 }).notNull(), // 'THU' | 'CHI'
  amount: integer("amount").notNull(), // SoTien VND > 0
  reason: varchar("reason", { length: 255 }).notNull(), // LyDo
  performedBy: varchar("performed_by", { length: 100 }).notNull(), // NguoiThucHien
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Shift = typeof shifts.$inferSelect;
export type NewShift = typeof shifts.$inferInsert;
export type CashEntry = typeof cashEntries.$inferSelect;
export type NewCashEntry = typeof cashEntries.$inferInsert;
