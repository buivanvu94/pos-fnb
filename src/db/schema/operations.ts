import { pgTable, serial, varchar, integer, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { orders } from "./orders-payments";

/**
 * Print jobs for queuing print operations to LAN thermal printers.
 * Types: KOT_KITCHEN | KOT_BAR | RECEIPT_TEMP | RECEIPT_FINAL | Z_REPORT
 */
export const printJobs = pgTable("print_jobs", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
  jobType: varchar("job_type", { length: 30 }).notNull(),
  targetPrinter: varchar("target_printer", { length: 50 }).notNull(),
  payload: text("payload").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("PENDING"), // PENDING | SENT | FAILED
  retryCount: integer("retry_count").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Audit logs recording sensitive actions (PIN approvals, item cancellations, discounts).
 */
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 50 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: varchar("entity_id", { length: 50 }),
  reason: varchar("reason", { length: 255 }),
  metadata: text("metadata"),
  ipAddress: varchar("ip_address", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Outbox queue for offline-first LAN store synchronization to cloud (NFR-04, DEC-10).
 */
export const outbox = pgTable("outbox", {
  id: serial("id").primaryKey(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  aggregateId: varchar("aggregate_id", { length: 50 }).notNull(),
  payload: text("payload").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("PENDING"), // PENDING | SENT | FAILED
  retryCount: integer("retry_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

/**
 * System settings and parameters (store info, wifi QR, feature flags).
 */
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  description: varchar("description", { length: 255 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PrintJob = typeof printJobs.$inferSelect;
export type NewPrintJob = typeof printJobs.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type OutboxItem = typeof outbox.$inferSelect;
export type NewOutboxItem = typeof outbox.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
