import { test, expect, type APIRequestContext } from "@playwright/test";
import { createOrderWithItems, getE2eContext, getOrder, json, loginAs, openShift, payCash } from "./e2e-helpers";

/**
 * Kịch bản lỗi: mất Internet (đích đồng bộ không với tới), máy in không kết nối,
 * F5 giữa chừng (lặp lệnh), hai máy thao tác cùng một bàn.
 * Chạy sau main-flow nên mở một ca mới cho cùng thu ngân.
 */
test.describe.serial("Kịch bản lỗi và đồng thời", () => {
  const ctx = getE2eContext();
  let cashier: APIRequestContext;
  let secondTerminal: APIRequestContext;
  let manager: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    cashier = await loginAs(playwright, ctx.cashierUsername);
    secondTerminal = await loginAs(playwright, ctx.waiterUsername);
    manager = await loginAs(playwright, ctx.managerUsername);
    await openShift(cashier, 500_000);
  });

  test.afterAll(async () => {
    await cashier.dispose();
    await secondTerminal.dispose();
    await manager.dispose();
  });

  test("mất Internet: vẫn bán, thu tiền mặt, in lỗi không chặn; sự kiện đồng bộ xếp hàng chờ", async () => {
    const before = await json(await cashier.get("/api/v1/sync/status"));
    const order = await createOrderWithItems(cashier, { tableId: ctx.tableBId, menuItemId: ctx.menuItemId, quantity: 1 });

    const sent = await cashier.post(`/api/v1/orders/${order.id}/send-kitchen`, { data: { expectedVersion: order.version } });
    expect(sent.status(), "máy in không kết nối vẫn trả 200").toBe(200);

    const latest = await getOrder(cashier, order.id);
    const paid = await payCash(cashier, latest, latest.finalAmount);
    expect(paid.status()).toBe(200);

    // Đích đồng bộ không tồn tại: sự kiện hóa đơn nằm trong hàng đợi, không làm hỏng thanh toán.
    const after = await json(await cashier.get("/api/v1/sync/status"));
    expect(after.data.pending).toBeGreaterThan(before.data.pending);

    // Worker chạy khi không có mạng: sự kiện vẫn còn chờ (không bị đánh dấu lỗi vĩnh viễn).
    const run = await manager.post("/api/v1/sync/run");
    expect(run.status()).toBe(200);
    const afterRun = await json(await cashier.get("/api/v1/sync/status"));
    expect(afterRun.data.pending).toBeGreaterThan(0);
    expect(afterRun.data.failed).toBe(0);
  });

  test("hai máy cùng một bàn: máy thứ hai không tạo được đơn trùng", async () => {
    const first = await cashier.post("/api/v1/orders", { data: { tableId: ctx.tableAId } });
    expect(first.status()).toBeLessThan(300);

    const second = await secondTerminal.post("/api/v1/orders", { data: { tableId: ctx.tableAId } });
    expect([400, 409]).toContain(second.status());
  });

  test("hai máy sửa cùng một đơn: phiên bản cũ bị 409 và không ghi đè", async () => {
    const order = await createOrderWithItems(cashier, { takeaway: true, menuItemId: ctx.menuItemId, quantity: 1 });
    const stale = order.version;

    const firstEdit = await cashier.post(`/api/v1/orders/${order.id}/items`, {
      data: { menuItemId: ctx.menuItemId, quantity: 1, expectedVersion: stale },
    });
    expect(firstEdit.status()).toBe(200);

    const staleEdit = await cashier.post(`/api/v1/orders/${order.id}/items`, {
      data: { menuItemId: ctx.menuItemId, quantity: 1, expectedVersion: stale },
    });
    expect(staleEdit.status()).toBe(409);
  });

  test("F5 giữa chừng: xem lại đơn đã thanh toán rồi thanh toán lại không tạo thêm tiền", async () => {
    const order = await createOrderWithItems(cashier, { takeaway: true, menuItemId: ctx.menuItemId, quantity: 1 });
    expect((await payCash(cashier, order, order.finalAmount)).status()).toBe(200);

    const reloaded = await getOrder(cashier, order.id);
    expect(reloaded.status).toBe("DA_THANH_TOAN");
    expect((await payCash(cashier, order, order.finalAmount)).status()).toBe(409);
  });
});
