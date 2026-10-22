import { pgTable, serial, varchar, integer, timestamp, text, index } from "drizzle-orm/pg-core";
import { orders } from "./orders-payments";
import { users } from "./users";

/**
 * Unmatched transactions from payment gateways (e.g. SePay) when transfer amount or invoice code does not match.
 * Preserves audit record for managers to reconcile manually without customer fund loss.
 */
export const unmatchedTransactions = pgTable(
  "unmatched_transactions",
  {
    id: serial("id").primaryKey(),
    gateway: varchar("gateway", { length: 50 }).notNull().default("SEPAY"),
    gatewayTransactionId: varchar("gateway_transaction_id", { length: 100 }),
    amount: integer("amount").notNull(),
    content: varchar("content", { length: 255 }),
    transferType: varchar("transfer_type", { length: 20 }).default("IN"),
    orderCode: varchar("order_code", { length: 50 }),
    orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
    reason: varchar("reason", { length: 255 }).notNull(),
    rawPayload: text("raw_payload"),
    status: varchar("status", { length: 20 }).notNull().default("UNRESOLVED"), // UNRESOLVED | RESOLVED | REFUNDED
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedById: integer("resolved_by_id").references(() => users.id, { onDelete: "set null" }),
    resolutionNotes: varchar("resolution_notes", { length: 255 }),
  },
  (table) => [
    index("unmatched_tx_gateway_id_idx").on(table.gatewayTransactionId),
    index("unmatched_tx_order_code_idx").on(table.orderCode),
    index("unmatched_tx_order_id_idx").on(table.orderId),
  ],
);

export type UnmatchedTransaction = typeof unmatchedTransactions.$inferSelect;
export type NewUnmatchedTransaction = typeof unmatchedTransactions.$inferInsert;
