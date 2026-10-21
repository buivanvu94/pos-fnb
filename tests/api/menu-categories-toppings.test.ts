import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as getCategoriesHandler, POST as createCategoryHandler } from "@/app/api/v1/menu/categories/route";
import { GET as getToppingsHandler, POST as createToppingHandler } from "@/app/api/v1/menu/toppings/route";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { seedMenuFromCsv } from "../../scripts/seed-menu";
import { getTestDbUrl } from "../setup/test-config";

describe("Menu Categories, Toppings & CSV Idempotency Tests", () => {
  const getTokens = async () => {
    const managerToken = await signAuthToken({
      userId: 1,
      username: "quanly",
      fullName: "Quản Lý",
      role: "QUAN_LY",
    });
    const waiterToken = await signAuthToken({
      userId: 3,
      username: "phucvu",
      fullName: "Phục Vụ",
      role: "PHUC_VU",
    });
    return { managerToken, waiterToken };
  };

  it("handles category authorization and validation correctly", async () => {
    const { managerToken, waiterToken } = await getTokens();

    // 1. Phục vụ GET categories -> 200
    const getReq = new NextRequest("http://localhost:3000/api/v1/menu/categories", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });
    const getRes = await getCategoriesHandler(getReq);
    expect(getRes.status).toBe(200);

    // 2. Phục vụ POST category -> 403
    const waiterPostReq = new NextRequest("http://localhost:3000/api/v1/menu/categories", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Danh mục thử" }),
    });
    expect((await createCategoryHandler(waiterPostReq)).status).toBe(403);

    // 3. Quản lý creates category -> 201
    const randCode = `CAT-TEST-${Date.now().toString().slice(-4)}`;
    const mgrPostReq = new NextRequest("http://localhost:3000/api/v1/menu/categories", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Nước ép tươi", code: randCode }),
    });
    const mgrRes = await createCategoryHandler(mgrPostReq);
    expect(mgrRes.status).toBe(201);
  });

  it("handles topping authorization and validation correctly", async () => {
    const { managerToken, waiterToken } = await getTokens();

    // 1. Phục vụ GET toppings -> 200
    const getReq = new NextRequest("http://localhost:3000/api/v1/menu/toppings", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });
    expect((await getToppingsHandler(getReq)).status).toBe(200);

    // 2. Phục vụ POST topping -> 403
    const waiterPostReq = new NextRequest("http://localhost:3000/api/v1/menu/toppings", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Thạch dừa", price: 5000 }),
    });
    expect((await createToppingHandler(waiterPostReq)).status).toBe(403);

    // 3. Quản lý creates topping -> 201
    const mgrPostReq = new NextRequest("http://localhost:3000/api/v1/menu/toppings", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Trân châu đường đen", price: 10000 }),
    });
    expect((await createToppingHandler(mgrPostReq)).status).toBe(201);
  });

  it("runs CSV seed idempotently without duplicating menu records", async () => {
    const testDbUrl = getTestDbUrl();
    const tag = Date.now().toString().slice(-6);
    const csvContent = `nhóm,tên món,đơn giá,đơn vị tính,trạng thái
Cà phê Ý ${tag},Espresso Đậm ${tag},35000,Ly,Đang bán
Cà phê Ý ${tag},Cappuccino Nóng ${tag},45000,Ly,Đang bán
Bánh ngọt ${tag},Croissant Bơ Pháp ${tag},30000,Cái,Đang bán`;

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
