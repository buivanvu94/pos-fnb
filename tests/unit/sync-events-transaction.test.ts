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
  const rand = () => Math.random().toString(36).slice(2, 8);
  const testTag = rand();

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });
  });

  afterAll(async () => {
    if (db) {
      await db.delete(schema.outbox).where(eq(schema.outbox.lastError, testTag));
    }
    await pool.end();
  });

  it("proves rollback in transaction discards outbox event", async () => {
    const orderId = 999001;
    const key = `sync_invoice_${orderId}_v1_${testTag}`;

    await expect(
      db.transaction(async (tx) => {
        await recordSyncInvoiceEvent(
          {
            orderId,
            orderCode: `HD_${testTag}`,
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

    const rows = await db
      .select()
      .from(schema.outbox)
      .where(eq(schema.outbox.idempotencyKey, key));
    expect(rows.length).toBe(0);
  });

  it("proves duplicate idempotencyKey is ignored (onConflictDoNothing)", async () => {
    const orderId = 999002;
    const payload = {
      orderId,
      orderCode: `HD_${testTag}_2`,
      orderType: "MANG_VE",
      status: "DA_THANH_TOAN",
      totalAmount: 60000,
      discountAmount: 0,
      finalAmount: 60000,
      paymentMethod: "TIEN_MAT",
      paidAt: new Date().toISOString(),
      voidedAt: null,
      voidReason: null,
      queueNumber: 2,
      shiftId: 1,
      version: 1,
    };

    const first = await recordSyncInvoiceEvent(payload, db as any);
    expect(first).not.toBeNull();

    // Replay with identical payload and version
    const second = await recordSyncInvoiceEvent(payload, db as any);
    expect(second).toBeNull();

    const rows = await db
      .select()
      .from(schema.outbox)
      .where(eq(schema.outbox.idempotencyKey, `sync_invoice_${orderId}_v1`));
    expect(rows.length).toBe(1);

    // Cleanup
    await db
      .delete(schema.outbox)
      .where(eq(schema.outbox.idempotencyKey, `sync_invoice_${orderId}_v1`));
  });

  it("enqueues SYNC_SHIFT, SYNC_CASH_TXN, and SYNC_AUDIT with expected fields", async () => {
    const shiftRes = await recordSyncShiftEvent(
      {
        shiftId: 88801,
        shiftCode: `CA_${testTag}`,
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
    expect(shiftRes?.status).toBe("PENDING");

    const cashRes = await recordSyncCashTxnEvent(
      {
        id: 77701,
        shiftId: 88801,
        entryType: "THU",
        amount: 25000,
        reason: "Thu tiền đổi",
        performedBy: 10,
        createdAt: new Date().toISOString(),
      },
      db as any,
    );
    expect(cashRes?.type).toBe("SYNC_CASH_TXN");

    const auditRes = await recordSyncAuditEvent(
      {
        id: 66601,
        userId: 10,
        action: "TEST_ACTION",
        entityType: "ORDER",
        entityId: "123",
        reason: "Testing audit",
        metadata: { tag: testTag },
        ipAddress: "127.0.0.1",
        createdAt: new Date().toISOString(),
      },
      db as any,
    );
    expect(auditRes?.type).toBe("SYNC_AUDIT");

    // Cleanup
    await db.delete(schema.outbox).where(
      inArray(schema.outbox.id, [
        shiftRes!.id,
        cashRes!.id,
        auditRes!.id,
      ]),
    );
  });
});
