import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "@/db/schema";
import { POST as modifyOrderItemsHandler } from "@/app/api/v1/orders/[id]/items/route";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { ERROR_CATALOG } from "@/lib/error-catalog";
import { getTestDbUrl } from "../setup/test-config";

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

  const CORRECT_PIN = "9876";
  const WRONG_PIN = "1111";

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

    const pinHash = await bcrypt.hash(CORRECT_PIN, 10);

    const [manager] = await db
      .insert(schema.users)
      .values({
        username: `mgr_itmc_${tag}`,
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
        username: `csh_itmc_${tag}`,
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
        username: `wtr_itmc_${tag}`,
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

    const [area] = await db.insert(schema.areas).values({ code: `A_${tag}`, name: `Area_${tag}` }).returning();
    areaId = area.id;

    const [shift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_${tag}`,
        cashierId: cashier.id,
        initialCash: 1000000,
        expectedCash: 1000000,
        status: "DANG_MO",
      })
      .returning();
    shiftId = shift.id;

    const [cat] = await db
      .insert(schema.categories)
      .values({ code: `CAT_${tag}`, name: `Cat ${tag}` })
      .returning();
    categoryId = cat.id;

    const [kitchenItem] = await db
      .insert(schema.menuItems)
      .values({
        code: `MON_K_${tag}`,
        categoryId: cat.id,
        name: "Cơm gà xối mỡ",
        price: 50000,
        targetPrinter: "KITCHEN",
      })
      .returning();
    kitchenItemId = kitchenItem.id;

    const [barItem] = await db
      .insert(schema.menuItems)
      .values({
        code: `MON_B_${tag}`,
        categoryId: cat.id,
        name: "Trà đào cam sả",
        price: 35000,
        targetPrinter: "BAR",
      })
      .returning();
    barItemId = barItem.id;
  });

  afterAll(async () => {
    if (db) {
      await db.delete(schema.printJobs).where(sqlActiveOrders());
      await db.delete(schema.orderItems).where(eq(schema.orderItems.menuItemId, kitchenItemId));
      await db.delete(schema.orderItems).where(eq(schema.orderItems.menuItemId, barItemId));
      await db.delete(schema.orders).where(eq(schema.orders.shiftId, shiftId));
      await db.delete(schema.menuItems).where(eq(schema.menuItems.categoryId, categoryId));
      await db.delete(schema.categories).where(eq(schema.categories.id, categoryId));
      await db.delete(schema.tables).where(eq(schema.tables.areaId, areaId));
      await db.delete(schema.areas).where(eq(schema.areas.id, areaId));
      await db.delete(schema.shifts).where(eq(schema.shifts.id, shiftId));
      await db.delete(schema.auditLogs).where(eq(schema.auditLogs.userId, waiterId));
      await db.delete(schema.auditLogs).where(eq(schema.auditLogs.userId, cashierId));
      await db.delete(schema.auditLogs).where(eq(schema.auditLogs.userId, managerId));
      await db.delete(schema.users).where(eq(schema.users.id, waiterId));
      await db.delete(schema.users).where(eq(schema.users.id, cashierId));
      await db.delete(schema.users).where(eq(schema.users.id, managerId));
    }
    await pool.end();
  });

  function sqlActiveOrders() {
    return eq(schema.printJobs.status, "PENDING");
  }

  it("AC-06-1: cancels kitchen-printed item with valid PIN, recalculates total, enqueues KOT_CANCEL job, records audit", async () => {
    const { table, order } = await createTestOrder(35000);

    const [item] = await db
      .insert(schema.orderItems)
      .values({
        orderId: order.id,
        menuItemId: barItemId,
        quantity: 1,
        unitPrice: 35000,
        isPrintedKitchen: true,
        sentAt: new Date(),
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
        lyDo: "Khách đổi món sang trà sữa",
      }),
    });

    const res = await modifyOrderItemsHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.totalAmount).toBe(0);
    expect(body.data.finalAmount).toBe(0);

    const [updatedItem] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, item.id));
    expect(updatedItem.isCancelled).toBe(true);
    expect(updatedItem.cancelReason).toBe("Khách đổi món sang trà sữa");
    expect(updatedItem.cancelledById).toBe(waiterId);

    const printJobs = await db
      .select()
      .from(schema.printJobs)
      .where(and(eq(schema.printJobs.orderId, order.id), eq(schema.printJobs.jobType, "KOT_BAR")));
    expect(printJobs.length).toBeGreaterThanOrEqual(1);

    const latestJob = printJobs[printJobs.length - 1];
    expect(latestJob.targetPrinter).toBe("BAR");
    const payload = JSON.parse(latestJob.payload);
    expect(payload.kind).toBe("KOT_CANCEL");
    expect(payload.reason).toBe("Khách đổi món sang trà sữa");
    expect(payload.items[0].name).toBe("Trà đào cam sả");

    const auditEntries = await db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.action, "CANCEL_ITEM"), eq(schema.auditLogs.entityId, String(item.id))));
    expect(auditEntries.length).toBe(1);
    expect(auditEntries[0].reason).toBe("Khách đổi món sang trà sữa");
    const meta = JSON.parse(auditEntries[0].metadata!);
    expect(meta.approverId).toBe(managerId);
  });

  it("AC-06-2: rejects cancellation of printed item when PIN is wrong (403 ERR-02), leaves data unchanged", async () => {
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
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
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

    const [unchangedItem] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, item.id));
    expect(unchangedItem.isCancelled).toBe(false);

    const [unchangedOrder] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
    expect(unchangedOrder.totalAmount).toBe(50000);
  });

  it("allows deleting unprinted items without requiring PIN or reason", async () => {
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
  });

  it("allows QUAN_LY to cancel printed item without PIN, but reason >= 5 chars is mandatory", async () => {
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

    // 1. Manager with reason < 5 chars is rejected (400)
    const reqInvalid = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
      },
      body: JSON.stringify({
        action: "delete",
        orderItemId: item.id,
        expectedVersion: 1,
        lyDo: "Huy", // < 5 chars
      }),
    });
    const resInvalid = await modifyOrderItemsHandler(reqInvalid, { params: Promise.resolve({ id: String(order.id) }) });
    expect(resInvalid.status).toBe(400);

    // 2. Manager without PIN but with reason >= 5 chars succeeds
    const reqValid = new NextRequest(`http://localhost:3000/api/v1/orders/${order.id}/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
      },
      body: JSON.stringify({
        action: "delete",
        orderItemId: item.id,
        expectedVersion: 1,
        lyDo: "Quản lý trực tiếp hủy theo yêu cầu khách",
      }),
    });
    const resValid = await modifyOrderItemsHandler(reqValid, { params: Promise.resolve({ id: String(order.id) }) });
    expect(resValid.status).toBe(200);

    const [cancelledItem] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, item.id));
    expect(cancelledItem.isCancelled).toBe(true);
    expect(cancelledItem.cancelledById).toBe(managerId);
  });

  it("reduces quantity of printed item (3 -> 1) with PIN: enqueues KOT_CANCEL for 2, updates total and logs REDUCE_ITEM", async () => {
    const { order } = await createTestOrder(150000);

    const [item] = await db
      .insert(schema.orderItems)
      .values({
        orderId: order.id,
        menuItemId: kitchenItemId,
        quantity: 3,
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
        action: "update",
        orderItemId: item.id,
        quantity: 1,
        expectedVersion: 1,
        pinCode: CORRECT_PIN,
        lyDo: "Khách báo ăn không hết xin giảm 2 phần",
      }),
    });

    const res = await modifyOrderItemsHandler(req, { params: Promise.resolve({ id: String(order.id) }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.totalAmount).toBe(50000);

    const [reducedItem] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, item.id));
    expect(reducedItem.quantity).toBe(1);
    expect(reducedItem.isCancelled).toBe(false);

    const auditEntries = await db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.action, "REDUCE_ITEM"), eq(schema.auditLogs.entityId, String(item.id))));
    expect(auditEntries.length).toBe(1);
    const meta = JSON.parse(auditEntries[0].metadata!);
    expect(meta.quantityCancelled).toBe(2);
    expect(meta.remainingQuantity).toBe(1);
  });
});
