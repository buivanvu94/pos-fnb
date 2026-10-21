import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as createItemHandler, GET as getItemsHandler, PATCH as updateItemHandler } from "@/app/api/v1/menu/items/route";
import { PATCH as patchAvailabilityHandler } from "@/app/api/v1/menu/items/[id]/availability/route";
import { createCategory } from "@/server/menu/menu-service";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { ERROR_CATALOG } from "@/lib/error-catalog";

describe("Menu Items API Tests (US-12, FR-15, BR-14, ERR-12)", () => {
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
    const cashierToken = await signAuthToken({
      userId: 2,
      username: "thungan",
      fullName: "Thu Ngân",
      role: "THU_NGAN",
    });
    return { managerToken, waiterToken, cashierToken };
  };

  it("blocks unauthenticated requests with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/menu/items", {
      method: "POST",
      body: JSON.stringify({ name: "Cà phê", price: 25000, categoryId: 1 }),
    });
    const res = await createItemHandler(req);
    expect(res.status).toBe(401);
  });

  it("blocks PHUC_VU and THU_NGAN from creating menu items with 403", async () => {
    const { waiterToken, cashierToken } = await getTokens();

    const waiterReq = new NextRequest("http://localhost:3000/api/v1/menu/items", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Trà đào", price: 30000, categoryId: 1 }),
    });
    const waiterRes = await createItemHandler(waiterReq);
    expect(waiterRes.status).toBe(403);

    const cashierReq = new NextRequest("http://localhost:3000/api/v1/menu/items", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${cashierToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Trà đào", price: 30000, categoryId: 1 }),
    });
    const cashierRes = await createItemHandler(cashierReq);
    expect(cashierRes.status).toBe(403);
  });

  it("rejects negative price with 400 and returns exact ERR-12 message", async () => {
    const { managerToken } = await getTokens();
    const req = new NextRequest("http://localhost:3000/api/v1/menu/items", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Món Giá Âm",
        price: -10000,
        categoryId: 1,
      }),
    });

    const res = await createItemHandler(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe(ERROR_CATALOG.ERR_12.message);
  });

  it("rejects empty item name with 400", async () => {
    const { managerToken } = await getTokens();
    const req = new NextRequest("http://localhost:3000/api/v1/menu/items", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "   ",
        price: 35000,
        categoryId: 1,
      }),
    });

    const res = await createItemHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toContain("Tên món ăn không được để trống");
  });

  it("allows QUAN_LY to create an item, then toggles availability to HET_HANG and verifies via GET", async () => {
    const { managerToken, waiterToken } = await getTokens();

    // 0. Ensure dynamic test category exists
    const testCategory = await createCategory({
      name: "Trà sữa Test",
      code: `CAT-TS-${Date.now().toString().slice(-4)}`,
    });

    // 1. Create item as QUAN_LY
    const createReq = new NextRequest("http://localhost:3000/api/v1/menu/items", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Trà sữa matcha test",
        price: 45000,
        categoryId: testCategory.id,
        unit: "Ly",
        status: "DANG_BAN",
      }),
    });
    const createRes = await createItemHandler(createReq);
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.ok).toBe(true);
    expect(created.data.status).toBe("DANG_BAN");
    const itemId = created.data.id;

    // 2. Toggle availability to HET_HANG (AC-12-1)
    const patchReq = new NextRequest(
      `http://localhost:3000/api/v1/menu/items/${itemId}/availability`,
      {
        method: "PATCH",
        headers: {
          Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "HET_HANG" }),
      },
    );
    const patchRes = await patchAvailabilityHandler(patchReq, {
      params: Promise.resolve({ id: String(itemId) }),
    });
    expect(patchRes.status).toBe(200);
    const patchData = await patchRes.json();
    expect(patchData.ok).toBe(true);
    expect(patchData.data.status).toBe("HET_HANG");

    // 3. Phục vụ queries GET /api/v1/menu/items and sees HET_HANG
    const getReq = new NextRequest("http://localhost:3000/api/v1/menu/items", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });
    const getRes = await getItemsHandler(getReq);
    expect(getRes.status).toBe(200);
    const itemsData = await getRes.json();
    const fetchedItem = itemsData.data.find((i: { id: number }) => i.id === itemId);
    expect(fetchedItem).toBeDefined();
    expect(fetchedItem.status).toBe("HET_HANG");
  });

  it("rejects negative price on PATCH update with 400 and ERR-12", async () => {
    const { managerToken } = await getTokens();
    const req = new NextRequest("http://localhost:3000/api/v1/menu/items", {
      method: "PATCH",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: 1,
        price: -5000,
      }),
    });

    const res = await updateItemHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe(ERROR_CATALOG.ERR_12.message);
  });
});
