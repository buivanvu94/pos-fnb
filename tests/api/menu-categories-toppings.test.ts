import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as getCategoriesHandler, POST as createCategoryHandler } from "@/app/api/v1/menu/categories/route";
import { GET as getToppingsHandler, POST as createToppingHandler } from "@/app/api/v1/menu/toppings/route";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { seedMenuFromCsv } from "../../scripts/seed-menu";
import { getTestDbUrl } from "../setup/test-config";

describe("Menu Categories, Toppings & CSV Idempotency Tests", () => {
  const getTokens = async () => {
    const managerToken = await signAuthToken({ userId: 1, username: "quanly", fullName: "Quản Lý", role: "QUAN_LY" });
    const waiterToken = await signAuthToken({ userId: 3, username: "phucvu", fullName: "Phục Vụ", role: "PHUC_VU" });
    const cashierToken = await signAuthToken({ userId: 2, username: "thungan", fullName: "Thu Ngân", role: "THU_NGAN" });
    return { managerToken, waiterToken, cashierToken };
  };

  it("handles category authorization and validation correctly", async () => {
    const { managerToken, waiterToken, cashierToken } = await getTokens();

    // 1. Phục vụ GET categories -> 200
    const getReq = new NextRequest("http://localhost:3000/api/v1/menu/categories", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });
    expect((await getCategoriesHandler(getReq)).status).toBe(200);

    // 2. Phục vụ and Thu ngân POST category -> 403
    for (const token of [waiterToken, cashierToken]) {
      const staffPostReq = new NextRequest("http://localhost:3000/api/v1/menu/categories", {
        method: "POST",
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Danh mục thử" }),
      });
      expect((await createCategoryHandler(staffPostReq)).status).toBe(403);
    }

    // 3. Validation: empty name and malformed JSON -> 400
    const emptyNameReq = new NextRequest("http://localhost:3000/api/v1/menu/categories", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "   " }),
    });
    expect((await createCategoryHandler(emptyNameReq)).status).toBe(400);

    const badJsonReq = new NextRequest("http://localhost:3000/api/v1/menu/categories", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" },
      body: "{ not json",
    });
    expect((await createCategoryHandler(badJsonReq)).status).toBe(400);

    // 4. Quản lý creates category -> 201
    const randCode = `CAT-${Date.now().toString().slice(-4)}`;
    const mgrPostReq = new NextRequest("http://localhost:3000/api/v1/menu/categories", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Nước ép tươi", code: randCode }),
    });
    expect((await createCategoryHandler(mgrPostReq)).status).toBe(201);
  });

  it("handles topping authorization and validation correctly", async () => {
    const { managerToken, waiterToken, cashierToken } = await getTokens();

    // 1. Phục vụ GET toppings -> 200
    const getReq = new NextRequest("http://localhost:3000/api/v1/menu/toppings", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });
    expect((await getToppingsHandler(getReq)).status).toBe(200);

    // 2. Phục vụ and Thu ngân POST topping -> 403
    for (const token of [waiterToken, cashierToken]) {
      const staffPostReq = new NextRequest("http://localhost:3000/api/v1/menu/toppings", {
        method: "POST",
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Thạch dừa", price: 5000 }),
      });
      expect((await createToppingHandler(staffPostReq)).status).toBe(403);
    }

    // 3. Validation: negative price, exceeding cap (> 2 tỷ), malformed JSON -> 400
    const negPriceReq = new NextRequest("http://localhost:3000/api/v1/menu/toppings", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Thạch âm", price: -5000 }),
    });
    expect((await createToppingHandler(negPriceReq)).status).toBe(400);

    const bigPriceReq = new NextRequest("http://localhost:3000/api/v1/menu/toppings", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Topping vàng", price: 3_000_000_000 }),
    });
    expect((await createToppingHandler(bigPriceReq)).status).toBe(400);

    const badJsonReq = new NextRequest("http://localhost:3000/api/v1/menu/toppings", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" },
      body: "invalid",
    });
    expect((await createToppingHandler(badJsonReq)).status).toBe(400);

    // 4. Quản lý creates topping -> 201
    const mgrPostReq = new NextRequest("http://localhost:3000/api/v1/menu/toppings", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Trân châu ${Date.now().toString().slice(-4)}`, price: 10000 }),
    });
    expect((await createToppingHandler(mgrPostReq)).status).toBe(201);
  });

  it("runs CSV seed idempotently inside transaction without duplicating menu records", async () => {
    const testDbUrl = getTestDbUrl();
    const tag = Date.now().toString().slice(-6);
    const csvContent = `nhóm,tên món,đơn giá,đơn vị tính,trạng thái
Cà phê Ý ${tag},Espresso Đậm ${tag},35000,Ly,Đang bán
Cà phê Ý ${tag},Cappuccino Nóng ${tag},"45.000",Ly,Đang bán
Bánh ngọt ${tag},Croissant Bơ Pháp ${tag},"30,000",Cái,Hết hàng`;

    // First run: all 3 items inserted
    const run1 = await seedMenuFromCsv(csvContent, {
      isContent: true,
      connectionString: testDbUrl,
      silent: true,
    });
    expect(run1.errors).toHaveLength(0);
    expect(run1.inserted).toBe(3);
    expect(run1.updated).toBe(0);

    // Second run: 0 inserted, all 3 updated (idempotent)
    const run2 = await seedMenuFromCsv(csvContent, {
      isContent: true,
      connectionString: testDbUrl,
      silent: true,
    });
    expect(run2.errors).toHaveLength(0);
    expect(run2.inserted).toBe(0);
    expect(run2.updated).toBe(3);
  });
});
