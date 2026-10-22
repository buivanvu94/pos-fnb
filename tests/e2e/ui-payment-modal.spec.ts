import { test, expect } from "@playwright/test";
import { createOrderWithItems, getE2eContext, getOrder, json, openShift } from "./e2e-helpers";

/**
 * Thanh toán bằng giao diện: bấm "Thanh toán" ở màn bàn mở modal (không đổi URL),
 * trả tiền mặt xong quay về sơ đồ bàn. Chạy sau resilience nên thu ngân đã có ca mở.
 */
test("màn bàn: Thanh toán mở modal, trả tiền mặt không chuyển trang", async ({ page }) => {
  const ctx = getE2eContext();
  const login = await page.request.post("/api/v1/auth/login", {
    data: { username: ctx.cashierUsername, password: ctx.password },
  });
  expect(login.status()).toBe(200);

  const current = await json(await page.request.get("/api/v1/shifts/current"));
  if (!current.data) await openShift(page.request, 500_000);

  const order = await createOrderWithItems(page.request, {
    tableId: ctx.tableBId,
    menuItemId: ctx.menuItemId,
    quantity: 1,
  });

  await page.goto("/tables");
  // Nhiều khu vực khiến tab bị cuộn ra ngoài khung nhìn: kích hoạt tab trực tiếp trên DOM
  await page.getByRole("tab", { name: new RegExp(`Khu E2E ${ctx.tag}`) }).evaluate((el) => (el as HTMLElement).click());
  await page.getByText(`Bàn E2E B ${ctx.tag}`).first().click();
  await page.getByRole("button", { name: "Thanh toán" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Thanh toán hóa đơn")).toBeVisible();
  await expect(page).toHaveURL(/\/tables$/);

  await dialog.getByRole("button", { name: "Hoàn tất thanh toán" }).click();
  await expect(dialog.getByText("Thanh toán thành công!")).toBeVisible({ timeout: 20_000 });

  await dialog.getByRole("button", { name: "Quay về sơ đồ bàn" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/tables$/);
  expect((await getOrder(page.request, order.id)).status).toBe("DA_THANH_TOAN");
});
