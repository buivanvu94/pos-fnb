import { expect, type APIRequestContext, type APIResponse, type PlaywrightWorkerArgs } from "@playwright/test";
import type { E2eContext } from "./global-setup";

export const BASE_URL = "http://localhost:3100";

export function getE2eContext(): E2eContext {
  const raw = process.env.E2E_CONTEXT;
  if (!raw) throw new Error("E2E_CONTEXT chưa được global-setup khởi tạo");
  return JSON.parse(raw) as E2eContext;
}

/** Tạo một "máy POS": phiên API riêng đã đăng nhập (cookie httpOnly nằm trong context). */
export async function loginAs(playwright: PlaywrightWorkerArgs["playwright"], username: string): Promise<APIRequestContext> {
  const ctx = getE2eContext();
  const api = await playwright.request.newContext({ baseURL: BASE_URL });
  const res = await api.post("/api/v1/auth/login", { data: { username, password: ctx.password } });
  expect(res.status(), `đăng nhập ${username}`).toBe(200);
  return api;
}

export async function json(res: APIResponse): Promise<any> {
  return res.json();
}

export async function getOrder(api: APIRequestContext, orderId: number) {
  const res = await api.get(`/api/v1/orders/${orderId}`);
  expect(res.status()).toBe(200);
  return (await json(res)).data;
}

export async function openShift(api: APIRequestContext, tienDauCa = 1_000_000) {
  const res = await api.post("/api/v1/shifts/open", { data: { tienDauCa } });
  expect(res.status(), "mở ca").toBe(201);
  return (await json(res)).data;
}

/** Tạo đơn (tại bàn hoặc mang về) rồi thêm món, trả về đơn mới nhất kèm version. */
export async function createOrderWithItems(
  api: APIRequestContext,
  opts: { tableId?: number; takeaway?: boolean; menuItemId: number; quantity: number },
) {
  const created = await api.post("/api/v1/orders", {
    data: opts.takeaway ? { orderType: "MANG_VE" } : { tableId: opts.tableId },
  });
  expect(created.status(), "tạo đơn").toBeLessThan(300);
  const orderId = (await json(created)).data.id as number;
  let order = await getOrder(api, orderId);
  const added = await api.post(`/api/v1/orders/${orderId}/items`, {
    data: { menuItemId: opts.menuItemId, quantity: opts.quantity, expectedVersion: order.version },
  });
  expect(added.status(), "thêm món").toBe(200);
  order = await getOrder(api, orderId);
  return order;
}

export async function payCash(api: APIRequestContext, order: { id: number; version: number; finalAmount: number }, tienKhachDua: number) {
  return api.post("/api/v1/payments/cash", {
    data: { orderId: order.id, tienKhachDua, expectedVersion: order.version },
  });
}
