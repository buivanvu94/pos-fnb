import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import {
  recordSyncInvoiceEvent,
  recordSyncShiftEvent,
  recordSyncCashTxnEvent,
  recordSyncAuditEvent,
} from "@/server/sync";

describe("Sync Events Transaction Atomicity & Idempotency", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  const randNum = () => Math.floor(1000000 + Math.random() * 9000000);
  const createdKeys: string[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });
  });

  afterAll(async () => {
    if (db && createdKeys.length > 0) {
      await db.delete(schema.outbox).where(inArray(schema.outbox.idempotencyKey, createdKeys));
    }
    await pool.end();
  });

  it("proves rollback in transaction discards outbox event, and commit persists it", async () => {
    const rollbackOrderId = randNum();
    const rollbackKey = `sync_invoice_${rollbackOrderId}_v1`;
    createdKeys.push(rollbackKey);

    // 1. Transaction that rolls back -> no outbox item created
    await expect(
      db.transaction(async (tx) => {
        await recordSyncInvoiceEvent(
          {
            orderId: rollbackOrderId,
            orderCode: `HD_RB_${rollbackOrderId}`,
            orderType: "MANG_VE",
            status: "DA_THANH_TOAN",
            totalAmount: 50000,
            discountAmount: 0,
            finalAmount: 50000,
            paymentMethod: "TIEN_MAT",
            paidAt: new Date().toISOString(),
            voidedAt: null,
            voidReason: null,
            queueNumber: 1,
            shiftId: 1,
            version: 1,
          },
          tx as any,
        );
        throw new Error("Simulated business error rollback");
      }),
    ).rejects.toThrow("Simulated business error rollback");

    const rollbackRows = await db.select().from(schema.outbox).where(eq(schema.outbox.idempotencyKey, rollbackKey));
    expect(rollbackRows.length).toBe(0);

    // 2. Transaction that commits -> outbox item persists
    const commitOrderId = randNum();
    const commitKey = `sync_invoice_${commitOrderId}_v1`;
    createdKeys.push(commitKey);

    await db.transaction(async (tx) => {
      await recordSyncInvoiceEvent(
        {
          orderId: commitOrderId,
          orderCode: `HD_CM_${commitOrderId}`,
          orderType: "MANG_VE",
          status: "DA_THANH_TOAN",
          totalAmount: 70000,
          discountAmount: 0,
          finalAmount: 70000,
          paymentMethod: "TIEN_MAT",
          paidAt: new Date().toISOString(),
          voidedAt: null,
          voidReason: null,
          queueNumber: 2,
          shiftId: 1,
          version: 1,
        },
        tx as any,
      );
    });

    const commitRows = await db.select().from(schema.outbox).where(eq(schema.outbox.idempotencyKey, commitKey));
    expect(commitRows.length).toBe(1);
    expect(commitRows[0].status).toBe("PENDING");
  });

  it("proves duplicate idempotencyKey is ignored (onConflictDoNothing)", async () => {
    const orderId = randNum();
    const key = `sync_invoice_${orderId}_v1`;
    createdKeys.push(key);

    const payload = {
      orderId,
      orderCode: `HD_DUP_${orderId}`,
      orderType: "MANG_VE" as const,
      status: "DA_THANH_TOAN" as const,
      totalAmount: 60000,
      discountAmount: 0,
      finalAmount: 60000,
      paymentMethod: "TIEN_MAT" as const,
      paidAt: new Date().toISOString(),
      voidedAt: null,
      voidReason: null,
      queueNumber: 3,
      shiftId: 1,
      version: 1,
    };

    const first = await recordSyncInvoiceEvent(payload, db as any);
    expect(first).not.toBeNull();
    const second = await recordSyncInvoiceEvent(payload, db as any);
    expect(second).toBeNull();

    const rows = await db.select().from(schema.outbox).where(eq(schema.outbox.idempotencyKey, key));
    expect(rows.length).toBe(1);
  });

  it("enqueues SYNC_SHIFT, SYNC_CASH_TXN, and SYNC_AUDIT with expected fields", async () => {
    const shiftId = randNum();
    const cashEntryId = randNum();
    const auditId = randNum();
    const shiftKey = `sync_shift_${shiftId}_DANG_MO`;
    const cashKey = `sync_cash_txn_${cashEntryId}`;
    const auditKey = `sync_audit_${auditId}`;
    createdKeys.push(shiftKey, cashKey, auditKey);

    const shiftRes = await recordSyncShiftEvent(
      {
        shiftId,
        shiftCode: `CA_${shiftId}`,
        cashierId: 10,
        initialCash: 100000,
        actualCash: null,
        expectedCash: 100000,
        difference: null,
        explanation: null,
        status: "DANG_MO",
        openedAt: new Date().toISOString(),
        closedAt: null,
        approvedById: null,
      },
      db as any,
    );
    expect(shiftRes?.type).toBe("SYNC_SHIFT");
    expect(shiftRes?.idempotencyKey).toBe(shiftKey);

    const cashRes = await recordSyncCashTxnEvent(
      { id: cashEntryId, shiftId, entryType: "THU", amount: 25000, reason: "Thu tiền đổi", performedBy: 10, createdAt: new Date().toISOString() },
      db as any,
    );
    expect(cashRes?.type).toBe("SYNC_CASH_TXN");
    expect(cashRes?.idempotencyKey).toBe(cashKey);

    const auditRes = await recordSyncAuditEvent(
      { id: auditId, userId: 10, action: "TEST_ACTION", entityType: "ORDER", entityId: "123", reason: "Testing audit", metadata: { tag: "test" }, ipAddress: "127.0.0.1", createdAt: new Date().toISOString() },
      db as any,
    );
    expect(auditRes?.type).toBe("SYNC_AUDIT");
    expect(auditRes?.idempotencyKey).toBe(auditKey);
  });
});
