import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { generateSafeTestPin, clearManagerPinHash } from "../helpers/test-pin-helper";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { POST as approveShiftHandler } from "@/app/api/v1/shifts/approve/route";
import { POST as closeShiftHandler } from "@/app/api/v1/shifts/close/route";
import { payOrderCash } from "@/server/payments/cash-payment-service";
import { voidPaidBill } from "@/server/payments/void-bill-service";

describe("Phase 09 Concurrency & Hardening Tests (Round 2)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let cashierUserId: number;
  let cashierToken: string;
  let managerUserId: number;
  let managerToken: string;
  const managerPin = generateSafeTestPin();

  const rand = () => Math.random().toString(36).slice(2, 8);

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const pinHash = await bcrypt.hash(managerPin, 10);
    const [manager] = await db
      .insert(schema.users)
      .values({ username: `mgr_c_${rand()}`, fullName: "Quản Lý Test", role: "QUAN_LY", passwordHash: "dummy", pinHash })
      .returning();
    managerUserId = manager.id;
    managerToken = await signAuthToken({ userId: manager.id, username: manager.username, fullName: manager.fullName, role: "QUAN_LY" });

    const [cashier] = await db
      .insert(schema.users)
      .values({ username: `csh_c_${rand()}`, fullName: "Thu Ngân Test", role: "THU_NGAN", passwordHash: "dummy" })
      .returning();
    cashierUserId = cashier.id;
    cashierToken = await signAuthToken({ userId: cashier.id, username: cashier.username, fullName: cashier.fullName, role: "THU_NGAN" });
  });

  afterAll(async () => {
    if (db) {
      await clearManagerPinHash(db, managerUserId);
    }
    await pool.end();
  });

  it("handles concurrent closeShift and payOrderCash without deadlock", async () => {
    const [shift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_RACECASH_${rand()}`,
        cashierId: cashierUserId,
        initialCash: 1_000_000,
        status: "DANG_MO",
      })
      .returning();

    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_RACE_${rand()}`,
        orderType: "MANG_VE",
        shiftId: shift.id,
        totalAmount: 100_000,
        finalAmount: 100_000,
        status: "DANG_PHUC_VU",
        version: 1,
      })
      .returning();

    const [cat] = await db
      .insert(schema.categories)
      .values({ code: `CAT_${rand()}`, name: "Cat" })
      .returning();
    const [mItem] = await db
      .insert(schema.menuItems)
      .values({ code: `MI_${rand()}`, categoryId: cat.id, name: `Item ${rand()}`, price: 100_000 })
      .returning();
    await db.insert(schema.orderItems).values({
      orderId: order.id,
      menuItemId: mItem.id,
      quantity: 1,
      unitPrice: 100_000,
      isCancelled: false,
    });

    const runPay = () =>
      payOrderCash({
        orderId: order.id,
        tienKhachDua: 100_000,
        expectedVersion: 1,
        user: { userId: cashierUserId, username: "csh", fullName: "Thu Ngan", role: "THU_NGAN" },
        shift,
      });

    const runClose = () =>
      closeShiftHandler(
        new NextRequest("http://localhost:3000/api/v1/shifts/close", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}` },
          body: JSON.stringify({ shiftId: shift.id, tienThucDem: 1_000_000, giaiTrinh: "Khop hoac lech" }),
        }),
      );

    const [payRes, closeRes] = await Promise.all([runPay(), runClose()]);

    // Neither call should throw an unhandled deadlock error (deadlock detected = 40P01)
    expect(payRes).toBeDefined();
    expect(closeRes).toBeDefined();

    const closeBody = await closeRes.json();
    // One of the valid operational outcomes must happen:
    // 1) Payment succeeded first (200), shift closed after (200) or closed before.
    // 2) Shift closed first (200), payment got 409 because shift is no longer DANG_MO.
    expect([200, 409]).toContain(payRes.status);
    expect([200, 409, 422]).toContain(closeRes.status);
  });

  it("blocks voidPaidBill with 409 when order shift is in CHO_DUYET status", async () => {
    const [shift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_VOID_${rand()}`,
        cashierId: cashierUserId,
        initialCash: 1_000_000,
        status: "CHO_DUYET",
      })
      .returning();

    const [order] = await db
      .insert(schema.orders)
      .values({
        orderCode: `HD_VOID_${rand()}`,
        orderType: "MANG_VE",
        shiftId: shift.id,
        totalAmount: 80_000,
        finalAmount: 80_000,
        status: "DA_THANH_TOAN",
        paidAt: new Date(),
        version: 2,
      })
      .returning();

    await db.insert(schema.payments).values({
      orderId: order.id,
      shiftId: shift.id,
      paymentMethod: "TIEN_MAT",
      amount: 80_000,
      status: "SUCCESS",
    });

    const result = await voidPaidBill({
      orderId: order.id,
      expectedVersion: 2,
      lyDo: "Khách trả nhầm món cần hủy",
      pinCode: managerPin,
      user: { userId: cashierUserId, username: "csh", fullName: "Thu Ngan", role: "THU_NGAN" },
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.error).toContain("Không thể hủy hóa đơn vì ca làm việc của hóa đơn này đã đóng");

    const [refreshedOrder] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
    expect(refreshedOrder.status).toBe("DA_THANH_TOAN");
  });

  it("rejects shift approval when lyDo exceeds 255 characters with 400", async () => {
    const [shift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_LONG_${rand()}`,
        cashierId: cashierUserId,
        initialCash: 500_000,
        expectedCash: 500_000,
        actualCash: 500_000,
        difference: 0,
        status: "CHO_DUYET",
      })
      .returning();

    const req = new NextRequest("http://localhost:3000/api/v1/shifts/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `${AUTH_COOKIE_NAME}=${managerToken}` },
      body: JSON.stringify({ shiftId: shift.id, pin: managerPin, lyDo: "x".repeat(256) }),
    });

    const res = await approveShiftHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Lý do phê duyệt không được vượt quá 255 ký tự");
  });
});
