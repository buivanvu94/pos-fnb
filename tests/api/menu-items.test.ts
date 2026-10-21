import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as createItemHandler, GET as getItemsHandler, PATCH as updateItemHandler } from "@/app/api/v1/menu/items/route";
import { PATCH as updateItemByIdHandler } from "@/app/api/v1/menu/items/[id]/route";
import { PATCH as patchAvailabilityHandler } from "@/app/api/v1/menu/items/[id]/availability/route";
import { createCategory } from "@/server/menu/menu-service";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";
import { ERROR_CATALOG } from "@/lib/error-catalog";

describe("Menu Items API Tests (US-12, FR-15, BR-14, ERR-12)", () => {
  const getTokens = async () => {
    const managerToken = await signAuthToken({ userId: 1, username: "quanly", fullName: "Quản Lý", role: "QUAN_LY" });
    const waiterToken = await signAuthToken({ userId: 3, username: "phucvu", fullName: "Phục Vụ", role: "PHUC_VU" });
    const cashierToken = await signAuthToken({ userId: 2, username: "thungan", fullName: "Thu Ngân", role: "THU_NGAN" });
    return { managerToken, waiterToken, cashierToken };
  };

  it("blocks unauthenticated requests with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/menu/items", {
      method: "POST",
      body: JSON.stringify({ name: "Cà phê", price: 25000, categoryId: 1 }),
    });
    expect((await createItemHandler(req)).status).toBe(401);
  });

  it("blocks PHUC_VU and THU_NGAN with 403 on ALL write routes", async () => {
    const { waiterToken, cashierToken } = await getTokens();
    const staffTokens = [waiterToken, cashierToken];

    for (const token of staffTokens) {
      const headers = { Cookie: `${AUTH_COOKIE_NAME}=${token}`, "Content-Type": "application/json" };

      // 1. POST items
      const postReq = new NextRequest("http://localhost:3000/api/v1/menu/items", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "Trà", price: 20000, categoryId: 1 }),
      });
      expect((await createItemHandler(postReq)).status).toBe(403);

      // 2. PATCH items
      const patchReq = new NextRequest("http://localhost:3000/api/v1/menu/items", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: 1, name: "Trà sửa" }),
      });
      expect((await updateItemHandler(patchReq)).status).toBe(403);

      // 3. PATCH items/[id]
      const patchIdReq = new NextRequest("http://localhost:3000/api/v1/menu/items/1", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: "Trà sửa" }),
      });
      expect((await updateItemByIdHandler(patchIdReq, { params: Promise.resolve({ id: "1" }) })).status).toBe(403);

      // 4. PATCH availability
      const availReq = new NextRequest("http://localhost:3000/api/v1/menu/items/1/availability", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "HET_HANG" }),
      });
      expect((await patchAvailabilityHandler(availReq, { params: Promise.resolve({ id: "1" }) })).status).toBe(403);
    }
  });

  it("rejects negative price and prices exceeding 2,000,000,000 cap", async () => {
    const { managerToken } = await getTokens();
    const headers = { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" };

    // Negative price -> ERR-12
    const negReq = new NextRequest("http://localhost:3000/api/v1/menu/items", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Món Giá Âm", price: -10000, categoryId: 1 }),
    });
    const negRes = await createItemHandler(negReq);
    expect(negRes.status).toBe(400);
    expect((await negRes.json()).error).toBe(ERROR_CATALOG.ERR_12.message);

    // Exceeding 2 billion
    const bigReq = new NextRequest("http://localhost:3000/api/v1/menu/items", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Món Giá Quá Cao", price: 3_000_000_000, categoryId: 1 }),
    });
    const bigRes = await createItemHandler(bigReq);
    expect(bigRes.status).toBe(400);
    expect((await bigRes.json()).error).toContain("2.000.000.000 VNĐ");
  });

  it("handles malformed JSON and invalid IDs with 400 instead of 500", async () => {
    const { managerToken } = await getTokens();
    const headers = { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" };

    // Malformed JSON on POST
    const badJsonReq = new NextRequest("http://localhost:3000/api/v1/menu/items", {
      method: "POST",
      headers,
      body: "{ bad json",
    });
    expect((await createItemHandler(badJsonReq)).status).toBe(400);

    // Non-numeric ID on availability
    const badIdReq = new NextRequest("http://localhost:3000/api/v1/menu/items/abc/availability", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "HET_HANG" }),
    });
    expect((await patchAvailabilityHandler(badIdReq, { params: Promise.resolve({ id: "abc" }) })).status).toBe(400);

    // Invalid status on availability
    const badStatusReq = new NextRequest("http://localhost:3000/api/v1/menu/items/1/availability", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "TAM_DUNG" }),
    });
    expect((await patchAvailabilityHandler(badStatusReq, { params: Promise.resolve({ id: "1" }) })).status).toBe(400);

    // Invalid categoryId in GET items
    const badCatGetReq = new NextRequest("http://localhost:3000/api/v1/menu/items?categoryId=abc", { headers });
    expect((await getItemsHandler(badCatGetReq)).status).toBe(400);
  });

  it("rejects invalid or unsafe image URLs", async () => {
    const { managerToken } = await getTokens();
    const headers = { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" };

    const unsafeReq = new NextRequest("http://localhost:3000/api/v1/menu/items", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Món XSS",
        price: 20000,
        categoryId: 1,
        imageUrl: "javascript:alert(1)",
      }),
    });
    const unsafeRes = await createItemHandler(unsafeReq);
    expect(unsafeRes.status).toBe(400);
    expect((await unsafeRes.json()).error).toContain("Đường dẫn ảnh không hợp lệ");
  });

  it("allows QUAN_LY to create an item, toggles availability to HET_HANG and verifies via GET", async () => {
    const { managerToken, waiterToken } = await getTokens();
    const testCategory = await createCategory({
      name: `Trà sữa Test ${Date.now().toString().slice(-4)}`,
      code: `CAT-TS-${Date.now().toString().slice(-4)}`,
    });
    expect(testCategory).toBeDefined();

    const createReq = new NextRequest("http://localhost:3000/api/v1/menu/items", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Trà sữa matcha test",
        price: 45000,
        categoryId: testCategory!.id,
        unit: "Ly",
        status: "DANG_BAN",
      }),
    });
    const createRes = await createItemHandler(createReq);
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    const itemId = created.data.id;

    // Toggle availability to HET_HANG
    const patchReq = new NextRequest(`http://localhost:3000/api/v1/menu/items/${itemId}/availability`, {
      method: "PATCH",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "HET_HANG" }),
    });
    const patchRes = await patchAvailabilityHandler(patchReq, { params: Promise.resolve({ id: String(itemId) }) });
    expect(patchRes.status).toBe(200);

    // Phục vụ queries GET and sees HET_HANG
    const getReq = new NextRequest("http://localhost:3000/api/v1/menu/items", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });
    const getRes = await getItemsHandler(getReq);
    expect(getRes.status).toBe(200);
    const itemsData = await getRes.json();
    const fetched = itemsData.data.find((i: { id: number }) => i.id === itemId);
    expect(fetched?.status).toBe("HET_HANG");
  });
});
