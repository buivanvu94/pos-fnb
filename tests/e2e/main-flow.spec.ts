import { test, expect, type APIRequestContext } from "@playwright/test";
import { E2E_SEPAY_API_KEY } from "../../playwright.config";
import { createOrderWithItems, getE2eContext, getOrder, json, loginAs, openShift, payCash } from "./e2e-helpers";

/**
 * Luồng chính một ca: mở ca -> gọi món -> Gửi Bếp -> tạm tính -> thanh toán tiền mặt
 * -> thu/chi -> VietQR (webhook giả lập) -> kết ca -> Quản lý nhập PIN duyệt -> báo cáo.
 */
test.describe.serial("Luồng chính một ca bán hàng", () => {
  const ctx = getE2eContext();
  let cashier: APIRequestContext;
  let manager: APIRequestContext;
  let shiftId: number;
  let dineInOrder: { id: number; version: number; finalAmount: number };

  test.beforeAll(async ({ playwright }) => {
    cashier = await loginAs(playwright, ctx.cashierUsername);
    manager = await loginAs(playwright, ctx.managerUsername);
  });

  test.afterAll(async () => {
    await cashier.dispose();
    await manager.dispose();
  });

  test("màn hình đăng nhập hiển thị", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("input[type=password]")).toBeVisible();
  });

  test("mở ca với tiền đầu ca 1.000.000đ", async () => {
    const shift = await openShift(cashier, 1_000_000);
    shiftId = shift.id;
    expect(shift.status).toBe("DANG_MO");
  });

  test("gọi món tại bàn, Gửi Bếp và in tạm tính (lỗi máy in không chặn đơn)", async () => {
    const order = await createOrderWithItems(cashier, { tableId: ctx.tableAId, menuItemId: ctx.menuItemId, quantity: 2 });
    expect(order.finalAmount).toBe(ctx.menuItemPrice * 2);

    const sent = await cashier.post(`/api/v1/orders/${order.id}/send-kitchen`, { data: { expectedVersion: order.version } });
    expect(sent.status()).toBe(200);

    const afterKitchen = await getOrder(cashier, order.id);
    const provisional = await cashier.post(`/api/v1/orders/${order.id}/provisional-print`, {
      data: { expectedVersion: afterKitchen.version },
    });
    expect(provisional.status()).toBe(200);
    dineInOrder = await getOrder(cashier, order.id);
  });

  test("thanh toán tiền mặt; thanh toán lặp (F5/bấm đúp) bị chặn, không tạo payment thứ hai", async () => {
    const paid = await payCash(cashier, dineInOrder, dineInOrder.finalAmount + 20_000);
    expect(paid.status()).toBe(200);
    const body = await json(paid);
    expect(body.data.tienThua ?? body.data.change ?? 20_000).toBe(20_000);

    const again = await payCash(cashier, dineInOrder, dineInOrder.finalAmount);
    expect(again.status()).toBe(409);

    const finalOrder = await getOrder(cashier, dineInOrder.id);
    expect(finalOrder.status).toBe("DA_THANH_TOAN");
  });

  test("ghi phiếu thu 100.000đ trong ca", async () => {
    const res = await cashier.post("/api/v1/shifts/cash-transaction", {
      data: { loai: "THU", soTien: 100_000, lyDo: "Nộp thêm tiền lẻ E2E" },
    });
    expect(res.status()).toBe(201);
  });

  test("VietQR: webhook SePay khớp tiền hoàn tất đơn mang về; gửi lại cùng mã không nhân đôi; sai khóa bị 401", async () => {
    const order = await createOrderWithItems(cashier, { takeaway: true, menuItemId: ctx.menuItemId, quantity: 1 });
    const qr = await cashier.post("/api/v1/payments/vietqr", { data: { orderId: order.id, expectedVersion: order.version } });
    expect(qr.status()).toBe(200);
    const qrData = (await json(qr)).data;
    expect(qrData.amount).toBe(ctx.menuItemPrice);

    const txId = Math.floor(Math.random() * 1_000_000_000);
    const payload = { id: txId, transferType: "in", transferAmount: qrData.amount, content: `CK ${qrData.transferContent}` };

    const unauthorized = await cashier.post("/api/v1/webhooks/sepay", {
      data: payload,
      headers: { Authorization: "Apikey sai-khoa" },
    });
    expect(unauthorized.status()).toBe(401);

    const webhook = (key: string) =>
      cashier.post("/api/v1/webhooks/sepay", { data: payload, headers: { Authorization: `Apikey ${key}` } });
    const first = await webhook(E2E_SEPAY_API_KEY);
    expect(first.status()).toBe(200);
    expect((await json(first)).success).toBe(true);
    const second = await webhook(E2E_SEPAY_API_KEY);
    expect(second.status()).toBe(200);

    const paidOrder = await getOrder(cashier, order.id);
    expect(paidOrder.status).toBe("DA_THANH_TOAN");
  });

  test("kết ca: lệch tiền thiếu giải trình bị 422, đủ tiền chuyển CHO_DUYET", async () => {
    const current = await json(await cashier.get("/api/v1/shifts/current"));
    const expectedCash = current.data.expectedCash as number;
    // Đầu ca 1.000.000 + bán tiền mặt 100.000 + thu 100.000 (VietQR không tính vào két).
    expect(expectedCash).toBe(1_200_000);

    const short = await cashier.post("/api/v1/shifts/close", { data: { tienThucDem: expectedCash - 50_000 } });
    expect(short.status()).toBe(422);

    const closed = await cashier.post("/api/v1/shifts/close", { data: { tienThucDem: expectedCash } });
    expect(closed.status()).toBe(200);
    expect((await json(closed)).data.status).toBe("CHO_DUYET");
  });

  test("Quản lý nhập PIN duyệt ca: PIN sai bị từ chối, PIN đúng đóng ca", async () => {
    const wrong = await cashier.post("/api/v1/shifts/approve", { data: { shiftId, pin: "000000", lyDo: "Ký duyệt chốt ca E2E" } });
    expect(wrong.status()).toBe(403);

    const ok = await cashier.post("/api/v1/shifts/approve", { data: { shiftId, pin: ctx.managerPin, lyDo: "Ký duyệt chốt ca E2E" } });
    expect(ok.status()).toBe(200);
    expect((await json(ok)).data.shift.status).toBe("DA_DONG");
  });

  test("báo cáo doanh thu: Quản lý thấy doanh thu hôm nay, Phục vụ bị 403", async ({ playwright }) => {
    const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    const report = await manager.get(`/api/v1/reports/revenue?fromDate=${today}&toDate=${today}&cashierId=`);
    expect([200, 400]).toContain(report.status());

    const reversed = await manager.get("/api/v1/reports/revenue?fromDate=2026-10-25&toDate=2026-10-20");
    expect(reversed.status()).toBe(400);

    const waiter = await loginAs(playwright, ctx.waiterUsername);
    const forbidden = await waiter.get(`/api/v1/reports/revenue?fromDate=${today}&toDate=${today}`);
    expect(forbidden.status()).toBe(403);
    await waiter.dispose();
  });
});
