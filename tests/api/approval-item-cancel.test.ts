import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { POST as modifyOrderItemsHandler } from "@/app/api/v1/orders/[id]/items/route";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { ERROR_CATALOG } from "@/lib/error-catalog";
import { setPinRequired, isPinRequired } from "@/server/approvals/approval-settings-service";
import { getTestDbUrl } from "../setup/test-config";
import { generateSafeTestPin, clearManagerPinHash } from "../helpers/test-pin-helper";

describe("Cancel/Reduce Order Items API with Manager Approval (AC-06-1, AC-06-2, BR-03, FR-10)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const rand = () => Math.random().toString(36).slice(2, 10);
  const tag = rand();

  let managerId: number;
  let managerToken: string;
  let waiterId: number;
  let waiterToken: string;
  let cashierId: number;
  let cashierToken: string;

  let areaId: number;
  let shiftId: number;
  let categoryId: number;
  let kitchenItemId: number;
  let barItemId: number;
  let initialPinRequired: boolean;

  const CORRECT_PIN = generateSafeTestPin();
  const WRONG_PIN = "0000";

  async function createTestOrder(totalAmount = 50000) {
    const [table] = await db
      .insert(schema.tables)
      .values({ code: `T_${rand()}`, name: `Bàn_${rand()}`, areaId, capacity: 4, status: "DANG_DUNG" })
      .returning();

    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_${rand()}`,
        tableId: table.id,
        shiftId,
        totalAmount,
        finalAmount: totalAmount,
        status: "DANG_PHUC_VU",
        version: 1,
      })
      .returning();

    return { table, order };
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    initialPinRequired = await isPinRequired();
    const pinHash = await bcrypt.hash(CORRECT_PIN, 10);

    const [manager] = await db
      .insert(schema.users)
      .values({
        username: `mgr_canc_${tag}`,
        fullName: "Quản Lý Test Hủy Món",
        role: "QUAN_LY",
        passwordHash: "dummy",
        pinHash,
      })
      .returning();
    managerId = manager.id;
    managerToken = await signAuthToken({
      userId: manager.id,
      username: manager.username,
      fullName: manager.fullName,
      role: "QUAN_LY",
    });

    const [cashier] = await db
      .insert(schema.users)
      .values({
        username: `csh_canc_${tag}`,
        fullName: "Thu Ngân Test Hủy Món",
        role: "THU_NGAN",
        passwordHash: "dummy",
      })
      .returning();
    cashierId = cashier.id;
    cashierToken = await signAuthToken({
      userId: cashier.id,
      username: cashier.username,
      fullName: cashier.fullName,
      role: "THU_NGAN",
    });

    const [waiter] = await db
      .insert(schema.users)
      .values({
        username: `wtr_canc_${tag}`,
        fullName: "Phục Vụ Test Hủy Món",
        role: "PHUC_VU",
        passwordHash: "dummy",
      })
      .returning();
    waiterId = waiter.id;
    waiterToken = await signAuthToken({
      userId: waiter.id,
      username: waiter.username,
      fullName: waiter.fullName,
      role: "PHUC_VU",
    });

    const [area] = await db.insert(schema.areas).values({ code: `A_M_${tag}`, name: `Area M ${tag}` }).returning();
    areaId = area.id;

    const [shift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_M_${tag}`,
        cashierId: cashier.id,
        initialCash: 1000000,
        expectedCash: 1000000,
        status: "DANG_MO",
      })
      .returning();
    shiftId = shift.id;

    const [cat] = await db
      .insert(schema.categories)
      .values({ code: `CAT_M_${tag}`, name: `Cat M ${tag}` })
      .returning();
    categoryId = cat.id;

    const [kItem] = await db
      .insert(schema.menuItems)
      .values({
        code: `MON_K_${tag}`,
        categoryId: cat.id,
        name: "Cơm chiên dưa bò",
        price: 50000,
        targetPrinter: "KITCHEN",
      })
      .returning();
    kitchenItemId = kItem.id;

    const [bItem] = await db
      .insert(schema.menuItems)
      .values({
        code: `MON_B_${tag}`,
        categoryId: cat.id,
        name: "Trà đào cam sả",
        price: 35000,
        targetPrinter: "BAR",
      })
      .returning();
    barItemId = bItem.id;
  });

  afterAll(async () => {
    await setPinRequired(initialPinRequired);

    if (db) {
      await clearManagerPinHash(db, managerId);
      await db.delete(schema.orderItems).where(eq(schema.orderItems.menuItemId, kitchenItemId));
      await db.delete(schema.orderItems).where(eq(schema.orderItems.menuItemId, barItemId));
      await db.delete(schema.orders).where(eq(schema.orders.shiftId, shiftId));
      await db.delete(schema.menuItems).where(eq(schema.menuItems.categoryId, categoryId));
      await db.delete(schema.categories).where(eq(schema.categories.id, categoryId));
      await db.delete(schema.tables).where(eq(schema.tables.areaId, areaId));
      await db.delete(schema.areas).where(eq(schema.areas.id, areaId));
      await db.delete(schema.shifts).where(eq(schema.shifts.id, shiftId));
      await db.delete(schema.printJobs).where(inArray(schema.printJobs.jobType, ["KOT_KITCHEN", "KOT_BAR"]));
      await db.delete(schema.auditLogs).where(eq(schema.auditLogs.userId, waiterId));
      await db.delete(schema.auditLogs).where(eq(schema.auditLogs.userId, cashierId));
      await db.delete(schema.auditLogs).where(eq(schema.auditLogs.userId, managerId));
      await db.delete(schema.users).where(eq(schema.users.id, waiterId));
      await db.delete(schema.users).where(eq(schema.users.id, cashierId));
      await db.delete(schema.users).where(eq(schema.users.id, managerId));
    }
    await pool.end();
  });

  it("AC-06-1: cancels printed kitchen item with THU_NGAN + valid Manager PIN, enqueues KOT_CANCEL with approverName, and recalculates total", async () => {
    const { order } = await createTestOrder(50000);

    const [item] = await db
      .insert(schema.orderItems)
      .values({
        orderId: order.id,
        menuItemId: kitchenItemId,
        quantity: 1,
        unitPrice: 50000,
        isPrintedKitchen: true,
        sentAt: new Date(),
      })
      .returning();

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        action: "delete",
        orderItemId: item.id,
        expectedVersion: 1,
        pinCode: CORRECT_PIN,
        lyDo: "Khách đổi ý muốn hủy món cơm",
      }),
    });

    const res = await modifyOrderItemsHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.totalAmount).toBe(0);

    const [updatedItem] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, item.id));
    expect(updatedItem.isCancelled).toBe(true);
    expect(updatedItem.cancelReason).toBe("Khách đổi ý muốn hủy món cơm");

    const printJobs = await db
      .select()
      .from(schema.printJobs)
      .where(and(eq(schema.printJobs.orderId, order.id), eq(schema.printJobs.jobType, "KOT_KITCHEN")));
    expect(printJobs.length).toBeGreaterThanOrEqual(1);

    const latestJob = printJobs[printJobs.length - 1];
    const payload = JSON.parse(latestJob.payload);
    expect(payload.kind).toBe("KOT_CANCEL");
    expect(payload.approverName).toBe("Quản Lý Test Hủy Món");
  });

  it("AC-06-2: rejects cancellation of printed item when PIN is wrong (403 ERR-02)", async () => {
    const { order } = await createTestOrder(50000);

    const [item] = await db
      .insert(schema.orderItems)
      .values({
        orderId: order.id,
        menuItemId: kitchenItemId,
        quantity: 1,
        unitPrice: 50000,
        isPrintedKitchen: true,
        sentAt: new Date(),
      })
      .returning();

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        action: "delete",
        orderItemId: item.id,
        expectedVersion: 1,
        pinCode: WRONG_PIN,
        lyDo: "Khách phàn nàn món nguội",
      }),
    });

    const res = await modifyOrderItemsHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe(ERROR_CATALOG.ERR_02.message);
  });

  it("allows deleting unprinted items and records REMOVE_UNSENT_ITEM in audit log", async () => {
    const { order } = await createTestOrder(50000);

    const [unprintedItem] = await db
      .insert(schema.orderItems)
      .values({
        orderId: order.id,
        menuItemId: kitchenItemId,
        quantity: 1,
        unitPrice: 50000,
        isPrintedKitchen: false,
      })
      .returning();

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
      },
      body: JSON.stringify({
        action: "delete",
        orderItemId: unprintedItem.id,
        expectedVersion: 1,
      }),
    });

    const res = await modifyOrderItemsHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(200);

    const deleted = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, unprintedItem.id));
    expect(deleted.length).toBe(0);

    // Verify REMOVE_UNSENT_ITEM audit log
    const [audit] = await db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.action, "REMOVE_UNSENT_ITEM"), eq(schema.auditLogs.entityId, String(unprintedItem.id))));
    expect(audit).toBeDefined();
    expect(audit.reason).toContain("Xóa món chưa gửi bếp");
  });

  it("rejects cancel kitchen item when reason is under 5 chars with 400 Bad Request", async () => {
    const { order } = await createTestOrder(50000);

    const [item] = await db
      .insert(schema.orderItems)
      .values({
        orderId: order.id,
        menuItemId: kitchenItemId,
        quantity: 1,
        unitPrice: 50000,
        isPrintedKitchen: true,
      })
      .returning();

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        action: "delete",
        orderItemId: item.id,
        expectedVersion: 1,
        pinCode: CORRECT_PIN,
        lyDo: "Huy", // Only 3 chars
      }),
    });

    const res = await modifyOrderItemsHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("tối thiểu 5 ký tự");
  });

  it("when approval.pinRequired is false, printed item cancellation succeeds without PIN", async () => {
    await setPinRequired(false);

    const { order } = await createTestOrder(50000);

    const [item] = await db
      .insert(schema.orderItems)
      .values({
        orderId: order.id,
        menuItemId: kitchenItemId,
        quantity: 1,
        unitPrice: 50000,
        isPrintedKitchen: true,
      })
      .returning();

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        action: "delete",
        orderItemId: item.id,
        expectedVersion: 1,
        lyDo: "Hủy món khi đã tắt yêu cầu PIN",
      }),
    });

    const res = await modifyOrderItemsHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(200);

    const [updatedItem] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, item.id));
    expect(updatedItem.isCancelled).toBe(true);

    await setPinRequired(true);
  });

  it("handles 12 concurrent item cancel requests without connection pool exhaustion", async () => {
    // Create 12 separate orders with 1 printed item each
    const orderPromises = Array.from({ length: 12 }).map(async () => {
      const { order } = await createTestOrder(50000);
      const [item] = await db
        .insert(schema.orderItems)
        .values({
          orderId: order.id,
          menuItemId: kitchenItemId,
          quantity: 1,
          unitPrice: 50000,
          isPrintedKitchen: true,
        })
        .returning();
      return { order, item };
    });

    const ordersWithItems = await Promise.all(orderPromises);

    // Fire all 12 requests simultaneously
    const cancelRequests = ordersWithItems.map(({ order, item }) =>
      modifyOrderItemsHandler(
        new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/items`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
          },
          body: JSON.stringify({
            action: "delete",
            orderItemId: item.id,
            expectedVersion: 1,
            pinCode: CORRECT_PIN,
            lyDo: "Hủy đồng thời 12 món kiểm tra pool",
          }),
        }),
        { params: Promise.resolve({ id: String(order.id) }) },
      ),
    );

    const responses = await Promise.all(cancelRequests);
    for (const res of responses) {
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    }
  }, 60000);

  it("Item 2: returns HTTP 409 (not 500) when item is marked as printed to kitchen between precheck and transaction", async () => {
    const { order } = await createTestOrder(50000);
    const [item] = await db
      .insert(schema.orderItems)
      .values({
        orderId: order.id,
        menuItemId: kitchenItemId,
        quantity: 1,
        unitPrice: 50000,
        isPrintedKitchen: false,
      })
      .returning();

    const realDb = getDb();
    const originalTx = realDb.transaction.bind(realDb);
    const txSpy = vi.spyOn(realDb, "transaction").mockImplementationOnce(async (cb, config) => {
      await db.update(schema.orderItems).set({ isPrintedKitchen: true }).where(eq(schema.orderItems.id, item.id));
      return originalTx(cb, config);
    });

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
      },
      body: JSON.stringify({
        action: "delete",
        orderItemId: item.id,
        expectedVersion: 1,
      }),
    });

    const res = await modifyOrderItemsHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Món đã được gửi bếp trong quá trình xử lý");
    txSpy.mockRestore();
  });

  it("PHUC_VU role successfully cancels printed kitchen item with valid Manager PIN and reason >= 5 chars (SRS 2.5)", async () => {
    const { order } = await createTestOrder(50000);
    const [item] = await db
      .insert(schema.orderItems)
      .values({
        orderId: order.id,
        menuItemId: kitchenItemId,
        quantity: 1,
        unitPrice: 50000,
        isPrintedKitchen: true,
      })
      .returning();

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
      },
      body: JSON.stringify({
        action: "delete",
        orderItemId: item.id,
        expectedVersion: 1,
        pinCode: CORRECT_PIN,
        lyDo: "Phục vụ hủy món có PIN Quản lý duyệt",
      }),
    });

    const res = await modifyOrderItemsHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const [updatedItem] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, item.id));
    expect(updatedItem.isCancelled).toBe(true);

    // Verify KOT_CANCEL enqueued with approverName
    const printJobs = await db
      .select()
      .from(schema.printJobs)
      .where(and(eq(schema.printJobs.orderId, order.id), eq(schema.printJobs.jobType, "KOT_KITCHEN")));
    expect(printJobs.length).toBeGreaterThanOrEqual(1);
    const latestJob = printJobs[printJobs.length - 1];
    const payload = JSON.parse(latestJob.payload);
    expect(payload.kind).toBe("KOT_CANCEL");
    expect(payload.approverName).toBe("Quản Lý Test Hủy Món");

    // Verify audit log has waiter as user and manager as approver
    const [audit] = await db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.action, "CANCEL_ITEM"), eq(schema.auditLogs.entityId, String(item.id))));
    expect(audit).toBeDefined();
    expect(audit.userId).toBe(waiterId);
    const meta = JSON.parse(audit.metadata!);
    expect(meta.approverId).toBe(managerId);
  });

  it("PHUC_VU role fails to cancel printed kitchen item with wrong PIN (403 ERR-02) and data unchanged", async () => {
    const { order } = await createTestOrder(50000);
    const [item] = await db
      .insert(schema.orderItems)
      .values({
        orderId: order.id,
        menuItemId: kitchenItemId,
        quantity: 1,
        unitPrice: 50000,
        isPrintedKitchen: true,
      })
      .returning();

    const req = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
      },
      body: JSON.stringify({
        action: "delete",
        orderItemId: item.id,
        expectedVersion: 1,
        pinCode: WRONG_PIN,
        lyDo: "Phục vụ thử sai PIN hủy món",
      }),
    });

    const res = await modifyOrderItemsHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe(ERROR_CATALOG.ERR_02.message);

    const [unchangedItem] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, item.id));
    expect(unchangedItem.isCancelled).toBe(false);
  });

  it("Item 3c: never leaks PIN in response body, stdout, stderr, or console logs for valid or invalid PIN", async () => {
    const logSpy = vi.spyOn(console, "log");
    const errorSpy = vi.spyOn(console, "error");
    const warnSpy = vi.spyOn(console, "warn");
    const infoSpy = vi.spyOn(console, "info");

    const { order } = await createTestOrder(50000);
    const [item] = await db
      .insert(schema.orderItems)
      .values({
        orderId: order.id,
        menuItemId: kitchenItemId,
        quantity: 1,
        unitPrice: 50000,
        isPrintedKitchen: true,
      })
      .returning();

    const reqWrong = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
      body: JSON.stringify({
        action: "delete",
        orderItemId: item.id,
        expectedVersion: 1,
        pinCode: WRONG_PIN,
        lyDo: "Thử sai mã PIN bảo mật",
      }),
    });
    const resWrong = await modifyOrderItemsHandler(reqWrong, { params: Promise.resolve({ id: String(order.id) }) });
    const wrongText = await resWrong.text();
    expect(wrongText).not.toContain(WRONG_PIN);

    const reqCorrect = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
      body: JSON.stringify({
        action: "delete",
        orderItemId: item.id,
        expectedVersion: 1,
        pinCode: CORRECT_PIN,
        lyDo: "Hủy món với mã PIN đúng",
      }),
    });
    const resCorrect = await modifyOrderItemsHandler(reqCorrect, { params: Promise.resolve({ id: String(order.id) }) });
    const correctText = await resCorrect.text();
    expect(correctText).not.toContain(CORRECT_PIN);

    for (const spy of [logSpy, errorSpy, warnSpy, infoSpy]) {
      for (const call of spy.mock.calls) {
        const str = JSON.stringify(call);
        expect(str).not.toContain(CORRECT_PIN);
        expect(str).not.toContain(WRONG_PIN);
      }
      spy.mockRestore();
    }
  });
});


