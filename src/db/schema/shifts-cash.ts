import { pgTable, serial, varchar, integer, timestamp, uniqueIndex, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

/**
 * Shifts (CaLamViec) managing cashier work sessions, cash handling, and closeout approvals.
 * Format for shiftCode: CA-YYYYMMDD-nn (e.g. CA-20261020-01)
 * Status: DANG_MO | CHO_DUYET | DA_DONG
 * Constraint: Partial unique index ensures at most one open shift ('DANG_MO') per cashier.
 */
export const shifts = pgTable(
  "shifts",
  {
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
  },
  (table) => [
    uniqueIndex("shifts_cashier_active_unique")
      .on(table.cashierId)
      .where(sql`status = 'DANG_MO'`),
    index("shifts_cashier_id_idx").on(table.cashierId),
    index("shifts_approved_by_id_idx").on(table.approvedById),
    check("shifts_initial_cash_check", sql`${table.initialCash} >= 0`),
    check("shifts_status_check", sql`${table.status} IN ('DANG_MO', 'CHO_DUYET', 'DA_DONG')`),
  ],
);

/**
 * Cash transactions (PhieuThuChi) within a shift for Cash In/Cash Out.
 * Types: THU (Cash In) | CHI (Cash Out)
 * performedBy is foreign key referencing users.id
 */
export const cashEntries = pgTable(
  "cash_entries",
  {
    id: serial("id").primaryKey(),
    shiftId: integer("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    entryType: varchar("entry_type", { length: 20 }).notNull(), // 'THU' | 'CHI'
    amount: integer("amount").notNull(), // SoTien VND > 0
    reason: varchar("reason", { length: 255 }).notNull(), // LyDo
    performedBy: integer("performed_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("cash_entries_shift_id_idx").on(table.shiftId),
    check("cash_entries_entry_type_check", sql`${table.entryType} IN ('THU', 'CHI')`),
    check("cash_entries_amount_check", sql`${table.amount} > 0`),
  ],
);

export type Shift = typeof shifts.$inferSelect;
export type NewShift = typeof shifts.$inferInsert;
export type CashEntry = typeof cashEntries.$inferSelect;
export type NewCashEntry = typeof cashEntries.$inferInsert;
